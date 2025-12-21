from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    check_band_permission,
    check_venue_permission,
    get_band_or_404,
    get_current_active_user,
    get_venue_or_404,
)
from app.database import get_db
from app.models import (
    BandAvailability,
    BandMember,
    BandMemberAvailability,
    BandRole,
    DayOfWeek,
    User,
    VenueAvailability,
    VenueRole,
)
from app.schemas.availability import (
    BandAvailabilityBulkCreate,
    BandAvailabilityCreate,
    BandAvailabilityResponse,
    BandEffectiveAvailability,
    BandEffectiveAvailabilityRange,
    BandMemberAvailabilityBulkCreate,
    BandMemberAvailabilityCreate,
    BandMemberAvailabilityResponse,
)
from app.schemas.venue_availability import (
    VenueAvailabilityBulkCreate,
    VenueAvailabilityBulkCreateByDayOfWeek,
    VenueAvailabilityCreate,
    VenueAvailabilityResponse,
)
from app.services.availability_service import AvailabilityService
from app.utils.exceptions import (
    AvailabilityConflictException,
    BandMemberNotFoundException,
    InvalidDateRangeException,
    UnauthorizedBandAccessException,
    VenueAvailabilityConflictException,
)

router = APIRouter()


@router.get(
    "/bands/{band_id}/members/me/availability",
    response_model=List[BandMemberAvailabilityResponse],
)
def get_band_member_availability(
    band_id: int,
    start_date: Optional[date] = Query(None, description="Start date for availability range"),
    end_date: Optional[date] = Query(None, description="End date for availability range"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[BandMemberAvailabilityResponse]:
    """
    Get availability entries for the current user as a band member.
    
    If start_date and end_date are provided, returns availability for that date range.
    Otherwise, returns all availability entries for the user.
    """
    band = get_band_or_404(band_id, db)

    membership = None
    for member in band.members:
        if member.user_id == current_user.id:
            membership = member
            break

    if not membership:
        raise UnauthorizedBandAccessException()

    query = db.query(BandMemberAvailability).filter(
        BandMemberAvailability.band_member_id == membership.id
    )

    if start_date:
        query = query.filter(BandMemberAvailability.date >= start_date)
    if end_date:
        query = query.filter(BandMemberAvailability.date <= end_date)

    availabilities = query.order_by(BandMemberAvailability.date).all()
    return availabilities


@router.get(
    "/bands/{band_id}/availability",
    response_model=BandEffectiveAvailabilityRange,
)
def get_band_availability_range(
    band_id: int,
    start_date: date = Query(..., description="Start date for availability range"),
    end_date: date = Query(..., description="End date for availability range"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> BandEffectiveAvailabilityRange:
    """
    Get effective availability for all band members across a date range.
    
    Returns detailed availability information for each date, including:
    - Which members are unavailable
    - Total counts of available/unavailable/tentative members
    - Member names and details
    """
    if end_date < start_date:
        raise InvalidDateRangeException()
    
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    
    availability_list = []
    current_date = start_date
    
    while current_date <= end_date:
        is_available, member_details = AvailabilityService.get_band_effective_availability(
            db, band, current_date
        )
        
        unavailable_count = sum(1 for m in member_details if m.status.value == "unavailable")
        available_count = sum(1 for m in member_details if m.status.value == "available")
        tentative_count = sum(1 for m in member_details if m.status.value == "tentative")
        
        # Check for explicit band block
        band_block = (
            db.query(BandAvailability)
            .filter(BandAvailability.band_id == band_id, BandAvailability.date == current_date)
            .first()
        )
        
        availability_list.append(
            BandEffectiveAvailability(
                date=current_date,
                is_available=is_available,
                has_explicit_band_block=band_block is not None and band_block.status == "unavailable",
                band_block_note=band_block.note if band_block else None,
                band_event_id=band_block.band_event_id if band_block else None,
                total_members=len(band.members),
                available_members=available_count,
                unavailable_members=unavailable_count,
                tentative_members=tentative_count,
                member_details=member_details,
            )
        )
        
        current_date += timedelta(days=1)
    
    return BandEffectiveAvailabilityRange(
        band_id=band.id,
        band_name=band.name,
        start_date=start_date,
        end_date=end_date,
        availability=availability_list,
    )


@router.post(
    "/bands/{band_id}/members/me/availability",
    response_model=List[BandMemberAvailabilityResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_band_member_availability(
    band_id: int,
    availability_data: BandMemberAvailabilityBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[BandMemberAvailabilityResponse]:
    """
    Create availability entries for the current user as a band member.

    Allows a band member to mark specific dates as unavailable, available, or tentative.
    Multiple dates can be set in a single request.
    """
    band = get_band_or_404(band_id, db)

    membership = None
    for member in band.members:
        if member.user_id == current_user.id:
            membership = member
            break

    if not membership:
        raise UnauthorizedBandAccessException()

    created_entries = []

    for entry_data in availability_data.entries:
        existing = (
            db.query(BandMemberAvailability)
            .filter(
                BandMemberAvailability.band_member_id == membership.id,
                BandMemberAvailability.date == entry_data.date,
            )
            .first()
        )

        if existing:
            existing.status = entry_data.status.value
            existing.note = entry_data.note
            db.add(existing)
            created_entries.append(existing)
        else:
            new_availability = BandMemberAvailability(
                band_member_id=membership.id,
                date=entry_data.date,
                status=entry_data.status.value,
                note=entry_data.note,
            )
            db.add(new_availability)
            created_entries.append(new_availability)

    db.commit()

    for entry in created_entries:
        db.refresh(entry)

    return created_entries


@router.post(
    "/bands/{band_id}/members/me/availability/by-day-of-week",
    response_model=List[BandMemberAvailabilityResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_band_member_availability_by_day_of_week(
    band_id: int,
    start_date: date,
    end_date: date,
    days_of_week: List[DayOfWeek],
    status_value: str = "unavailable",
    note: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[BandMemberAvailabilityResponse]:
    """
    Create availability entries for specific days of the week within a date range.

    Useful for marking recurring unavailability, such as:
    - "I'm unavailable every Monday and Tuesday"
    - "I can't do weekends for the next month"

    This creates individual entries for each matching date in the range.
    """
    band = get_band_or_404(band_id, db)

    membership = None
    for member in band.members:
        if member.user_id == current_user.id:
            membership = member
            break

    if not membership:
        raise UnauthorizedBandAccessException()

    if end_date < start_date:
        from app.utils.exceptions import InvalidDateRangeException

        raise InvalidDateRangeException()

    target_days = [day.value for day in days_of_week]
    created_entries = []
    current_date = start_date

    while current_date <= end_date:
        if current_date.weekday() in target_days:
            existing = (
                db.query(BandMemberAvailability)
                .filter(
                    BandMemberAvailability.band_member_id == membership.id,
                    BandMemberAvailability.date == current_date,
                )
                .first()
            )

            if existing:
                existing.status = status_value
                existing.note = note
                db.add(existing)
                created_entries.append(existing)
            else:
                new_availability = BandMemberAvailability(
                    band_member_id=membership.id,
                    date=current_date,
                    status=status_value,
                    note=note,
                )
                db.add(new_availability)
                created_entries.append(new_availability)

        current_date += timedelta(days=1)

    db.commit()

    for entry in created_entries:
        db.refresh(entry)

    return created_entries


@router.post(
    "/bands/{band_id}/availability",
    response_model=List[BandAvailabilityResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_band_availability(
    band_id: int,
    availability_data: BandAvailabilityBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[BandAvailabilityResponse]:
    """
    Create band-level availability entries.

    Requires OWNER or ADMIN role. Used for band-wide blocks that apply
    regardless of individual member availability (e.g., studio time, hiatus).
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])

    created_entries = []

    for entry_data in availability_data.entries:
        existing = (
            db.query(BandAvailability)
            .filter(
                BandAvailability.band_id == band_id,
                BandAvailability.date == entry_data.date,
            )
            .first()
        )

        if existing:
            existing.status = entry_data.status.value
            existing.note = entry_data.note
            db.add(existing)
            created_entries.append(existing)
        else:
            new_availability = BandAvailability(
                band_id=band_id,
                date=entry_data.date,
                status=entry_data.status.value,
                note=entry_data.note,
            )
            db.add(new_availability)
            created_entries.append(new_availability)

    db.commit()

    for entry in created_entries:
        db.refresh(entry)

    return created_entries


@router.post(
    "/bands/{band_id}/availability/by-day-of-week",
    response_model=List[BandAvailabilityResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_band_availability_by_day_of_week(
    band_id: int,
    start_date: date,
    end_date: date,
    days_of_week: List[DayOfWeek],
    status_value: str = "unavailable",
    note: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[BandAvailabilityResponse]:
    """
    Create band availability entries for specific days of the week within a date range.

    Requires OWNER or ADMIN role. Useful for blocking recurring days when
    the band has standing commitments or cannot perform.
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])

    if end_date < start_date:
        from app.utils.exceptions import InvalidDateRangeException

        raise InvalidDateRangeException()

    target_days = [day.value for day in days_of_week]
    created_entries = []
    current_date = start_date

    while current_date <= end_date:
        if current_date.weekday() in target_days:
            existing = (
                db.query(BandAvailability)
                .filter(
                    BandAvailability.band_id == band_id,
                    BandAvailability.date == current_date,
                )
                .first()
            )

            if existing:
                existing.status = status_value
                existing.note = note
                db.add(existing)
                created_entries.append(existing)
            else:
                new_availability = BandAvailability(
                    band_id=band_id,
                    date=current_date,
                    status=status_value,
                    note=note,
                )
                db.add(new_availability)
                created_entries.append(new_availability)

        current_date += timedelta(days=1)

    db.commit()

    for entry in created_entries:
        db.refresh(entry)

    return created_entries


@router.post(
    "/venues/{venue_id}/availability",
    response_model=List[VenueAvailabilityResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_venue_availability(
    venue_id: int,
    availability_data: VenueAvailabilityBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[VenueAvailabilityResponse]:
    """
    Create venue availability entries for specific dates.

    Requires OWNER or MANAGER role. Used for one-off blocks such as:
    - Private events
    - Renovations
    - Holidays
    - Special closures

    Operating hours handle regular weekly availability patterns.
    """
    venue = get_venue_or_404(venue_id, db)
    check_venue_permission(venue, current_user, [VenueRole.OWNER, VenueRole.MANAGER])

    created_entries = []

    for entry_data in availability_data.entries:
        existing = (
            db.query(VenueAvailability)
            .filter(
                VenueAvailability.venue_id == venue_id,
                VenueAvailability.date == entry_data.date,
            )
            .first()
        )

        if existing:
            existing.status = entry_data.status.value
            existing.note = entry_data.note
            db.add(existing)
            created_entries.append(existing)
        else:
            new_availability = VenueAvailability(
                venue_id=venue_id,
                date=entry_data.date,
                status=entry_data.status.value,
                note=entry_data.note,
            )
            db.add(new_availability)
            created_entries.append(new_availability)

    db.commit()

    for entry in created_entries:
        db.refresh(entry)

    return created_entries


@router.post(
    "/venues/{venue_id}/availability/by-day-of-week",
    response_model=List[VenueAvailabilityResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_venue_availability_by_day_of_week(
    venue_id: int,
    availability_data: VenueAvailabilityBulkCreateByDayOfWeek,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[VenueAvailabilityResponse]:
    """
    Create venue availability entries for specific days of the week within a date range.

    Requires OWNER or MANAGER role. Useful for temporary changes to regular
    operating patterns, such as:
    - "Closed all Mondays in December for renovations"
    - "Extra availability on Sundays during festival season"

    For permanent weekly patterns, use operating hours instead.
    """
    venue = get_venue_or_404(venue_id, db)
    check_venue_permission(venue, current_user, [VenueRole.OWNER, VenueRole.MANAGER])

    if availability_data.end_date < availability_data.start_date:
        from app.utils.exceptions import InvalidDateRangeException

        raise InvalidDateRangeException()

    target_days = [day.value for day in availability_data.days_of_week]
    created_entries = []
    current_date = availability_data.start_date

    while current_date <= availability_data.end_date:
        if current_date.weekday() in target_days:
            existing = (
                db.query(VenueAvailability)
                .filter(
                    VenueAvailability.venue_id == venue_id,
                    VenueAvailability.date == current_date,
                )
                .first()
            )

            if existing:
                existing.status = availability_data.status.value
                existing.note = availability_data.note
                db.add(existing)
                created_entries.append(existing)
            else:
                new_availability = VenueAvailability(
                    venue_id=venue_id,
                    date=current_date,
                    status=availability_data.status.value,
                    note=availability_data.note,
                )
                db.add(new_availability)
                created_entries.append(new_availability)

        current_date += timedelta(days=1)

    db.commit()

    for entry in created_entries:
        db.refresh(entry)

    return created_entries

