from typing import List, Optional
from datetime import date
from pathlib import Path
import uuid
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, status, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.api.deps import check_band_permission, get_band_or_404, get_current_active_user
from app.models.band_member import BandRole
from app.database import get_db
from app.models import User, Rehearsal, RehearsalInstance, RehearsalAttachment
from app.models.setlist import Setlist as SetlistModel
from app.schemas.rehearsal import (
    Rehearsal as RehearsalSchema,
    RehearsalCreate,
    RehearsalUpdate,
    RehearsalInstanceUpdate,
    RehearsalInstance as RehearsalInstanceSchema,
    RehearsalAttachment as RehearsalAttachmentSchema,
    RehearsalCalendarItem,
)
from app.services.rehearsal_service import RehearsalService
from app.services.storage import storage_service

router = APIRouter()


@router.post("/bands/{band_id}/rehearsals", response_model=RehearsalSchema, status_code=status.HTTP_201_CREATED)
def create_rehearsal(
    band_id: int,
    rehearsal_data: RehearsalCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> RehearsalSchema:
    """
    Create a new rehearsal for a band.
    
    Requires admin or owner role in the band.
    """
    # Check permissions
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])
    
    # Validate recurring rehearsal data
    if rehearsal_data.is_recurring:
        if not rehearsal_data.recurrence_frequency:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="recurrence_frequency is required for recurring rehearsals"
            )
        if not rehearsal_data.recurrence_start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="recurrence_start_date is required for recurring rehearsals"
            )
    else:
        if not rehearsal_data.rehearsal_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="rehearsal_date is required for non-recurring rehearsals"
            )
    
    rehearsal = RehearsalService.create_rehearsal(db, rehearsal_data, band_id, current_user.id)
    
    # Load relationships including setlist for attachments
    rehearsal = (
        db.query(Rehearsal)
        .options(
            joinedload(Rehearsal.attachments).joinedload(RehearsalAttachment.setlist),
            joinedload(Rehearsal.instances)
        )
        .filter(Rehearsal.id == rehearsal.id)
        .first()
    )
    
    r_dict = RehearsalSchema.model_validate(rehearsal).model_dump()
    if rehearsal.attachments:
        for att_dict, att_model in zip(r_dict["attachments"], rehearsal.attachments):
            if att_model.setlist:
                att_dict["setlist_name"] = att_model.setlist.name
    
    return r_dict


@router.get("/bands/{band_id}/rehearsals", response_model=List[RehearsalSchema])
def get_band_rehearsals(
    band_id: int,
    start_date: Optional[date] = Query(None, description="Filter rehearsals from this date"),
    end_date: Optional[date] = Query(None, description="Filter rehearsals until this date"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> List[RehearsalSchema]:
    """
    Get all rehearsals for a band.
    
    Optionally filter by date range.
    """
    # Check user is a member of the band
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    
    rehearsals = RehearsalService.get_band_rehearsals(db, band_id, start_date, end_date)
    
    # Load relationships including setlist for attachments
    rehearsals = (
        db.query(Rehearsal)
        .options(
            joinedload(Rehearsal.attachments).joinedload(RehearsalAttachment.setlist),
            joinedload(Rehearsal.instances)
        )
        .filter(Rehearsal.id.in_([r.id for r in rehearsals]))
        .all()
    )
    
    # Convert to schema format with setlist_name for attachments
    result = []
    for r in rehearsals:
        r_dict = RehearsalSchema.model_validate(r).model_dump()
        if r.attachments:
            for att_dict, att_model in zip(r_dict["attachments"], r.attachments):
                if att_model.setlist:
                    att_dict["setlist_name"] = att_model.setlist.name
        result.append(r_dict)
    
    return result


@router.get("/bands/{band_id}/rehearsals/calendar", response_model=List[RehearsalCalendarItem])
def get_rehearsals_for_calendar(
    band_id: int,
    start_date: date = Query(..., description="Start date for calendar range"),
    end_date: date = Query(..., description="End date for calendar range"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> List[RehearsalCalendarItem]:
    """
    Get rehearsal instances for calendar display.
    
    Returns individual rehearsal instances in the specified date range.
    """
    # Check user is a member of the band
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    
    instances = RehearsalService.get_rehearsal_instances_for_calendar(db, band_id, start_date, end_date)
    
    # Load rehearsal info
    rehearsal_ids = list(set([i.rehearsal_id for i in instances]))
    rehearsals = (
        db.query(Rehearsal)
        .filter(Rehearsal.id.in_(rehearsal_ids))
        .all()
    )
    rehearsal_map = {r.id: r for r in rehearsals}
    
    calendar_items = []
    for instance in instances:
        rehearsal = rehearsal_map[instance.rehearsal_id]
        calendar_items.append(RehearsalCalendarItem(
            id=instance.id,
            instance_date=instance.instance_date,
            start_time=rehearsal.start_time,
            location=instance.location,
            duration_minutes=instance.duration_minutes,
            notes=instance.notes,
            rehearsal_id=rehearsal.id,
            is_recurring=rehearsal.is_recurring == "true",
        ))
    
    return calendar_items


@router.get("/bands/{band_id}/rehearsals/{rehearsal_id}", response_model=RehearsalSchema)
def get_rehearsal(
    band_id: int,
    rehearsal_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> RehearsalSchema:
    """
    Get a specific rehearsal by ID.
    """
    # Check user is a member of the band
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    
    rehearsal = (
        db.query(Rehearsal)
        .options(
            joinedload(Rehearsal.attachments).joinedload(RehearsalAttachment.setlist),
            joinedload(Rehearsal.instances)
        )
        .filter(
            Rehearsal.id == rehearsal_id,
            Rehearsal.band_id == band_id
        )
        .first()
    )
    
    if not rehearsal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rehearsal not found"
        )
    
    r_dict = RehearsalSchema.model_validate(rehearsal).model_dump()
    if rehearsal.attachments:
        for att_dict, att_model in zip(r_dict["attachments"], rehearsal.attachments):
            if att_model.setlist:
                att_dict["setlist_name"] = att_model.setlist.name
    
    return r_dict


@router.put("/bands/{band_id}/rehearsals/{rehearsal_id}", response_model=RehearsalSchema)
def update_rehearsal(
    band_id: int,
    rehearsal_id: int,
    rehearsal_data: RehearsalUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> RehearsalSchema:
    """
    Update a rehearsal.
    
    Requires admin or owner role in the band.
    """
    # Check permissions
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])
    
    rehearsal = RehearsalService.update_rehearsal(db, rehearsal_id, rehearsal_data, band_id)
    
    if not rehearsal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rehearsal not found"
        )
    
    # Load relationships including setlist for attachments
    rehearsal = (
        db.query(Rehearsal)
        .options(
            joinedload(Rehearsal.attachments).joinedload(RehearsalAttachment.setlist),
            joinedload(Rehearsal.instances)
        )
        .filter(Rehearsal.id == rehearsal.id)
        .first()
    )
    
    r_dict = RehearsalSchema.model_validate(rehearsal).model_dump()
    if rehearsal.attachments:
        for att_dict, att_model in zip(r_dict["attachments"], rehearsal.attachments):
            if att_model.setlist:
                att_dict["setlist_name"] = att_model.setlist.name
    
    return r_dict


@router.delete("/bands/{band_id}/rehearsals/{rehearsal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rehearsal(
    band_id: int,
    rehearsal_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> None:
    """
    Delete a rehearsal and all its instances.
    
    Requires admin or owner role in the band.
    """
    # Check permissions
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])
    
    success = RehearsalService.delete_rehearsal(db, rehearsal_id, band_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rehearsal not found"
        )


@router.post(
    "/bands/{band_id}/rehearsals/{rehearsal_id}/attachments",
    response_model=RehearsalAttachmentSchema,
    status_code=status.HTTP_201_CREATED
)
async def upload_rehearsal_attachment(
    band_id: int,
    rehearsal_id: int,
    file: UploadFile = File(...),
    file_type: Optional[str] = Form(None, description="File type/category (setlist, video, demo, etc.)"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> RehearsalAttachmentSchema:
    """
    Upload a file attachment to a rehearsal.
    
    Requires admin or owner role in the band.
    """
    # Check permissions
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])
    
    # Verify rehearsal exists and belongs to band
    rehearsal = db.query(Rehearsal).filter(
        Rehearsal.id == rehearsal_id,
        Rehearsal.band_id == band_id
    ).first()
    
    if not rehearsal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rehearsal not found"
        )
    
    # Upload file to GCP or local storage
    file_path, file_size = await storage_service.upload_file(file, folder="rehearsal_attachments")
    
    # Create attachment record
    attachment = RehearsalService.add_attachment(
        db, rehearsal_id, file_path, file.filename, file_type, file_size, current_user.id
    )
    
    # Reload with setlist relationship if it's a setlist attachment
    if attachment.setlist_id:
        attachment = (
            db.query(RehearsalAttachment)
            .options(joinedload(RehearsalAttachment.setlist))
            .filter(RehearsalAttachment.id == attachment.id)
            .first()
        )
    
    att_dict = RehearsalAttachmentSchema.model_validate(attachment).model_dump()
    if attachment.setlist:
        att_dict["setlist_name"] = attachment.setlist.name
    
    return att_dict


@router.delete(
    "/bands/{band_id}/rehearsals/{rehearsal_id}/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_rehearsal_attachment(
    band_id: int,
    rehearsal_id: int,
    attachment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> None:
    """
    Delete a rehearsal attachment.
    
    Requires admin or owner role in the band.
    """
    # Check permissions
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])
    
    # Verify rehearsal exists and belongs to band
    rehearsal = db.query(Rehearsal).filter(
        Rehearsal.id == rehearsal_id,
        Rehearsal.band_id == band_id
    ).first()
    
    if not rehearsal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rehearsal not found"
        )
    
    # Get attachment to delete file
    attachment = db.query(RehearsalAttachment).filter(
        RehearsalAttachment.id == attachment_id,
        RehearsalAttachment.rehearsal_id == rehearsal_id
    ).first()
    
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found"
        )
    
    # Delete file from filesystem (only if it's a file attachment, not a setlist)
    if attachment.file_path and os.path.exists(attachment.file_path):
        try:
            os.remove(attachment.file_path)
        except Exception:
            pass  # Continue even if file deletion fails
    
    # Delete attachment record
    success = RehearsalService.delete_attachment(db, attachment_id, rehearsal_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found"
        )


@router.get("/bands/{band_id}/rehearsals/instances/{instance_id}", response_model=dict)
def get_rehearsal_instance(
    band_id: int,
    instance_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Get a specific rehearsal instance by ID.
    Returns instance data with is_recurring flag from parent rehearsal.
    """
    # Check user is a member of the band
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    
    instance = RehearsalService.get_rehearsal_instance(db, instance_id, band_id)
    
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rehearsal instance not found"
        )
    
    # Get parent rehearsal to include is_recurring flag and start_time
    rehearsal = db.query(Rehearsal).filter(Rehearsal.id == instance.rehearsal_id).first()
    
    instance_dict = RehearsalInstanceSchema.model_validate(instance).model_dump()
    instance_dict["is_recurring"] = rehearsal.is_recurring == "true" if rehearsal else False
    # Include start_time from rehearsal to avoid timezone issues
    if rehearsal:
        instance_dict["start_time"] = rehearsal.start_time.strftime("%H:%M") if rehearsal.start_time else None
    
    # Get instance-specific attachments with setlist relationship loaded
    instance_attachments = (
        db.query(RehearsalAttachment)
        .options(joinedload(RehearsalAttachment.setlist))
        .join(RehearsalInstance)
        .join(Rehearsal)
        .filter(
            RehearsalInstance.id == instance_id,
            Rehearsal.band_id == band_id,
            RehearsalAttachment.instance_id == instance_id
        )
        .all()
    )
    
    # Convert to schema format with setlist_name
    attachments_list = []
    for att in instance_attachments:
        att_dict = RehearsalAttachmentSchema.model_validate(att).model_dump()
        if att.setlist:
            att_dict["setlist_name"] = att.setlist.name
        attachments_list.append(att_dict)
    
    instance_dict["attachments"] = attachments_list
    
    return instance_dict


@router.put("/bands/{band_id}/rehearsals/instances/{instance_id}", response_model=RehearsalInstanceSchema)
def update_rehearsal_instance(
    band_id: int,
    instance_id: int,
    instance_data: RehearsalInstanceUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> RehearsalInstanceSchema:
    """
    Update a single rehearsal instance.
    
    For recurring rehearsals, this only affects the specific instance clicked on,
    not the entire recurring series.
    
    Requires admin or owner role in the band.
    """
    # Check permissions
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])
    
    instance = RehearsalService.update_rehearsal_instance(db, instance_id, band_id, instance_data)
    
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rehearsal instance not found"
        )
    
    return RehearsalInstanceSchema.model_validate(instance)


@router.post(
    "/bands/{band_id}/rehearsals/instances/{instance_id}/attachments",
    response_model=RehearsalAttachmentSchema,
    status_code=status.HTTP_201_CREATED
)
async def upload_rehearsal_instance_attachment(
    band_id: int,
    instance_id: int,
    file: Optional[UploadFile] = File(None),
    file_type: Optional[str] = Form(None, description="File type/category (setlist, video, demo, etc.)"),
    setlist_id: Optional[int] = Form(None, description="ID of setlist to attach (alternative to file upload)"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> RehearsalAttachmentSchema:
    """
    Upload a file attachment or attach a setlist to a specific rehearsal instance.
    
    Requires admin or owner role in the band.
    Either file or setlist_id must be provided.
    """
    # Check permissions
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])
    
    # Verify instance exists and belongs to band
    instance = RehearsalService.get_rehearsal_instance(db, instance_id, band_id)
    
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rehearsal instance not found"
        )
    
    # Validate that either file or setlist_id is provided
    if not file and not setlist_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either file or setlist_id must be provided"
        )
    
    if file and setlist_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot provide both file and setlist_id"
        )
    
    # Handle setlist attachment
    if setlist_id:
        from app.models.setlist import Setlist as SetlistModel
        # Verify setlist exists and belongs to band
        setlist = db.query(SetlistModel).filter(
            SetlistModel.id == setlist_id,
            SetlistModel.band_id == band_id
        ).first()
        
        if not setlist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Setlist not found"
            )
        
        # Create setlist attachment record
        attachment = RehearsalService.add_attachment(
            db, instance.rehearsal_id, file_path=None, file_name=None, 
            file_type="setlist", file_size=None, user_id=current_user.id, 
            instance_id=instance_id, setlist_id=setlist_id
        )
        
        # Reload with setlist relationship
        attachment = (
            db.query(RehearsalAttachment)
            .options(joinedload(RehearsalAttachment.setlist))
            .filter(RehearsalAttachment.id == attachment.id)
            .first()
        )
        
        att_dict = RehearsalAttachmentSchema.model_validate(attachment).model_dump()
        if attachment.setlist:
            att_dict["setlist_name"] = attachment.setlist.name
        
        return att_dict
    else:
        # Handle file attachment
        # Create attachments directory if it doesn't exist
        attachments_dir = Path("rehearsal_attachments")
        attachments_dir.mkdir(exist_ok=True)
        
        # Upload file to GCP or local storage
        file_path, file_size = await storage_service.upload_file(file, folder="rehearsal_attachments")
        
        # Create attachment record linked to the instance
        attachment = RehearsalService.add_attachment(
            db, instance.rehearsal_id, file_path, file.filename, file_type, file_size, current_user.id, instance_id=instance_id
        )
        
        # Reload with setlist relationship if it's a setlist attachment
        if attachment.setlist_id:
            attachment = (
                db.query(RehearsalAttachment)
                .options(joinedload(RehearsalAttachment.setlist))
                .filter(RehearsalAttachment.id == attachment.id)
                .first()
            )
    
    att_dict = RehearsalAttachmentSchema.model_validate(attachment).model_dump()
    if attachment.setlist:
        att_dict["setlist_name"] = attachment.setlist.name
    
    return att_dict


@router.delete(
    "/bands/{band_id}/rehearsals/instances/{instance_id}/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_rehearsal_instance_attachment(
    band_id: int,
    instance_id: int,
    attachment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> None:
    """
    Delete an attachment from a specific rehearsal instance.
    
    Requires admin or owner role in the band.
    """
    # Check permissions
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])
    
    # Verify instance exists and belongs to band
    instance = RehearsalService.get_rehearsal_instance(db, instance_id, band_id)
    
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rehearsal instance not found"
        )
    
    # Get attachment to verify it belongs to this instance and delete file
    attachment = db.query(RehearsalAttachment).filter(
        RehearsalAttachment.id == attachment_id,
        RehearsalAttachment.instance_id == instance_id
    ).first()
    
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found"
        )
    
    # Delete file from filesystem (only if it's a file attachment, not a setlist)
    if attachment.file_path and os.path.exists(attachment.file_path):
        try:
            os.remove(attachment.file_path)
        except Exception:
            pass  # Continue even if file deletion fails
    
    # Delete attachment record (pass instance_id to ensure it's instance-specific)
    success = RehearsalService.delete_attachment(db, attachment_id, instance.rehearsal_id, instance_id=instance_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found"
        )

