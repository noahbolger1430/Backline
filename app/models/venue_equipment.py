from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.member_equipment import EquipmentCategory


class VenueEquipment(Base):
    """
    Model representing backline equipment owned by a venue.
    This is used for venues that provide their own backline for events.
    
    Venue equipment typically includes amplifiers, drum kits, and microphones
    that bands must use when performing at the venue.
    """
    
    __tablename__ = "venue_equipment"
    
    id = Column(Integer, primary_key=True, index=True)
    venue_id = Column(
        Integer, 
        ForeignKey("venues.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    
    # Equipment categorization
    category = Column(String, nullable=False)  # EquipmentCategory value (only backline items)
    name = Column(String(255), nullable=False)  # e.g., "Main Guitar Amp", "House Drum Kit", "Vocal Mic 1"
    
    # Equipment details
    brand = Column(String(255), nullable=True)  # e.g., "Fender", "Pearl", "Shure"
    model = Column(String(255), nullable=True)  # e.g., "Twin Reverb", "Export Series", "SM58"
    specs = Column(Text, nullable=True)  # Detailed specifications
    notes = Column(Text, nullable=True)  # Additional notes about the equipment
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now(),
        nullable=False
    )
    
    # Relationship back to venue
    venue = relationship("Venue", backref="equipment")

