from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class StagePlot(Base):
    """
    StagePlot model representing a band's stage setup diagram.

    Contains stage plot information including positioned equipment items.
    Each band can have multiple stage plots (e.g., for different venues or setups).
    """

    __tablename__ = "stage_plots"

    id = Column(Integer, primary_key=True, index=True)
    band_id = Column(Integer, ForeignKey("bands.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False, default="Default Stage Plot")
    description = Column(Text, nullable=True)
    # Store stage items as JSON string (list of equipment with positions)
    items_json = Column(Text, nullable=False, default="[]")
    # Store stage dimensions and settings as JSON string
    settings_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    band = relationship("Band", back_populates="stage_plots")
    