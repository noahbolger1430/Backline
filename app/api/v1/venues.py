from typing import List, Optional
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_venue_or_404
from app.database import get_db
from app.models import User, Venue, VenueRole, VenueStaff, VenueEquipment
from app.models.venue_favorite import VenueFavorite
from app.models.venue_operating_hours import VenueOperatingHours
from app.schemas.venue import (
    Venue as VenueSchema,
    VenueCreate,
    VenueJoinByInvite,
    VenueListResponse,
    VenueOperatingHoursResponse,
    VenueOperatingHoursUpdate,
    VenueResponse,
    VenueStaffCreate,
    VenueStaffResponse,
    VenueStaffUpdate,
    VenueUpdate,
)
from app.schemas.equipment import (
    VenueEquipment as VenueEquipmentSchema,
    VenueEquipmentCreate,
    VenueEquipmentUpdate,
    VenueEquipmentList,
    get_venue_backline_categories,
    EquipmentCategories,
)
from app.services.venue_service import VenueService
from app.services.storage import storage_service

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
    Create a new venue.
    
    Creates a venue with the authenticated user as the owner. Venue names
    must be unique. An invite code is automatically generated for staff.
    
    **Parameters:**
    - **name**: Unique venue name (required)
    - **description**: Venue description
    - **street_address**: Street address (required)
    - **city**: City (required)
    - **state**: State/province (required)
    - **zip_code**: Postal code (required)
    - **capacity**: Maximum capacity
    - **has_sound_provided**: Sound system available
    - **has_parking**: Parking available
    - **age_restriction**: Minimum age (e.g., 21)
    - **image**: Venue photo
    
    **Returns:**
    - **201 Created**: Venue created with invite code
    - **409 Conflict**: Venue name already exists
    
    **Response includes:**
    - All venue details
    - Generated invite code
    - Staff and event counts
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
            image_path = await storage_service.upload_image(image, folder="venues")

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
    band_id: Optional[int] = Query(None, description="Optional band ID to include favorite status"),
    db: Session = Depends(get_db),
) -> VenueListResponse:
    """
    Search and list venues with filters.
    
    Public endpoint for discovering venues. Supports filtering by
    location, amenities, and capacity.
    
    **Parameters:**
    - **city**: Filter by city (partial match)
    - **state**: Filter by state/province
    - **has_sound_provided**: Filter venues with sound
    - **has_parking**: Filter venues with parking
    - **min_capacity**: Minimum venue capacity
    - **max_capacity**: Maximum venue capacity
    - **skip**: Pagination offset
    - **limit**: Page size (max 100)
    
    **Returns:**
    - **200 OK**: Paginated list of venues
    - **400 Bad Request**: Invalid capacity range
    
    **Use Cases:**
    - Bands searching for venues
    - Public venue directory
    - Filtered venue discovery
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

    # Get favorite status if band_id is provided
    favorite_venue_ids = set()
    if band_id:
        favorites = (
            db.query(VenueFavorite)
            .filter(VenueFavorite.band_id == band_id)
            .all()
        )
        favorite_venue_ids = {f.venue_id for f in favorites}

    # Build response with favorite status
    venue_responses = []
    for venue in venues:
        venue_data = VenueResponse.model_validate(venue).model_dump()
        if band_id is not None:
            venue_data["is_favorited"] = venue.id in favorite_venue_ids
        venue_responses.append(VenueResponse(**venue_data))

    return VenueListResponse(
        venues=venue_responses,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/my-venues", response_model=List[VenueResponse])
def get_my_venues(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> List[VenueResponse]:
    """
    Get venues where the current user is staff.
    
    Returns all venues where the authenticated user has any staff role
    (owner, manager, or staff).
    
    **Returns:**
    - **200 OK**: List of user's venues with their role
    
    **Use Cases:**
    - Venue staff dashboard
    - Quick venue switching
    - Staff venue overview
    """
    venues = VenueService.get_user_venues(db, current_user)
    return [VenueResponse.model_validate(v) for v in venues]


@router.get("/{venue_id}", response_model=VenueResponse)
def get_venue(venue_id: int, db: Session = Depends(get_db)) -> VenueResponse:
    """
    Get detailed venue information.
    
    Public endpoint - returns complete venue details including
    location, amenities, and counts.
    
    **Parameters:**
    - **venue_id**: ID of the venue
    
    **Returns:**
    - **200 OK**: Complete venue information
    - **404 Not Found**: Venue not found
    
    **Response includes:**
    - All venue attributes
    - Full address
    - Event and staff counts
    - Invite code (for staff to see)
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
    Update venue information.
    
    Venue owners and managers can update venue details. All fields
    are optional - only provided fields are updated.
    
    **Parameters:**
    - **venue_id**: ID of the venue
    - **venue_data**: Fields to update (all optional)
    
    **Returns:**
    - **200 OK**: Updated venue information
    - **403 Forbidden**: Not owner or manager
    - **404 Not Found**: Venue not found
    - **409 Conflict**: Name already taken
    
    **Permissions:**
    - Owners: Can update all fields
    - Managers: Can update all fields
    - Staff: No update permissions
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


@router.post("/{venue_id}/image", response_model=VenueResponse)
async def update_venue_image(
    venue_id: int,
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VenueResponse:
    """
    Update venue image.
    
    Venue owners and managers can upload a new image for the venue.
    The old image file will be deleted if it exists.
    
    **Parameters:**
    - **venue_id**: ID of the venue
    - **image**: New image file (JPEG, PNG, GIF, or WebP)
    
    **Returns:**
    - **200 OK**: Updated venue information with new image path
    - **403 Forbidden**: Not owner or manager
    - **404 Not Found**: Venue not found
    - **400 Bad Request**: Invalid image file
    
    **Permissions:**
    - Owners: Can update image
    - Managers: Can update image
    - Staff: No update permissions
    """
    venue = get_venue_or_404(venue_id, db)

    if not VenueService.user_can_manage_venue(db, current_user, venue):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this venue",
        )

    # Validate file type
    if image.content_type not in ["image/jpeg", "image/png", "image/gif", "image/webp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image type. Allowed types: JPEG, PNG, GIF, WebP",
        )

    try:
        # Delete old image if it exists
        if venue.image_path:
            storage_service.delete_image(venue.image_path)

        # Upload new image
        image_path = await storage_service.upload_image(image, folder="venues")

        # Update venue with new image path
        venue.image_path = image_path
        db.commit()
        db.refresh(venue)

        # Reload venue with relationships to ensure hybrid properties work
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
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error updating venue image: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update venue image: {str(e)}",
        )


@router.get("/{venue_id}/operating-hours", response_model=List[VenueOperatingHoursResponse])
def get_venue_operating_hours(
    venue_id: int,
    db: Session = Depends(get_db),
) -> List[VenueOperatingHoursResponse]:
    """
    Get venue operating hours for all days of the week.
    
    **Parameters:**
    - **venue_id**: ID of the venue
    
    **Returns:**
    - **200 OK**: List of operating hours for each day (may be empty)
    - **404 Not Found**: Venue not found
    """
    # Verify venue exists
    get_venue_or_404(venue_id, db)
    
    hours = (
        db.query(VenueOperatingHours)
        .filter(VenueOperatingHours.venue_id == venue_id)
        .order_by(VenueOperatingHours.day_of_week)
        .all()
    )
    
    # Return empty list if no hours are set yet
    return [VenueOperatingHoursResponse.model_validate(h) for h in hours]


@router.put("/{venue_id}/operating-hours", response_model=List[VenueOperatingHoursResponse])
def update_venue_operating_hours(
    venue_id: int,
    hours_data: List[VenueOperatingHoursUpdate],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[VenueOperatingHoursResponse]:
    """
    Update venue operating hours for all days of the week.
    
    Replaces all existing operating hours with the provided data.
    Each day of the week (0=Monday through 6=Sunday) can have:
    - is_closed: True if venue is closed that day
    - open_time: Opening time (required if not closed)
    - close_time: Closing time (required if not closed)
    
    **Parameters:**
    - **venue_id**: ID of the venue
    - **hours_data**: List of operating hours for each day
    
    **Returns:**
    - **200 OK**: Updated list of operating hours
    - **403 Forbidden**: Not owner or manager
    - **404 Not Found**: Venue not found
    
    **Permissions:**
    - Owners: Can update hours
    - Managers: Can update hours
    - Staff: No update permissions
    """
    venue = get_venue_or_404(venue_id, db)

    if not VenueService.user_can_manage_venue(db, current_user, venue):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this venue",
        )

    try:
        # Delete existing operating hours
        db.query(VenueOperatingHours).filter(VenueOperatingHours.venue_id == venue_id).delete()
        db.flush()
        
        # Create new operating hours
        new_hours = []
        for hour_data in hours_data:
            # Validate that open/close times are provided if not closed
            if not hour_data.is_closed:
                if hour_data.open_time is None or hour_data.close_time is None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Open and close times are required for day {hour_data.day_of_week} when not closed",
                    )
            
            operating_hour = VenueOperatingHours(
                venue_id=venue_id,
                day_of_week=hour_data.day_of_week,
                is_closed=hour_data.is_closed,
                open_time=hour_data.open_time if not hour_data.is_closed else None,
                close_time=hour_data.close_time if not hour_data.is_closed else None,
            )
            db.add(operating_hour)
            new_hours.append(operating_hour)
        
        db.commit()
        
        # Refresh all hours to get IDs and timestamps
        for hour in new_hours:
            db.refresh(hour)
        
        return [VenueOperatingHoursResponse.model_validate(h) for h in new_hours]
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error updating venue operating hours: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update operating hours: {str(e)}",
        )


@router.delete("/{venue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_venue(venue_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    """
    Delete a venue permanently.
    
    Only venue owners can delete venues. This removes all associated
    data including events, staff, and availability.
    
    **Parameters:**
    - **venue_id**: ID of the venue to delete
    
    **Returns:**
    - **204 No Content**: Venue deleted
    - **403 Forbidden**: Not the venue owner
    - **404 Not Found**: Venue not found
    
    **Warning:** This cannot be undone!
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
    Add a staff member to a venue.
    
    Venue owners and managers can add staff members by user ID.
    Only owners can grant owner role.
    
    **Parameters:**
    - **venue_id**: ID of the venue
    - **staff_data**: Staff member details
        - **user_id**: ID of user to add
        - **role**: Role to assign (STAFF, MANAGER, OWNER)
    
    **Returns:**
    - **200 OK**: Staff member added
    - **403 Forbidden**: Insufficient permissions
    - **404 Not Found**: Venue or user not found
    - **409 Conflict**: User already staff member
    
    **Permissions:**
    - Owners: Can add any role
    - Managers: Can add STAFF only
    - Staff: Cannot add staff
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
    
    Public endpoint - anyone can see venue staff list.
    
    **Parameters:**
    - **venue_id**: ID of the venue
    
    **Returns:**
    - **200 OK**: List of staff members with roles
    - **404 Not Found**: Venue not found
    
    **Response includes:**
    - User ID and details
    - Staff role
    - Join date
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
    Update a staff member's role.
    
    Only venue owners can change staff roles. Cannot remove the
    last owner from a venue.
    
    **Parameters:**
    - **venue_id**: ID of the venue
    - **user_id**: ID of the staff member
    - **staff_data**: New role assignment
        - **role**: New role (STAFF, MANAGER, OWNER)
    
    **Returns:**
    - **200 OK**: Role updated
    - **400 Bad Request**: Would remove last owner
    - **403 Forbidden**: Not venue owner
    - **404 Not Found**: Staff member not found
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
    Remove a staff member from a venue.
    
    Staff can remove themselves. Owners/managers can remove others.
    Cannot remove the last owner.
    
    **Parameters:**
    - **venue_id**: ID of the venue
    - **user_id**: ID of staff member to remove
    
    **Returns:**
    - **204 No Content**: Staff member removed
    - **400 Bad Request**: Would remove last owner
    - **403 Forbidden**: Insufficient permissions
    - **404 Not Found**: Staff member not found
    
    **Permissions:**
    - Self-removal: Any staff member
    - Remove others: Owners and managers only
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
    Join a venue staff using an invite code.
    
    Users with a valid invite code can join as staff members.
    New members receive STAFF role by default.
    
    **Parameters:**
    - **join_data**: Invite code
        - **invite_code**: 6-character venue invite code
    
    **Returns:**
    - **200 OK**: Successfully joined venue
    - **400 Bad Request**: Already a staff member
    - **404 Not Found**: Invalid invite code
    
    **Notes:**
    - Invite codes are case-sensitive
    - Staff role can be upgraded by owners later
    """
    venue = db.query(Venue).filter(Venue.invite_code == join_data.invite_code).first()

    if not venue:
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


# Venue Equipment Endpoints

@router.get("/{venue_id}/equipment/categories", response_model=EquipmentCategories)
def list_venue_equipment_categories() -> EquipmentCategories:
    """
    Get all available backline equipment categories for venues.
    Returns only categories that are valid for venue backline equipment.
    """
    return get_venue_backline_categories()


@router.get("/{venue_id}/equipment", response_model=VenueEquipmentList)
def list_venue_equipment(
    venue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VenueEquipmentList:
    """
    List all equipment for a venue.
    Requires staff membership at the venue.
    """
    venue = get_venue_or_404(venue_id, db)
    
    # Check if user is staff member
    if not VenueService.user_can_manage_venue(db, current_user, venue):
        staff_check = (
            db.query(VenueStaff)
            .filter(VenueStaff.venue_id == venue_id, VenueStaff.user_id == current_user.id)
            .first()
        )
        if not staff_check:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be a staff member to view venue equipment",
            )
    
    equipment_list = (
        db.query(VenueEquipment)
        .filter(VenueEquipment.venue_id == venue_id)
        .order_by(VenueEquipment.category, VenueEquipment.name)
        .all()
    )
    
    return VenueEquipmentList(
        equipment=[VenueEquipmentSchema.model_validate(eq) for eq in equipment_list],
        total=len(equipment_list)
    )


@router.post("/{venue_id}/equipment", response_model=VenueEquipmentSchema, status_code=status.HTTP_201_CREATED)
def create_venue_equipment(
    venue_id: int,
    equipment_data: VenueEquipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VenueEquipmentSchema:
    """
    Add a new piece of equipment to the venue's backline.
    Requires owner or manager permissions.
    """
    venue = get_venue_or_404(venue_id, db)
    
    # Check permissions - only owners and managers can add equipment
    if not VenueService.user_can_manage_venue(db, current_user, venue):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an owner or manager to add venue equipment",
        )
    
    equipment = VenueEquipment(
        venue_id=venue_id,
        **equipment_data.model_dump()
    )
    
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    
    return VenueEquipmentSchema.model_validate(equipment)


@router.get("/{venue_id}/equipment/{equipment_id}", response_model=VenueEquipmentSchema)
def get_venue_equipment(
    venue_id: int,
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VenueEquipmentSchema:
    """
    Get a specific piece of venue equipment by ID.
    Requires staff membership at the venue.
    """
    venue = get_venue_or_404(venue_id, db)
    
    # Check if user is staff member
    staff_check = (
        db.query(VenueStaff)
        .filter(VenueStaff.venue_id == venue_id, VenueStaff.user_id == current_user.id)
        .first()
    )
    if not staff_check:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a staff member to view venue equipment",
        )
    
    equipment = (
        db.query(VenueEquipment)
        .filter(
            VenueEquipment.id == equipment_id,
            VenueEquipment.venue_id == venue_id
        )
        .first()
    )
    
    if not equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment not found"
        )
    
    return VenueEquipmentSchema.model_validate(equipment)


@router.put("/{venue_id}/equipment/{equipment_id}", response_model=VenueEquipmentSchema)
def update_venue_equipment(
    venue_id: int,
    equipment_id: int,
    equipment_data: VenueEquipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VenueEquipmentSchema:
    """
    Update a piece of venue equipment.
    Requires owner or manager permissions.
    """
    venue = get_venue_or_404(venue_id, db)
    
    # Check permissions
    if not VenueService.user_can_manage_venue(db, current_user, venue):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an owner or manager to update venue equipment",
        )
    
    equipment = (
        db.query(VenueEquipment)
        .filter(
            VenueEquipment.id == equipment_id,
            VenueEquipment.venue_id == venue_id
        )
        .first()
    )
    
    if not equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment not found"
        )
    
    update_data = equipment_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(equipment, field, value)
    
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    
    return VenueEquipmentSchema.model_validate(equipment)


@router.delete("/{venue_id}/equipment/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_venue_equipment(
    venue_id: int,
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete a piece of venue equipment.
    Requires owner or manager permissions.
    """
    venue = get_venue_or_404(venue_id, db)
    
    # Check permissions
    if not VenueService.user_can_manage_venue(db, current_user, venue):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an owner or manager to delete venue equipment",
        )
    
    equipment = (
        db.query(VenueEquipment)
        .filter(
            VenueEquipment.id == equipment_id,
            VenueEquipment.venue_id == venue_id
        )
        .first()
    )
    
    if not equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment not found"
        )
    
    db.delete(equipment)
    db.commit()

