from datetime import date
from typing import List, Optional
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_band_or_404, get_event_or_404, get_venue_or_404
from app.database import get_db
from app.models import Band, BandAvailability, BandEvent, Event, Venue
from app.models.availability import AvailabilityStatus
from app.models.event import EventStatus
from app.schemas.event import (
    BandEventCreate,
    BandEventResponse,
    BandEventUpdate,
    EventCreate,
    EventListResponse,
    EventResponse,
    EventUpdate,
)
from app.schemas.band_event import BandEventStatus
from app.services.event_service import EventService

router = APIRouter()


def serialize_event_with_details(event: Event) -> dict:
    """
    Serialize an event with venue name and band count.
    """
    # Safely access venue name
    venue_name = ""
    try:
        if hasattr(event, 'venue') and event.venue:
            venue_name = event.venue.name
    except Exception:
        # If venue relationship is not loaded, try to get it from the venue_id
        pass
    
    # Safely access band count
    band_count = 0
    try:
        if hasattr(event, 'bands') and event.bands:
            band_count = len(event.bands)
    except Exception:
        pass
    
    event_dict = {
        "id": event.id,
        "venue_id": event.venue_id,
        "name": event.name,
        "description": event.description,
        "event_date": event.event_date,
        "doors_time": event.doors_time,
        "show_time": event.show_time,
        "status": event.status,
        "is_open_for_applications": event.is_open_for_applications,
        "is_ticketed": event.is_ticketed,
        "ticket_price": event.ticket_price,
        "is_age_restricted": event.is_age_restricted,
        "age_restriction": event.age_restriction,
        "image_path": event.image_path,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
        "venue_name": venue_name,
        "band_count": band_count,
    }
    return event_dict


@router.post("/", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    venue_id: int = Form(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    event_date: date = Form(...),
    doors_time: Optional[str] = Form(None),
    show_time: str = Form(...),
    status: str = Form(EventStatus.CONFIRMED.value),
    is_open_for_applications: bool = Form(False),
    is_ticketed: bool = Form(False),
    ticket_price: Optional[int] = Form(None),
    is_age_restricted: bool = Form(False),
    age_restriction: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    band_ids: Optional[str] = Form(None, description="Comma-separated list of band IDs to add to the event"),
    db: Session = Depends(get_db),
) -> EventResponse:
    """
    Create a new event at a venue.

    This will automatically mark the venue as unavailable on the event date.
    Set status to "pending" and is_open_for_applications to true to allow bands to apply.
    """
    venue = get_venue_or_404(venue_id, db)

    existing_event = (
        db.query(Event)
        .filter(Event.venue_id == venue.id, Event.event_date == event_date)
        .first()
    )

    if existing_event:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Venue already has an event on {event_date}",
        )

    # Validate status value
    try:
        event_status = EventStatus(status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join([s.value for s in EventStatus])}",
        )

    # Validate that only pending events can be open for applications
    if is_open_for_applications and event_status != EventStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending events can be open for applications",
        )

    # Handle image upload
    image_path = None
    if image and image.filename:
        # Create images directory if it doesn't exist
        images_dir = Path("images")
        images_dir.mkdir(exist_ok=True)
        
        # Generate unique filename
        file_extension = Path(image.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        image_path = f"images/{unique_filename}"
        
        # Save file
        file_path = images_dir / unique_filename
        with open(file_path, "wb") as buffer:
            content = await image.read()
            buffer.write(content)

    # Parse time strings
    from datetime import time as time_type
    show_time_obj = None
    doors_time_obj = None
    
    if show_time:
        try:
            time_parts = show_time.split(":")
            show_time_obj = time_type(int(time_parts[0]), int(time_parts[1]))
        except (ValueError, IndexError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid show_time format. Use HH:MM format.",
            )
    
    if doors_time:
        try:
            time_parts = doors_time.split(":")
            doors_time_obj = time_type(int(time_parts[0]), int(time_parts[1]))
        except (ValueError, IndexError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid doors_time format. Use HH:MM format.",
            )

    # Create event data
    event_data_dict = {
        "venue_id": venue_id,
        "name": name,
        "description": description,
        "event_date": event_date,
        "doors_time": doors_time_obj,
        "show_time": show_time_obj,
        "status": event_status,
        "is_open_for_applications": is_open_for_applications,
        "is_ticketed": is_ticketed,
        "ticket_price": ticket_price,
        "is_age_restricted": is_age_restricted,
        "age_restriction": age_restriction,
    }
    
    event_data = EventCreate(**event_data_dict)

    try:
        event = EventService.create_event(db, event_data)
        
        # Update image_path if image was uploaded
        if image_path:
            event.image_path = image_path
            db.commit()
            db.refresh(event)
        
        # Add bands to event if band_ids provided
        if band_ids:
            try:
                band_id_list = [int(bid.strip()) for bid in band_ids.split(",") if bid.strip()]
                for band_id in band_id_list:
                    band = get_band_or_404(band_id, db)
                    # Check if band is already added to this event
                    existing_band_event = (
                        db.query(BandEvent)
                        .filter(BandEvent.event_id == event.id, BandEvent.band_id == band.id)
                        .first()
                    )
                    if not existing_band_event:
                        # Create BandEvent with default status "confirmed" (venue owner is adding them)
                        band_event_data = BandEventCreate(
                            band_id=band.id,
                            event_id=event.id,
                            status=BandEventStatus.CONFIRMED.value,
                            set_time=None,
                            set_length_minutes=None,
                            performance_order=None,
                        )
                        EventService.add_band_to_event(db, event, band, band_event_data)
            except ValueError:
                # Invalid band ID format - skip
                pass
        
        # Reload event with relationships to ensure venue_name and band_count work
        event = (
            db.query(Event)
            .options(joinedload(Event.venue), joinedload(Event.bands))
            .filter(Event.id == event.id)
            .first()
        )
        
        serialized = serialize_event_with_details(event)
        return EventResponse.model_validate(serialized)
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating event: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )


@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)) -> EventResponse:
    """
    Get event details by ID.
    """
    event = (
        db.query(Event)
        .options(joinedload(Event.venue), joinedload(Event.bands))
        .filter(Event.id == event_id)
        .first()
    )
    
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    
    return EventResponse.model_validate(serialize_event_with_details(event))


@router.get("/", response_model=EventListResponse)
def list_events(
    venue_id: Optional[int] = None,
    band_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    status: Optional[str] = None,
    is_open_for_applications: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> EventListResponse:
    """
    List events with optional filters.

    Filter by venue, band, date range, status, or application availability.
    """
    events, total = EventService.list_events(
        db,
        venue_id=venue_id,
        band_id=band_id,
        start_date=start_date,
        end_date=end_date,
        status=status,
        is_open_for_applications=is_open_for_applications,
        skip=skip,
        limit=limit,
    )

    # Reload events with relationships
    event_ids = [e.id for e in events]
    events_with_details = (
        db.query(Event)
        .options(joinedload(Event.venue), joinedload(Event.bands))
        .filter(Event.id.in_(event_ids))
        .all()
    )
    
    # Create a map for quick lookup
    events_map = {e.id: e for e in events_with_details}
    
    return EventListResponse(
        events=[EventResponse.model_validate(serialize_event_with_details(events_map.get(e.id, e))) for e in events],
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

    # Validate that only pending events can be open for applications
    new_status = event_data.status if event_data.status else event.status
    new_open_for_apps = event_data.is_open_for_applications if event_data.is_open_for_applications is not None else event.is_open_for_applications
    
    if new_open_for_apps and new_status != EventStatus.PENDING.value and new_status != EventStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending events can be open for applications",
        )

    updated_event = EventService.update_event(db, event, event_data)
    
    # Reload event with relationships
    updated_event = (
        db.query(Event)
        .options(joinedload(Event.venue), joinedload(Event.bands))
        .filter(Event.id == updated_event.id)
        .first()
    )
    
    return EventResponse.model_validate(serialize_event_with_details(updated_event))


@router.post("/{event_id}/open-applications", response_model=EventResponse)
def open_event_for_applications(event_id: int, db: Session = Depends(get_db)) -> EventResponse:
    """
    Open a pending event for band applications.
    """
    event = get_event_or_404(event_id, db)
    
    if event.status != EventStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending events can be opened for applications",
        )
    
    event.is_open_for_applications = True
    db.commit()
    db.refresh(event)
    
    # Reload event with relationships
    event = (
        db.query(Event)
        .options(joinedload(Event.venue), joinedload(Event.bands))
        .filter(Event.id == event.id)
        .first()
    )
    
    return EventResponse.model_validate(serialize_event_with_details(event))


@router.post("/{event_id}/close-applications", response_model=EventResponse)
def close_event_applications(event_id: int, db: Session = Depends(get_db)) -> EventResponse:
    """
    Close an event for band applications.
    """
    event = get_event_or_404(event_id, db)
    
    event.is_open_for_applications = False
    db.commit()
    db.refresh(event)
    
    # Reload event with relationships
    event = (
        db.query(Event)
        .options(joinedload(Event.venue), joinedload(Event.bands))
        .filter(Event.id == event.id)
        .first()
    )
    
    return EventResponse.model_validate(serialize_event_with_details(event))


@router.post("/{event_id}/confirm", response_model=EventResponse)
def confirm_event(event_id: int, db: Session = Depends(get_db)) -> EventResponse:
    """
    Confirm a pending event, closing it for applications.
    """
    event = get_event_or_404(event_id, db)
    
    if event.status != EventStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending events can be confirmed",
        )
    
    event.status = EventStatus.CONFIRMED.value
    event.is_open_for_applications = False
    db.commit()
    db.refresh(event)
    
    # Reload event with relationships
    event = (
        db.query(Event)
        .options(joinedload(Event.venue), joinedload(Event.bands))
        .filter(Event.id == event.id)
        .first()
    )
    
    return EventResponse.model_validate(serialize_event_with_details(event))


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
