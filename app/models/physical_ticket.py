"""
Physical Ticket models for managing venue ticket distribution to bands.

This module contains models for:
- PhysicalTicketPool: A pool of tickets created for an event
- PhysicalTicketAllocation: Tickets allocated to specific bands
- PhysicalTicketSale: Individual ticket sale records by bands
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class PhysicalTicketPool(Base):
    """
    Represents a pool of physical tickets created for an event.
    
    Venues create a ticket pool with a total quantity and prefix,
    then allocate portions of the pool to bands performing at the event.
    """

    __tablename__ = "physical_ticket_pools"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(
        Integer, 
        ForeignKey("events.id", ondelete="CASCADE"), 
        nullable=False, 
        unique=True,
        index=True
    )
    total_quantity = Column(Integer, nullable=False)
    ticket_prefix = Column(String(50), nullable=False)  # e.g., "EVT2026-"
    start_number = Column(Integer, nullable=False, default=1)
    end_number = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    event = relationship("Event", back_populates="ticket_pool")
    allocations = relationship(
        "PhysicalTicketAllocation", 
        back_populates="ticket_pool", 
        cascade="all, delete-orphan"
    )

    @property
    def allocated_count(self) -> int:
        """Return total number of tickets allocated to bands."""
        return sum(alloc.allocated_quantity for alloc in self.allocations)

    @property
    def unallocated_count(self) -> int:
        """Return number of tickets not yet allocated to any band."""
        return self.total_quantity - self.allocated_count

    @property
    def total_sold(self) -> int:
        """Return total number of tickets sold across all bands."""
        return sum(alloc.sold_count for alloc in self.allocations)

    def get_next_available_start(self) -> int:
        """Get the next available starting ticket number for allocation."""
        if not self.allocations:
            return self.start_number
        max_end = max(alloc.ticket_end_number for alloc in self.allocations)
        return max_end + 1


class PhysicalTicketAllocation(Base):
    """
    Represents tickets allocated to a specific band for an event.
    
    Each allocation contains a contiguous range of ticket numbers
    that the band is responsible for selling.
    """

    __tablename__ = "physical_ticket_allocations"

    id = Column(Integer, primary_key=True, index=True)
    ticket_pool_id = Column(
        Integer, 
        ForeignKey("physical_ticket_pools.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    band_event_id = Column(
        Integer, 
        ForeignKey("band_events.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    allocated_quantity = Column(Integer, nullable=False)
    ticket_start_number = Column(Integer, nullable=False)
    ticket_end_number = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    ticket_pool = relationship("PhysicalTicketPool", back_populates="allocations")
    band_event = relationship("BandEvent", back_populates="ticket_allocations")
    sales = relationship(
        "PhysicalTicketSale", 
        back_populates="allocation", 
        cascade="all, delete-orphan"
    )

    # Unique constraint: one allocation per band per pool
    __table_args__ = (
        UniqueConstraint("ticket_pool_id", "band_event_id", name="uq_pool_band_allocation"),
    )

    @property
    def sold_count(self) -> int:
        """Return number of tickets sold from this allocation."""
        return sum(sale.quantity for sale in self.sales)

    @property
    def unsold_count(self) -> int:
        """Return number of tickets not yet sold."""
        return self.allocated_quantity - self.sold_count

    @property
    def paid_count(self) -> int:
        """Return number of tickets that have been paid for."""
        return sum(sale.quantity for sale in self.sales if sale.is_paid)

    @property
    def unpaid_count(self) -> int:
        """Return number of sold tickets that haven't been paid for."""
        return sum(sale.quantity for sale in self.sales if not sale.is_paid)

    def get_ticket_number(self, offset: int) -> str:
        """Generate the full ticket number for a given offset within this allocation."""
        if offset < 0 or offset >= self.allocated_quantity:
            raise ValueError(f"Offset {offset} out of range for allocation of {self.allocated_quantity}")
        number = self.ticket_start_number + offset
        return f"{self.ticket_pool.ticket_prefix}{number:04d}"

    def get_available_ticket_numbers(self) -> list[str]:
        """Get list of ticket numbers not yet sold."""
        sold_numbers = {sale.ticket_number for sale in self.sales}
        available = []
        for i in range(self.allocated_quantity):
            ticket_num = self.get_ticket_number(i)
            if ticket_num not in sold_numbers:
                available.append(ticket_num)
        return available


class PhysicalTicketSale(Base):
    """
    Represents an individual ticket sale by a band.
    """

    __tablename__ = "physical_ticket_sales"

    id = Column(Integer, primary_key=True, index=True)
    allocation_id = Column(
        Integer, 
        ForeignKey("physical_ticket_allocations.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    ticket_number = Column(String(100), nullable=False, index=True)  # Remove unique=True
    purchaser_name = Column(String(255), nullable=False)
    purchaser_email = Column(String(255), nullable=True)
    purchaser_phone = Column(String(50), nullable=True)
    delivery_address = Column(Text, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    is_paid = Column(Boolean, nullable=False, default=False)
    is_delivered = Column(Boolean, nullable=False, default=False)
    delivery_assigned_to_member_id = Column(
        Integer, 
        ForeignKey("band_members.id", ondelete="SET NULL"), 
        nullable=True,
        index=True
    )
    created_by_user_id = Column(
        Integer, 
        ForeignKey("users.id", ondelete="SET NULL"), 
        nullable=True,
        index=True
    )
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    allocation = relationship("PhysicalTicketAllocation", back_populates="sales")
    delivery_assigned_to = relationship("BandMember")
    created_by = relationship("User")

    # Unique constraint: ticket number unique within allocation
    __table_args__ = (
        UniqueConstraint("allocation_id", "ticket_number", name="uq_allocation_ticket_number"),
    )
