from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_band_or_404, get_event_or_404, get_venue_or_404
from app.database import get_db
from app.models import Band, BandAvailability, BandEvent, Event, Venue
from app.models.availability import AvailabilityStatus
from app.schemas.event import (
    BandEventCreate,
    BandEventResponse,
    BandEventUpdate,
    EventCreate,
    EventListResponse,
    EventResponse,
    EventUpdate,
)
from app.services.event_service import EventService

router = APIRouter()


@router.post("/", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(event_data: EventCreate, db: Session = Depends(get_db)) -> EventResponse:
    """
    Create a new event at a venue.

    This will automatically mark the venue as unavailable on the event date.
    """
    venue = get_venue_or_404(event_data.venue_id, db)

    existing_event = (
        db.query(Event)
        .filter(Event.venue_id == venue.id, Event.event_date == event_data.event_date)
        .first()
    )

    if existing_event:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Venue already has an event on {event_data.event_date}",
        )

    event = EventService.create_event(db, event_data)
    return EventResponse.model_validate(event)


@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)) -> EventResponse:
    """
    Get event details by ID.
    """
    event = get_event_or_404(event_id, db)
    return EventResponse.model_validate(event)


@router.get("/", response_model=EventListResponse)
def list_events(
    venue_id: Optional[int] = None,
    band_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> EventListResponse:
    """
    List events with optional filters.

    Filter by venue, band, or date range.
    """
    events, total = EventService.list_events(
        db,
        venue_id=venue_id,
        band_id=band_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )

    return EventListResponse(
        events=[EventResponse.model_validate(e) for e in events],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.patch("/{event_id}", response_model=EventResponse)
def update_event(event_id: int, event_data: EventUpdate, db: Session = Depends(get_db)) -> EventResponse:
    """
    Update event details.

    If the event date changes, this will update venue availability accordingly.
    """
    event = get_event_or_404(event_id, db)

    if event_data.event_date and event_data.event_date != event.event_date:
        existing_event = (
            db.query(Event)
            .filter(
                Event.venue_id == event.venue_id,
                Event.event_date == event_data.event_date,
                Event.id != event_id,
            )
            .first()
        )

        if existing_event:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Venue already has an event on {event_data.event_date}",
            )

    updated_event = EventService.update_event(db, event, event_data)
    return EventResponse.model_validate(updated_event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db)) -> None:
    """
    Delete an event.

    This will free up the venue for the event date and remove all band associations.
    """
    event = get_event_or_404(event_id, db)
    EventService.delete_event(db, event)


@router.post("/{event_id}/bands", response_model=BandEventResponse)
def add_band_to_event(event_id: int, band_event_data: BandEventCreate, db: Session = Depends(get_db)) -> BandEventResponse:
    """
    Add a band to an event lineup.

    This will create a band availability block for the event date.
    """
    event = get_event_or_404(event_id, db)
    band = get_band_or_404(band_event_data.band_id, db)

    existing_band_event = (
        db.query(BandEvent)
        .filter(BandEvent.event_id == event_id, BandEvent.band_id == band.id)
        .first()
    )

    if existing_band_event:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Band is already part of this event",
        )

    band_event = EventService.add_band_to_event(db, event, band, band_event_data)
    return BandEventResponse.model_validate(band_event)


@router.patch("/{event_id}/bands/{band_id}", response_model=BandEventResponse)
def update_band_event(
    event_id: int,
    band_id: int,
    band_event_data: BandEventUpdate,
    db: Session = Depends(get_db),
) -> BandEventResponse:
    """
    Update band's participation details for an event.
    """
    band_event = (
        db.query(BandEvent)
        .filter(BandEvent.event_id == event_id, BandEvent.band_id == band_id)
        .first()
    )

    if not band_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Band is not part of this event",
        )

    updated_band_event = EventService.update_band_event(db, band_event, band_event_data)
    return BandEventResponse.model_validate(updated_band_event)


@router.delete("/{event_id}/bands/{band_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_band_from_event(event_id: int, band_id: int, db: Session = Depends(get_db)) -> None:
    """
    Remove a band from an event.

    This will remove the band availability block for the event date.
    """
    band_event = (
        db.query(BandEvent).filter(BandEvent.event_id == event_id, BandEvent.band_id == band_id).first()
    )

    if not band_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Band is not part of this event",
        )

    EventService.remove_band_from_event(db, band_event)


@router.get("/{event_id}/bands", response_model=List[BandEventResponse])
def get_event_bands(event_id: int, db: Session = Depends(get_db)) -> List[BandEventResponse]:
    """
    Get all bands performing at an event.
    """
    event = get_event_or_404(event_id, db)
    band_events = EventService.get_event_bands(db, event)
    return [BandEventResponse.model_validate(be) for be in band_events]

