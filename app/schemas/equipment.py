from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.member_equipment import EquipmentCategory


class EquipmentBase(BaseModel):
    """
    Base schema for equipment with common attributes.
    """
    
    category: str = Field(..., description="Equipment category (e.g., guitar_amp, drum_kit, pedal)")
    name: str = Field(..., min_length=1, max_length=255, description="Name/identifier for this piece of equipment")
    brand: Optional[str] = Field(None, max_length=255, description="Brand/manufacturer")
    model: Optional[str] = Field(None, max_length=255, description="Model name/number")
    specs: Optional[str] = Field(None, max_length=2000, description="Detailed specifications")
    notes: Optional[str] = Field(None, max_length=2000, description="Additional notes for gear sharing")
    available_for_share: bool = Field(True, description="Whether this equipment is available for gear sharing")
    
    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        """Validate that category is a valid EquipmentCategory value."""
        valid_categories = [cat.value for cat in EquipmentCategory]
        if v not in valid_categories:
            raise ValueError(f"Invalid category. Must be one of: {', '.join(valid_categories)}")
        return v
    
    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Clean and validate equipment name."""
        cleaned = " ".join(v.split())
        if not cleaned:
            raise ValueError("Name cannot be empty or only whitespace")
        return cleaned
    
    @field_validator("brand", "model")
    @classmethod
    def validate_optional_string(cls, v: Optional[str]) -> Optional[str]:
        """Clean optional string fields."""
        if v is not None:
            cleaned = " ".join(v.split())
            return cleaned if cleaned else None
        return v


class EquipmentCreate(EquipmentBase):
    """
    Schema for creating new equipment.
    """
    pass


class EquipmentUpdate(BaseModel):
    """
    Schema for updating equipment. All fields are optional.
    """
    
    category: Optional[str] = Field(None, description="Equipment category")
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Name/identifier")
    brand: Optional[str] = Field(None, max_length=255, description="Brand/manufacturer")
    model: Optional[str] = Field(None, max_length=255, description="Model name/number")
    specs: Optional[str] = Field(None, max_length=2000, description="Detailed specifications")
    notes: Optional[str] = Field(None, max_length=2000, description="Additional notes")
    available_for_share: Optional[bool] = Field(None, description="Available for gear sharing")
    
    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        """Validate that category is a valid EquipmentCategory value if provided."""
        if v is not None:
            valid_categories = [cat.value for cat in EquipmentCategory]
            if v not in valid_categories:
                raise ValueError(f"Invalid category. Must be one of: {', '.join(valid_categories)}")
        return v


class EquipmentInDB(EquipmentBase):
    """
    Schema representing equipment as stored in database.
    """
    
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    band_member_id: int
    created_at: datetime
    updated_at: datetime
    
    @field_validator("available_for_share", mode="before")
    @classmethod
    def convert_available_for_share(cls, v):
        """Convert integer to boolean for available_for_share."""
        if isinstance(v, int):
            return v == 1
        return v


class Equipment(EquipmentInDB):
    """
    Schema for equipment responses.
    """
    pass


class EquipmentList(BaseModel):
    """
    Schema for listing equipment.
    """
    
    equipment: List[Equipment] = []
    total: int = 0


class EquipmentBulkCreate(BaseModel):
    """
    Schema for bulk creating equipment (e.g., full drum kit or pedalboard).
    """
    
    items: List[EquipmentCreate] = Field(..., min_length=1)


class EquipmentCategoryInfo(BaseModel):
    """
    Schema for equipment category information.
    """
    
    value: str
    label: str
    description: Optional[str] = None


class EquipmentCategories(BaseModel):
    """
    Schema for listing all equipment categories.
    """
    
    categories: List[EquipmentCategoryInfo] = []


class EquipmentClaimCreate(BaseModel):
    """
    Schema for claiming equipment for an event.
    """
    
    equipment_id: int = Field(..., description="ID of the equipment to claim")


class EquipmentClaim(BaseModel):
    """
    Schema representing an equipment claim for an event.
    """
    
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    event_id: int
    equipment_id: int
    band_member_id: int
    created_at: datetime
    updated_at: datetime


# Category display labels and descriptions
EQUIPMENT_CATEGORY_INFO = {
    EquipmentCategory.GUITAR_AMP: {
        "label": "Guitar Amp",
        "description": "Guitar amplifier (combo or head + cabinet)"
    },
    EquipmentCategory.BASS_AMP: {
        "label": "Bass Amp",
        "description": "Bass amplifier (combo or head + cabinet)"
    },
    EquipmentCategory.KEYBOARD_AMP: {
        "label": "Keyboard Amp",
        "description": "Keyboard/PA amplifier"
    },
    EquipmentCategory.GUITAR: {
        "label": "Guitar",
        "description": "Electric or acoustic guitar"
    },
    EquipmentCategory.BASS: {
        "label": "Bass",
        "description": "Electric or acoustic bass"
    },
    EquipmentCategory.KEYBOARD: {
        "label": "Keyboard",
        "description": "Keyboard, synthesizer, or piano"
    },
    EquipmentCategory.DRUM_KIT: {
        "label": "Drum Kit",
        "description": "Full drum kit or shell pack"
    },
    EquipmentCategory.SNARE: {
        "label": "Snare Drum",
        "description": "Snare drum"
    },
    EquipmentCategory.KICK: {
        "label": "Kick Drum",
        "description": "Bass drum / kick drum"
    },
    EquipmentCategory.TOM: {
        "label": "Tom",
        "description": "Rack tom or floor tom"
    },
    EquipmentCategory.CYMBAL: {
        "label": "Cymbal",
        "description": "Crash, ride, or effects cymbal"
    },
    EquipmentCategory.HI_HAT: {
        "label": "Hi-Hat",
        "description": "Hi-hat cymbals"
    },
    EquipmentCategory.DRUM_HARDWARE: {
        "label": "Drum Hardware",
        "description": "Stands, pedals, throne, etc."
    },
    EquipmentCategory.PEDALBOARD: {
        "label": "Pedalboard",
        "description": "Full pedalboard setup"
    },
    EquipmentCategory.PEDAL: {
        "label": "Pedal",
        "description": "Individual effects pedal"
    },
    EquipmentCategory.MICROPHONE: {
        "label": "Microphone",
        "description": "Microphone for vocals or instruments"
    },
    EquipmentCategory.DI_BOX: {
        "label": "DI Box",
        "description": "Direct input box"
    },
    EquipmentCategory.OTHER: {
        "label": "Other",
        "description": "Other equipment"
    },
}


def get_all_categories() -> EquipmentCategories:
    """Get all equipment categories with their labels and descriptions."""
    categories = []
    for cat in EquipmentCategory:
        info = EQUIPMENT_CATEGORY_INFO.get(cat, {"label": cat.value, "description": None})
        categories.append(EquipmentCategoryInfo(
            value=cat.value,
            label=info["label"],
            description=info.get("description")
        ))
    return EquipmentCategories(categories=categories)


# Venue Equipment Schemas (similar to member equipment, but without available_for_share)

# Valid backline categories for venue equipment
VENUE_BACKLINE_CATEGORIES = {
    EquipmentCategory.GUITAR_AMP,
    EquipmentCategory.BASS_AMP,
    EquipmentCategory.KEYBOARD_AMP,
    EquipmentCategory.DRUM_KIT,
    EquipmentCategory.KEYBOARD,
    EquipmentCategory.MICROPHONE,
}


class VenueEquipmentBase(BaseModel):
    """
    Base schema for venue equipment with common attributes.
    Note: Venue equipment does not have available_for_share since it's always available.
    """
    
    category: str = Field(..., description="Equipment category (backline items only)")
    name: str = Field(..., min_length=1, max_length=255, description="Name/identifier for this piece of equipment")
    brand: Optional[str] = Field(None, max_length=255, description="Brand/manufacturer")
    model: Optional[str] = Field(None, max_length=255, description="Model name/number")
    specs: Optional[str] = Field(None, max_length=2000, description="Detailed specifications")
    notes: Optional[str] = Field(None, max_length=2000, description="Additional notes")
    
    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        """Validate that category is a valid backline EquipmentCategory value for venues."""
        valid_categories = [cat.value for cat in VENUE_BACKLINE_CATEGORIES]
        if v not in valid_categories:
            raise ValueError(f"Invalid category for venue equipment. Must be one of: {', '.join(valid_categories)}")
        return v
    
    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Clean and validate equipment name."""
        cleaned = " ".join(v.split())
        if not cleaned:
            raise ValueError("Name cannot be empty or only whitespace")
        return cleaned
    
    @field_validator("brand", "model")
    @classmethod
    def validate_optional_string(cls, v: Optional[str]) -> Optional[str]:
        """Clean optional string fields."""
        if v is not None:
            cleaned = " ".join(v.split())
            return cleaned if cleaned else None
        return v


class VenueEquipmentCreate(VenueEquipmentBase):
    """
    Schema for creating new venue equipment.
    """
    pass


class VenueEquipmentUpdate(BaseModel):
    """
    Schema for updating venue equipment. All fields are optional.
    """
    
    category: Optional[str] = Field(None, description="Equipment category (backline items only)")
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Name/identifier")
    brand: Optional[str] = Field(None, max_length=255, description="Brand/manufacturer")
    model: Optional[str] = Field(None, max_length=255, description="Model name/number")
    specs: Optional[str] = Field(None, max_length=2000, description="Detailed specifications")
    notes: Optional[str] = Field(None, max_length=2000, description="Additional notes")
    
    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        """Validate that category is a valid backline EquipmentCategory value if provided."""
        if v is not None:
            valid_categories = [cat.value for cat in VENUE_BACKLINE_CATEGORIES]
            if v not in valid_categories:
                raise ValueError(f"Invalid category for venue equipment. Must be one of: {', '.join(valid_categories)}")
        return v


class VenueEquipmentInDB(VenueEquipmentBase):
    """
    Schema representing venue equipment as stored in database.
    """
    
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    venue_id: int
    created_at: datetime
    updated_at: datetime


class VenueEquipment(VenueEquipmentInDB):
    """
    Schema for venue equipment responses.
    """
    pass


class VenueEquipmentList(BaseModel):
    """
    Schema for listing venue equipment.
    """
    
    equipment: List[VenueEquipment] = []
    total: int = 0


def get_venue_backline_categories() -> EquipmentCategories:
    """Get backline equipment categories available for venues."""
    categories = []
    for cat in VENUE_BACKLINE_CATEGORIES:
        info = EQUIPMENT_CATEGORY_INFO.get(cat, {"label": cat.value, "description": None})
        categories.append(EquipmentCategoryInfo(
            value=cat.value,
            label=info["label"],
            description=info.get("description")
        ))
    return EquipmentCategories(categories=categories)

