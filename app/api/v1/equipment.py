"""
Equipment API endpoints for managing band member equipment.
Used for Gear Share feature to coordinate backline sharing between bands.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.database import get_db
from app.models import Band, BandEvent, BandMember, MemberEquipment, User, EventEquipmentClaim
from app.models.member_equipment import EquipmentCategory
from app.schemas.equipment import (
    Equipment,
    EquipmentBulkCreate,
    EquipmentCreate,
    EquipmentList,
    EquipmentUpdate,
    EquipmentCategories,
    EquipmentClaimCreate,
    EquipmentClaim,
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


# Relevant categories for backline gear sharing (excludes individual instruments)
BACKLINE_CATEGORIES = {
    EquipmentCategory.GUITAR_AMP,
    EquipmentCategory.BASS_AMP,
    EquipmentCategory.KEYBOARD_AMP,
    EquipmentCategory.DRUM_KIT,
    EquipmentCategory.KEYBOARD,
}


@router.get("/events/{event_id}/backline", response_model=dict)
def get_event_backline(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """
    Get all backline equipment from all bands on an event.
    Only includes relevant categories: guitar_amp, bass_amp, keyboard_amp, drum_kit, keyboard.
    Returns equipment grouped by category and band, with claim information.
    """
    # Get all bands on the event
    band_events = (
        db.query(BandEvent)
        .filter(BandEvent.event_id == event_id)
        .all()
    )
    
    if not band_events:
        return {
            "event_id": event_id,
            "backline_items": [],
            "by_category": {},
            "claimed_equipment": {}
        }
    
    # Get all claims for this event
    claims = (
        db.query(EventEquipmentClaim)
        .filter(EventEquipmentClaim.event_id == event_id)
        .all()
    )
    
    # Create a map of equipment_id -> claim
    claims_map = {claim.equipment_id: claim for claim in claims}
    
    # Collect all equipment from all bands
    backline_items = []
    by_category = {}
    claimed_equipment = {}  # {category: equipment_id}
    
    for band_event in band_events:
        band_id = band_event.band_id
        band = db.query(Band).filter(Band.id == band_id).first()
        
        if not band:
            continue
        
        # Get all members of this band
        members = (
            db.query(BandMember)
            .filter(BandMember.band_id == band_id)
            .all()
        )
        
        for member in members:
            # Get equipment for this member, filtered to backline categories
            equipment_list = (
                db.query(MemberEquipment)
                .filter(
                    MemberEquipment.band_member_id == member.id,
                    MemberEquipment.category.in_([cat.value for cat in BACKLINE_CATEGORIES]),
                    MemberEquipment.available_for_share == 1
                )
                .order_by(MemberEquipment.category, MemberEquipment.name)
                .all()
            )
            
            for eq in equipment_list:
                user = member.user
                is_claimed = eq.id in claims_map
                claim = claims_map.get(eq.id)
                
                # Check if current user can unclaim (if they own the claim)
                can_unclaim = False
                if claim and claim.band_member_id == member.id and member.user_id == current_user.id:
                    can_unclaim = True
                
                item_data = {
                    "equipment_id": eq.id,
                    "category": eq.category,
                    "name": eq.name,
                    "brand": eq.brand,
                    "model": eq.model,
                    "specs": eq.specs,
                    "notes": eq.notes,
                    "band_id": band_id,
                    "band_name": band.name,
                    "member_id": member.id,
                    "member_name": user.full_name if user else None,
                    "instrument": member.instrument,
                    "is_claimed": is_claimed,
                    "claimed_by_member_id": claim.band_member_id if claim else None,
                    "can_unclaim": can_unclaim,
                }
                backline_items.append(item_data)
                
                # Group by category
                if eq.category not in by_category:
                    by_category[eq.category] = []
                by_category[eq.category].append(item_data)
                
                # Track claimed equipment by category
                if is_claimed:
                    claimed_equipment[eq.category] = eq.id
    
    return {
        "event_id": event_id,
        "backline_items": backline_items,
        "by_category": by_category,
        "claimed_equipment": claimed_equipment
    }


@router.get("/bands/{band_id}/has-category/{category}", response_model=dict)
def check_user_has_category(
    band_id: int,
    category: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """
    Check if the current user has equipment of a specific category for a band.
    Returns whether the user has that category and optionally the equipment items.
    """
    # Validate category
    valid_categories = [cat.value for cat in EquipmentCategory]
    if category not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}"
        )
    
    # Get user's band membership
    member = (
        db.query(BandMember)
        .filter(
            BandMember.band_id == band_id,
            BandMember.user_id == current_user.id
        )
        .first()
    )
    
    if not member:
        return {
            "has_category": False,
            "equipment": []
        }
    
    # Check if user has equipment of this category
    equipment_list = (
        db.query(MemberEquipment)
        .filter(
            MemberEquipment.band_member_id == member.id,
            MemberEquipment.category == category,
            MemberEquipment.available_for_share == 1
        )
        .order_by(MemberEquipment.name)
        .all()
    )
    
    return {
        "has_category": len(equipment_list) > 0,
        "equipment": [Equipment.model_validate(eq).model_dump() for eq in equipment_list]
    }


@router.post("/events/{event_id}/claim", response_model=EquipmentClaim, status_code=status.HTTP_201_CREATED)
def claim_equipment_for_event(
    event_id: int,
    claim_data: EquipmentClaimCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> EquipmentClaim:
    """
    Claim equipment for backline at an event.
    The equipment must belong to the current user and be available for sharing.
    """
    # Get the equipment
    equipment = db.query(MemberEquipment).filter(MemberEquipment.id == claim_data.equipment_id).first()
    if not equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment not found"
        )
    
    # Verify equipment is available for sharing
    if equipment.available_for_share != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This equipment is not available for sharing"
        )
    
    # Verify equipment category is a backline category
    if EquipmentCategory(equipment.category) not in BACKLINE_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This equipment category cannot be claimed as backline"
        )
    
    # Verify the equipment belongs to the current user
    member = (
        db.query(BandMember)
        .filter(
            BandMember.id == equipment.band_member_id,
            BandMember.user_id == current_user.id
        )
        .first()
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only claim your own equipment"
        )
    
    # Verify the user's band is on the event
    band_event = (
        db.query(BandEvent)
        .filter(
            BandEvent.event_id == event_id,
            BandEvent.band_id == member.band_id
        )
        .first()
    )
    if not band_event:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your band must be on the event bill to claim equipment"
        )
    
    # Check if this equipment is already claimed for this event
    existing_claim = (
        db.query(EventEquipmentClaim)
        .filter(
            EventEquipmentClaim.event_id == event_id,
            EventEquipmentClaim.equipment_id == claim_data.equipment_id
        )
        .first()
    )
    if existing_claim:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This equipment is already claimed for this event"
        )
    
    # Check if user already has a claim for this category on this event
    # Get all equipment claimed by this user for this event
    user_claims = (
        db.query(EventEquipmentClaim)
        .join(MemberEquipment, EventEquipmentClaim.equipment_id == MemberEquipment.id)
        .filter(
            EventEquipmentClaim.event_id == event_id,
            EventEquipmentClaim.band_member_id == member.id
        )
        .all()
    )
    
    # Check if any of the user's claims are for the same category
    for user_claim in user_claims:
        claimed_equipment = db.query(MemberEquipment).filter(MemberEquipment.id == user_claim.equipment_id).first()
        if claimed_equipment and claimed_equipment.category == equipment.category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You have already claimed a {equipment.category.replace('_', ' ')} for this event. Please unclaim it first."
            )
    
    # Create the claim
    claim = EventEquipmentClaim(
        event_id=event_id,
        equipment_id=claim_data.equipment_id,
        band_member_id=member.id
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)
    
    return EquipmentClaim.model_validate(claim)


@router.delete("/events/{event_id}/claim/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def unclaim_equipment_for_event(
    event_id: int,
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """
    Unclaim equipment for backline at an event.
    Only the user who claimed it can unclaim it.
    """
    # Get the claim
    claim = (
        db.query(EventEquipmentClaim)
        .filter(
            EventEquipmentClaim.event_id == event_id,
            EventEquipmentClaim.equipment_id == equipment_id
        )
        .first()
    )
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment claim not found"
        )
    
    # Verify the claim belongs to the current user
    member = (
        db.query(BandMember)
        .filter(
            BandMember.id == claim.band_member_id,
            BandMember.user_id == current_user.id
        )
        .first()
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only unclaim your own equipment"
        )
    
    db.delete(claim)
    db.commit()

