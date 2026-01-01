"""
Pydantic schemas for Physical Ticket management.

This module contains request/response schemas for:
- PhysicalTicketPool: Ticket pools for events
- PhysicalTicketAllocation: Tickets allocated to bands
- PhysicalTicketSale: Individual ticket sales
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ===== Ticket Pool Schemas =====

class PhysicalTicketPoolBase(BaseModel):
    """Base schema for ticket pool."""
    total_quantity: int = Field(..., gt=0, le=10000, description="Total number of tickets to generate")
    ticket_prefix: str = Field(..., min_length=1, max_length=50, description="Prefix for ticket numbers, e.g., 'EVT2026-'")

    @field_validator("ticket_prefix")
    @classmethod
    def validate_prefix(cls, v: str) -> str:
        """Clean and validate ticket prefix."""
        v = v.strip()
        if not v:
            raise ValueError("Ticket prefix cannot be empty")
        # Remove any trailing dash, we'll add it consistently
        return v.rstrip("-") + "-"


class PhysicalTicketPoolCreate(PhysicalTicketPoolBase):
    """Schema for creating a ticket pool."""
    pass


class PhysicalTicketPoolResponse(BaseModel):
    """Schema for ticket pool response."""
    id: int
    event_id: int
    total_quantity: int
    ticket_prefix: str
    start_number: int
    end_number: int
    allocated_count: int
    unallocated_count: int
    total_sold: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PhysicalTicketPoolWithAllocations(PhysicalTicketPoolResponse):
    """Schema for ticket pool with allocation details."""
    allocations: List["PhysicalTicketAllocationResponse"] = []


# ===== Ticket Allocation Schemas =====

class PhysicalTicketAllocationBase(BaseModel):
    """Base schema for ticket allocation."""
    band_event_id: int = Field(..., gt=0, description="ID of the band_event to allocate tickets to")
    allocated_quantity: int = Field(..., gt=0, le=10000, description="Number of tickets to allocate")


class PhysicalTicketAllocationCreate(PhysicalTicketAllocationBase):
    """Schema for creating a ticket allocation."""
    pass


class PhysicalTicketAllocationUpdate(BaseModel):
    """Schema for updating a ticket allocation."""
    allocated_quantity: Optional[int] = Field(None, gt=0, le=10000)


class PhysicalTicketAllocationResponse(BaseModel):
    """Schema for ticket allocation response."""
    id: int
    ticket_pool_id: int
    band_event_id: int
    band_id: Optional[int] = None
    band_name: Optional[str] = None
    allocated_quantity: int
    ticket_start_number: int
    ticket_end_number: int
    ticket_range: str  # e.g., "EVT2026-0001 to EVT2026-0025"
    sold_count: int
    unsold_count: int
    paid_count: int
    unpaid_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PhysicalTicketAllocationWithSales(PhysicalTicketAllocationResponse):
    """Schema for allocation with full sales details."""
    sales: List["PhysicalTicketSaleResponse"] = []
    available_ticket_numbers: List[str] = []


# ===== Ticket Sale Schemas =====

class PhysicalTicketSaleBase(BaseModel):
    """Base schema for ticket sale."""
    ticket_number: str = Field(..., min_length=1, max_length=100, description="Full ticket number")
    purchaser_name: str = Field(..., min_length=1, max_length=255, description="Name of the purchaser")
    purchaser_email: Optional[str] = Field(None, max_length=255)
    purchaser_phone: Optional[str] = Field(None, max_length=50)
    delivery_address: str = Field(..., min_length=1, description="Delivery address for the ticket")
    quantity: int = Field(1, ge=1, description="Number of tickets in this sale")
    is_paid: bool = Field(False, description="Whether payment has been received")
    is_delivered: bool = Field(False, description="Whether tickets have been delivered")
    delivery_assigned_to_member_id: Optional[int] = Field(None, description="Band member assigned for delivery")
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator("purchaser_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Purchaser name cannot be empty")
        return v

    @field_validator("delivery_address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Delivery address cannot be empty")
        return v


class PhysicalTicketSaleCreate(PhysicalTicketSaleBase):
    """Schema for creating a ticket sale."""
    pass


class PhysicalTicketSaleUpdate(BaseModel):
    """Schema for updating a ticket sale."""
    purchaser_name: Optional[str] = Field(None, min_length=1, max_length=255)
    purchaser_email: Optional[str] = Field(None, max_length=255)
    purchaser_phone: Optional[str] = Field(None, max_length=50)
    delivery_address: Optional[str] = Field(None, min_length=1)
    is_paid: Optional[bool] = None
    is_delivered: Optional[bool] = None
    delivery_assigned_to_member_id: Optional[int] = None
    notes: Optional[str] = Field(None, max_length=1000)


class PhysicalTicketSaleResponse(BaseModel):
    """Schema for ticket sale response."""
    id: int
    allocation_id: int
    ticket_number: str
    purchaser_name: str
    purchaser_email: Optional[str] = None
    purchaser_phone: Optional[str] = None
    delivery_address: str
    quantity: int
    is_paid: bool
    is_delivered: bool
    delivery_assigned_to_member_id: Optional[int] = None
    delivery_assigned_to_name: Optional[str] = None
    created_by_user_id: Optional[int] = None
    created_by_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===== Summary Schemas =====

class BandTicketSummary(BaseModel):
    """Summary of ticket allocation for a single band."""
    band_id: int
    band_name: str
    allocation_id: int
    allocated_count: int
    sold_count: int
    unsold_count: int
    paid_count: int
    unpaid_count: int
    ticket_range: str


class EventTicketingSummary(BaseModel):
    """Venue-level overview of all ticket activity for an event."""
    event_id: int
    event_name: str
    ticket_price: Optional[int] = None
    pool_id: Optional[int] = None
    total_tickets: int
    allocated_count: int
    unallocated_count: int
    total_sold: int
    total_proceeds_collected: int  # ticket_price * paid_count
    total_proceeds_outstanding: int  # ticket_price * unpaid_count
    bands: List[BandTicketSummary] = []


# Update forward references
PhysicalTicketPoolWithAllocations.model_rebuild()
PhysicalTicketAllocationWithSales.model_rebuild()

