from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models import User, Venue, VenueStaff
from app.models.venue_staff import VenueRole
from app.schemas.venue import VenueCreate, VenueStaffCreate, VenueStaffUpdate, VenueUpdate


class VenueService:
    """
    Service for managing venues and venue staff.
    """

    @staticmethod
    def create_venue(db: Session, venue_data: VenueCreate, owner: User) -> Venue:
        """
        Create a new venue and assign the creating user as owner.
        """
        venue = Venue(**venue_data.model_dump())
        db.add(venue)
        db.flush()

        venue_staff = VenueStaff(venue_id=venue.id, user_id=owner.id, role=VenueRole.OWNER)
        db.add(venue_staff)

        db.commit()
        db.refresh(venue)
        return venue

    @staticmethod
    def update_venue(db: Session, venue: Venue, venue_data: VenueUpdate) -> Venue:
        """
        Update venue details.
        """
        update_data = venue_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(venue, field, value)

        db.commit()
        db.refresh(venue)
        return venue

    @staticmethod
    def delete_venue(db: Session, venue: Venue) -> None:
        """
        Delete a venue and all associated data.
        """
        db.delete(venue)
        db.commit()

    @staticmethod
    def add_venue_staff(db: Session, venue: Venue, user: User, staff_data: VenueStaffCreate) -> VenueStaff:
        """
        Add a staff member to a venue.
        """
        venue_staff = VenueStaff(venue_id=venue.id, user_id=user.id, role=staff_data.role)
        db.add(venue_staff)
        db.commit()
        db.refresh(venue_staff)
        return venue_staff

    @staticmethod
    def update_venue_staff(db: Session, venue_staff: VenueStaff, staff_data: VenueStaffUpdate) -> VenueStaff:
        """
        Update staff member details.
        """
        update_data = staff_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(venue_staff, field, value)

        db.commit()
        db.refresh(venue_staff)
        return venue_staff

    @staticmethod
    def remove_venue_staff(db: Session, venue_staff: VenueStaff) -> None:
        """
        Remove a staff member from a venue.
        """
        db.delete(venue_staff)
        db.commit()

    @staticmethod
    def get_venue_staff(db: Session, venue: Venue) -> List[VenueStaff]:
        """
        Get all staff members for a venue.
        """
        return (
            db.query(VenueStaff)
            .options(joinedload(VenueStaff.user))
            .filter(VenueStaff.venue_id == venue.id)
            .order_by(VenueStaff.role, VenueStaff.joined_at)
            .all()
        )

    @staticmethod
    def get_user_venues(db: Session, user: User) -> List[Venue]:
        """
        Get all venues where a user is a staff member.
        """
        return (
            db.query(Venue)
            .join(VenueStaff)
            .filter(VenueStaff.user_id == user.id)
            .order_by(VenueStaff.role, Venue.name)
            .all()
        )

    @staticmethod
    def user_can_manage_venue(db: Session, user: User, venue: Venue) -> bool:
        """
        Check if a user has management permissions for a venue.
        """
        venue_staff = (
            db.query(VenueStaff)
            .filter(
                VenueStaff.venue_id == venue.id,
                VenueStaff.user_id == user.id,
                VenueStaff.role.in_([VenueRole.OWNER, VenueRole.MANAGER]),
            )
            .first()
        )
        return venue_staff is not None

    @staticmethod
    def user_is_venue_owner(db: Session, user: User, venue: Venue) -> bool:
        """
        Check if a user is an owner of a venue.
        """
        venue_staff = (
            db.query(VenueStaff)
            .filter(
                VenueStaff.venue_id == venue.id,
                VenueStaff.user_id == user.id,
                VenueStaff.role == VenueRole.OWNER,
            )
            .first()
        )
        return venue_staff is not None

    @staticmethod
    def list_venues(
        db: Session,
        city: Optional[str] = None,
        state: Optional[str] = None,
        has_sound_provided: Optional[bool] = None,
        has_parking: Optional[bool] = None,
        min_capacity: Optional[int] = None,
        max_capacity: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[Venue], int]:
        """
        List venues with optional filters.
        """
        query = db.query(Venue)

        if city is not None:
            query = query.filter(func.lower(Venue.city) == func.lower(city))

        if state is not None:
            query = query.filter(func.upper(Venue.state) == func.upper(state))

        if has_sound_provided is not None:
            query = query.filter(Venue.has_sound_provided == has_sound_provided)

        if has_parking is not None:
            query = query.filter(Venue.has_parking == has_parking)

        if min_capacity is not None:
            query = query.filter(Venue.capacity >= min_capacity)

        if max_capacity is not None:
            query = query.filter(Venue.capacity <= max_capacity)

        total = query.count()
        venues = query.order_by(Venue.name).offset(skip).limit(limit).all()

        return venues, total

