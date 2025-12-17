from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session, joinedload

from app.models import Band, BandEvent, BandMember, Event, EventApplication, User, Venue, VenueStaff
from app.models.event_application import ApplicationStatus
from app.schemas.event_application import EventApplicationCreate, EventApplicationReview, EventApplicationUpdate


class EventApplicationService:
    """
    Service for managing event applications.
    """

    @staticmethod
    def create_application(db: Session, event: Event, band: Band, application_data: EventApplicationCreate) -> EventApplication:
        application = EventApplication(
            event_id=event.id,
            band_id=band.id,
            message=application_data.message,
            status=ApplicationStatus.PENDING.value,
        )
        db.add(application)
        db.commit()
        db.refresh(application)
        return application

    @staticmethod
    def update_application(db: Session, application: EventApplication, application_data: EventApplicationUpdate) -> EventApplication:
        if application_data.message is not None:
            application.message = application_data.message

        db.commit()
        db.refresh(application)
        return application

    @staticmethod
    def review_application(
        db: Session, application: EventApplication, review_data: EventApplicationReview, reviewer: User
    ) -> EventApplication:
        application.status = review_data.status.value
        application.response_note = review_data.response_note
        application.reviewed_at = datetime.utcnow()
        application.reviewed_by_user_id = reviewer.id

        db.commit()
        db.refresh(application)
        return application

    @staticmethod
    def withdraw_application(db: Session, application: EventApplication) -> EventApplication:
        application.status = ApplicationStatus.WITHDRAWN.value

        db.commit()
        db.refresh(application)
        return application

    @staticmethod
    def add_band_to_event_from_application(db: Session, application: EventApplication) -> None:
        existing_band_event = (
            db.query(BandEvent)
            .filter(BandEvent.event_id == application.event_id, BandEvent.band_id == application.band_id)
            .first()
        )

        if not existing_band_event:
            band_event = BandEvent(event_id=application.event_id, band_id=application.band_id, status="confirmed")
            db.add(band_event)
            db.commit()

    @staticmethod
    def list_event_applications(
        db: Session,
        event: Event,
        status: Optional[ApplicationStatus] = None,
        user: Optional[User] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[EventApplication], int]:
        query = (
            db.query(EventApplication)
            .options(
                joinedload(EventApplication.band),
                joinedload(EventApplication.event),
                joinedload(EventApplication.reviewed_by),
            )
            .filter(EventApplication.event_id == event.id)
        )

        if status is not None:
            query = query.filter(EventApplication.status == status.value)

        if user is not None:
            user_bands = (
                db.query(Band.id).join(BandMember).filter(BandMember.user_id == user.id).subquery()
            )
            query = query.filter(EventApplication.band_id.in_(user_bands))

        total = query.count()
        applications = (
            query.order_by(EventApplication.applied_at.desc()).offset(skip).limit(limit).all()
        )

        return applications, total

    @staticmethod
    def list_band_applications(
        db: Session,
        band: Band,
        status: Optional[ApplicationStatus] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[EventApplication], int]:
        query = (
            db.query(EventApplication)
            .options(joinedload(EventApplication.event), joinedload(EventApplication.reviewed_by))
            .filter(EventApplication.band_id == band.id)
        )

        if status is not None:
            query = query.filter(EventApplication.status == status.value)

        total = query.count()
        applications = (
            query.order_by(EventApplication.applied_at.desc()).offset(skip).limit(limit).all()
        )

        return applications, total

    @staticmethod
    def user_can_manage_band(db: Session, user: User, band: Band) -> bool:
        band_member = (
            db.query(BandMember).filter(BandMember.band_id == band.id, BandMember.user_id == user.id).first()
        )
        return band_member is not None

    @staticmethod
    def user_can_manage_venue(db: Session, user: User, venue: Venue) -> bool:
        venue_staff = (
            db.query(VenueStaff)
            .filter(VenueStaff.venue_id == venue.id, VenueStaff.user_id == user.id)
            .first()
        )
        return venue_staff is not None

