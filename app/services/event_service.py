from datetime import date
from typing import List, Optional, Tuple

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
        return (
            db.query(BandEvent)
            .filter(BandEvent.event_id == event.id)
            .order_by(BandEvent.performance_order.nullslast())
            .all()
        )

    @staticmethod
    def list_events(
        db: Session,
        venue_id: Optional[int] = None,
        band_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[Event], int]:
        """
        List events with optional filters.
        """
        query = db.query(Event)

        if venue_id is not None:
            query = query.filter(Event.venue_id == venue_id)

        if band_id is not None:
            query = query.join(BandEvent).filter(BandEvent.band_id == band_id).distinct()

        if start_date is not None:
            query = query.filter(Event.event_date >= start_date)

        if end_date is not None:
            query = query.filter(Event.event_date <= end_date)

        total = query.count()
        events = (
            query.order_by(Event.event_date, Event.show_time)
            .offset(skip)
            .limit(limit)
            .all()
        )

        return events, total

