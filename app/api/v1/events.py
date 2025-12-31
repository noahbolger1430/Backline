from datetime import date
from typing import List, Optional
import logging
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_band_or_404, get_event_or_404, get_venue_or_404
from app.database import get_db
from app.models import Band, BandAvailability, BandEvent, BandMember, Event, Venue
from app.models.availability import AvailabilityStatus
from app.models.event import EventStatus
from app.models.notification import NotificationType
from app.schemas.event import (
    EventCreate,
    EventListResponse,
    EventResponse,
    EventUpdate,
)
from app.schemas.event import EventWithBands 
from app.schemas.band_event import (
    BandEventCreate,
    BandEventCreateWithoutEventId,
    BandEventResponse,
    BandEventStatus,
    BandEventUpdate,
)
from app.schemas.notification import NotificationCreate
from app.services.event_service import EventService
from app.services.notification_service import NotificationService

router = APIRouter()


def check_deleted_recurring_event(event_id: int, db: Session) -> None:
    """
    Check if an event_id is a synthetic ID from a deleted recurring event.
    Raises HTTPException ONLY if we're certain it's a synthetic ID from a deleted recurring event.
    
    This function should only be called when extract_original_event_id didn't extract,
    meaning either:
    1. The event doesn't exist (deleted) - raise error
    2. The event exists but isn't recurring (not a synthetic ID) - don't raise error
    3. The date format doesn't match (might be a different format) - don't raise error
    """
    if event_id > 1000000:
        potential_original_id = event_id // 1000000
        date_part = event_id % 1000000
        date_part_str = str(date_part)
        
        # Only raise an error if:
        # 1. The date part looks like a valid date (6-8 digits)
        # 2. The month and day are valid
        # 3. The original event doesn't exist
        # This ensures we only raise an error for actual deleted recurring events
        if 6 <= len(date_part_str) <= 8:
            try:
                if len(date_part_str) == 8:
                    month = int(date_part_str[4:6])
                    day = int(date_part_str[6:8])
                elif len(date_part_str) == 6:
                    month = int(date_part_str[2:4])
                    day = int(date_part_str[4:6])
                else:
                    month = day = 0
                
                # If it looks like a valid date format, check if event exists
                if 1 <= month <= 12 and 1 <= day <= 31:
                    test_event = db.query(Event).filter(Event.id == potential_original_id).first()
                    if not test_event:
                        # Original event doesn't exist AND it looks like a valid synthetic ID format
                        # This is likely a deleted recurring event
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Recurring event with id {potential_original_id} not found. The recurring event may have been deleted."
                        )
                    # If event exists but isn't recurring, don't raise an error
                    # It might not be a synthetic ID at all
            except (ValueError, IndexError):
                # Invalid date format - probably not a synthetic ID, don't raise error
                pass


def extract_original_event_id(event_id: int, db: Session) -> int:
    """
    Extract the original event ID from a potentially synthetic ID.
    
    Synthetic IDs are used for expanded recurring event instances:
    synthetic_id = original_id * 1000000 + date_as_int (YYYYMMDD or YYMMDD)
    
    Returns the original event ID if it's a synthetic ID, otherwise returns the event_id as-is.
    
    IMPORTANT: Only extracts if the event exists AND is recurring. If the event doesn't exist,
    returns the original event_id unchanged to avoid false positives.
    """
    if event_id > 1000000:
        # Try to extract original event ID
        potential_original_id = event_id // 1000000
        date_part = event_id % 1000000
        date_part_str = str(date_part)
        
        # Check if date_part looks like a valid date (6-8 digits)
        if 6 <= len(date_part_str) <= 8:
            # Validate the date part looks reasonable (month 01-12, day 01-31)
            try:
                if len(date_part_str) == 8:
                    # YYYYMMDD format
                    month = int(date_part_str[4:6])
                    day = int(date_part_str[6:8])
                elif len(date_part_str) == 6:
                    # YYMMDD format
                    month = int(date_part_str[2:4])
                    day = int(date_part_str[4:6])
                else:
                    month = day = 0
                
                # If month and day are valid, check if event exists and is recurring
                if 1 <= month <= 12 and 1 <= day <= 31:
                    # CRITICAL: Check if event exists BEFORE extracting
                    test_event = db.query(Event).filter(Event.id == potential_original_id).first()
                    # Only extract if the event exists AND is recurring
                    # This ensures we don't incorrectly extract IDs from regular events or deleted events
                    if test_event and test_event.is_recurring:
                        # This is very likely a synthetic ID, return the original event ID
                        logging.debug(f"Extracted original event ID {potential_original_id} from synthetic ID {event_id}")
                        return potential_original_id
                    elif test_event:
                        # Event exists but is not recurring - don't extract, it's a regular event
                        logging.debug(f"Event {potential_original_id} exists but is not recurring, not extracting from {event_id}")
                    else:
                        # Event doesn't exist - this could be:
                        # 1. A deleted recurring event (legitimate case)
                        # 2. An old synthetic ID from before the event was deleted/recreated
                        # 3. A format mismatch: 6-digit date interpreted as 8-digit, or vice versa
                        #
                        # If the date part is 6 digits, try to find a matching event with 8-digit format
                        # For example, 48260110 could be:
                        #   - Event 48 with 6-digit date (260110) = 48 * 1000000 + 260110
                        #   - Event 28 with 8-digit date (20260110) = 28 * 1000000 + 20260110
                        # The difference is 20000000, which is 20 * 1000000
                        # So if we have event_id = X * 1000000 + 6digit_date,
                        # and event_id = Y * 1000000 + 8digit_date,
                        # then X - Y = 20 (since 8digit - 6digit = 20000000)
                        if len(date_part_str) == 6:
                            # Try alternative ID (20 less) which would match with 8-digit date
                            alternative_id = potential_original_id - 20
                            if alternative_id > 0:
                                alt_event = db.query(Event).filter(Event.id == alternative_id).first()
                                if alt_event and alt_event.is_recurring:
                                    # Found a matching event! This is likely the correct one
                                    logging.info(f"Found alternative event ID {alternative_id} for synthetic ID {event_id} (6-digit vs 8-digit format mismatch, original ID {potential_original_id} doesn't exist)")
                                    return alternative_id
                        
                        # Event doesn't exist and no alternative found - don't extract, return original ID
                        logging.warning(f"Event {potential_original_id} does not exist, not extracting from {event_id} (likely deleted event or format mismatch)")
                        # Return the original ID unchanged - the calling code will check if it's a deleted recurring event
            except (ValueError, IndexError):
                pass  # Invalid date format, treat as regular ID
    
    # Not a synthetic ID or extraction failed, return as-is
    return event_id


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
    
    # Check if this is an expanded recurring event instance (has _original_event_id)
    original_event_id = getattr(event, '_original_event_id', None)
    
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
        "ticket_price": int(event.ticket_price) if event.ticket_price is not None else None,
        "is_age_restricted": event.is_age_restricted,
        "age_restriction": int(event.age_restriction) if event.age_restriction is not None else None,
        "image_path": event.image_path,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
        "venue_name": venue_name,
        "band_count": band_count,
        "is_recurring": getattr(event, 'is_recurring', False),
        "recurring_day_of_week": getattr(event, 'recurring_day_of_week', None),
        "recurring_frequency": getattr(event, 'recurring_frequency', None),
        "recurring_start_date": getattr(event, 'recurring_start_date', None),
        "recurring_end_date": getattr(event, 'recurring_end_date', None),
    }
    
    # If this is an expanded instance, add the original event ID
    if original_event_id:
        event_dict["_original_event_id"] = original_event_id
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
    genre_tags: Optional[str] = Form(None, description="Comma-separated genre tags for band matching"),
    is_ticketed: bool = Form(False),
    ticket_price: Optional[int] = Form(None),
    is_age_restricted: bool = Form(False),
    age_restriction: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    band_ids: Optional[str] = Form(None, description="Comma-separated list of band IDs to add to the event"),
    is_recurring: bool = Form(False),
    recurring_day_of_week: Optional[int] = Form(None),
    recurring_frequency: Optional[str] = Form(None),
    recurring_start_date: Optional[date] = Form(None),
    recurring_end_date: Optional[date] = Form(None),
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

    # Validate recurring event fields
    if is_recurring:
        if recurring_day_of_week is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="recurring_day_of_week is required for recurring events",
            )
        if recurring_frequency is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="recurring_frequency is required for recurring events",
            )
        if recurring_start_date is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="recurring_start_date is required for recurring events",
            )
        if recurring_end_date is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="recurring_end_date is required for recurring events",
            )
        if recurring_end_date < recurring_start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="recurring_end_date must be after recurring_start_date",
            )
        if recurring_frequency not in ["weekly", "bi_weekly", "monthly"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="recurring_frequency must be one of: weekly, bi_weekly, monthly",
            )
        if recurring_day_of_week < 0 or recurring_day_of_week > 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="recurring_day_of_week must be between 0 (Monday) and 6 (Sunday)",
            )
        
        # Validate that start date matches the selected day of week
        # Python weekday(): 0=Monday, 6=Sunday
        start_date_weekday = recurring_start_date.weekday()
        if start_date_weekday != recurring_day_of_week:
            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            selected_day = day_names[recurring_day_of_week]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"recurring_start_date must be a {selected_day} (day of week {recurring_day_of_week})",
            )
        
        # Validate that end date matches the selected day of week
        end_date_weekday = recurring_end_date.weekday()
        if end_date_weekday != recurring_day_of_week:
            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            selected_day = day_names[recurring_day_of_week]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"recurring_end_date must be a {selected_day} (day of week {recurring_day_of_week})",
            )
        
        # For recurring events, use recurring_start_date as the event_date
        event_date = recurring_start_date

    # Clean and normalize genre tags
    cleaned_genre_tags = None
    if genre_tags:
        # Clean up: strip whitespace, lowercase, remove empty tags
        tags = [tag.strip().lower() for tag in genre_tags.split(",") if tag.strip()]
        if tags:
            cleaned_genre_tags = ",".join(tags)

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
        "genre_tags": cleaned_genre_tags,
        "is_ticketed": is_ticketed,
        "ticket_price": int(float(ticket_price)) if ticket_price is not None else None,
        "is_age_restricted": is_age_restricted,
        "age_restriction": int(float(age_restriction)) if age_restriction is not None else None,
        "is_recurring": is_recurring,
        "recurring_day_of_week": recurring_day_of_week,
        "recurring_frequency": recurring_frequency,
        "recurring_start_date": recurring_start_date,
        "recurring_end_date": recurring_end_date,
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
        
        # If event is open for applications, notify all band members
        if event.is_open_for_applications and event.status == "pending":
            from datetime import datetime
            # Get all band members from all bands
            all_band_members = (
                db.query(BandMember)
                .options(joinedload(BandMember.user))
                .all()
            )
            
            # Convert event_date (Date) to datetime for notification
            if isinstance(event.event_date, date):
                gig_date = datetime.combine(event.event_date, datetime.min.time())
            else:
                gig_date = event.event_date
            
            # Create notification for each band member
            for band_member in all_band_members:
                notification_data = NotificationCreate(
                    user_id=band_member.user_id,
                    type=NotificationType.GIG_AVAILABLE.value,
                    value="",  # Not used for this notification type
                    venue_name=event.venue.name,
                    gig_name=event.name,
                    gig_date=gig_date,
                    event_application_id=None,
                )
                NotificationService.create_notification(db, notification_data)
        
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


@router.get("/{event_id}", response_model=EventWithBands)
def get_event(event_id: int, db: Session = Depends(get_db)) -> EventWithBands:
    """
    Get event details by ID with band information.
    
    If the event_id is a synthetic ID from an expanded recurring event instance,
    extract the original event ID and fetch that instead.
    """
    # Check if this is a synthetic ID and extract the original event ID
    requested_event_id = event_id
    event_id = extract_original_event_id(event_id, db)
    
    # If extraction didn't happen, check if it's a synthetic ID from a deleted recurring event
    if requested_event_id == event_id and requested_event_id > 1000000:
        check_deleted_recurring_event(requested_event_id, db)
    
    synthetic_date = None
    
    # If it was a synthetic ID, extract the date for the response
    if requested_event_id != event_id:
        date_part = requested_event_id % 1000000
        date_part_str = str(date_part)
        
        try:
            from datetime import date as date_type
            if len(date_part_str) == 8:
                # YYYYMMDD format
                year = date_part // 10000
                month = (date_part % 10000) // 100
                day = date_part % 100
                synthetic_date = date_type(year, month, day)
            elif len(date_part_str) == 6:
                # YYMMDD format - assume 20YY
                year_2digit = int(date_part_str[:2])
                month = int(date_part_str[2:4])
                day = int(date_part_str[4:6])
                year = 2000 + year_2digit
                synthetic_date = date_type(year, month, day)
        except (ValueError, TypeError, IndexError):
            synthetic_date = None
    
    event = (
        db.query(Event)
        .options(
            joinedload(Event.venue), 
            joinedload(Event.bands).joinedload(BandEvent.band)
        )
        .filter(Event.id == event_id)
        .first()
    )
    
    if not event:
        # If we extracted an ID but the event doesn't exist, provide a more helpful error
        if requested_event_id != event_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recurring event with id {event_id} not found (extracted from synthetic ID {requested_event_id})"
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id {event_id} not found"
        )
    
    # Serialize with bands included
    serialized = serialize_event_with_details(event)
    serialized['bands'] = [
        {
            'id': be.id,
            'band_id': be.band_id,
            'band_name': be.band.name if be.band else 'Unknown',
            'event_id': be.event_id,
            'status': be.status,
            'set_time': be.set_time,
            'set_length_minutes': be.set_length_minutes,
            'performance_order': be.performance_order,
            'load_in_time': be.load_in_time,
            'sound_check_time': be.sound_check_time,
            'created_at': be.created_at,
            'updated_at': be.updated_at,
        }
        for be in event.bands
    ]
    
    # If this was a synthetic ID request, update the event_date in the response
    # to match the date from the synthetic ID
    if synthetic_date is not None:
        serialized['event_date'] = synthetic_date
    
    return EventWithBands.model_validate(serialized)

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
    expand_recurring: bool = True,
    db: Session = Depends(get_db),
) -> EventListResponse:
    """
    List events with optional filters.

    Filter by venue, band, date range, status, or application availability.
    If expand_recurring is False, recurring events are shown as single entries instead of expanded instances.
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
        expand_recurring=expand_recurring,
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
async def update_event(
    event_id: int,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    event_date: Optional[date] = Form(None),
    doors_time: Optional[str] = Form(None),
    show_time: Optional[str] = Form(None),
    status: Optional[str] = Form(None),  # Changed from event_status to match frontend
    is_open_for_applications: Optional[bool] = Form(None),
    genre_tags: Optional[str] = Form(None),
    is_ticketed: Optional[bool] = Form(None),
    ticket_price: Optional[int] = Form(None),
    is_age_restricted: Optional[bool] = Form(None),
    age_restriction: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    remove_image: Optional[str] = Form(None),
    db: Session = Depends(get_db),
) -> EventResponse:
    """
    Update event details.

    If the event date changes, this will update venue availability accordingly.
    Supports both JSON and FormData (for image uploads).
    
    If the event_id is a synthetic ID from an expanded recurring event instance,
    create a new non-recurring event for that specific date instead of updating
    the base recurring event. This ensures only the single instance is modified.
    """
    # Check if this is a synthetic ID (expanded recurring event instance)
    original_requested_id = event_id
    is_synthetic_id = False
    synthetic_date = None
    original_recurring_event_id = None
    
    # First, use extract_original_event_id to handle synthetic IDs
    # This will extract the original ID if it's a synthetic ID and the event exists and is recurring
    extracted_id = extract_original_event_id(original_requested_id, db)
    
    # If extraction happened, this is likely a synthetic ID
    if extracted_id != original_requested_id:
        # Try to parse the date from the synthetic ID
        date_part = original_requested_id % 1000000
        date_part_str = str(date_part)
        
        if 6 <= len(date_part_str) <= 8:
            try:
                if len(date_part_str) == 8:
                    # YYYYMMDD format
                    year = int(date_part_str[:4])
                    month = int(date_part_str[4:6])
                    day = int(date_part_str[6:8])
                    synthetic_date = date(year, month, day)
                elif len(date_part_str) == 6:
                    # YYMMDD format - assume 20YY
                    year_2digit = int(date_part_str[:2])
                    month = int(date_part_str[2:4])
                    day = int(date_part_str[4:6])
                    synthetic_date = date(2000 + year_2digit, month, day)
                
                # Validate month and day
                if 1 <= month <= 12 and 1 <= day <= 31 and synthetic_date:
                    # Check if the extracted event exists and is recurring
                    test_event = db.query(Event).filter(Event.id == extracted_id).first()
                    if test_event and test_event.is_recurring:
                        is_synthetic_id = True
                        original_recurring_event_id = extracted_id
                        event_id = extracted_id
                        logging.info(f"Detected synthetic ID {original_requested_id} for recurring event {extracted_id} on date {synthetic_date}")
            except (ValueError, IndexError, TypeError) as e:
                logging.debug(f"Invalid date format in synthetic ID check: {e}")
                pass
    elif original_requested_id > 1000000:
        # Extraction didn't happen, but ID is large - might still be a synthetic ID format
        # Try to parse the date to see if it's a valid synthetic ID format
        potential_original_id = original_requested_id // 1000000
        date_part = original_requested_id % 1000000
        date_part_str = str(date_part)
        
        if 6 <= len(date_part_str) <= 8:
            try:
                if len(date_part_str) == 8:
                    year = int(date_part_str[:4])
                    month = int(date_part_str[4:6])
                    day = int(date_part_str[6:8])
                    synthetic_date = date(year, month, day)
                elif len(date_part_str) == 6:
                    year_2digit = int(date_part_str[:2])
                    month = int(date_part_str[2:4])
                    day = int(date_part_str[4:6])
                    synthetic_date = date(2000 + year_2digit, month, day)
                
                if 1 <= month <= 12 and 1 <= day <= 31 and synthetic_date:
                    # We have a valid date format, so this looks like a synthetic ID
                    # Try to find the event with the potential original ID
                    test_event = db.query(Event).filter(Event.id == potential_original_id).first()
                    if test_event and test_event.is_recurring:
                        # Found it! This is a synthetic ID
                        is_synthetic_id = True
                        original_recurring_event_id = potential_original_id
                        event_id = potential_original_id
                        logging.info(f"Detected synthetic ID {original_requested_id} for recurring event {potential_original_id} on date {synthetic_date}")
                    elif not test_event:
                        # Event doesn't exist - check if it's a deleted recurring event
                        check_deleted_recurring_event(original_requested_id, db)
                        # If we get here, check_deleted_recurring_event didn't raise
                        # This shouldn't happen, but if it does, we'll let the normal flow handle it
            except (ValueError, IndexError, TypeError) as e:
                logging.debug(f"Invalid date format in synthetic ID check: {e}")
                pass
    
    # Get the event (either the original recurring event or a regular event)
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        if is_synthetic_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recurring event with id {event_id} not found (extracted from synthetic ID {original_requested_id}). The recurring event may have been deleted."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with id {event_id} not found"
            )
    
    # If this is a synthetic ID (expanded recurring event instance), create a new non-recurring event
    # for that specific date instead of updating the base recurring event
    if is_synthetic_id and event.is_recurring and synthetic_date:
        # Check if a non-recurring event already exists for this date
        existing_single_event = (
            db.query(Event)
            .filter(
                Event.venue_id == event.venue_id,
                Event.event_date == synthetic_date,
                Event.is_recurring == False,
            )
            .first()
        )
        
        if existing_single_event:
            # Update the existing single event instead of creating a new one
            event = existing_single_event
            logging.info(f"Found existing single event {existing_single_event.id} for date {synthetic_date}, updating it instead")
        else:
            # Create a new non-recurring event based on the recurring event
            # Copy all properties from the recurring event, but allow form parameters to override
            # Determine initial status - use form parameter if provided, otherwise use recurring event's status
            initial_status = event.status
            if status is not None:
                try:
                    initial_status = EventStatus(status).value
                except ValueError:
                    # Invalid status, will be caught later in validation
                    pass
            
            # Helper function to convert FormData boolean strings to actual booleans
            def to_bool(value, default):
                if value is None:
                    return default
                if isinstance(value, bool):
                    return value
                if isinstance(value, str):
                    return value.lower() in ('true', '1', 'yes', 'on')
                return bool(value)
            
            new_event_data = {
                "venue_id": event.venue_id,
                "name": name if name is not None else event.name,
                "description": description if description is not None else event.description,
                "event_date": synthetic_date,  # Use the specific date from synthetic ID
                "show_time": show_time if show_time is not None else event.show_time,
                "doors_time": doors_time if doors_time is not None else event.doors_time,
                "is_ticketed": to_bool(is_ticketed, event.is_ticketed),
                "ticket_price": ticket_price if ticket_price is not None else event.ticket_price,
                "is_age_restricted": to_bool(is_age_restricted, event.is_age_restricted),
                # Use form parameter if provided (even if 0), otherwise use recurring event's value
                # This ensures the new event instance gets the correct value from the form
                "age_restriction": age_restriction if age_restriction is not None else (event.age_restriction if to_bool(is_age_restricted, event.is_age_restricted) else None),
                "status": initial_status,
                "is_open_for_applications": to_bool(is_open_for_applications, event.is_open_for_applications),
                "image_path": event.image_path,
                "is_recurring": False,  # This is a single event, not recurring
            }
            
            # Create the new event
            new_event = Event(**new_event_data)
            db.add(new_event)
            db.flush()  # Flush to get the new event ID
            
            event = new_event
            logging.info(f"Created new single event {event.id} for date {synthetic_date} from recurring event {original_recurring_event_id}")

    # Debug: Print all received form data
    print(f"=== UPDATE EVENT DEBUG ===")
    print(f"event_id: {event_id}")
    print(f"name: {name}, type: {type(name)}")
    print(f"description: {description}, type: {type(description)}")
    print(f"event_date: {event_date}, type: {type(event_date)}")
    print(f"is_ticketed: {is_ticketed}, type: {type(is_ticketed)}")
    print(f"ticket_price: {ticket_price}, type: {type(ticket_price)}")
    print(f"is_age_restricted: {is_age_restricted}, type: {type(is_age_restricted)}")
    print(f"age_restriction: {age_restriction}, type: {type(age_restriction)}")
    print(f"status: {status}, type: {type(status)}")
    print(f"is_open_for_applications: {is_open_for_applications}, type: {type(is_open_for_applications)}")
    print(f"========================")

    # Build update data from form fields
    update_data = {}
    if name is not None:
        update_data["name"] = name
    if description is not None:
        update_data["description"] = description if description.strip() else None
    if event_date is not None:
        # If this is a synthetic ID (expanded recurring instance), ensure the date matches
        if is_synthetic_id and synthetic_date:
            if event_date != synthetic_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot change event date for a recurring event instance. The date must remain {synthetic_date}."
                )
        update_data["event_date"] = event_date
    if doors_time is not None:
        update_data["doors_time"] = doors_time if doors_time.strip() else None
    if show_time is not None:
        update_data["show_time"] = show_time
    if status is not None:
        # Validate status value
        try:
            event_status_enum = EventStatus(status)
            update_data["status"] = event_status_enum.value
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join([s.value for s in EventStatus])}",
            )
    if is_open_for_applications is not None:
        # Handle boolean conversion from FormData (which sends strings)
        if isinstance(is_open_for_applications, str):
            update_data["is_open_for_applications"] = is_open_for_applications.lower() in ('true', '1', 'yes', 'on')
        else:
            update_data["is_open_for_applications"] = bool(is_open_for_applications)
    if genre_tags is not None:
        # Clean and normalize genre tags (empty string clears them)
        if genre_tags.strip():
            tags = [tag.strip().lower() for tag in genre_tags.split(",") if tag.strip()]
            update_data["genre_tags"] = ",".join(tags) if tags else None
        else:
            update_data["genre_tags"] = None
    if is_ticketed is not None:
        update_data["is_ticketed"] = is_ticketed
        # If event is not ticketed, explicitly set ticket_price to None
        if not is_ticketed:
            update_data["ticket_price"] = None
            print("Event is not ticketed, setting ticket_price to None")
    
    if ticket_price is not None:
        # Ensure ticket_price is an integer (in cents)
        # Handle both string and int inputs from FormData
        print(f"Received ticket_price: {ticket_price}, type: {type(ticket_price)}")
        try:
            if isinstance(ticket_price, str):
                # If it's a string, try to parse it as float first (in case it's "1000.0") then convert to int
                update_data["ticket_price"] = int(float(ticket_price))
            else:
                update_data["ticket_price"] = int(ticket_price)
            print(f"Converted ticket_price to: {update_data['ticket_price']}")
        except (ValueError, TypeError) as e:
            print(f"Error converting ticket_price: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"ticket_price must be a valid integer (price in cents). Received: {ticket_price}, type: {type(ticket_price)}"
            )
    # Handle age restriction - process is_age_restricted first, then age_restriction
    # This ensures proper ordering: if is_age_restricted is False, age_restriction should be None
    # If is_age_restricted is True, age_restriction should be set if provided
    if is_age_restricted is not None:
        # Handle boolean conversion from FormData
        if isinstance(is_age_restricted, str):
            is_age_restricted_bool = is_age_restricted.lower() in ('true', '1', 'yes', 'on')
        else:
            is_age_restricted_bool = bool(is_age_restricted)
        
        update_data["is_age_restricted"] = is_age_restricted_bool
        # If event is not age restricted, explicitly set age_restriction to None
        if not is_age_restricted_bool:
            update_data["age_restriction"] = None
            print("Event is not age restricted, setting age_restriction to None")
        # If event IS age restricted but age_restriction is not provided, don't override it
        # (it will keep the existing value or be set below if provided)
    
    if age_restriction is not None:
        # Only set age_restriction if is_age_restricted is True (or not provided, meaning keep existing)
        # If is_age_restricted was explicitly set to False above, we already set age_restriction to None
        if "age_restriction" not in update_data or update_data.get("age_restriction") is not None:
            # Ensure age_restriction is an integer
            print(f"Received age_restriction: {age_restriction}, type: {type(age_restriction)}")
            try:
                if isinstance(age_restriction, str):
                    # If it's a string, try to parse it as float first then convert to int
                    update_data["age_restriction"] = int(float(age_restriction))
                else:
                    update_data["age_restriction"] = int(age_restriction)
                print(f"Converted age_restriction to: {update_data['age_restriction']}")
            except (ValueError, TypeError) as e:
                print(f"Error converting age_restriction: {e}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"age_restriction must be a valid integer. Received: {age_restriction}, type: {type(age_restriction)}"
                )

    # Handle image upload or removal
    image_path = None
    remove_image_flag = remove_image == "true"
    if image and image.filename:
        # Create images directory if it doesn't exist
        images_dir = Path("images")
        images_dir.mkdir(exist_ok=True)
        
        # Delete old image if it exists
        if event.image_path and os.path.exists(event.image_path):
            try:
                os.remove(event.image_path)
            except Exception:
                pass  # Ignore errors when deleting old image
        
        # Generate unique filename
        file_extension = Path(image.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        image_path = f"images/{unique_filename}"
        
        # Save file
        file_path = images_dir / unique_filename
        with open(file_path, "wb") as buffer:
            content = await image.read()
            buffer.write(content)
        
        update_data["image_path"] = image_path
    elif remove_image_flag:
        # Remove existing image
        if event.image_path and os.path.exists(event.image_path):
            try:
                os.remove(event.image_path)
            except Exception:
                pass  # Ignore errors when deleting image
        update_data["image_path"] = None

    # Validate event_date change
    if update_data.get("event_date") and update_data["event_date"] != event.event_date:
        existing_event = (
            db.query(Event)
            .filter(
                Event.venue_id == event.venue_id,
                Event.event_date == update_data["event_date"],
                Event.id != event_id,
            )
            .first()
        )

        if existing_event:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Venue already has an event on {update_data['event_date']}",
            )

    # Validate that only pending events can be open for applications
    # Get the new status (either from update_data or current event status)
    new_status = update_data.get("status") if "status" in update_data else event.status
    new_open_for_apps = update_data.get("is_open_for_applications") if "is_open_for_applications" in update_data else event.is_open_for_applications
    
    # Normalize new_status to string for comparison
    if isinstance(new_status, EventStatus):
        new_status_str = new_status.value
    else:
        new_status_str = str(new_status)
    
    # Only allow opening for applications if status is pending
    # If user is trying to open for applications but status is not pending,
    # automatically set status to pending if status wasn't explicitly provided
    if new_open_for_apps and new_status_str != EventStatus.PENDING.value:
        if "status" not in update_data:
            # Status wasn't provided, but user wants to open for applications
            # Automatically set status to pending
            update_data["status"] = EventStatus.PENDING.value
            new_status_str = EventStatus.PENDING.value
            logging.info(f"Automatically setting event status to 'pending' because is_open_for_applications is True")
        else:
            # Status was explicitly provided and it's not pending
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only pending events can be open for applications. Please set the status to 'pending' first.",
            )

    # Create EventUpdate schema from update_data
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

    # Check if is_open_for_applications is being changed to True
    was_open_for_applications = event.is_open_for_applications
    
    # Log update_data before creating EventUpdate
    print(f"update_data before EventUpdate creation: {update_data}")
    
    event_update = EventUpdate(**update_data)
    print(f"EventUpdate created with ticket_price: {event_update.ticket_price}, age_restriction: {event_update.age_restriction}")
    print(f"EventUpdate model_dump: {event_update.model_dump(exclude_unset=True)}")
    
    updated_event = EventService.update_event(db, event, event_update)
    print(f"Event after update - ticket_price: {updated_event.ticket_price}, age_restriction: {updated_event.age_restriction}")
    
    # Reload event with relationships
    updated_event = (
        db.query(Event)
        .options(joinedload(Event.venue), joinedload(Event.bands))
        .filter(Event.id == updated_event.id)
        .first()
    )
    
    # If event is being opened for applications, notify all band members
    is_opening_for_applications = (
        updated_event.is_open_for_applications and
        not was_open_for_applications and
        updated_event.status == "pending"
    )
    
    if is_opening_for_applications:
        from datetime import datetime
        # Get all band members from all bands
        all_band_members = (
            db.query(BandMember)
            .options(joinedload(BandMember.user))
            .all()
        )
        
        # Convert event_date (Date) to datetime for notification
        if isinstance(updated_event.event_date, date):
            gig_date = datetime.combine(updated_event.event_date, datetime.min.time())
        else:
            gig_date = updated_event.event_date
        
        # Create notification for each band member
        for band_member in all_band_members:
            notification_data = NotificationCreate(
                user_id=band_member.user_id,
                type=NotificationType.GIG_AVAILABLE.value,
                value="",  # Not used for this notification type
                venue_name=updated_event.venue.name,
                gig_name=updated_event.name,
                gig_date=gig_date,
                event_application_id=None,
            )
            NotificationService.create_notification(db, notification_data)
    
    return EventResponse.model_validate(serialize_event_with_details(updated_event))


@router.post("/{event_id}/open-applications", response_model=EventResponse)
def open_event_for_applications(event_id: int, db: Session = Depends(get_db)) -> EventResponse:
    """
    Open a pending event for band applications.
    
    If the event_id is a synthetic ID from an expanded recurring event instance,
    extract the original event ID and use that instead.
    """
    # Check if this is a synthetic ID and extract the original event ID
    original_requested_id = event_id
    event_id = extract_original_event_id(event_id, db)
    
    # If extraction didn't happen, check if it's a synthetic ID from a deleted recurring event
    # Only check if the ID looks like a synthetic ID (has a valid date format)
    # AND the original event doesn't exist (which means it was likely deleted)
    if original_requested_id == event_id and original_requested_id > 1000000:
        date_part = original_requested_id % 1000000
        date_part_str = str(date_part)
        potential_original_id = original_requested_id // 1000000
        
        # Only check if it looks like a valid synthetic ID format (6-8 digit date)
        if 6 <= len(date_part_str) <= 8:
            try:
                if len(date_part_str) == 8:
                    month = int(date_part_str[4:6])
                    day = int(date_part_str[6:8])
                elif len(date_part_str) == 6:
                    month = int(date_part_str[2:4])
                    day = int(date_part_str[4:6])
                else:
                    month = day = 0
                # Only check if it's a valid date format AND the original event doesn't exist
                if 1 <= month <= 12 and 1 <= day <= 31:
                    # Check if the original event exists - if not, it's likely a deleted recurring event
                    test_event = db.query(Event).filter(Event.id == potential_original_id).first()
                    if not test_event:
                        # Original event doesn't exist - this is likely a deleted recurring event
                        check_deleted_recurring_event(original_requested_id, db)
                    # If event exists, don't raise an error - it might not be a synthetic ID
            except (ValueError, IndexError):
                # Invalid date format - probably not a synthetic ID, skip the check
                pass
    
    event = get_event_or_404(event_id, db)
    
    if event.status != EventStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending events can be opened for applications",
        )
    
    # Check if event was already open for applications
    was_open_for_applications = event.is_open_for_applications
    
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
    
    # If event is being opened for applications (wasn't already open), notify all band members
    if not was_open_for_applications:
        from datetime import datetime
        # Get all band members from all bands
        all_band_members = (
            db.query(BandMember)
            .options(joinedload(BandMember.user))
            .all()
        )
        
        # Convert event_date (Date) to datetime for notification
        if isinstance(event.event_date, date):
            gig_date = datetime.combine(event.event_date, datetime.min.time())
        else:
            gig_date = event.event_date
        
        # Create notification for each band member
        for band_member in all_band_members:
            notification_data = NotificationCreate(
                user_id=band_member.user_id,
                type=NotificationType.GIG_AVAILABLE.value,
                value="",  # Not used for this notification type
                venue_name=event.venue.name,
                gig_name=event.name,
                gig_date=gig_date,
                event_application_id=None,
            )
            NotificationService.create_notification(db, notification_data)
    
    return EventResponse.model_validate(serialize_event_with_details(event))


@router.post("/{event_id}/close-applications", response_model=EventResponse)
def close_event_applications(event_id: int, db: Session = Depends(get_db)) -> EventResponse:
    """
    Close an event for band applications.
    
    If the event_id is a synthetic ID from an expanded recurring event instance,
    extract the original event ID and use that instead.
    """
    # Check if this is a synthetic ID and extract the original event ID
    original_requested_id = event_id
    event_id = extract_original_event_id(event_id, db)
    
    # If extraction didn't happen, check if it's a synthetic ID from a deleted recurring event
    # Only check if the ID looks like a synthetic ID (has a valid date format)
    # AND the original event doesn't exist (which means it was likely deleted)
    if original_requested_id == event_id and original_requested_id > 1000000:
        date_part = original_requested_id % 1000000
        date_part_str = str(date_part)
        potential_original_id = original_requested_id // 1000000
        
        # Only check if it looks like a valid synthetic ID format (6-8 digit date)
        if 6 <= len(date_part_str) <= 8:
            try:
                if len(date_part_str) == 8:
                    month = int(date_part_str[4:6])
                    day = int(date_part_str[6:8])
                elif len(date_part_str) == 6:
                    month = int(date_part_str[2:4])
                    day = int(date_part_str[4:6])
                else:
                    month = day = 0
                # Only check if it's a valid date format AND the original event doesn't exist
                if 1 <= month <= 12 and 1 <= day <= 31:
                    # Check if the original event exists - if not, it's likely a deleted recurring event
                    test_event = db.query(Event).filter(Event.id == potential_original_id).first()
                    if not test_event:
                        # Original event doesn't exist - this is likely a deleted recurring event
                        check_deleted_recurring_event(original_requested_id, db)
                    # If event exists, don't raise an error - it might not be a synthetic ID
            except (ValueError, IndexError):
                # Invalid date format - probably not a synthetic ID, skip the check
                pass
    
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
    
    If the event_id is a synthetic ID from an expanded recurring event instance,
    extract the original event ID and use that instead.
    """
    # Check if this is a synthetic ID and extract the original event ID
    original_requested_id = event_id
    event_id = extract_original_event_id(event_id, db)
    
    # If extraction didn't happen, check if it's a synthetic ID from a deleted recurring event
    # Only check if the ID looks like a synthetic ID (has a valid date format)
    # AND the original event doesn't exist (which means it was likely deleted)
    if original_requested_id == event_id and original_requested_id > 1000000:
        date_part = original_requested_id % 1000000
        date_part_str = str(date_part)
        potential_original_id = original_requested_id // 1000000
        
        # Only check if it looks like a valid synthetic ID format (6-8 digit date)
        if 6 <= len(date_part_str) <= 8:
            try:
                if len(date_part_str) == 8:
                    month = int(date_part_str[4:6])
                    day = int(date_part_str[6:8])
                elif len(date_part_str) == 6:
                    month = int(date_part_str[2:4])
                    day = int(date_part_str[4:6])
                else:
                    month = day = 0
                # Only check if it's a valid date format AND the original event doesn't exist
                if 1 <= month <= 12 and 1 <= day <= 31:
                    # Check if the original event exists - if not, it's likely a deleted recurring event
                    test_event = db.query(Event).filter(Event.id == potential_original_id).first()
                    if not test_event:
                        # Original event doesn't exist - this is likely a deleted recurring event
                        check_deleted_recurring_event(original_requested_id, db)
                    # If event exists, don't raise an error - it might not be a synthetic ID
            except (ValueError, IndexError):
                # Invalid date format - probably not a synthetic ID, skip the check
                pass
    
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
    
    If the event_id is a synthetic ID from an expanded recurring event instance,
    extract the original event ID and delete that instead.
    """
    # Check if this is a synthetic ID and extract the original event ID
    original_requested_id = event_id
    event_id = extract_original_event_id(event_id, db)
    
    # If extraction didn't happen, check if it's a synthetic ID from a deleted recurring event
    # Only check if the ID looks like a synthetic ID (has a valid date format)
    # AND the original event doesn't exist (which means it was likely deleted)
    if original_requested_id == event_id and original_requested_id > 1000000:
        date_part = original_requested_id % 1000000
        date_part_str = str(date_part)
        potential_original_id = original_requested_id // 1000000
        
        # Only check if it looks like a valid synthetic ID format (6-8 digit date)
        if 6 <= len(date_part_str) <= 8:
            try:
                if len(date_part_str) == 8:
                    month = int(date_part_str[4:6])
                    day = int(date_part_str[6:8])
                elif len(date_part_str) == 6:
                    month = int(date_part_str[2:4])
                    day = int(date_part_str[4:6])
                else:
                    month = day = 0
                # Only check if it's a valid date format AND the original event doesn't exist
                if 1 <= month <= 12 and 1 <= day <= 31:
                    # Check if the original event exists - if not, it's likely a deleted recurring event
                    test_event = db.query(Event).filter(Event.id == potential_original_id).first()
                    if not test_event:
                        # Original event doesn't exist - this is likely a deleted recurring event
                        check_deleted_recurring_event(original_requested_id, db)
                    # If event exists, don't raise an error - it might not be a synthetic ID
            except (ValueError, IndexError):
                # Invalid date format - probably not a synthetic ID, skip the check
                pass
    
    # Verify the extracted event exists
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        if original_requested_id != event_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with id {event_id} not found (extracted from synthetic ID {original_requested_id}). The recurring event may have been deleted."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with id {event_id} not found"
            )
    
    # Use get_event_or_404 for consistency
    event = get_event_or_404(event_id, db)
    EventService.delete_event(db, event)


@router.post("/{event_id}/bands", response_model=BandEventResponse)
def add_band_to_event(event_id: int, band_event_data: BandEventCreateWithoutEventId, db: Session = Depends(get_db)) -> BandEventResponse:
    """
    Add a band to an event lineup.

    This will create a band availability block for the event date.
    
    If the event_id is a synthetic ID from an expanded recurring event instance,
    extract the original event ID and use that instead.
    """
    # Check if this is a synthetic ID and extract the original event ID
    original_requested_id = event_id
    event_id = extract_original_event_id(event_id, db)
    
    # If extraction didn't happen, check if it's a synthetic ID from a deleted recurring event
    # Only check if the ID looks like a synthetic ID (has a valid date format)
    # AND the original event doesn't exist (which means it was likely deleted)
    if original_requested_id == event_id and original_requested_id > 1000000:
        date_part = original_requested_id % 1000000
        date_part_str = str(date_part)
        potential_original_id = original_requested_id // 1000000
        
        # Only check if it looks like a valid synthetic ID format (6-8 digit date)
        if 6 <= len(date_part_str) <= 8:
            try:
                if len(date_part_str) == 8:
                    month = int(date_part_str[4:6])
                    day = int(date_part_str[6:8])
                elif len(date_part_str) == 6:
                    month = int(date_part_str[2:4])
                    day = int(date_part_str[4:6])
                else:
                    month = day = 0
                # Only check if it's a valid date format AND the original event doesn't exist
                if 1 <= month <= 12 and 1 <= day <= 31:
                    # Check if the original event exists - if not, it's likely a deleted recurring event
                    test_event = db.query(Event).filter(Event.id == potential_original_id).first()
                    if not test_event:
                        # Original event doesn't exist - this is likely a deleted recurring event
                        check_deleted_recurring_event(original_requested_id, db)
                    # If event exists, don't raise an error - it might not be a synthetic ID
            except (ValueError, IndexError):
                # Invalid date format - probably not a synthetic ID, skip the check
                pass
    
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
    # Refresh to get the loaded band relationship
    db.refresh(band_event, ["band"])
    band_event_response = BandEventResponse.model_validate(band_event)
    if band_event.band:
        band_event_response.band_name = band_event.band.name
        band_event_response.band_image_path = band_event.band.image_path
    return band_event_response


@router.patch("/{event_id}/bands/{band_id}", response_model=BandEventResponse)
def update_band_event(
    event_id: int,
    band_id: int,
    band_event_data: BandEventUpdate,
    db: Session = Depends(get_db),
) -> BandEventResponse:
    """
    Update band's participation details for an event.
    
    If the event_id is a synthetic ID from an expanded recurring event instance,
    extract the original event ID and use that instead.
    """
    # Check if this is a synthetic ID and extract the original event ID
    original_requested_id = event_id
    event_id = extract_original_event_id(event_id, db)
    
    # If extraction didn't happen, check if it's a synthetic ID from a deleted recurring event
    # Only check if the ID looks like a synthetic ID (has a valid date format)
    # AND the original event doesn't exist (which means it was likely deleted)
    if original_requested_id == event_id and original_requested_id > 1000000:
        date_part = original_requested_id % 1000000
        date_part_str = str(date_part)
        potential_original_id = original_requested_id // 1000000
        
        # Only check if it looks like a valid synthetic ID format (6-8 digit date)
        if 6 <= len(date_part_str) <= 8:
            try:
                if len(date_part_str) == 8:
                    month = int(date_part_str[4:6])
                    day = int(date_part_str[6:8])
                elif len(date_part_str) == 6:
                    month = int(date_part_str[2:4])
                    day = int(date_part_str[4:6])
                else:
                    month = day = 0
                # Only check if it's a valid date format AND the original event doesn't exist
                if 1 <= month <= 12 and 1 <= day <= 31:
                    # Check if the original event exists - if not, it's likely a deleted recurring event
                    test_event = db.query(Event).filter(Event.id == potential_original_id).first()
                    if not test_event:
                        # Original event doesn't exist - this is likely a deleted recurring event
                        check_deleted_recurring_event(original_requested_id, db)
                    # If event exists, don't raise an error - it might not be a synthetic ID
            except (ValueError, IndexError):
                # Invalid date format - probably not a synthetic ID, skip the check
                pass
    
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
    # Refresh to get the loaded band relationship
    db.refresh(updated_band_event, ["band"])
    band_event_response = BandEventResponse.model_validate(updated_band_event)
    if updated_band_event.band:
        band_event_response.band_name = updated_band_event.band.name
        band_event_response.band_image_path = updated_band_event.band.image_path
    return band_event_response


@router.delete("/{event_id}/bands/{band_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_band_from_event(event_id: int, band_id: int, db: Session = Depends(get_db)) -> None:
    """
    Remove a band from an event.

    This will remove the band availability block for the event date.
    
    If the event_id is a synthetic ID from an expanded recurring event instance,
    extract the original event ID and use that instead.
    """
    # Check if this is a synthetic ID and extract the original event ID
    original_requested_id = event_id
    event_id = extract_original_event_id(event_id, db)
    
    # Verify the extracted event exists - if not, try original ID
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event and original_requested_id != event_id:
        logging.warning(f"Extracted event {event_id} from {original_requested_id} but event doesn't exist, trying original ID")
        event = db.query(Event).filter(Event.id == original_requested_id).first()
        if event:
            event_id = original_requested_id
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with id {event_id} not found (extracted from synthetic ID {original_requested_id})"
            )
    
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
    
    If the event_id is a synthetic ID from an expanded recurring event instance,
    extract the original event ID and use that instead.
    """
    # Check if this is a synthetic ID and extract the original event ID
    original_requested_id = event_id
    event_id = extract_original_event_id(event_id, db)
    
    # If extraction didn't happen, check if it's a synthetic ID from a deleted recurring event
    # Only check if the ID looks like a synthetic ID (has a valid date format)
    # AND the original event doesn't exist (which means it was likely deleted)
    if original_requested_id == event_id and original_requested_id > 1000000:
        date_part = original_requested_id % 1000000
        date_part_str = str(date_part)
        potential_original_id = original_requested_id // 1000000
        
        # Only check if it looks like a valid synthetic ID format (6-8 digit date)
        if 6 <= len(date_part_str) <= 8:
            try:
                if len(date_part_str) == 8:
                    month = int(date_part_str[4:6])
                    day = int(date_part_str[6:8])
                elif len(date_part_str) == 6:
                    month = int(date_part_str[2:4])
                    day = int(date_part_str[4:6])
                else:
                    month = day = 0
                # Only check if it's a valid date format AND the original event doesn't exist
                if 1 <= month <= 12 and 1 <= day <= 31:
                    # Check if the original event exists - if not, it's likely a deleted recurring event
                    test_event = db.query(Event).filter(Event.id == potential_original_id).first()
                    if not test_event:
                        # Original event doesn't exist - this is likely a deleted recurring event
                        check_deleted_recurring_event(original_requested_id, db)
                    # If event exists, don't raise an error - it might not be a synthetic ID
            except (ValueError, IndexError):
                # Invalid date format - probably not a synthetic ID, skip the check
                pass
    
    # Verify the extracted event exists - if not, the extraction might have been incorrect
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        if original_requested_id != event_id:
            # Extraction happened but event doesn't exist
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with id {event_id} not found (extracted from synthetic ID {original_requested_id}). The recurring event may have been deleted."
            )
        else:
            # No extraction, event just doesn't exist
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with id {event_id} not found"
            )
    
    # Use get_event_or_404 for consistency
    event = get_event_or_404(event_id, db)
    band_events = EventService.get_event_bands(db, event)
    # Serialize with band_name and band_image_path included
    result = []
    for be in band_events:
        band_event_response = BandEventResponse.model_validate(be)
        # Add band_name and band_image_path if band is loaded
        if be.band:
            band_event_response.band_name = be.band.name
            band_event_response.band_image_path = be.band.image_path
        result.append(band_event_response)
    return result


@router.patch("/{event_id}/schedule", response_model=dict)
def update_event_schedule(
    event_id: int,
    schedule_data: dict,
    db: Session = Depends(get_db),
) -> dict:
    """
    Update event schedule (load in, sound check, and set times) for bands.
    
    Expects: { "schedule": [{ "bandEventId": int, "load_in_time": str, "sound_check_time": str, "set_time": str }, ...] }
    
    If the event_id is a synthetic ID from an expanded recurring event instance,
    extract the original event ID and use that instead.
    """
    from datetime import time as time_type, datetime
    from app.models import BandMember
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    from app.services.notification_service import NotificationService
    
    # Check if this is a synthetic ID and extract the original event ID
    original_requested_id = event_id
    event_id = extract_original_event_id(event_id, db)
    
    # If extraction didn't happen, check if it's a synthetic ID from a deleted recurring event
    # Only check if the ID looks like a synthetic ID (has a valid date format)
    # AND the original event doesn't exist (which means it was likely deleted)
    if original_requested_id == event_id and original_requested_id > 1000000:
        date_part = original_requested_id % 1000000
        date_part_str = str(date_part)
        potential_original_id = original_requested_id // 1000000
        
        # Only check if it looks like a valid synthetic ID format (6-8 digit date)
        if 6 <= len(date_part_str) <= 8:
            try:
                if len(date_part_str) == 8:
                    month = int(date_part_str[4:6])
                    day = int(date_part_str[6:8])
                elif len(date_part_str) == 6:
                    month = int(date_part_str[2:4])
                    day = int(date_part_str[4:6])
                else:
                    month = day = 0
                # Only check if it's a valid date format AND the original event doesn't exist
                if 1 <= month <= 12 and 1 <= day <= 31:
                    # Check if the original event exists - if not, it's likely a deleted recurring event
                    test_event = db.query(Event).filter(Event.id == potential_original_id).first()
                    if not test_event:
                        # Original event doesn't exist - this is likely a deleted recurring event
                        check_deleted_recurring_event(original_requested_id, db)
                    # If event exists, don't raise an error - it might not be a synthetic ID
            except (ValueError, IndexError):
                # Invalid date format - probably not a synthetic ID, skip the check
                pass
    
    event = get_event_or_404(event_id, db)
    
    # Only confirmed events can have schedules
    if event.status != EventStatus.CONFIRMED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only confirmed events can have schedules"
        )
    
    # Reload event with venue relationship
    event = (
        db.query(Event)
        .options(joinedload(Event.venue))
        .filter(Event.id == event_id)
        .first()
    )
    
    schedule_updates = schedule_data.get("schedule", [])
    updated_bands = []
    
    for update in schedule_updates:
        band_event_id = update.get("bandEventId")
        load_in_time_str = update.get("load_in_time")
        sound_check_time_str = update.get("sound_check_time")
        set_time_str = update.get("set_time")
        
        band_event = db.query(BandEvent).filter(BandEvent.id == band_event_id).first()
        if not band_event or band_event.event_id != event_id:
            continue
        
        # Parse time strings
        load_in_time = None
        if load_in_time_str:
            try:
                time_parts = load_in_time_str.split(":")
                load_in_time = time_type(int(time_parts[0]), int(time_parts[1]))
            except (ValueError, IndexError):
                pass
        
        sound_check_time = None
        if sound_check_time_str:
            try:
                time_parts = sound_check_time_str.split(":")
                sound_check_time = time_type(int(time_parts[0]), int(time_parts[1]))
            except (ValueError, IndexError):
                pass
        
        set_time = None
        if set_time_str:
            try:
                time_parts = set_time_str.split(":")
                set_time = time_type(int(time_parts[0]), int(time_parts[1]))
            except (ValueError, IndexError):
                pass
        
        # Update band event
        band_event.load_in_time = load_in_time
        band_event.sound_check_time = sound_check_time
        band_event.set_time = set_time
        updated_bands.append(band_event.band_id)
    
    db.commit()
    
    # Send notifications to all band members for updated bands
    if updated_bands:
        # Get venue name
        venue_name = event.venue.name if event.venue else "Venue"
        
        # Convert event_date to datetime for notification
        if isinstance(event.event_date, date):
            gig_date = datetime.combine(event.event_date, datetime.min.time())
        else:
            gig_date = event.event_date
        
        # Get all band members for updated bands
        notification_count = 0
        for band_id in updated_bands:
            band_members = db.query(BandMember).filter(BandMember.band_id == band_id).all()
            print(f"Found {len(band_members)} members for band {band_id}")
            for member in band_members:
                try:
                    notification_data = NotificationCreate(
                        user_id=member.user_id,
                        type=NotificationType.EVENT_SCHEDULE.value,
                        value="",  # Not used for schedule notifications
                        venue_name=venue_name,
                        gig_name=event.name,
                        gig_date=gig_date,
                    )
                    NotificationService.create_notification(db, notification_data)
                    notification_count += 1
                    print(f"Created notification for user {member.user_id} (band member {member.id})")
                except Exception as e:
                    print(f"Error creating notification for user {member.user_id}: {e}")
                    import traceback
                    traceback.print_exc()
        
        print(f"Created {notification_count} notifications for {len(updated_bands)} bands")
    
    return {"message": "Schedule updated successfully", "updated_bands": len(updated_bands)}
