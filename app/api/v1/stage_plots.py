import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import check_band_permission, get_band_or_404, get_current_active_user
from app.database import get_db
from app.models import Band as BandModel
from app.models import BandEvent, BandRole, Event, User, Venue, VenueRole, VenueStaff
from app.models.stage_plot import StagePlot as StagePlotModel
from app.utils.exceptions import UnauthorizedBandAccessException
from app.schemas.stage_plot import (
    StagePlot,
    StagePlotCreate,
    StagePlotSummary,
    StagePlotUpdate,
)

router = APIRouter()


def get_stage_plot_or_404(stage_plot_id: int, db: Session) -> StagePlotModel:
    """
    Get a stage plot by ID or raise 404 if not found.
    """
    stage_plot = db.query(StagePlotModel).filter(StagePlotModel.id == stage_plot_id).first()
    if not stage_plot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stage plot not found"
        )
    return stage_plot


@router.post("/", response_model=StagePlot, status_code=status.HTTP_201_CREATED)
def create_stage_plot(
    stage_plot_in: StagePlotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StagePlot:
    """
    Create a new stage plot for a band.
    Requires band membership.
    """
    band = get_band_or_404(stage_plot_in.band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])

    # Convert items and settings to JSON strings
    items_json = json.dumps([item.model_dump() for item in stage_plot_in.items])
    settings_json = json.dumps(stage_plot_in.settings.model_dump() if stage_plot_in.settings else {})

    db_stage_plot = StagePlotModel(
        band_id=stage_plot_in.band_id,
        name=stage_plot_in.name,
        description=stage_plot_in.description,
        items_json=items_json,
        settings_json=settings_json,
    )
    db.add(db_stage_plot)
    db.commit()
    db.refresh(db_stage_plot)

    return StagePlot.model_validate(db_stage_plot)


@router.get("/band/{band_id}", response_model=List[StagePlotSummary])
def list_band_stage_plots(
    band_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[StagePlotSummary]:
    """
    List all stage plots for a band.
    Requires band membership OR venue staff/owner status with band on an event at their venue.
    """
    band = get_band_or_404(band_id, db)
    
    # Check if user is a band member
    is_band_member = False
    try:
        check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
        is_band_member = True
    except UnauthorizedBandAccessException:
        # User is not a band member, check if they're venue staff with band on their event
        pass
    
    # If not a band member, check if user is venue staff and band is on an event at their venue
    if not is_band_member:
        # Get all venues where user is staff/owner
        user_venue_staff = db.query(VenueStaff).filter(VenueStaff.user_id == current_user.id).all()
        venue_ids = [vs.venue_id for vs in user_venue_staff]
        
        if venue_ids:
            # Check if band is on any event at user's venues
            band_event = (
                db.query(BandEvent)
                .join(Event, BandEvent.event_id == Event.id)
                .filter(BandEvent.band_id == band_id, Event.venue_id.in_(venue_ids))
                .first()
            )
            
            if not band_event:
                # User is not a band member and band is not on any event at their venues
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to perform this action"
                )
        else:
            # User is not a band member and not venue staff anywhere
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to perform this action"
            )

    stage_plots = (
        db.query(StagePlotModel)
        .filter(StagePlotModel.band_id == band_id)
        .order_by(StagePlotModel.updated_at.desc())
        .all()
    )

    return [StagePlotSummary.model_validate(sp) for sp in stage_plots]


@router.get("/{stage_plot_id}", response_model=StagePlot)
def get_stage_plot(
    stage_plot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StagePlot:
    """
    Get a specific stage plot by ID.
    Requires band membership OR venue staff/owner status with band on an event at their venue.
    """
    stage_plot = get_stage_plot_or_404(stage_plot_id, db)
    band = get_band_or_404(stage_plot.band_id, db)
    
    # Check if user is a band member
    is_band_member = False
    try:
        check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
        is_band_member = True
    except UnauthorizedBandAccessException:
        # User is not a band member, check if they're venue staff with band on their event
        pass
    
    # If not a band member, check if user is venue staff and band is on an event at their venue
    if not is_band_member:
        # Get all venues where user is staff/owner
        user_venue_staff = db.query(VenueStaff).filter(VenueStaff.user_id == current_user.id).all()
        venue_ids = [vs.venue_id for vs in user_venue_staff]
        
        if venue_ids:
            # Check if band is on any event at user's venues
            band_event = (
                db.query(BandEvent)
                .join(Event, BandEvent.event_id == Event.id)
                .filter(BandEvent.band_id == band.id, Event.venue_id.in_(venue_ids))
                .first()
            )
            
            if not band_event:
                # User is not a band member and band is not on any event at their venues
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to perform this action"
                )
        else:
            # User is not a band member and not venue staff anywhere
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to perform this action"
            )

    return StagePlot.model_validate(stage_plot)


@router.put("/{stage_plot_id}", response_model=StagePlot)
def update_stage_plot(
    stage_plot_id: int,
    stage_plot_update: StagePlotUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StagePlot:
    """
    Update a stage plot.
    Requires band membership.
    """
    stage_plot = get_stage_plot_or_404(stage_plot_id, db)
    band = get_band_or_404(stage_plot.band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])

    update_data = stage_plot_update.model_dump(exclude_unset=True)

    if "name" in update_data:
        stage_plot.name = update_data["name"]
    if "description" in update_data:
        stage_plot.description = update_data["description"]
    if "items" in update_data and update_data["items"] is not None:
        stage_plot.items_json = json.dumps([item.model_dump() for item in stage_plot_update.items])
    if "settings" in update_data and update_data["settings"] is not None:
        stage_plot.settings_json = json.dumps(stage_plot_update.settings.model_dump())

    db.add(stage_plot)
    db.commit()
    db.refresh(stage_plot)

    return StagePlot.model_validate(stage_plot)


@router.delete("/{stage_plot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stage_plot(
    stage_plot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """
    Delete a stage plot.
    Requires OWNER or ADMIN role.
    """
    stage_plot = get_stage_plot_or_404(stage_plot_id, db)
    band = get_band_or_404(stage_plot.band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])

    db.delete(stage_plot)
    db.commit()
