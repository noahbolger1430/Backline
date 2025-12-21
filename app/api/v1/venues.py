from typing import List, Optional
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_venue_or_404
from app.database import get_db
from app.models import User, Venue, VenueRole, VenueStaff
from app.schemas.venue import (
    Venue as VenueSchema,
    VenueCreate,
    VenueJoinByInvite,
    VenueListResponse,
    VenueResponse,
    VenueStaffCreate,
    VenueStaffResponse,
    VenueStaffUpdate,
    VenueUpdate,
)
from app.services.venue_service import VenueService

router = APIRouter()


@router.post("/", response_model=VenueResponse, status_code=status.HTTP_201_CREATED)
async def create_venue(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    street_address: str = Form(...),
    city: str = Form(...),
    state: str = Form(...),
    zip_code: str = Form(...),
    capacity: Optional[int] = Form(None),
    has_sound_provided: bool = Form(False),
    has_parking: bool = Form(False),
    age_restriction: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VenueResponse:
    """
    Create a new venue. The creating user becomes the venue owner automatically.
    """
    try:
        existing_venue = db.query(Venue).filter(Venue.name == name).first()
        if existing_venue:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Venue with name '{name}' already exists",
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

        # Create venue data
        venue_data_dict = {
            "name": name,
            "description": description,
            "street_address": street_address,
            "city": city,
            "state": state,
            "zip_code": zip_code,
            "capacity": capacity,
            "has_sound_provided": has_sound_provided,
            "has_parking": has_parking,
            "age_restriction": age_restriction,
        }
        
        venue_data = VenueCreate(**venue_data_dict)

        venue = VenueService.create_venue(db, venue_data, current_user)
        
        # Update image_path if image was uploaded
        if image_path:
            venue.image_path = image_path
            db.commit()
            db.refresh(venue)
        
        # Reload venue with relationships to ensure hybrid properties (event_count, staff_count) work
        venue = (
            db.query(Venue)
            .options(joinedload(Venue.events), joinedload(Venue.staff))
            .filter(Venue.id == venue.id)
            .first()
        )
        
        return VenueResponse.model_validate(venue)
    except HTTPException:
        raise
    except Exception as e:
        print(e)
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating venue: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )


@router.get("/", response_model=VenueListResponse)
def list_venues(
    city: Optional[str] = None,
    state: Optional[str] = None,
    has_sound_provided: Optional[bool] = None,
    has_parking: Optional[bool] = None,
    min_capacity: Optional[int] = Query(None, ge=0),
    max_capacity: Optional[int] = Query(None, ge=0),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> VenueListResponse:
    """
    List venues with optional filters by location, amenities, or capacity.
    """
    if min_capacity and max_capacity and min_capacity > max_capacity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="min_capacity cannot be greater than max_capacity",
        )

    venues, total = VenueService.list_venues(
        db,
        city=city,
        state=state,
        has_sound_provided=has_sound_provided,
        has_parking=has_parking,
        min_capacity=min_capacity,
        max_capacity=max_capacity,
        skip=skip,
        limit=limit,
    )

    return VenueListResponse(
        venues=[VenueResponse.model_validate(v) for v in venues],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/my-venues", response_model=List[VenueResponse])
def get_my_venues(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> List[VenueResponse]:
    """
    Get all venues where the current user is a staff member.
    """
    venues = VenueService.get_user_venues(db, current_user)
    return [VenueResponse.model_validate(v) for v in venues]


@router.get("/{venue_id}", response_model=VenueResponse)
def get_venue(venue_id: int, db: Session = Depends(get_db)) -> VenueResponse:
    """
    Get venue details by ID.
    """
    venue = get_venue_or_404(venue_id, db)
    return VenueResponse.model_validate(venue)


@router.patch("/{venue_id}", response_model=VenueResponse)
def update_venue(
    venue_id: int,
    venue_data: VenueUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VenueResponse:
    """
    Update venue details. Requires owner or manager role at the venue.
    """
    venue = get_venue_or_404(venue_id, db)

    if not VenueService.user_can_manage_venue(db, current_user, venue):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this venue",
        )

    if venue_data.name and venue_data.name != venue.name:
        existing_venue = (
            db.query(Venue).filter(Venue.name == venue_data.name, Venue.id != venue_id).first()
        )
        if existing_venue:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Venue with name '{venue_data.name}' already exists",
            )

    updated_venue = VenueService.update_venue(db, venue, venue_data)
    return VenueResponse.model_validate(updated_venue)


@router.delete("/{venue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_venue(venue_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    """
    Delete a venue. Requires owner role.
    """
    venue = get_venue_or_404(venue_id, db)

    if not VenueService.user_is_venue_owner(db, current_user, venue):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only venue owners can delete venues",
        )

    VenueService.delete_venue(db, venue)


@router.post("/{venue_id}/staff", response_model=VenueStaffResponse)
def add_venue_staff(
    venue_id: int,
    staff_data: VenueStaffCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VenueStaffResponse:
    """
    Add a staff member to a venue. Requires owner or manager role.
    """
    venue = get_venue_or_404(venue_id, db)

    if not VenueService.user_can_manage_venue(db, current_user, venue):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to manage venue staff",
        )

    target_user = db.query(User).filter(User.id == staff_data.user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing_staff = (
        db.query(VenueStaff)
        .filter(VenueStaff.venue_id == venue_id, VenueStaff.user_id == staff_data.user_id)
        .first()
    )
    if existing_staff:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a staff member at this venue",
        )

    if staff_data.role == VenueRole.OWNER and not VenueService.user_is_venue_owner(db, current_user, venue):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can assign owner role",
        )

    venue_staff = VenueService.add_venue_staff(db, venue, target_user, staff_data)
    return VenueStaffResponse.model_validate(venue_staff)


@router.get("/{venue_id}/staff", response_model=List[VenueStaffResponse])
def get_venue_staff(venue_id: int, db: Session = Depends(get_db)) -> List[VenueStaffResponse]:
    """
    Get all staff members for a venue.
    """
    venue = get_venue_or_404(venue_id, db)
    staff_members = VenueService.get_venue_staff(db, venue)
    return [VenueStaffResponse.model_validate(s) for s in staff_members]


@router.patch("/{venue_id}/staff/{user_id}", response_model=VenueStaffResponse)
def update_venue_staff(
    venue_id: int,
    user_id: int,
    staff_data: VenueStaffUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VenueStaffResponse:
    """
    Update a staff member's role. Requires owner role.
    """
    venue = get_venue_or_404(venue_id, db)

    if not VenueService.user_is_venue_owner(db, current_user, venue):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only venue owners can update staff roles",
        )

    venue_staff = (
        db.query(VenueStaff).filter(VenueStaff.venue_id == venue_id, VenueStaff.user_id == user_id).first()
    )
    if not venue_staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a staff member at this venue",
        )

    if venue_staff.user_id == current_user.id and staff_data.role != VenueRole.OWNER:
        owner_count = (
            db.query(VenueStaff)
            .filter(VenueStaff.venue_id == venue_id, VenueStaff.role == VenueRole.OWNER)
            .count()
        )
        if owner_count == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner",
            )

    updated_staff = VenueService.update_venue_staff(db, venue_staff, staff_data)
    return VenueStaffResponse.model_validate(updated_staff)


@router.delete("/{venue_id}/staff/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_venue_staff(
    venue_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """
    Remove a staff member. Staff can remove themselves; owners/managers can remove others.
    """
    venue = get_venue_or_404(venue_id, db)

    venue_staff = (
        db.query(VenueStaff).filter(VenueStaff.venue_id == venue_id, VenueStaff.user_id == user_id).first()
    )
    if not venue_staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a staff member at this venue",
        )

    if user_id == current_user.id:
        owner_count = (
            db.query(VenueStaff)
            .filter(VenueStaff.venue_id == venue_id, VenueStaff.role == VenueRole.OWNER)
            .count()
        )
        if venue_staff.role == VenueRole.OWNER and owner_count == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner",
            )
    else:
        if not VenueService.user_can_manage_venue(db, current_user, venue):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to remove staff members",
            )

    VenueService.remove_venue_staff(db, venue_staff)


@router.post("/join", response_model=VenueResponse, status_code=status.HTTP_200_OK)
def join_venue_with_invite(
    join_data: VenueJoinByInvite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VenueResponse:
    """
    Join a venue using an invite code.
    """
    venue = db.query(Venue).filter(Venue.invite_code == join_data.invite_code).first()

    if not venue:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code",
        )

    existing_staff = (
        db.query(VenueStaff)
        .filter(VenueStaff.venue_id == venue.id, VenueStaff.user_id == current_user.id)
        .first()
    )

    if existing_staff:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a staff member at this venue",
        )

    new_staff = VenueStaff(
        user_id=current_user.id,
        venue_id=venue.id,
        role=VenueRole.STAFF.value,
    )
    db.add(new_staff)
    db.commit()
    
    # Reload venue with relationships to ensure hybrid properties work
    venue = (
        db.query(Venue)
        .options(joinedload(Venue.events), joinedload(Venue.staff))
        .filter(Venue.id == venue.id)
        .first()
    )

    return VenueResponse.model_validate(venue)

