from datetime import datetime, timedelta, time, date
from typing import List, Optional
from dateutil.rrule import rrule, DAILY, WEEKLY, MONTHLY

from sqlalchemy.orm import Session

from app.models import Rehearsal, RehearsalInstance, RehearsalAttachment, BandMember, User
from app.models.rehearsal import RecurrenceFrequency
from app.schemas.rehearsal import RehearsalCreate, RehearsalUpdate
from app.services.notification_service import NotificationService
from app.schemas.notification import NotificationCreate
from app.models.notification import NotificationType


class RehearsalService:
    """
    Service for managing rehearsals and generating recurring instances.
    """
    
    @staticmethod
    def create_rehearsal(db: Session, rehearsal_data: RehearsalCreate, band_id: int, user_id: int) -> Rehearsal:
        """Create a new rehearsal and generate instances if recurring."""
        # Create the rehearsal
        rehearsal = Rehearsal(
            band_id=band_id,
            created_by_user_id=user_id,
            is_recurring="true" if rehearsal_data.is_recurring else "false",
            recurrence_frequency=rehearsal_data.recurrence_frequency.value if rehearsal_data.recurrence_frequency else None,
            recurrence_start_date=rehearsal_data.recurrence_start_date,
            recurrence_end_date=rehearsal_data.recurrence_end_date,
            rehearsal_date=rehearsal_data.rehearsal_date,
            start_time=rehearsal_data.start_time,
            location=rehearsal_data.location,
            duration_minutes=rehearsal_data.duration_minutes,
            notes=rehearsal_data.notes,
        )
        
        db.add(rehearsal)
        db.flush()
        
        # Generate instances if recurring
        if rehearsal_data.is_recurring and rehearsal_data.recurrence_start_date:
            RehearsalService._generate_recurring_instances(
                db, rehearsal, rehearsal_data.recurrence_start_date,
                rehearsal_data.recurrence_end_date
            )
        elif rehearsal_data.rehearsal_date:
            # Create single instance for non-recurring rehearsal
            instance = RehearsalInstance(
                rehearsal_id=rehearsal.id,
                instance_date=rehearsal_data.rehearsal_date,
                location=rehearsal_data.location,
                duration_minutes=rehearsal_data.duration_minutes,
                notes=rehearsal_data.notes,
            )
            db.add(instance)
        
        db.commit()
        db.refresh(rehearsal)
        
        # Send notifications to band members
        RehearsalService._notify_band_members(db, rehearsal, band_id)
        
        return rehearsal
    
    @staticmethod
    def _generate_recurring_instances(
        db: Session, rehearsal: Rehearsal, start_date: datetime, end_date: Optional[datetime]
    ) -> None:
        """Generate individual rehearsal instances from a recurring schedule."""
        # Determine frequency
        freq_map = {
            RecurrenceFrequency.DAILY: DAILY,
            RecurrenceFrequency.WEEKLY: WEEKLY,
            RecurrenceFrequency.BIWEEKLY: WEEKLY,  # Weekly with interval 2
            RecurrenceFrequency.MONTHLY: MONTHLY,
        }
        
        frequency = freq_map.get(RecurrenceFrequency(rehearsal.recurrence_frequency), WEEKLY)
        interval = 2 if rehearsal.recurrence_frequency == RecurrenceFrequency.BIWEEKLY.value else 1
        
        # Set end date to 1 year from start if not provided
        if not end_date:
            end_date = start_date + timedelta(days=365)
        
        # Generate dates using rrule
        dates = list(rrule(
            freq=frequency,
            interval=interval,
            dtstart=start_date,
            until=end_date
        ))
        
        # Create instances for each date
        for instance_date in dates:
            # Combine date with start time
            combined_datetime = datetime.combine(instance_date.date(), rehearsal.start_time)
            if instance_date.tzinfo:
                combined_datetime = combined_datetime.replace(tzinfo=instance_date.tzinfo)
            
            instance = RehearsalInstance(
                rehearsal_id=rehearsal.id,
                instance_date=combined_datetime,
                location=rehearsal.location,
                duration_minutes=rehearsal.duration_minutes,
                notes=rehearsal.notes,
            )
            db.add(instance)
    
    @staticmethod
    def _notify_band_members(db: Session, rehearsal: Rehearsal, band_id: int) -> None:
        """Send notifications to all band members about the new rehearsal."""
        # Get all band members
        members = db.query(BandMember).filter(BandMember.band_id == band_id).all()
        
        # Determine the first rehearsal date for notification
        if rehearsal.is_recurring == "true" and rehearsal.recurrence_start_date:
            first_date = rehearsal.recurrence_start_date
        elif rehearsal.rehearsal_date:
            first_date = rehearsal.rehearsal_date
        else:
            return  # No date to notify about
        
        # Create notifications for each member
        for member in members:
            notification_data = NotificationCreate(
                user_id=member.user_id,
                type=NotificationType.EVENT_SCHEDULE.value,
                value="Rehearsal scheduled",
                venue_name="",  # Not applicable for rehearsals
                gig_name=f"Rehearsal at {rehearsal.location}",
                gig_date=first_date,
                event_application_id=None,
            )
            NotificationService.create_notification(db, notification_data)
    
    @staticmethod
    def update_rehearsal(
        db: Session, rehearsal_id: int, rehearsal_data: RehearsalUpdate, band_id: int
    ) -> Optional[Rehearsal]:
        """Update a rehearsal."""
        rehearsal = db.query(Rehearsal).filter(
            Rehearsal.id == rehearsal_id,
            Rehearsal.band_id == band_id
        ).first()
        
        if not rehearsal:
            return None
        
        # Update fields
        if rehearsal_data.start_time is not None:
            rehearsal.start_time = rehearsal_data.start_time
        if rehearsal_data.location is not None:
            rehearsal.location = rehearsal_data.location
        if rehearsal_data.duration_minutes is not None:
            rehearsal.duration_minutes = rehearsal_data.duration_minutes
        if rehearsal_data.notes is not None:
            rehearsal.notes = rehearsal_data.notes
        if rehearsal_data.recurrence_end_date is not None:
            rehearsal.recurrence_end_date = rehearsal_data.recurrence_end_date
        
        # Update existing instances if location or duration changed
        if rehearsal_data.location is not None or rehearsal_data.duration_minutes is not None:
            for instance in rehearsal.instances:
                if instance.instance_date > datetime.now(instance.instance_date.tzinfo) if instance.instance_date.tzinfo else datetime.now():
                    if rehearsal_data.location is not None:
                        instance.location = rehearsal_data.location
                    if rehearsal_data.duration_minutes is not None:
                        instance.duration_minutes = rehearsal_data.duration_minutes
        
        db.commit()
        db.refresh(rehearsal)
        return rehearsal
    
    @staticmethod
    def delete_rehearsal(db: Session, rehearsal_id: int, band_id: int) -> bool:
        """Delete a rehearsal and all its instances."""
        rehearsal = db.query(Rehearsal).filter(
            Rehearsal.id == rehearsal_id,
            Rehearsal.band_id == band_id
        ).first()
        
        if not rehearsal:
            return False
        
        db.delete(rehearsal)
        db.commit()
        return True
    
    @staticmethod
    def get_band_rehearsals(
        db: Session, band_id: int, start_date: Optional[date] = None, end_date: Optional[date] = None
    ) -> List[Rehearsal]:
        """Get all rehearsals for a band, optionally filtered by date range."""
        query = db.query(Rehearsal).filter(Rehearsal.band_id == band_id)
        
        if start_date or end_date:
            # Filter by instances in date range
            query = query.join(RehearsalInstance).filter(
                RehearsalInstance.instance_date >= datetime.combine(start_date, time.min) if start_date else True,
                RehearsalInstance.instance_date <= datetime.combine(end_date, time.max) if end_date else True
            )
        
        return query.order_by(Rehearsal.created_at.desc()).all()
    
    @staticmethod
    def get_rehearsal_instances_for_calendar(
        db: Session, band_id: int, start_date: date, end_date: date
    ) -> List[RehearsalInstance]:
        """Get rehearsal instances for calendar display in a date range."""
        return db.query(RehearsalInstance).join(Rehearsal).filter(
            Rehearsal.band_id == band_id,
            RehearsalInstance.instance_date >= datetime.combine(start_date, time.min),
            RehearsalInstance.instance_date <= datetime.combine(end_date, time.max)
        ).order_by(RehearsalInstance.instance_date.asc()).all()
    
    @staticmethod
    def add_attachment(
        db: Session, rehearsal_id: int, file_path: str, file_name: str,
        file_type: Optional[str], file_size: Optional[int], user_id: int,
        instance_id: Optional[int] = None
    ) -> RehearsalAttachment:
        """Add a file attachment to a rehearsal or specific instance."""
        attachment = RehearsalAttachment(
            rehearsal_id=rehearsal_id,
            instance_id=instance_id,
            file_path=file_path,
            file_name=file_name,
            file_type=file_type,
            file_size=file_size,
            uploaded_by_user_id=user_id,
        )
        db.add(attachment)
        db.commit()
        db.refresh(attachment)
        return attachment
    
    @staticmethod
    def get_instance_attachments(
        db: Session, instance_id: int, band_id: int
    ) -> List[RehearsalAttachment]:
        """Get attachments for a specific rehearsal instance."""
        return (
            db.query(RehearsalAttachment)
            .join(RehearsalInstance)
            .join(Rehearsal)
            .filter(
                RehearsalInstance.id == instance_id,
                Rehearsal.band_id == band_id,
                RehearsalAttachment.instance_id == instance_id
            )
            .all()
        )
    
    @staticmethod
    def delete_attachment(
        db: Session, attachment_id: int, rehearsal_id: int, instance_id: Optional[int] = None
    ) -> bool:
        """Delete a rehearsal attachment, optionally filtered by instance_id."""
        query = db.query(RehearsalAttachment).filter(
            RehearsalAttachment.id == attachment_id,
            RehearsalAttachment.rehearsal_id == rehearsal_id
        )
        
        # If instance_id is provided, filter by it to ensure we're deleting the right attachment
        if instance_id is not None:
            query = query.filter(RehearsalAttachment.instance_id == instance_id)
        
        attachment = query.first()
        
        if not attachment:
            return False
        
        db.delete(attachment)
        db.commit()
        return True
    
    @staticmethod
    def update_rehearsal_instance(
        db: Session, instance_id: int, band_id: int, instance_data
    ) -> Optional[RehearsalInstance]:
        """Update a single rehearsal instance (for recurring rehearsals, only affects this instance)."""
        from app.schemas.rehearsal import RehearsalInstanceUpdate
        
        # Get the instance and verify it belongs to the band
        instance = (
            db.query(RehearsalInstance)
            .join(Rehearsal)
            .filter(
                RehearsalInstance.id == instance_id,
                Rehearsal.band_id == band_id
            )
            .first()
        )
        
        if not instance:
            return None
        
        # Update instance fields
        if instance_data.instance_date is not None:
            instance.instance_date = instance_data.instance_date
        if instance_data.location is not None:
            instance.location = instance_data.location
        if instance_data.duration_minutes is not None:
            instance.duration_minutes = instance_data.duration_minutes
        if instance_data.notes is not None:
            instance.notes = instance_data.notes
        
        db.commit()
        db.refresh(instance)
        return instance
    
    @staticmethod
    def get_rehearsal_instance(
        db: Session, instance_id: int, band_id: int
    ) -> Optional[RehearsalInstance]:
        """Get a single rehearsal instance by ID."""
        return (
            db.query(RehearsalInstance)
            .join(Rehearsal)
            .filter(
                RehearsalInstance.id == instance_id,
                Rehearsal.band_id == band_id
            )
            .first()
        )

