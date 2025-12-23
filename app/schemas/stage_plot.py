import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StageItemBase(BaseModel):
    """
    Base schema for a stage item (equipment placed on stage).
    """

    id: str = Field(..., description="Equipment type ID (e.g., 'vocal-mic')")
    instance_id: int = Field(..., description="Unique instance ID for this placed item")
    name: str = Field(..., min_length=1, max_length=100)
    icon: str = Field(..., min_length=1, max_length=10)
    x: float = Field(..., ge=0, le=800, description="X position on stage")
    y: float = Field(..., ge=0, le=600, description="Y position on stage")


class StageItem(StageItemBase):
    """
    Schema for stage item responses.
    """

    pass


class StagePlotSettings(BaseModel):
    """
    Schema for stage plot settings (dimensions, etc.).
    """

    stage_width: int = Field(default=600, ge=100, le=1000)
    stage_height: int = Field(default=300, ge=100, le=800)
    stage_x: int = Field(default=100, ge=0)
    stage_y: int = Field(default=150, ge=0)


class StagePlotBase(BaseModel):
    """
    Base stage plot schema with common attributes.
    """

    name: str = Field(default="Default Stage Plot", min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = " ".join(v.split())
        if not cleaned:
            raise ValueError("Stage plot name cannot be empty or only whitespace")
        return cleaned


class StagePlotCreate(StagePlotBase):
    """
    Schema for stage plot creation.
    """

    band_id: int = Field(..., gt=0)
    items: List[StageItem] = Field(default_factory=list)
    settings: Optional[StagePlotSettings] = Field(default_factory=StagePlotSettings)


class StagePlotUpdate(BaseModel):
    """
    Schema for updating stage plot information.
    All fields are optional.
    """

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    items: Optional[List[StageItem]] = None
    settings: Optional[StagePlotSettings] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = " ".join(v.split())
            if not cleaned:
                raise ValueError("Stage plot name cannot be empty or only whitespace")
            return cleaned
        return v


class StagePlotInDB(StagePlotBase):
    """
    Schema representing stage plot as stored in database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    band_id: int
    items_json: str
    settings_json: str
    created_at: datetime
    updated_at: datetime


class StagePlot(StagePlotBase):
    """
    Schema for stage plot responses with parsed items and settings.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    band_id: int
    items: List[StageItem] = Field(default_factory=list)
    settings: StagePlotSettings = Field(default_factory=StagePlotSettings)
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def parse_json_fields(cls, data: Any) -> Any:
        """
        Parse JSON string fields into Python objects.
        """
        if isinstance(data, dict):
            # Already a dict, check if items_json needs parsing
            if "items_json" in data and isinstance(data["items_json"], str):
                try:
                    data["items"] = json.loads(data["items_json"])
                except json.JSONDecodeError:
                    data["items"] = []
            if "settings_json" in data and isinstance(data["settings_json"], str):
                try:
                    data["settings"] = json.loads(data["settings_json"])
                except json.JSONDecodeError:
                    data["settings"] = {}
            return data
        
        # If data is an ORM model
        if hasattr(data, "items_json"):
            items = []
            if data.items_json:
                try:
                    items = json.loads(data.items_json)
                except json.JSONDecodeError:
                    items = []
            
            settings = {}
            if hasattr(data, "settings_json") and data.settings_json:
                try:
                    settings = json.loads(data.settings_json)
                except json.JSONDecodeError:
                    settings = {}
            
            return {
                "id": data.id,
                "band_id": data.band_id,
                "name": data.name,
                "description": data.description,
                "items": items,
                "settings": settings,
                "created_at": data.created_at,
                "updated_at": data.updated_at,
            }
        
        return data


class StagePlotSummary(BaseModel):
    """
    Schema for stage plot summary in list responses.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    band_id: int
    name: str
    description: Optional[str] = None
    item_count: int = 0
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def calculate_item_count(cls, data: Any) -> Any:
        """
        Calculate the number of items in the stage plot.
        """
        if isinstance(data, dict):
            if "items_json" in data and isinstance(data["items_json"], str):
                try:
                    items = json.loads(data["items_json"])
                    data["item_count"] = len(items)
                except json.JSONDecodeError:
                    data["item_count"] = 0
            return data
        
        # If data is an ORM model
        if hasattr(data, "items_json"):
            item_count = 0
            if data.items_json:
                try:
                    items = json.loads(data.items_json)
                    item_count = len(items)
                except json.JSONDecodeError:
                    item_count = 0
            
            return {
                "id": data.id,
                "band_id": data.band_id,
                "name": data.name,
                "description": data.description,
                "item_count": item_count,
                "created_at": data.created_at,
                "updated_at": data.updated_at,
            }
        
        return data
