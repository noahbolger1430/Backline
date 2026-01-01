"""
Service layer for Physical Ticket management.

This module contains business logic for:
- Creating and managing ticket pools
- Allocating tickets to bands
- Recording and managing ticket sales
- Generating ticket summaries
"""

from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models import Event, BandEvent, BandMember
from app.models.physical_ticket import (
    PhysicalTicketPool,
    PhysicalTicketAllocation,
    PhysicalTicketSale,
)
from app.schemas.physical_ticket import (
    PhysicalTicketPoolCreate,
    PhysicalTicketAllocationCreate,
    PhysicalTicketAllocationUpdate,
    PhysicalTicketSaleCreate,
    PhysicalTicketSaleUpdate,
    EventTicketingSummary,
    BandTicketSummary,
)


class PhysicalTicketService:
    """
    Service for managing physical tickets for events.
    """

    # ===== Ticket Pool Operations =====

    @staticmethod
    def create_ticket_pool(
        db: Session, 
        event_id: int, 
        pool_data: PhysicalTicketPoolCreate
    ) -> PhysicalTicketPool:
        """
        Create a new ticket pool for an event.
        
        Args:
            db: Database session
            event_id: ID of the event
            pool_data: Ticket pool creation data
            
        Returns:
            Created PhysicalTicketPool
            
        Raises:
            ValueError: If event already has a ticket pool
        """
        # Check if pool already exists
        existing = db.query(PhysicalTicketPool).filter(
            PhysicalTicketPool.event_id == event_id
        ).first()
        if existing:
            raise ValueError("Event already has a ticket pool")
        
        # Create pool with sequential ticket numbers
        pool = PhysicalTicketPool(
            event_id=event_id,
            total_quantity=pool_data.total_quantity,
            ticket_prefix=pool_data.ticket_prefix,
            start_number=1,
            end_number=pool_data.total_quantity,
        )
        db.add(pool)
        db.commit()
        db.refresh(pool)
        return pool

    @staticmethod
    def get_ticket_pool(db: Session, event_id: int) -> Optional[PhysicalTicketPool]:
        """
        Get the ticket pool for an event.
        """
        return db.query(PhysicalTicketPool).options(
            joinedload(PhysicalTicketPool.allocations).joinedload(PhysicalTicketAllocation.band_event).joinedload(BandEvent.band),
            joinedload(PhysicalTicketPool.allocations).joinedload(PhysicalTicketAllocation.sales),
        ).filter(
            PhysicalTicketPool.event_id == event_id
        ).first()

    @staticmethod
    def get_ticket_pool_by_id(db: Session, pool_id: int) -> Optional[PhysicalTicketPool]:
        """
        Get a ticket pool by its ID.
        """
        return db.query(PhysicalTicketPool).options(
            joinedload(PhysicalTicketPool.allocations).joinedload(PhysicalTicketAllocation.band_event).joinedload(BandEvent.band),
            joinedload(PhysicalTicketPool.allocations).joinedload(PhysicalTicketAllocation.sales),
        ).filter(
            PhysicalTicketPool.id == pool_id
        ).first()

    @staticmethod
    def delete_ticket_pool(db: Session, pool: PhysicalTicketPool) -> None:
        """
        Delete a ticket pool (cascades to allocations and sales).
        """
        db.delete(pool)
        db.commit()

    # ===== Ticket Allocation Operations =====

    @staticmethod
    def allocate_tickets_to_band(
        db: Session,
        pool: PhysicalTicketPool,
        allocation_data: PhysicalTicketAllocationCreate
    ) -> PhysicalTicketAllocation:
        """
        Allocate a contiguous range of tickets to a band.
        
        Args:
            db: Database session
            pool: Ticket pool to allocate from
            allocation_data: Allocation creation data
            
        Returns:
            Created PhysicalTicketAllocation
            
        Raises:
            ValueError: If not enough tickets available or band already has allocation
        """
        # Check if band already has an allocation
        existing = db.query(PhysicalTicketAllocation).filter(
            PhysicalTicketAllocation.ticket_pool_id == pool.id,
            PhysicalTicketAllocation.band_event_id == allocation_data.band_event_id
        ).first()
        if existing:
            raise ValueError("Band already has a ticket allocation for this event")
        
        # Check if enough tickets are available
        if allocation_data.allocated_quantity > pool.unallocated_count:
            raise ValueError(
                f"Not enough tickets available. Requested: {allocation_data.allocated_quantity}, "
                f"Available: {pool.unallocated_count}"
            )
        
        # Get the next available starting number
        start_number = pool.get_next_available_start()
        end_number = start_number + allocation_data.allocated_quantity - 1
        
        allocation = PhysicalTicketAllocation(
            ticket_pool_id=pool.id,
            band_event_id=allocation_data.band_event_id,
            allocated_quantity=allocation_data.allocated_quantity,
            ticket_start_number=start_number,
            ticket_end_number=end_number,
        )
        db.add(allocation)
        db.commit()
        db.refresh(allocation)
        
        # Reload with relationships
        return db.query(PhysicalTicketAllocation).options(
            joinedload(PhysicalTicketAllocation.band_event).joinedload(BandEvent.band),
            joinedload(PhysicalTicketAllocation.sales),
            joinedload(PhysicalTicketAllocation.ticket_pool),
        ).filter(
            PhysicalTicketAllocation.id == allocation.id
        ).first()

    @staticmethod
    def get_allocation(db: Session, allocation_id: int) -> Optional[PhysicalTicketAllocation]:
        """
        Get a ticket allocation by ID.
        """
        return db.query(PhysicalTicketAllocation).options(
            joinedload(PhysicalTicketAllocation.band_event).joinedload(BandEvent.band),
            joinedload(PhysicalTicketAllocation.sales).joinedload(PhysicalTicketSale.delivery_assigned_to),
            joinedload(PhysicalTicketAllocation.sales).joinedload(PhysicalTicketSale.created_by),
            joinedload(PhysicalTicketAllocation.ticket_pool),
        ).filter(
            PhysicalTicketAllocation.id == allocation_id
        ).first()

    @staticmethod
    def get_allocation_by_band_event(db: Session, band_event_id: int) -> Optional[PhysicalTicketAllocation]:
        """
        Get a ticket allocation by band_event_id.
        """
        return db.query(PhysicalTicketAllocation).options(
            joinedload(PhysicalTicketAllocation.band_event).joinedload(BandEvent.band),
            joinedload(PhysicalTicketAllocation.sales).joinedload(PhysicalTicketSale.delivery_assigned_to).joinedload(BandMember.user),
            joinedload(PhysicalTicketAllocation.sales).joinedload(PhysicalTicketSale.created_by),
            joinedload(PhysicalTicketAllocation.ticket_pool),
        ).filter(
            PhysicalTicketAllocation.band_event_id == band_event_id
        ).first()

    @staticmethod
    def update_allocation(
        db: Session,
        allocation: PhysicalTicketAllocation,
        update_data: PhysicalTicketAllocationUpdate
    ) -> PhysicalTicketAllocation:
        """
        Update a ticket allocation.
        
        Note: Cannot reduce quantity below the number of tickets already sold.
        """
        if update_data.allocated_quantity is not None:
            if update_data.allocated_quantity < allocation.sold_count:
                raise ValueError(
                    f"Cannot reduce allocation below sold count. "
                    f"Sold: {allocation.sold_count}, Requested: {update_data.allocated_quantity}"
                )
            
            # Calculate the change in quantity
            quantity_change = update_data.allocated_quantity - allocation.allocated_quantity
            
            if quantity_change > 0:
                # Increasing allocation - check if enough unallocated tickets
                pool = allocation.ticket_pool
                if quantity_change > pool.unallocated_count:
                    raise ValueError(
                        f"Not enough unallocated tickets. "
                        f"Requested increase: {quantity_change}, Available: {pool.unallocated_count}"
                    )
            
            # Update the allocation
            allocation.allocated_quantity = update_data.allocated_quantity
            allocation.ticket_end_number = allocation.ticket_start_number + update_data.allocated_quantity - 1
        
        db.commit()
        db.refresh(allocation)
        return allocation

    @staticmethod
    def delete_allocation(db: Session, allocation: PhysicalTicketAllocation) -> None:
        """
        Delete a ticket allocation.
        
        Note: Cannot delete if any tickets have been sold.
        """
        if allocation.sold_count > 0:
            raise ValueError(
                f"Cannot delete allocation with {allocation.sold_count} sold tickets. "
                "Delete the sales first."
            )
        
        db.delete(allocation)
        db.commit()

    # ===== Ticket Sale Operations =====

    @staticmethod
    def record_sale(
        db: Session,
        allocation: PhysicalTicketAllocation,
        sale_data: PhysicalTicketSaleCreate,
        created_by_user_id: int
    ) -> PhysicalTicketSale:
        """
        Record a new ticket sale.
        
        Args:
            db: Database session
            allocation: Ticket allocation to record sale against
            sale_data: Sale creation data
            created_by_user_id: ID of user recording the sale
            
        Returns:
            Created PhysicalTicketSale
            
        Raises:
            ValueError: If ticket number is invalid or already sold
        """
        # Validate ticket number belongs to this allocation
        available_numbers = allocation.get_available_ticket_numbers()
        if sale_data.ticket_number not in available_numbers:
            # Check if it's already sold or out of range
            sold_numbers = {sale.ticket_number for sale in allocation.sales}
            if sale_data.ticket_number in sold_numbers:
                raise ValueError(f"Ticket {sale_data.ticket_number} is already sold")
            else:
                raise ValueError(f"Ticket {sale_data.ticket_number} is not valid for this allocation")
        
        sale = PhysicalTicketSale(
            allocation_id=allocation.id,
            ticket_number=sale_data.ticket_number,
            purchaser_name=sale_data.purchaser_name,
            purchaser_email=sale_data.purchaser_email,
            purchaser_phone=sale_data.purchaser_phone,
            delivery_address=sale_data.delivery_address,
            quantity=sale_data.quantity,
            is_paid=sale_data.is_paid,
            is_delivered=sale_data.is_delivered,
            delivery_assigned_to_member_id=sale_data.delivery_assigned_to_member_id,
            created_by_user_id=created_by_user_id,
            notes=sale_data.notes,
        )
        db.add(sale)
        db.commit()
        db.refresh(sale)
        return sale

    @staticmethod
    def get_sale(db: Session, sale_id: int) -> Optional[PhysicalTicketSale]:
        """
        Get a ticket sale by ID.
        """
        return db.query(PhysicalTicketSale).options(
            joinedload(PhysicalTicketSale.delivery_assigned_to),
            joinedload(PhysicalTicketSale.created_by),
            joinedload(PhysicalTicketSale.allocation).joinedload(PhysicalTicketAllocation.ticket_pool),
        ).filter(
            PhysicalTicketSale.id == sale_id
        ).first()

    @staticmethod
    def update_sale(
        db: Session,
        sale: PhysicalTicketSale,
        update_data: PhysicalTicketSaleUpdate
    ) -> PhysicalTicketSale:
        """
        Update a ticket sale.
        """
        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(sale, field, value)
        
        db.commit()
        db.refresh(sale)
        return sale

    @staticmethod
    def delete_sale(db: Session, sale: PhysicalTicketSale) -> None:
        """
        Delete a ticket sale.
        """
        db.delete(sale)
        db.commit()

    # ===== Summary Operations =====

    @staticmethod
    def get_event_ticket_summary(
        db: Session,
        event: Event
    ) -> EventTicketingSummary:
        """
        Get a comprehensive summary of ticket activity for an event.
        """
        pool = PhysicalTicketService.get_ticket_pool(db, event.id)
        
        if not pool:
            return EventTicketingSummary(
                event_id=event.id,
                event_name=event.name,
                ticket_price=event.ticket_price,
                pool_id=None,
                total_tickets=0,
                allocated_count=0,
                unallocated_count=0,
                total_sold=0,
                total_proceeds_collected=0,
                total_proceeds_outstanding=0,
                bands=[],
            )
        
        ticket_price = event.ticket_price or 0
        bands = []
        total_paid = 0
        total_unpaid = 0
        
        for alloc in pool.allocations:
            band = alloc.band_event.band
            bands.append(BandTicketSummary(
                band_id=band.id,
                band_name=band.name,
                allocation_id=alloc.id,
                allocated_count=alloc.allocated_quantity,
                sold_count=alloc.sold_count,
                unsold_count=alloc.unsold_count,
                paid_count=alloc.paid_count,
                unpaid_count=alloc.unpaid_count,
                ticket_range=f"{pool.ticket_prefix}{alloc.ticket_start_number:04d} to {pool.ticket_prefix}{alloc.ticket_end_number:04d}",
            ))
            total_paid += alloc.paid_count
            total_unpaid += alloc.unpaid_count
        
        return EventTicketingSummary(
            event_id=event.id,
            event_name=event.name,
            ticket_price=event.ticket_price,
            pool_id=pool.id,
            total_tickets=pool.total_quantity,
            allocated_count=pool.allocated_count,
            unallocated_count=pool.unallocated_count,
            total_sold=pool.total_sold,
            total_proceeds_collected=ticket_price * total_paid,
            total_proceeds_outstanding=ticket_price * total_unpaid,
            bands=bands,
        )

    @staticmethod
    def get_allocation_response_data(allocation: PhysicalTicketAllocation) -> dict:
        """
        Convert an allocation to response data with computed fields.
        """
        pool = allocation.ticket_pool
        band = allocation.band_event.band
        
        return {
            "id": allocation.id,
            "ticket_pool_id": allocation.ticket_pool_id,
            "band_event_id": allocation.band_event_id,
            "band_id": band.id,
            "band_name": band.name,
            "allocated_quantity": allocation.allocated_quantity,
            "ticket_start_number": allocation.ticket_start_number,
            "ticket_end_number": allocation.ticket_end_number,
            "ticket_range": f"{pool.ticket_prefix}{allocation.ticket_start_number:04d} to {pool.ticket_prefix}{allocation.ticket_end_number:04d}",
            "sold_count": allocation.sold_count,
            "unsold_count": allocation.unsold_count,
            "paid_count": allocation.paid_count,
            "unpaid_count": allocation.unpaid_count,
            "created_at": allocation.created_at,
            "updated_at": allocation.updated_at,
        }

    @staticmethod
    def get_sale_response_data(sale: PhysicalTicketSale) -> dict:
        """
        Convert a sale to response data with computed fields.
        """
        return {
            "id": sale.id,
            "allocation_id": sale.allocation_id,
            "ticket_number": sale.ticket_number,
            "purchaser_name": sale.purchaser_name,
            "purchaser_email": sale.purchaser_email,
            "purchaser_phone": sale.purchaser_phone,
            "delivery_address": sale.delivery_address,
            "quantity": sale.quantity,
            "is_paid": sale.is_paid,
            "is_delivered": sale.is_delivered,
            "delivery_assigned_to_member_id": sale.delivery_assigned_to_member_id,
            "delivery_assigned_to_name": sale.delivery_assigned_to.user.full_name if sale.delivery_assigned_to and sale.delivery_assigned_to.user else None,
            "created_by_user_id": sale.created_by_user_id,
            "created_by_name": sale.created_by.full_name if sale.created_by else None,
            "notes": sale.notes,
            "created_at": sale.created_at,
            "updated_at": sale.updated_at,
        }

