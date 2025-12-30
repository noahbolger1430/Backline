"""
Equipment API endpoints for managing band member equipment.
Used for Gear Share feature to coordinate backline sharing between bands.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.database import get_db
from app.models import BandMember, MemberEquipment, User
from app.schemas.equipment import (
    Equipment,
    EquipmentBulkCreate,
    EquipmentCreate,
    EquipmentList,
    EquipmentUpdate,
    EquipmentCategories,
    get_all_categories,
)

router = APIRouter()


def get_band_member_or_404(
    band_id: int, 
    current_user: User, 
    db: Session
) -> BandMember:
    """Get the current user's band member record for a specific band."""
    member = (
        db.query(BandMember)
        .filter(
            BandMember.band_id == band_id,
            BandMember.user_id == current_user.id
        )
        .first()
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not a member of this band"
        )
    return member


def get_equipment_or_404(
    equipment_id: int,
    band_member_id: int,
    db: Session
) -> MemberEquipment:
    """Get equipment by ID, verifying it belongs to the band member."""
    equipment = (
        db.query(MemberEquipment)
        .filter(
            MemberEquipment.id == equipment_id,
            MemberEquipment.band_member_id == band_member_id
        )
        .first()
    )
    if not equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment not found"
        )
    return equipment


@router.get("/categories", response_model=EquipmentCategories)
def list_equipment_categories() -> EquipmentCategories:
    """
    Get all available equipment categories.
    Returns categories with their values, labels, and descriptions.
    """
    return get_all_categories()


@router.get("/bands/{band_id}/my-equipment", response_model=EquipmentList)
def list_my_equipment(
    band_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> EquipmentList:
    """
    List all equipment for the current user's band membership.
    """
    member = get_band_member_or_404(band_id, current_user, db)
    
    equipment_list = (
        db.query(MemberEquipment)
        .filter(MemberEquipment.band_member_id == member.id)
        .order_by(MemberEquipment.category, MemberEquipment.name)
        .all()
    )
    
    return EquipmentList(
        equipment=[Equipment.model_validate(eq) for eq in equipment_list],
        total=len(equipment_list)
    )


@router.post("/bands/{band_id}/my-equipment", response_model=Equipment, status_code=status.HTTP_201_CREATED)
def create_equipment(
    band_id: int,
    equipment_in: EquipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Equipment:
    """
    Add a new piece of equipment to the current user's band membership.
    """
    member = get_band_member_or_404(band_id, current_user, db)
    
    # Convert available_for_share boolean to integer
    equipment_data = equipment_in.model_dump()
    equipment_data["available_for_share"] = 1 if equipment_data.get("available_for_share", True) else 0
    
    db_equipment = MemberEquipment(
        band_member_id=member.id,
        **equipment_data
    )
    db.add(db_equipment)
    db.commit()
    db.refresh(db_equipment)
    
    return Equipment.model_validate(db_equipment)


@router.post("/bands/{band_id}/my-equipment/bulk", response_model=EquipmentList, status_code=status.HTTP_201_CREATED)
def create_equipment_bulk(
    band_id: int,
    equipment_in: EquipmentBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> EquipmentList:
    """
    Add multiple pieces of equipment at once (e.g., full drum kit or pedalboard).
    """
    member = get_band_member_or_404(band_id, current_user, db)
    
    created_equipment = []
    for item in equipment_in.items:
        equipment_data = item.model_dump()
        equipment_data["available_for_share"] = 1 if equipment_data.get("available_for_share", True) else 0
        
        db_equipment = MemberEquipment(
            band_member_id=member.id,
            **equipment_data
        )
        db.add(db_equipment)
        created_equipment.append(db_equipment)
    
    db.commit()
    
    # Refresh all created equipment
    for eq in created_equipment:
        db.refresh(eq)
    
    return EquipmentList(
        equipment=[Equipment.model_validate(eq) for eq in created_equipment],
        total=len(created_equipment)
    )


@router.get("/bands/{band_id}/my-equipment/{equipment_id}", response_model=Equipment)
def get_equipment(
    band_id: int,
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Equipment:
    """
    Get a specific piece of equipment.
    """
    member = get_band_member_or_404(band_id, current_user, db)
    equipment = get_equipment_or_404(equipment_id, member.id, db)
    
    return Equipment.model_validate(equipment)


@router.put("/bands/{band_id}/my-equipment/{equipment_id}", response_model=Equipment)
def update_equipment(
    band_id: int,
    equipment_id: int,
    equipment_in: EquipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Equipment:
    """
    Update a piece of equipment.
    """
    member = get_band_member_or_404(band_id, current_user, db)
    equipment = get_equipment_or_404(equipment_id, member.id, db)
    
    update_data = equipment_in.model_dump(exclude_unset=True)
    
    # Convert available_for_share boolean to integer if present
    if "available_for_share" in update_data and update_data["available_for_share"] is not None:
        update_data["available_for_share"] = 1 if update_data["available_for_share"] else 0
    
    for field, value in update_data.items():
        setattr(equipment, field, value)
    
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    
    return Equipment.model_validate(equipment)


@router.delete("/bands/{band_id}/my-equipment/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(
    band_id: int,
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """
    Delete a piece of equipment.
    """
    member = get_band_member_or_404(band_id, current_user, db)
    equipment = get_equipment_or_404(equipment_id, member.id, db)
    
    db.delete(equipment)
    db.commit()


@router.get("/bands/{band_id}/all-equipment", response_model=dict)
def list_band_equipment(
    band_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """
    List all equipment from all members of a band.
    This is useful for gear share coordination.
    Returns equipment grouped by member.
    """
    # Verify user is a member of the band
    get_band_member_or_404(band_id, current_user, db)
    
    # Get all members of the band with their equipment
    members = (
        db.query(BandMember)
        .filter(BandMember.band_id == band_id)
        .all()
    )
    
    result = {
        "band_id": band_id,
        "members_equipment": []
    }
    
    for member in members:
        equipment_list = (
            db.query(MemberEquipment)
            .filter(MemberEquipment.band_member_id == member.id)
            .order_by(MemberEquipment.category, MemberEquipment.name)
            .all()
        )
        
        # Get user info
        user = member.user
        
        member_data = {
            "member_id": member.id,
            "user_id": member.user_id,
            "user_name": user.full_name if user else None,
            "instrument": member.instrument,
            "equipment": [Equipment.model_validate(eq).model_dump() for eq in equipment_list],
            "equipment_count": len(equipment_list)
        }
        result["members_equipment"].append(member_data)
    
    return result

