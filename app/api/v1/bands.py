from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import check_band_permission, get_band_or_404, get_current_active_user
from app.database import get_db
from app.models import Band as BandModel
from app.models import BandMember, BandRole, User
from app.schemas import Band, BandCreate, BandMemberAdd, BandMemberUpdate, BandUpdate
from app.utils.exceptions import BandAlreadyExistsException

router = APIRouter()


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
    db.refresh(db_band)

    return db_band


@router.get("/", response_model=List[Band])
def list_user_bands(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[Band]:
    """
    List all bands the current user is a member of.
    """
    user_bands = []
    for membership in current_user.band_memberships:
        user_bands.append(membership.band)

    return user_bands


@router.get("/{band_id}", response_model=Band)
def get_band(
    band_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Band:
    """
    Get details of a specific band.
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    return band


@router.put("/{band_id}", response_model=Band)
def update_band(
    band_id: int,
    band_update: BandUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Band:
    """
    Update band information. Requires OWNER or ADMIN role.
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])

    update_data = band_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(band, field, value)

    db.add(band)
    db.commit()
    db.refresh(band)

    return band


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
    db.refresh(band)

    return band


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
    db.refresh(band)

    return band


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

