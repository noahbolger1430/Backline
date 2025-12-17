from enum import Enum as PyEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class BandRole(str, PyEnum):
    """
    Enumeration of possible roles within a band.
    """

    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class BandMember(Base):
    """
    Association model representing a user's membership in a band.
    Includes role information and instrument played.
    """

    __tablename__ = "band_members"
    __table_args__ = (UniqueConstraint("user_id", "band_id", name="unique_user_band"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    band_id = Column(Integer, ForeignKey("bands.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False, default=BandRole.MEMBER.value)
    instrument = Column(String, nullable=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="band_memberships")
    band = relationship("Band", back_populates="members")
    availabilities = relationship(
        "BandMemberAvailability", back_populates="band_member", cascade="all, delete-orphan"
    )

