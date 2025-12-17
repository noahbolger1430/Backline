from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_band_or_404, get_venue_or_404
from app.database import get_db
from app.schemas.venue_availability import VenueAvailableDates, VenueEffectiveAvailabilityRange
from app.services.availability_service import AvailabilityService
from app.utils.exceptions import InvalidDateRangeException

router = APIRouter()


@router.get("/{venue_id}/availability", response_model=VenueEffectiveAvailabilityRange)
def get_venue_availability(
    venue_id: int,
    start_date: date = Query(..., description="Start date for availability range"),
    end_date: date = Query(..., description="End date for availability range"),
    band_id: Optional[int] = Query(None, description="Optional band ID to cross-reference availability"),
    db: Session = Depends(get_db),
) -> VenueEffectiveAvailabilityRange:
    """
    Get venue availability for a date range.

    Optionally filter by band availability to show only dates where both
    the venue and band are available. This is useful for bands searching
    for venues where they can perform.

    The response includes detailed availability information for each date:
    - Whether the date is available
    - Reason for unavailability if applicable
    - Operating hours for the day
    - Any scheduled events
    - Explicit availability blocks
    """
    if end_date < start_date:
        raise InvalidDateRangeException()

    venue = get_venue_or_404(venue_id, db)

    venue_availability = AvailabilityService.get_venue_availability_range(db, venue, start_date, end_date)

    if band_id is not None:
        band = get_band_or_404(band_id, db)
        venue_availability = AvailabilityService.filter_venue_availability_by_band(db, venue_availability, band)

    return VenueEffectiveAvailabilityRange(
        venue_id=venue.id,
        venue_name=venue.name,
        start_date=start_date,
        end_date=end_date,
        availability=venue_availability,
    )


@router.get("/{venue_id}/available-dates", response_model=VenueAvailableDates)
def get_venue_available_dates(
    venue_id: int,
    start_date: date = Query(..., description="Start date for availability range"),
    end_date: date = Query(..., description="End date for availability range"),
    band_id: Optional[int] = Query(None, description="Optional band ID to cross-reference availability"),
    db: Session = Depends(get_db),
) -> VenueAvailableDates:
    """
    Get a simplified list of available dates for a venue.

    Returns only the dates when the venue is available for booking,
    without detailed information about operating hours or events.
    Useful for quick lookups and calendar displays.

    Optionally filter by band availability to show only mutually available dates.
    """
    if end_date < start_date:
        raise InvalidDateRangeException()

    venue = get_venue_or_404(venue_id, db)

    venue_availability = AvailabilityService.get_venue_availability_range(db, venue, start_date, end_date)

    if band_id is not None:
        band = get_band_or_404(band_id, db)
        venue_availability = AvailabilityService.filter_venue_availability_by_band(db, venue_availability, band)

    available_dates = [availability.date for availability in venue_availability if availability.is_available]

    return VenueAvailableDates(venue_id=venue.id, venue_name=venue.name, available_dates=available_dates)

