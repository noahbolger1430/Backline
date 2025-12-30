from enum import Enum as PyEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class EquipmentCategory(str, PyEnum):
    """
    Generalized categories for equipment used in gear sharing.
    These categories help standardize equipment types for stage plots and gear coordination.
    """
    
    # Amplifiers
    GUITAR_AMP = "guitar_amp"
    BASS_AMP = "bass_amp"
    KEYBOARD_AMP = "keyboard_amp"
    
    # Instruments
    GUITAR = "guitar"
    BASS = "bass"
    KEYBOARD = "keyboard"
    
    # Drum-related
    DRUM_KIT = "drum_kit"  # Full kit or shell pack
    SNARE = "snare"
    KICK = "kick"
    TOM = "tom"
    CYMBAL = "cymbal"
    HI_HAT = "hi_hat"
    DRUM_HARDWARE = "drum_hardware"  # Stands, pedals, throne, etc.
    
    # Effects
    PEDALBOARD = "pedalboard"  # Full pedalboard
    PEDAL = "pedal"  # Individual pedal
    
    # Other
    MICROPHONE = "microphone"
    DI_BOX = "di_box"
    OTHER = "other"


class MemberEquipment(Base):
    """
    Model representing equipment owned by a band member.
    This is used for gear sharing coordination between bands on a bill.
    
    Each piece of equipment has a category (for standardization in gear sharing),
    brand, specifications, and optional notes.
    
    For items like drum kits and pedalboards that consist of multiple pieces,
    multiple entries can be created with descriptive names (e.g., "14x6.5 Snare").
    """
    
    __tablename__ = "member_equipment"
    
    id = Column(Integer, primary_key=True, index=True)
    band_member_id = Column(
        Integer, 
        ForeignKey("band_members.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    
    # Equipment categorization
    category = Column(String, nullable=False)  # EquipmentCategory value
    name = Column(String(255), nullable=False)  # e.g., "Main Guitar", "14x6.5 Snare", "Overdrive Pedal"
    
    # Equipment details
    brand = Column(String(255), nullable=True)  # e.g., "Fender", "Pearl", "Boss"
    model = Column(String(255), nullable=True)  # e.g., "Stratocaster", "Export Series", "BD-2"
    specs = Column(Text, nullable=True)  # Detailed specifications
    notes = Column(Text, nullable=True)  # Additional notes for gear share
    
    # Gear share settings
    available_for_share = Column(Integer, default=1)  # 1 = available, 0 = not available for sharing
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now(), 
        nullable=False
    )
    
    # Relationship back to band member
    band_member = relationship("BandMember", back_populates="equipment")

