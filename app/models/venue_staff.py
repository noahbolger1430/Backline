from enum import Enum as PyEnum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class VenueRole(str, PyEnum):
    """
    Enumeration of possible roles for venue staff members.
    """

    OWNER = "owner"
    MANAGER = "manager"
    STAFF = "staff"


class VenueStaff(Base):
    """
    Association model representing a user's role at a venue.

    Links users to venues they can manage, with specific permission levels
    for booking events and reviewing band applications.
    """

    __tablename__ = "venue_staff"
    __table_args__ = (UniqueConstraint("user_id", "venue_id", name="unique_user_venue"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    venue_id = Column(Integer, ForeignKey("venues.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False, default=VenueRole.STAFF.value)
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="venue_memberships")
    venue = relationship("Venue", back_populates="staff")

    @hybrid_property
    def user_name(self) -> str:
        """Return user's full name for convenience."""
        return self.user.full_name if self.user else ""

    @hybrid_property
    def user_email(self) -> str:
        """Return user's email for convenience."""
        return self.user.email if self.user else ""

