import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import check_band_permission, get_band_or_404, get_current_active_user
from app.database import get_db
from app.models import BandRole, User
from app.models.setlist import Setlist as SetlistModel
from app.schemas.setlist import (
    Setlist,
    SetlistCreate,
    SetlistSummary,
    SetlistUpdate,
)

router = APIRouter()


def get_setlist_or_404(setlist_id: int, db: Session) -> SetlistModel:
    """
    Get a setlist by ID or raise 404 if not found.
    """
    setlist = db.query(SetlistModel).filter(SetlistModel.id == setlist_id).first()
    if not setlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Setlist not found"
        )
    return setlist


@router.post("/", response_model=Setlist, status_code=status.HTTP_201_CREATED)
def create_setlist(
    setlist_in: SetlistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Setlist:
    """
    Create a new setlist for a band.
    Requires band membership.
    """
    band = get_band_or_404(setlist_in.band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])

    # Convert songs to JSON string
    songs_json = json.dumps(setlist_in.songs)

    db_setlist = SetlistModel(
        band_id=setlist_in.band_id,
        name=setlist_in.name,
        songs_json=songs_json,
    )
    db.add(db_setlist)
    db.commit()
    db.refresh(db_setlist)

    return Setlist.model_validate(db_setlist)


@router.get("/band/{band_id}", response_model=List[SetlistSummary])
def list_band_setlists(
    band_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[SetlistSummary]:
    """
    List all setlists for a band.
    Requires band membership.
    """
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])

    setlists = (
        db.query(SetlistModel)
        .filter(SetlistModel.band_id == band_id)
        .order_by(SetlistModel.updated_at.desc())
        .all()
    )

    return [SetlistSummary.model_validate(sl) for sl in setlists]


@router.get("/{setlist_id}", response_model=Setlist)
def get_setlist(
    setlist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Setlist:
    """
    Get a specific setlist by ID.
    Requires band membership.
    """
    setlist = get_setlist_or_404(setlist_id, db)
    band = get_band_or_404(setlist.band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])

    return Setlist.model_validate(setlist)


@router.put("/{setlist_id}", response_model=Setlist)
def update_setlist(
    setlist_id: int,
    setlist_update: SetlistUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Setlist:
    """
    Update a setlist.
    Requires band membership.
    """
    setlist = get_setlist_or_404(setlist_id, db)
    band = get_band_or_404(setlist.band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])

    update_data = setlist_update.model_dump(exclude_unset=True)

    if "name" in update_data:
        setlist.name = update_data["name"]
    if "songs" in update_data and update_data["songs"] is not None:
        setlist.songs_json = json.dumps(setlist_update.songs)

    db.add(setlist)
    db.commit()
    db.refresh(setlist)

    return Setlist.model_validate(setlist)


@router.delete("/{setlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_setlist(
    setlist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """
    Delete a setlist.
    Requires band membership.
    """
    setlist = get_setlist_or_404(setlist_id, db)
    band = get_band_or_404(setlist.band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])

    db.delete(setlist)
    db.commit()

