from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class EventEquipmentClaim(Base):
    """
    Model representing a claim of equipment for backline sharing at an event.
    
    When a band member claims their equipment for an event, it becomes
    the backline that other bands on the bill can see and coordinate with.
    """
    
    __tablename__ = "event_equipment_claims"
    __table_args__ = (
        UniqueConstraint('event_id', 'equipment_id', name='uq_event_equipment_claim'),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    equipment_id = Column(
        Integer,
        ForeignKey("member_equipment.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    band_member_id = Column(
        Integer,
        ForeignKey("band_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    
    # Relationships
    event = relationship("Event", backref="equipment_claims")
    equipment = relationship("MemberEquipment", backref="event_claims")
    band_member = relationship("BandMember", backref="equipment_claims")

