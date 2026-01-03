from sqlalchemy import Column, DateTime, Integer, String, Float, Date, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class SavedTour(Base):
    """
    SavedTour model for storing generated tour plans.
    """

    __tablename__ = "saved_tours"

    id = Column(Integer, primary_key=True, index=True)
    band_id = Column(Integer, ForeignKey("bands.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    tour_radius_km = Column(Float, nullable=False)
    starting_location = Column(String(255), nullable=True)
    tour_data = Column(JSON, nullable=False)  # Stores the full tour results
    tour_params = Column(JSON, nullable=False)  # Stores the generation parameters
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    band = relationship("Band", back_populates="saved_tours")
