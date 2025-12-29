from typing import Generator

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database import get_db
from app.models import Band, BandMember, BandRole, Event, User, Venue, VenueRole, VenueStaff
from app.utils.exceptions import (
    BandNotFoundException,
    CredentialsException,
    InactiveUserException,
    UnauthorizedBandAccessException,
    UnauthorizedVenueAccessException,
    VenueNotFoundException,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """
    Dependency to get the current authenticated user from JWT token.
    """
    email = decode_access_token(token)
    if email is None:
        raise CredentialsException()

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise CredentialsException()

    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency to get current user and verify they are active.
    """
    if not current_user.is_active:
        raise InactiveUserException()
    return current_user


def get_band_or_404(band_id: int, db: Session) -> Band:
    """
    Get band by ID or raise 404 exception.
    """
    band = db.query(Band).filter(Band.id == band_id).first()
    if not band:
        raise BandNotFoundException()
    return band


def check_band_permission(band: Band, user: User, required_roles: list[BandRole]) -> BandMember:
    """
    Check if user has required role in band.
    Raises exception if user is not a member or lacks permission.
    """
    membership = None
    for member in band.members:
        if member.user_id == user.id:
            membership = member
            break

    if not membership:
        raise UnauthorizedBandAccessException()

    if BandRole(membership.role) not in required_roles:
        raise UnauthorizedBandAccessException()

    return membership


def get_venue_or_404(venue_id: int, db: Session) -> Venue:
    """
    Get venue by ID or raise 404 exception.
    """
    venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not venue:
        raise VenueNotFoundException()
    return venue


def check_venue_permission(venue: Venue, user: User, required_roles: list[VenueRole]) -> VenueStaff:
    """
    Check if user has required role at venue.
    Raises exception if user is not staff or lacks permission.
    Returns the staff membership if authorized.
    """
    staff_membership = None
    for staff in venue.staff:
        if staff.user_id == user.id:
            staff_membership = staff
            break

    if not staff_membership:
        raise UnauthorizedVenueAccessException()

    if VenueRole(staff_membership.role) not in required_roles:
        raise UnauthorizedVenueAccessException()

    return staff_membership


def get_event_or_404(event_id: int, db: Session) -> Event:
    """
    Get an event by ID or raise 404.
    
    Note: This function does NOT handle synthetic IDs from recurring events.
    Use extract_original_event_id() before calling this function if you need to handle synthetic IDs.
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id {event_id} not found",
        )
    return event

