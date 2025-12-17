from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_band_or_404, get_current_user, get_event_or_404
from app.database import get_db
from app.models import Band, Event, EventApplication, User
from app.models.event_application import ApplicationStatus
from app.schemas.event_application import (
    EventApplicationCreate,
    EventApplicationListResponse,
    EventApplicationResponse,
    EventApplicationReview,
    EventApplicationUpdate,
)
from app.services.event_application_service import EventApplicationService

router = APIRouter()


@router.post(
    "/events/{event_id}/applications",
    response_model=EventApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_application(
    event_id: int,
    application_data: EventApplicationCreate,
    band_id: int = Query(..., description="ID of the band applying"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventApplicationResponse:
    """
    Submit an application for a band to perform at an event.
    User must be a member of the band to submit an application.
    """
    event = get_event_or_404(event_id, db)
    band = get_band_or_404(band_id, db)

    if not EventApplicationService.user_can_manage_band(db, current_user, band):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a band member to submit applications",
        )

    existing_application = (
        db.query(EventApplication)
        .filter(EventApplication.event_id == event_id, EventApplication.band_id == band_id)
        .first()
    )

    if existing_application:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Band has already applied to this event",
        )

    application = EventApplicationService.create_application(db, event, band, application_data)
    return EventApplicationResponse.model_validate(application)


@router.get("/events/{event_id}/applications", response_model=EventApplicationListResponse)
def list_event_applications(
    event_id: int,
    status: Optional[ApplicationStatus] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventApplicationListResponse:
    """
    List all applications for an event.
    Venue staff can see all applications.
    Bands can only see their own applications.
    """
    event = get_event_or_404(event_id, db)

    is_venue_staff = EventApplicationService.user_can_manage_venue(db, current_user, event.venue)

    applications, total = EventApplicationService.list_event_applications(
        db,
        event,
        status=status,
        user=current_user if not is_venue_staff else None,
        skip=skip,
        limit=limit,
    )

    return EventApplicationListResponse(
        applications=[EventApplicationResponse.model_validate(app) for app in applications],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/bands/{band_id}/applications", response_model=EventApplicationListResponse)
def list_band_applications(
    band_id: int,
    status: Optional[ApplicationStatus] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventApplicationListResponse:
    """
    List all event applications for a band.
    Only band members can view their band's applications.
    """
    band = get_band_or_404(band_id, db)

    if not EventApplicationService.user_can_manage_band(db, current_user, band):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a band member to view applications",
        )

    applications, total = EventApplicationService.list_band_applications(
        db,
        band,
        status=status,
        skip=skip,
        limit=limit,
    )

    return EventApplicationListResponse(
        applications=[EventApplicationResponse.model_validate(app) for app in applications],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/applications/{application_id}", response_model=EventApplicationResponse)
def get_application(application_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> EventApplicationResponse:
    """
    Get details of a specific application. Accessible to band members and venue staff.
    """
    application = db.query(EventApplication).filter(EventApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    can_view = EventApplicationService.user_can_manage_band(db, current_user, application.band) or EventApplicationService.user_can_manage_venue(db, current_user, application.event.venue)
    if not can_view:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have permission to view this application")

    return EventApplicationResponse.model_validate(application)


@router.patch("/applications/{application_id}", response_model=EventApplicationResponse)
def update_application(
    application_id: int,
    application_data: EventApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventApplicationResponse:
    """
    Update an application message. Only band members can update while pending.
    """
    application = db.query(EventApplication).filter(EventApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if not EventApplicationService.user_can_manage_band(db, current_user, application.band):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a band member to update this application",
        )

    if application.status != ApplicationStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only update pending applications",
        )

    updated_application = EventApplicationService.update_application(db, application, application_data)
    return EventApplicationResponse.model_validate(updated_application)


@router.post("/applications/{application_id}/review", response_model=EventApplicationResponse)
def review_application(
    application_id: int,
    review_data: EventApplicationReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventApplicationResponse:
    """
    Review an application as venue staff. Allows accepting, rejecting, or marking as reviewed.
    """
    application = db.query(EventApplication).filter(EventApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if not EventApplicationService.user_can_manage_venue(db, current_user, application.event.venue):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only venue staff can review applications",
        )

    if application.status == ApplicationStatus.WITHDRAWN.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot review withdrawn applications",
        )

    reviewed_application = EventApplicationService.review_application(db, application, review_data, current_user)

    if review_data.status == ApplicationStatus.ACCEPTED:
        EventApplicationService.add_band_to_event_from_application(db, application)

    return EventApplicationResponse.model_validate(reviewed_application)


@router.post("/applications/{application_id}/withdraw", response_model=EventApplicationResponse)
def withdraw_application(application_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> EventApplicationResponse:
    """
    Withdraw an application as a band member. Only pending applications can be withdrawn.
    """
    application = db.query(EventApplication).filter(EventApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if not EventApplicationService.user_can_manage_band(db, current_user, application.band):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a band member to withdraw this application",
        )

    if application.status != ApplicationStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only withdraw pending applications",
        )

    withdrawn_application = EventApplicationService.withdraw_application(db, application)
    return EventApplicationResponse.model_validate(withdrawn_application)

