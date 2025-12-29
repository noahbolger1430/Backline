from datetime import date, timedelta
from typing import List, Optional, Tuple
import copy

from sqlalchemy.orm import Session

from app.models import Band, BandAvailability, BandEvent, Event
from app.models.availability import AvailabilityStatus
from app.schemas.event import BandEventCreate, BandEventUpdate, EventCreate, EventUpdate


class EventService:
    """
    Service for managing events and their impact on availability.
    """

    @staticmethod
    def create_event(db: Session, event_data: EventCreate) -> Event:
        """
        Create a new event.
        """
        event = Event(**event_data.model_dump())
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    @staticmethod
    def update_event(db: Session, event: Event, event_data: EventUpdate) -> Event:
        """
        Update an event.
        """
        update_data = event_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(event, field, value)

        db.commit()
        db.refresh(event)
        return event

    @staticmethod
    def delete_event(db: Session, event: Event) -> None:
        """
        Delete an event and clean up related data.
        """
        db.delete(event)
        db.commit()

    @staticmethod
    def add_band_to_event(db: Session, event: Event, band: Band, band_event_data: BandEventCreate) -> BandEvent:
        """
        Add a band to an event and create availability block.
        """
        band_event = BandEvent(
            event_id=event.id,
            band_id=band.id,
            status=band_event_data.status,
            set_time=band_event_data.set_time,
            set_length_minutes=band_event_data.set_length_minutes,
            performance_order=band_event_data.performance_order,
        )
        db.add(band_event)

        existing_availability = (
            db.query(BandAvailability)
            .filter(BandAvailability.band_id == band.id, BandAvailability.date == event.event_date)
            .first()
        )

        if not existing_availability:
            band_availability = BandAvailability(
                band_id=band.id,
                date=event.event_date,
                status=AvailabilityStatus.UNAVAILABLE.value,
                note=f"Performing at {event.name}",
            )
            db.add(band_availability)

        db.commit()
        db.refresh(band_event)
        return band_event

    @staticmethod
    def update_band_event(db: Session, band_event: BandEvent, band_event_data: BandEventUpdate) -> BandEvent:
        """
        Update band's participation in an event.
        """
        update_data = band_event_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(band_event, field, value)

        db.commit()
        db.refresh(band_event)
        return band_event

    @staticmethod
    def remove_band_from_event(db: Session, band_event: BandEvent) -> None:
        """
        Remove a band from an event and clean up availability.
        """
        event = band_event.event
        band_id = band_event.band_id

        db.delete(band_event)

        other_events = (
            db.query(BandEvent)
            .join(Event)
            .filter(
                BandEvent.band_id == band_id,
                Event.event_date == event.event_date,
                BandEvent.event_id != event.id,
            )
            .first()
        )

        if not other_events:
            db.query(BandAvailability).filter(
                BandAvailability.band_id == band_id,
                BandAvailability.date == event.event_date,
                BandAvailability.note.like(f"%{event.name}%"),
            ).delete(synchronize_session=False)

        db.commit()

    @staticmethod
    def get_event_bands(db: Session, event: Event) -> List[BandEvent]:
        """
        Get all bands performing at an event.
        """
        from sqlalchemy.orm import joinedload
        return (
            db.query(BandEvent)
            .options(joinedload(BandEvent.band))
            .filter(BandEvent.event_id == event.id)
            .order_by(BandEvent.performance_order.nullslast())
            .all()
        )

    @staticmethod
    def _expand_recurring_event(event: Event, start_date: date, end_date: date) -> List[Event]:
        """
        Expand a recurring event into individual event instances for the given date range.
        Returns a list of Event objects (virtual instances, not saved to DB).
        """
        if not event.is_recurring:
            return [event]
        
        if event.recurring_start_date is None or event.recurring_end_date is None:
            return [event]
        
        if event.recurring_day_of_week is None or event.recurring_frequency is None:
            return [event]
        
        instances = []
        end_recurring = min(event.recurring_end_date, end_date)
        
        # Find the first occurrence of the selected day of week on or after the recurring_start_date
        # day_of_week: 0=Monday, 6=Sunday
        # Python weekday(): 0=Monday, 6=Sunday
        start_date_weekday = event.recurring_start_date.weekday()
        target_weekday = event.recurring_day_of_week
        
        # Calculate days until the target day of week
        days_until_target = (target_weekday - start_date_weekday) % 7
        # If the start date is already the target day, days_until_target will be 0
        # If not, we need to move forward to the next occurrence of that day
        
        current_occurrence = event.recurring_start_date + timedelta(days=days_until_target)
        
        # If we're before the start date (shouldn't happen, but just in case), move to next occurrence
        if current_occurrence < event.recurring_start_date:
            if event.recurring_frequency == "weekly":
                current_occurrence += timedelta(days=7)
            elif event.recurring_frequency == "bi_weekly":
                current_occurrence += timedelta(days=14)
            elif event.recurring_frequency == "monthly":
                # Move to same day next month
                if current_occurrence.month == 12:
                    current_occurrence = current_occurrence.replace(year=current_occurrence.year + 1, month=1)
                else:
                    current_occurrence = current_occurrence.replace(month=current_occurrence.month + 1)
        
        # Only include instances that are within the query date range
        if current_occurrence < start_date:
            # Skip to the first occurrence within the query range
            while current_occurrence < start_date and current_occurrence <= event.recurring_end_date:
                if event.recurring_frequency == "weekly":
                    current_occurrence += timedelta(days=7)
                elif event.recurring_frequency == "bi_weekly":
                    current_occurrence += timedelta(days=14)
                elif event.recurring_frequency == "monthly":
                    # Move to same day next month
                    if current_occurrence.month == 12:
                        current_occurrence = current_occurrence.replace(year=current_occurrence.year + 1, month=1)
                    else:
                        try:
                            current_occurrence = current_occurrence.replace(month=current_occurrence.month + 1)
                        except ValueError:
                            # Handle cases where the day doesn't exist in the next month
                            if current_occurrence.month == 12:
                                next_month = current_occurrence.replace(year=current_occurrence.year + 1, month=1, day=1)
                            else:
                                next_month = current_occurrence.replace(month=current_occurrence.month + 1, day=1)
                            from calendar import monthrange
                            last_day = monthrange(next_month.year, next_month.month)[1]
                            current_occurrence = next_month.replace(day=last_day)
                else:
                    break
        
        while current_occurrence <= end_recurring and current_occurrence <= event.recurring_end_date:
            # Create a virtual event instance for this occurrence
            # Use copy.copy() and then update the event_date
            instance = copy.copy(event)
            # Create a unique ID for this instance (combine event ID with date)
            # This ensures each occurrence has a unique identifier
            instance.id = event.id * 1000000 + int(current_occurrence.strftime('%Y%m%d'))
            # Store the original event ID so we can fetch the real event when needed
            instance._original_event_id = event.id
            # Set the event_date on the instance
            # We need to use object.__setattr__ to bypass SQLAlchemy's attribute system if needed
            try:
                instance.event_date = current_occurrence
            except:
                # If direct assignment fails, try using __dict__
                instance.__dict__['event_date'] = current_occurrence
            instance.is_recurring = False  # Individual instances are not recurring
            # Clear recurring fields on instances
            instance.recurring_day_of_week = None
            instance.recurring_frequency = None
            instance.recurring_start_date = None
            instance.recurring_end_date = None
            instances.append(instance)
            
            # Calculate next occurrence
            if event.recurring_frequency == "weekly":
                current_occurrence += timedelta(days=7)
            elif event.recurring_frequency == "bi_weekly":
                current_occurrence += timedelta(days=14)
            elif event.recurring_frequency == "monthly":
                # Move to same day next month
                if current_occurrence.month == 12:
                    current_occurrence = current_occurrence.replace(year=current_occurrence.year + 1, month=1)
                else:
                    try:
                        current_occurrence = current_occurrence.replace(month=current_occurrence.month + 1)
                    except ValueError:
                        # Handle cases where the day doesn't exist in the next month (e.g., Jan 31 -> Feb 31)
                        # Move to last day of next month
                        if current_occurrence.month == 12:
                            next_month = current_occurrence.replace(year=current_occurrence.year + 1, month=1, day=1)
                        else:
                            next_month = current_occurrence.replace(month=current_occurrence.month + 1, day=1)
                        # Get last day of next month
                        from calendar import monthrange
                        last_day = monthrange(next_month.year, next_month.month)[1]
                        current_occurrence = next_month.replace(day=last_day)
        
        return instances

    @staticmethod
    def list_events(
        db: Session,
        venue_id: Optional[int] = None,
        band_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[str] = None,
        is_open_for_applications: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
        expand_recurring: bool = True,
    ) -> Tuple[List[Event], int]:
        """
        List events with optional filters.
        If expand_recurring is True, expands recurring events into individual instances for the date range.
        If False, returns recurring events as single entries.
        """
        # First, get all events (including recurring ones that might be outside the date range)
        query = db.query(Event)

        if venue_id is not None:
            query = query.filter(Event.venue_id == venue_id)

        if band_id is not None:
            query = query.join(BandEvent).filter(BandEvent.band_id == band_id).distinct()

        # For recurring events, we need to check if they overlap with the date range
        # So we don't filter by date here for recurring events
        from sqlalchemy import or_, and_
        
        if start_date is not None and end_date is not None:
            # Include events that are either:
            # 1. Non-recurring and in the date range, OR
            # 2. Recurring and their recurring period overlaps with the date range
            query = query.filter(
                or_(
                    and_(Event.is_recurring == False, Event.event_date >= start_date, Event.event_date <= end_date),
                    and_(
                        Event.is_recurring == True,
                        Event.recurring_start_date <= end_date,
                        Event.recurring_end_date >= start_date
                    )
                )
            )
        elif start_date is not None:
            query = query.filter(
                or_(
                    and_(Event.is_recurring == False, Event.event_date >= start_date),
                    and_(
                        Event.is_recurring == True,
                        Event.recurring_end_date >= start_date
                    )
                )
            )
        elif end_date is not None:
            query = query.filter(
                or_(
                    and_(Event.is_recurring == False, Event.event_date <= end_date),
                    and_(
                        Event.is_recurring == True,
                        Event.recurring_start_date <= end_date
                    )
                )
            )

        if status is not None:
            query = query.filter(Event.status == status)

        if is_open_for_applications is not None:
            query = query.filter(Event.is_open_for_applications == is_open_for_applications)

        all_events = query.order_by(Event.event_date, Event.show_time).all()
        
        if expand_recurring:
            # Expand recurring events
            expanded_events = []
            effective_start = start_date or date.min
            effective_end = end_date or date.max
            
            # First, collect all non-recurring events and track their dates
            single_event_dates = set()
            for event in all_events:
                if not event.is_recurring:
                    # Only include non-recurring events that are in the date range
                    if (start_date is None or event.event_date >= start_date) and \
                       (end_date is None or event.event_date <= end_date):
                        expanded_events.append(event)
                        single_event_dates.add(event.event_date)
            
            # Then expand recurring events, but skip dates where single events exist
            for event in all_events:
                if event.is_recurring:
                    instances = EventService._expand_recurring_event(event, effective_start, effective_end)
                    # Filter out instances for dates where a single event already exists
                    for instance in instances:
                        if instance.event_date not in single_event_dates:
                            expanded_events.append(instance)
            
            # Sort expanded events by date and time
            expanded_events.sort(key=lambda e: (e.event_date, e.show_time))
            
            # Apply pagination
            total = len(expanded_events)
            paginated_events = expanded_events[skip:skip + limit]
            
            return paginated_events, total
        else:
            # Don't expand recurring events - return them as single entries
            # Filter non-recurring events by date range
            filtered_events = []
            for event in all_events:
                if event.is_recurring:
                    # Include recurring events if their period overlaps with the query range
                    if start_date is None and end_date is None:
                        filtered_events.append(event)
                    elif start_date is None:
                        if event.recurring_start_date <= end_date:
                            filtered_events.append(event)
                    elif end_date is None:
                        if event.recurring_end_date >= start_date:
                            filtered_events.append(event)
                    else:
                        if event.recurring_start_date <= end_date and event.recurring_end_date >= start_date:
                            filtered_events.append(event)
                else:
                    # Only include non-recurring events that are in the date range
                    if (start_date is None or event.event_date >= start_date) and \
                       (end_date is None or event.event_date <= end_date):
                        filtered_events.append(event)
            
            # Sort by start date (for recurring) or event_date (for non-recurring)
            filtered_events.sort(key=lambda e: e.recurring_start_date if e.is_recurring else e.event_date)
            
            # Apply pagination
            total = len(filtered_events)
            paginated_events = filtered_events[skip:skip + limit]
            
            return paginated_events, total
