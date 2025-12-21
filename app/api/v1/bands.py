from typing import List, Optional
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Query, status, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.api.deps import check_band_permission, get_band_or_404, get_current_active_user
from app.database import get_db
from app.models import Band as BandModel
from app.models import BandMember, BandRole, User
from app.schemas import Band, BandCreate, BandJoinByInvite, BandMemberAdd, BandMemberSelfUpdate, BandMemberUpdate, BandUpdate
from app.utils.exceptions import BandAlreadyExistsException

router = APIRouter()


def serialize_band_with_members(band: BandModel) -> dict:
    """
    Serialize a band with user information for members.
    """
    band_dict = {
        "id": band.id,
        "name": band.name,
        "description": band.description,
        "genre": band.genre,
        "location": band.location,
        "invite_code": band.invite_code,
        "image_path": band.image_path,
        "created_at": band.created_at,
        "updated_at": band.updated_at,
        "members": [],
    }
    
    # Add member information with user details
    for member in band.members:
        # Access user relationship - it should be loaded via joinedload
        try:
            user = getattr(member, "user", None)
            # If user is not loaded, try to access it directly (might trigger lazy load)
            if user is None and hasattr(member, "user_id"):
                # User relationship not loaded - this shouldn't happen with joinedload, but handle it
                user = None
        except Exception:
            # If there's any error accessing user, set to None
            user = None
        
        # Convert empty string to None for instrument to match schema validation
        instrument_value = member.instrument if member.instrument and member.instrument.strip() else None
        
        member_dict = {
            "id": member.id,
            "user_id": member.user_id,
            "band_id": member.band_id,
            "role": member.role,
            "instrument": instrument_value,
            "joined_at": member.joined_at,
            "user_name": user.full_name if user else None,
            "user_email": user.email if user else None,
        }
        band_dict["members"].append(member_dict)
    
    return band_dict


@router.post("/", response_model=Band, status_code=status.HTTP_201_CREATED)
def create_band(
    band_in: BandCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Band:
    """
    Create a new band. The creator becomes the owner.
    """
    existing_band = db.query(BandModel).filter(BandModel.name == band_in.name).first()
    if existing_band:
        raise BandAlreadyExistsException()

    db_band = BandModel(**band_in.model_dump())
    db.add(db_band)
    db.flush()

    owner_membership = BandMember(user_id=current_user.id, band_id=db_band.id, role=BandRole.OWNER.value)
    db.add(owner_membership)
    db.commit()
    
    # Reload with relationships
    db_band = (
        db.query(BandModel)
        .filter(BandModel.id == db_band.id)
        .options(joinedload(BandModel.members).joinedload(BandMember.user))
        .first()
    )

    return Band.model_validate(serialize_band_with_members(db_band))


@router.get("/", response_model=List[Band])
def list_user_bands(
    search: Optional[str] = Query(None, description="Search term to find bands by name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[Band]:
    """
    List all bands the current user is a member of, or search all bands if search parameter is provided.
    When search is provided, returns all bands matching the search term (for venue owners to find bands).
    """
    if search:
        # Search all bands by name (for venue owners)
        search_term = f"%{search.lower()}%"
        bands = (
            db.query(BandModel)
            .filter(BandModel.name.ilike(search_term))
            .options(joinedload(BandModel.members).joinedload(BandMember.user))
            .limit(50)  # Limit results for performance
            .all()
        )
    else:
        # Query bands with eager loading of members and users (user's bands only)
        bands = (
            db.query(BandModel)
            .join(BandMember, BandMember.band_id == BandModel.id)
            .filter(BandMember.user_id == current_user.id)
            .options(joinedload(BandModel.members).joinedload(BandMember.user))
            .all()
        )

    # Debug logging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"User {current_user.id} ({current_user.email}) - search: {search}, found {len(bands)} bands")
    
    result = [Band.model_validate(serialize_band_with_members(band)) for band in bands]
    
    return result


@router.get("/{band_id}", response_model=Band)
def get_band(
    band_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Band:
    """
    Get details of a specific band.
    """
    # Query band with eager loading of members and users
    band = (
        db.query(BandModel)
        .filter(BandModel.id == band_id)
        .options(joinedload(BandModel.members).joinedload(BandMember.user))
        .first()
    )
    
    if not band:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Band not found")
    
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    
    return Band.model_validate(serialize_band_with_members(band))


@router.post("/join", response_model=Band, status_code=status.HTTP_200_OK)
def join_band_with_invite(
    join_data: BandJoinByInvite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Band:
    """
    Join a band using an invite code.
    """
    try:
        band = (
            db.query(BandModel)
            .filter(BandModel.invite_code == join_data.invite_code)
            .options(joinedload(BandModel.members).joinedload(BandMember.user))
            .first()
        )

        if not band:
            from fastapi import HTTPException

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid invite code",
            )

        existing_membership = (
            db.query(BandMember)
            .filter(BandMember.band_id == band.id, BandMember.user_id == current_user.id)
            .first()
        )

        if existing_membership:
            # User is already a member - return the band instead of raising an error
            # This allows the frontend to redirect to the dashboard
            # Ensure band is loaded with members and users (reload to be safe)
            band = (
                db.query(BandModel)
                .filter(BandModel.id == band.id)
                .options(joinedload(BandModel.members).joinedload(BandMember.user))
                .first()
            )
            return Band.model_validate(serialize_band_with_members(band))

        # Convert empty string to None for instrument
        instrument_value = join_data.instrument if join_data.instrument and join_data.instrument.strip() else None
        
        new_member = BandMember(
            user_id=current_user.id,
            band_id=band.id,
            role=BandRole.MEMBER.value,
            instrument=instrument_value,
        )
        db.add(new_member)
        db.commit()
        
        # Reload the band with members and their user relationships
        band = (
            db.query(BandModel)
            .filter(BandModel.id == band.id)
            .options(joinedload(BandModel.members).joinedload(BandMember.user))
            .first()
        )

        return Band.model_validate(serialize_band_with_members(band))
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        print(e)
        logger.error(f"Error in join_band_with_invite: {e}", exc_info=True)
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )


@router.put("/{band_id}", response_model=Band)
async def update_band(
    band_id: int,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    genre: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Band:
    """
    Update band information. Requires OWNER or ADMIN role.
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])

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

    # Update fields if provided
    if name is not None:
        band.name = name
    if description is not None:
        band.description = description if description.strip() else None
    if genre is not None:
        band.genre = genre if genre.strip() else None
    if location is not None:
        band.location = location if location.strip() else None
    if image_path is not None:
        band.image_path = image_path

    db.add(band)
    db.commit()
    
    # Reload with relationships
    band = (
        db.query(BandModel)
        .filter(BandModel.id == band.id)
        .options(joinedload(BandModel.members).joinedload(BandMember.user))
        .first()
    )

    return Band.model_validate(serialize_band_with_members(band))


@router.delete("/{band_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_band(
    band_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """
    Delete a band. Only the owner can delete a band.
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER])

    db.delete(band)
    db.commit()


@router.post("/{band_id}/members", response_model=Band, status_code=status.HTTP_201_CREATED)
def add_band_member(
    band_id: int,
    member_data: BandMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Band:
    """
    Add a member to a band. Requires OWNER or ADMIN role.
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])

    existing_membership = (
        db.query(BandMember)
        .filter(BandMember.band_id == band_id, BandMember.user_id == member_data.user_id)
        .first()
    )

    if existing_membership:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this band",
        )

    new_member = BandMember(
        user_id=member_data.user_id,
        band_id=band_id,
        role=member_data.role.value,
        instrument=member_data.instrument,
    )
    db.add(new_member)
    db.commit()
    db.refresh(band, ["members"])
    for member in band.members:
        db.refresh(member, ["user"])

    return Band.model_validate(serialize_band_with_members(band))

@router.put("/{band_id}/members/me", response_model=Band)
def update_my_band_member_info(
    band_id: int,
    member_update: BandMemberSelfUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Band:
    """
    Update the current user's own band member information (instrument only).
    Users can update their own instrument in bands they are members of.
    """
    band = get_band_or_404(band_id, db)
    
    # Check if user is a member of this band
    member = (
        db.query(BandMember)
        .filter(BandMember.band_id == band_id, BandMember.user_id == current_user.id)
        .first()
    )
    
    if not member:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not a member of this band"
        )
    
    # Update only instrument (users cannot update their own role)
    update_data = member_update.model_dump(exclude_unset=True)
    if "instrument" in update_data:
        member.instrument = update_data["instrument"]
    
    db.add(member)
    db.commit()
    
    # Reload with relationships
    band = (
        db.query(BandModel)
        .filter(BandModel.id == band_id)
        .options(joinedload(BandModel.members).joinedload(BandMember.user))
        .first()
    )
    
    return Band.model_validate(serialize_band_with_members(band))


@router.put("/{band_id}/members/{member_id}", response_model=Band)
def update_band_member(
    band_id: int,
    member_id: int,
    member_update: BandMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Band:
    """
    Update a band member's role or instrument. Requires OWNER or ADMIN role.
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])

    member = db.query(BandMember).filter(BandMember.id == member_id).first()
    if not member or member.band_id != band_id:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Band member not found")

    update_data = member_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "role":
            setattr(member, field, value.value)
        else:
            setattr(member, field, value)

    db.add(member)
    db.commit()
    
    # Reload with relationships
    band = (
        db.query(BandModel)
        .filter(BandModel.id == band_id)
        .options(joinedload(BandModel.members).joinedload(BandMember.user))
        .first()
    )

    return Band.model_validate(serialize_band_with_members(band))


@router.delete("/{band_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_band_member(
    band_id: int,
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """
    Remove a member from a band. Requires OWNER or ADMIN role.
    Cannot remove the last owner.
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])

    member = db.query(BandMember).filter(BandMember.id == member_id).first()
    if not member or member.band_id != band_id:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Band member not found")

    if member.role == BandRole.OWNER.value:
        owner_count = sum(1 for m in band.members if m.role == BandRole.OWNER.value)
        if owner_count <= 1:
            from fastapi import HTTPException

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner from the band",
            )

    db.delete(member)
    db.commit()
