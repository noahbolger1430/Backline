from datetime import date
from typing import List, Optional
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_band_or_404, get_current_user, get_db
from app.database import get_db
from app.models import Band, BandEvent, BandMember, Event, User
from app.models.event import EventStatus
from app.schemas.event import (
    EventCreate,
    EventListResponse,
    EventResponse,
    EventUpdate,
    EventWithBands,
)
from app.schemas.band_event import (
    BandEventCreateWithoutEventId,
    BandEventResponse,
    BandEventStatus,
    BandEventUpdate,
)
from app.services.event_service import EventService
from app.services.storage import storage_service

router = APIRouter()
logger = logging.getLogger(__name__)


def check_band_member_permission(band_id: int, user: User, db: Session) -> Band:
    """
    Check if the current user is a member of the band and return the band.
    """
    band = get_band_or_404(band_id, db)
    
    # Check if user is a member of the band
    is_member = db.query(BandMember).filter(
        BandMember.band_id == band_id,
        BandMember.user_id == user.id
    ).first()
    
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this band to perform this action"
        )
    
    return band


def serialize_event_with_details(event: Event) -> dict:
    """
    Serialize an event with venue/location details and band count.
    """
    # Handle venue or band-created event details
    venue_name = None
    venue_street_address = None
    venue_city = None
    venue_state = None
    venue_zip_code = None
    created_by_band_name = None
    
    if event.venue_id and hasattr(event, 'venue') and event.venue:
        venue_name = event.venue.name
        venue_street_address = event.venue.street_address
        venue_city = event.venue.city
        venue_state = event.venue.state
        venue_zip_code = event.venue.zip_code
    
    if event.created_by_band_id and hasattr(event, 'created_by_band') and event.created_by_band:
        created_by_band_name = event.created_by_band.name
    
    # For band-created events, use location fields
    if event.created_by_band_id:
        location_name = event.location_name
        street_address = event.street_address
        city = event.city
        state = event.state
        zip_code = event.zip_code
    else:
        location_name = venue_name
        street_address = venue_street_address
        city = venue_city
        state = venue_state
        zip_code = venue_zip_code
    
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
        "created_by_band_id": event.created_by_band_id,
        "name": event.name,
        "description": event.description,
        "event_date": event.event_date,
        "doors_time": event.doors_time,
        "show_time": event.show_time,
        "status": event.status,
        "is_open_for_applications": event.is_open_for_applications,
        "is_ticketed": event.is_ticketed,
        "ticket_price": int(event.ticket_price) if event.ticket_price is not None else None,
        "is_age_restricted": event.is_age_restricted,
        "age_restriction": int(event.age_restriction) if event.age_restriction is not None else None,
        "image_path": event.image_path,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
        "venue_name": venue_name,
        "venue_street_address": venue_street_address,
        "venue_city": venue_city,
        "venue_state": venue_state,
        "venue_zip_code": venue_zip_code,
        "created_by_band_name": created_by_band_name,
        "location_name": location_name,
        "street_address": street_address,
        "city": city,
        "state": state,
        "zip_code": zip_code,
        "band_count": band_count,
        "genre_tags": event.genre_tags,
        "is_recurring": getattr(event, 'is_recurring', False),
        "recurring_day_of_week": getattr(event, 'recurring_day_of_week', None),
        "recurring_frequency": getattr(event, 'recurring_frequency', None),
        "recurring_start_date": getattr(event, 'recurring_start_date', None),
        "recurring_end_date": getattr(event, 'recurring_end_date', None),
    }
    
    return event_dict


@router.post("/bands/{band_id}/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_band_event(
    band_id: int,
    name: str = Form(...),
    description: Optional[str] = Form(None),
    event_date: date = Form(...),
    doors_time: Optional[str] = Form(None),
    show_time: str = Form(...),
    location_name: str = Form(...),
    street_address: Optional[str] = Form(None),
    city: str = Form(...),
    state: str = Form(...),
    zip_code: Optional[str] = Form(None),
    status: str = Form(EventStatus.CONFIRMED.value),
    genre_tags: Optional[str] = Form(None),
    is_ticketed: bool = Form(False),
    ticket_price: Optional[int] = Form(None),
    is_age_restricted: bool = Form(False),
    age_restriction: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    additional_band_ids: Optional[str] = Form(None, description="Comma-separated list of additional band IDs"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventResponse:
    """
    Create a new event as a band (private event or non-venue event).
    
    This will automatically add the creating band to the event.
    """
    # Check permissions
    band = check_band_member_permission(band_id, current_user, db)
    
    # Validate status value
    try:
        event_status = EventStatus(status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join([s.value for s in EventStatus])}",
        )
    
    # Handle image upload
    image_path = None
    if image and image.filename:
        image_path = await storage_service.upload_image(image, folder="events")
    
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
    
    # Clean and normalize genre tags
    cleaned_genre_tags = None
    if genre_tags:
        tags = [tag.strip().lower() for tag in genre_tags.split(",") if tag.strip()]
        if tags:
            cleaned_genre_tags = ",".join(tags)
    
    # Create event data
    event_data_dict = {
        "created_by_band_id": band_id,
        "name": name,
        "description": description,
        "event_date": event_date,
        "doors_time": doors_time_obj,
        "show_time": show_time_obj,
        "location_name": location_name,
        "street_address": street_address,
        "city": city,
        "state": state,
        "zip_code": zip_code,
        "status": event_status,
        "is_open_for_applications": False,  # Band events are not open for applications
        "genre_tags": cleaned_genre_tags,
        "is_ticketed": is_ticketed,
        "ticket_price": int(float(ticket_price)) if ticket_price is not None else None,
        "is_age_restricted": is_age_restricted,
        "age_restriction": int(float(age_restriction)) if age_restriction is not None else None,
    }
    
    event_data = EventCreate(**event_data_dict)
    
    try:
        # Create the event
        event = Event(**event_data.model_dump())
        
        # Set image path if uploaded
        if image_path:
            event.image_path = image_path
        
        db.add(event)
        db.flush()  # Get the event ID
        
        # Add the creating band to the event with confirmed status
        band_event = BandEvent(
            band_id=band_id,
            event_id=event.id,
            status=BandEventStatus.CONFIRMED.value,
        )
        db.add(band_event)
        
        # Add additional bands if specified
        if additional_band_ids:
            try:
                band_id_list = [int(bid.strip()) for bid in additional_band_ids.split(",") if bid.strip()]
                for additional_band_id in band_id_list:
                    if additional_band_id == band_id:
                        continue  # Skip the creating band
                    
                    additional_band = get_band_or_404(additional_band_id, db)
                    
                    # Check if band is already added
                    existing = db.query(BandEvent).filter(
                        BandEvent.event_id == event.id,
                        BandEvent.band_id == additional_band_id
                    ).first()
                    
                    if not existing:
                        band_event = BandEvent(
                            band_id=additional_band_id,
                            event_id=event.id,
                            status=BandEventStatus.CONFIRMED.value,
                        )
                        db.add(band_event)
            except ValueError:
                pass  # Invalid band ID format - skip
        
        db.commit()
        db.refresh(event)
        
        # Load relationships for response
        event = db.query(Event).options(
            joinedload(Event.created_by_band),
            joinedload(Event.bands)
        ).filter(Event.id == event.id).first()
        
        serialized = serialize_event_with_details(event)
        return EventResponse.model_validate(serialized)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating band event: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )


@router.get("/bands/{band_id}/events", response_model=EventListResponse)
def list_band_events(
    band_id: int,
    include_venue_events: bool = Query(True, description="Include events where the band is performing at venues"),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventListResponse:
    """
    List all events for a band.
    
    This includes both:
    - Events created by the band (private/non-venue events)
    - Events where the band is performing (if include_venue_events is True)
    """
    # Check if user is a member of the band (optional - you may want to make this public)
    # band = check_band_member_permission(band_id, current_user, db)
    
    query = db.query(Event)
    
    if include_venue_events:
        # Include both band-created events and events where the band is performing
        query = query.outerjoin(BandEvent, Event.id == BandEvent.event_id)
        query = query.filter(
            db.or_(
                Event.created_by_band_id == band_id,
                BandEvent.band_id == band_id
            )
        )
    else:
        # Only band-created events
        query = query.filter(Event.created_by_band_id == band_id)
    
    # Get total count
    total = query.distinct().count()
    
    # Get paginated results
    events = query.distinct().offset(skip).limit(limit).all()
    
    # Load relationships
    event_ids = [e.id for e in events]
    if event_ids:
        events_with_details = db.query(Event).options(
            joinedload(Event.venue),
            joinedload(Event.created_by_band),
            joinedload(Event.bands)
        ).filter(Event.id.in_(event_ids)).all()
        
        events_map = {e.id: e for e in events_with_details}
        events = [events_map.get(e.id, e) for e in events]
    
    return EventListResponse(
        events=[EventResponse.model_validate(serialize_event_with_details(e)) for e in events],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.patch("/bands/{band_id}/events/{event_id}", response_model=EventResponse)
async def update_band_event(
    band_id: int,
    event_id: int,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    event_date: Optional[date] = Form(None),
    doors_time: Optional[str] = Form(None),
    show_time: Optional[str] = Form(None),
    location_name: Optional[str] = Form(None),
    street_address: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    zip_code: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    genre_tags: Optional[str] = Form(None),
    is_ticketed: Optional[bool] = Form(None),
    ticket_price: Optional[int] = Form(None),
    is_age_restricted: Optional[bool] = Form(None),
    age_restriction: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    remove_image: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventResponse:
    """
    Update a band-created event.
    
    Only band members can update events created by their band.
    """
    # Check permissions
    band = check_band_member_permission(band_id, current_user, db)
    
    # Get the event and verify it was created by this band
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id {event_id} not found"
        )
    
    if event.created_by_band_id != band_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This event was not created by your band"
        )
    
    # Build update data
    update_data = {}
    if name is not None:
        update_data["name"] = name
    if description is not None:
        update_data["description"] = description if description.strip() else None
    if event_date is not None:
        update_data["event_date"] = event_date
    if doors_time is not None:
        update_data["doors_time"] = doors_time if doors_time.strip() else None
    if show_time is not None:
        update_data["show_time"] = show_time
    if location_name is not None:
        update_data["location_name"] = location_name
    if street_address is not None:
        update_data["street_address"] = street_address
    if city is not None:
        update_data["city"] = city
    if state is not None:
        update_data["state"] = state
    if zip_code is not None:
        update_data["zip_code"] = zip_code
    if status is not None:
        try:
            event_status_enum = EventStatus(status)
            update_data["status"] = event_status_enum.value
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join([s.value for s in EventStatus])}",
            )
    if genre_tags is not None:
        if genre_tags.strip():
            tags = [tag.strip().lower() for tag in genre_tags.split(",") if tag.strip()]
            update_data["genre_tags"] = ",".join(tags) if tags else None
        else:
            update_data["genre_tags"] = None
    if is_ticketed is not None:
        update_data["is_ticketed"] = is_ticketed
        if not is_ticketed:
            update_data["ticket_price"] = None
    if ticket_price is not None:
        try:
            update_data["ticket_price"] = int(float(ticket_price)) if is_ticketed else None
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"ticket_price must be a valid integer"
            )
    if is_age_restricted is not None:
        update_data["is_age_restricted"] = is_age_restricted
        if not is_age_restricted:
            update_data["age_restriction"] = None
    if age_restriction is not None:
        try:
            update_data["age_restriction"] = int(float(age_restriction)) if is_age_restricted else None
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"age_restriction must be a valid integer"
            )
    
    # Handle image
    if image and image.filename:
        if event.image_path:
            storage_service.delete_image(event.image_path)
        image_path = await storage_service.upload_image(image, folder="events")
        update_data["image_path"] = image_path
    elif remove_image == "true":
        if event.image_path:
            storage_service.delete_image(event.image_path)
        update_data["image_path"] = None
    
    # Parse time strings
    from datetime import time as time_type
    if "show_time" in update_data and update_data["show_time"]:
        try:
            time_parts = update_data["show_time"].split(":")
            update_data["show_time"] = time_type(int(time_parts[0]), int(time_parts[1]))
        except (ValueError, IndexError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid show_time format. Use HH:MM",
            )
    
    if "doors_time" in update_data and update_data["doors_time"]:
        try:
            time_parts = update_data["doors_time"].split(":")
            update_data["doors_time"] = time_type(int(time_parts[0]), int(time_parts[1]))
        except (ValueError, IndexError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid doors_time format. Use HH:MM",
            )
    
    # Update event
    event_update = EventUpdate(**update_data)
    updated_event = EventService.update_event(db, event, event_update)
    
    # Reload with relationships
    updated_event = db.query(Event).options(
        joinedload(Event.created_by_band),
        joinedload(Event.bands)
    ).filter(Event.id == updated_event.id).first()
    
    return EventResponse.model_validate(serialize_event_with_details(updated_event))


@router.delete("/bands/{band_id}/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_band_event(
    band_id: int,
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """
    Delete a band-created event.
    
    Only band members can delete events created by their band.
    """
    # Check permissions
    band = check_band_member_permission(band_id, current_user, db)
    
    # Get the event and verify it was created by this band
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id {event_id} not found"
        )
    
    if event.created_by_band_id != band_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This event was not created by your band"
        )
    
    EventService.delete_event(db, event)
