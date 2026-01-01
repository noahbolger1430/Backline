"""
API endpoints for Physical Ticket management.

This module provides endpoints for:
- Venue: Creating ticket pools, allocating to bands, viewing summaries
- Band: Recording sales, managing purchaser info, tracking payments (Phase 2)
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.api.deps import (
    get_current_active_user,
    get_event_or_404,
    get_venue_or_404,
    get_band_or_404,
    check_venue_permission,
    check_band_permission,
)
from app.database import get_db
from app.models import BandEvent, Event, User, Venue, Band
from app.models.venue_staff import VenueRole
from app.models.band_member import BandRole
from app.models.physical_ticket import (
    PhysicalTicketPool,
    PhysicalTicketAllocation,
    PhysicalTicketSale,
)
from app.schemas.physical_ticket import (
    PhysicalTicketPoolCreate,
    PhysicalTicketPoolResponse,
    PhysicalTicketPoolWithAllocations,
    PhysicalTicketAllocationCreate,
    PhysicalTicketAllocationUpdate,
    PhysicalTicketAllocationResponse,
    PhysicalTicketAllocationWithSales,
    PhysicalTicketSaleCreate,
    PhysicalTicketSaleUpdate,
    PhysicalTicketSaleResponse,
    EventTicketingSummary,
)
from app.services.physical_ticket_service import PhysicalTicketService
from app.utils.ticket_pdf_generator import ticket_pdf_generator

router = APIRouter()


# ===== Ticket Pool Endpoints =====

@router.post(
    "/events/{event_id}/ticket-pool",
    response_model=PhysicalTicketPoolResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create ticket pool for event",
    description="Create a new physical ticket pool for an event. Only venue staff can perform this action."
)
async def create_ticket_pool(
    event_id: int,
    pool_data: PhysicalTicketPoolCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a ticket pool for an event."""
    # Get event and verify venue access
    event = get_event_or_404(event_id, db)
    venue = get_venue_or_404(event.venue_id, db)
    check_venue_permission(venue, current_user, [VenueRole.OWNER, VenueRole.MANAGER, VenueRole.STAFF])
    
    # Verify event is ticketed
    if not event.is_ticketed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create ticket pool for non-ticketed event"
        )
    
    try:
        pool = PhysicalTicketService.create_ticket_pool(db, event_id, pool_data)
        return PhysicalTicketPoolResponse(
            id=pool.id,
            event_id=pool.event_id,
            total_quantity=pool.total_quantity,
            ticket_prefix=pool.ticket_prefix,
            start_number=pool.start_number,
            end_number=pool.end_number,
            allocated_count=pool.allocated_count,
            unallocated_count=pool.unallocated_count,
            total_sold=pool.total_sold,
            created_at=pool.created_at,
            updated_at=pool.updated_at,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/events/{event_id}/ticket-pool",
    response_model=PhysicalTicketPoolWithAllocations,
    summary="Get ticket pool for event",
    description="Get the ticket pool and all allocations for an event."
)
async def get_ticket_pool(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get the ticket pool for an event with all allocations."""
    event = get_event_or_404(event_id, db)
    venue = get_venue_or_404(event.venue_id, db)
    check_venue_permission(venue, current_user, [VenueRole.OWNER, VenueRole.MANAGER, VenueRole.STAFF])
    
    pool = PhysicalTicketService.get_ticket_pool(db, event_id)
    if not pool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No ticket pool found for this event"
        )
    
    # Build allocation responses
    allocations = []
    for alloc in pool.allocations:
        allocations.append(PhysicalTicketAllocationResponse(
            **PhysicalTicketService.get_allocation_response_data(alloc)
        ))
    
    return PhysicalTicketPoolWithAllocations(
        id=pool.id,
        event_id=pool.event_id,
        total_quantity=pool.total_quantity,
        ticket_prefix=pool.ticket_prefix,
        start_number=pool.start_number,
        end_number=pool.end_number,
        allocated_count=pool.allocated_count,
        unallocated_count=pool.unallocated_count,
        total_sold=pool.total_sold,
        created_at=pool.created_at,
        updated_at=pool.updated_at,
        allocations=allocations,
    )


@router.delete(
    "/events/{event_id}/ticket-pool",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete ticket pool",
    description="Delete the ticket pool for an event. This will cascade delete all allocations and sales."
)
async def delete_ticket_pool(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete the ticket pool for an event."""
    event = get_event_or_404(event_id, db)
    venue = get_venue_or_404(event.venue_id, db)
    check_venue_permission(venue, current_user, [VenueRole.OWNER, VenueRole.MANAGER])
    
    pool = PhysicalTicketService.get_ticket_pool(db, event_id)
    if not pool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No ticket pool found for this event"
        )
    
    PhysicalTicketService.delete_ticket_pool(db, pool)
    return None


# ===== Allocation Endpoints =====

@router.post(
    "/events/{event_id}/ticket-pool/allocations",
    response_model=PhysicalTicketAllocationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Allocate tickets to band",
    description="Allocate a portion of the ticket pool to a band performing at the event."
)
async def allocate_tickets(
    event_id: int,
    allocation_data: PhysicalTicketAllocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Allocate tickets to a band."""
    event = get_event_or_404(event_id, db)
    venue = get_venue_or_404(event.venue_id, db)
    check_venue_permission(venue, current_user, [VenueRole.OWNER, VenueRole.MANAGER, VenueRole.STAFF])
    
    # Get the ticket pool
    pool = PhysicalTicketService.get_ticket_pool(db, event_id)
    if not pool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No ticket pool found for this event. Create a ticket pool first."
        )
    
    # Verify the band_event belongs to this event
    band_event = db.query(BandEvent).filter(
        BandEvent.id == allocation_data.band_event_id
    ).first()
    if not band_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Band event not found"
        )
    if band_event.event_id != event_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Band event does not belong to this event"
        )
    
    try:
        allocation = PhysicalTicketService.allocate_tickets_to_band(db, pool, allocation_data)
        return PhysicalTicketAllocationResponse(
            **PhysicalTicketService.get_allocation_response_data(allocation)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/allocations/{allocation_id}",
    response_model=PhysicalTicketAllocationWithSales,
    summary="Get allocation details",
    description="Get a ticket allocation with all its sales."
)
async def get_allocation(
    allocation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get a ticket allocation with all sales."""
    allocation = PhysicalTicketService.get_allocation(db, allocation_id)
    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allocation not found"
        )
    
    # Check venue permission
    event = allocation.band_event.event
    venue = get_venue_or_404(event.venue_id, db)
    check_venue_permission(venue, current_user, [VenueRole.OWNER, VenueRole.MANAGER, VenueRole.STAFF])
    
    # Build response
    response_data = PhysicalTicketService.get_allocation_response_data(allocation)
    sales = [
        PhysicalTicketSaleResponse(**PhysicalTicketService.get_sale_response_data(sale))
        for sale in allocation.sales
    ]
    
    return PhysicalTicketAllocationWithSales(
        **response_data,
        sales=sales,
        available_ticket_numbers=allocation.get_available_ticket_numbers(),
    )


@router.put(
    "/allocations/{allocation_id}",
    response_model=PhysicalTicketAllocationResponse,
    summary="Update allocation",
    description="Update a ticket allocation quantity."
)
async def update_allocation(
    allocation_id: int,
    update_data: PhysicalTicketAllocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update a ticket allocation."""
    allocation = PhysicalTicketService.get_allocation(db, allocation_id)
    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allocation not found"
        )
    
    event = allocation.band_event.event
    venue = get_venue_or_404(event.venue_id, db)
    check_venue_permission(venue, current_user, [VenueRole.OWNER, VenueRole.MANAGER])
    
    try:
        updated = PhysicalTicketService.update_allocation(db, allocation, update_data)
        return PhysicalTicketAllocationResponse(
            **PhysicalTicketService.get_allocation_response_data(updated)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/allocations/{allocation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete allocation",
    description="Delete a ticket allocation. Cannot delete if any tickets have been sold."
)
async def delete_allocation(
    allocation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete a ticket allocation."""
    allocation = PhysicalTicketService.get_allocation(db, allocation_id)
    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allocation not found"
        )
    
    event = allocation.band_event.event
    venue = get_venue_or_404(event.venue_id, db)
    check_venue_permission(venue, current_user, [VenueRole.OWNER, VenueRole.MANAGER])
    
    try:
        PhysicalTicketService.delete_allocation(db, allocation)
        return None
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ===== Summary Endpoint =====

@router.get(
    "/events/{event_id}/tickets/summary",
    response_model=EventTicketingSummary,
    summary="Get event ticket summary",
    description="Get a comprehensive summary of all ticket activity for an event."
)
async def get_event_ticket_summary(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get ticket summary for an event."""
    event = get_event_or_404(event_id, db)
    venue = get_venue_or_404(event.venue_id, db)
    check_venue_permission(venue, current_user, [VenueRole.OWNER, VenueRole.MANAGER, VenueRole.STAFF])
    
    return PhysicalTicketService.get_event_ticket_summary(db, event)


# ===== PDF Generation Endpoint =====

@router.get(
    "/events/{event_id}/tickets/pdf",
    summary="Download ticket PDF",
    description="Generate and download a PDF containing all tickets for the event."
)
async def download_tickets_pdf(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Generate and download ticket PDF for an event."""
    event = get_event_or_404(event_id, db)
    venue = get_venue_or_404(event.venue_id, db)
    check_venue_permission(venue, current_user, [VenueRole.OWNER, VenueRole.MANAGER, VenueRole.STAFF])
    
    pool = PhysicalTicketService.get_ticket_pool(db, event_id)
    if not pool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No ticket pool found for this event"
        )
    
    # Build image URL if event has an image
    event_image_url = None
    if event.image_path:
        # Check if it's already a full URL (GCP) or a local path
        if event.image_path.startswith('http://') or event.image_path.startswith('https://'):
            event_image_url = event.image_path
        else:
            # For local images, construct the URL (though PDF generator will try to load the file directly)
            event_image_url = event.image_path
    
    # Generate PDF
    pdf_buffer = ticket_pdf_generator.generate_tickets_from_pool(
        ticket_prefix=pool.ticket_prefix,
        start_number=pool.start_number,
        end_number=pool.end_number,
        event_name=event.name,
        venue_name=venue.name,
        event_date=event.event_date,
        show_time=event.show_time,
        doors_time=event.doors_time,
        ticket_price_cents=event.ticket_price,
        event_image_path=event_image_url,
    )
    
    # Create filename
    safe_event_name = "".join(c for c in event.name if c.isalnum() or c in " -_").strip()
    filename = f"{safe_event_name}_tickets.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


# ===== Band Ticket Allocation Endpoint =====

@router.get(
    "/bands/{band_id}/events/{event_id}/ticket-allocation",
    response_model=PhysicalTicketAllocationWithSales,
    summary="Get band's ticket allocation for an event",
    description="Get the ticket allocation and sales for a specific band at an event."
)
async def get_band_ticket_allocation(
    band_id: int,
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get a band's ticket allocation for an event."""
    # Verify band exists and user is a member
    band = get_band_or_404(band_id, db)
    check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
    
    # Get the band_event
    band_event = db.query(BandEvent).filter(
        BandEvent.band_id == band_id,
        BandEvent.event_id == event_id
    ).first()
    
    if not band_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Band is not participating in this event"
        )
    
    # Get the allocation for this band_event
    allocation = PhysicalTicketService.get_allocation_by_band_event(db, band_event.id)
    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No ticket allocation found for this band"
        )
    
    # Build response
    response_data = PhysicalTicketService.get_allocation_response_data(allocation)
    sales = [
        PhysicalTicketSaleResponse(**PhysicalTicketService.get_sale_response_data(sale))
        for sale in allocation.sales
    ]
    
    return PhysicalTicketAllocationWithSales(
        **response_data,
        sales=sales,
        available_ticket_numbers=allocation.get_available_ticket_numbers(),
    )


# ===== Ticket Sale Endpoints (for Band use) =====

@router.post(
    "/allocations/{allocation_id}/sales",
    response_model=PhysicalTicketSaleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record ticket sale",
    description="Record a new ticket sale for an allocation. Can be used by venue staff or band members."
)
async def record_sale(
    allocation_id: int,
    sale_data: PhysicalTicketSaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Record a new ticket sale."""
    allocation = PhysicalTicketService.get_allocation(db, allocation_id)
    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allocation not found"
        )
    
    # Check permissions: venue staff OR band member
    event = allocation.band_event.event
    is_venue_staff = False
    is_band_member = False
    
    try:
        venue = get_venue_or_404(event.venue_id, db)
        check_venue_permission(venue, current_user, [VenueRole.OWNER, VenueRole.MANAGER, VenueRole.STAFF])
        is_venue_staff = True
    except:
        pass
    
    if not is_venue_staff:
        # Check if user is a member of the band
        band = allocation.band_event.band
        try:
            check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
            is_band_member = True
        except:
            pass
    
    if not is_venue_staff and not is_band_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be venue staff or a band member to record sales"
        )
    
    try:
        sale = PhysicalTicketService.record_sale(db, allocation, sale_data, current_user.id)
        return PhysicalTicketSaleResponse(**PhysicalTicketService.get_sale_response_data(sale))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put(
    "/sales/{sale_id}",
    response_model=PhysicalTicketSaleResponse,
    summary="Update ticket sale",
    description="Update a ticket sale record. Can be used by venue staff or band members."
)
async def update_sale(
    sale_id: int,
    update_data: PhysicalTicketSaleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update a ticket sale."""
    sale = PhysicalTicketService.get_sale(db, sale_id)
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sale not found"
        )
    
    # Check permissions: venue staff OR band member
    event = sale.allocation.band_event.event
    is_venue_staff = False
    is_band_member = False
    
    try:
        venue = get_venue_or_404(event.venue_id, db)
        check_venue_permission(venue, current_user, [VenueRole.OWNER, VenueRole.MANAGER, VenueRole.STAFF])
        is_venue_staff = True
    except:
        pass
    
    if not is_venue_staff:
        # Check if user is a member of the band
        band = sale.allocation.band_event.band
        try:
            check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN, BandRole.MEMBER])
            is_band_member = True
        except:
            pass
    
    if not is_venue_staff and not is_band_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be venue staff or a band member to update sales"
        )
    
    updated = PhysicalTicketService.update_sale(db, sale, update_data)
    return PhysicalTicketSaleResponse(**PhysicalTicketService.get_sale_response_data(updated))


@router.delete(
    "/sales/{sale_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete ticket sale",
    description="Delete a ticket sale record. Can be used by venue staff (owners/managers) or band members (owners/admins)."
)
async def delete_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete a ticket sale."""
    sale = PhysicalTicketService.get_sale(db, sale_id)
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sale not found"
        )
    
    # Check permissions: venue owner/manager OR band owner/admin
    event = sale.allocation.band_event.event
    is_venue_staff = False
    is_band_member = False
    
    try:
        venue = get_venue_or_404(event.venue_id, db)
        check_venue_permission(venue, current_user, [VenueRole.OWNER, VenueRole.MANAGER])
        is_venue_staff = True
    except:
        pass
    
    if not is_venue_staff:
        # Check if user is owner/admin of the band
        band = sale.allocation.band_event.band
        try:
            check_band_permission(band, current_user, [BandRole.OWNER, BandRole.ADMIN])
            is_band_member = True
        except:
            pass
    
    if not is_venue_staff and not is_band_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be venue owner/manager or band owner/admin to delete sales"
        )
    
    PhysicalTicketService.delete_sale(db, sale)
    return None

