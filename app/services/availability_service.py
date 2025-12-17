from datetime import date, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import (
    AvailabilityStatus,
    Band,
    BandAvailability,
    BandMember,
    BandMemberAvailability,
    DayOfWeek,
    Event,
    Venue,
    VenueAvailability,
    VenueAvailabilityStatus,
    VenueOperatingHours,
)
from app.schemas.availability import MemberAvailabilitySummary
from app.schemas.venue_availability import VenueEffectiveAvailability


class AvailabilityService:
    """
    Service for computing effective availability for venues and bands.
    Handles the complex logic of determining actual availability based on
    multiple factors like operating hours, events, and explicit blocks.
    """

    @staticmethod
    def get_venue_effective_availability(
        db: Session,
        venue: Venue,
        target_date: date,
        operating_hours_map: Optional[Dict[int, VenueOperatingHours]] = None,
    ) -> VenueEffectiveAvailability:
        """
        Calculate effective availability for a venue on a specific date.
        """
        day_of_week = DayOfWeek(target_date.weekday())

        if operating_hours_map is None:
            operating_hours_map = AvailabilityService._get_operating_hours_map(db, venue.id)

        operating_hours = operating_hours_map.get(day_of_week.value)
        is_operating_day = operating_hours is not None and not operating_hours.is_closed

        event = (
            db.query(Event).filter(Event.venue_id == venue.id, Event.event_date == target_date).first()
        )

        explicit_block = (
            db.query(VenueAvailability)
            .filter(VenueAvailability.venue_id == venue.id, VenueAvailability.date == target_date)
            .first()
        )

        is_available = True
        reason = None

        if event:
            is_available = False
            reason = f"Event scheduled: {event.name}"
        elif explicit_block and explicit_block.status == VenueAvailabilityStatus.UNAVAILABLE.value:
            is_available = False
            reason = "Venue blocked on this date"
        elif not is_operating_day:
            is_available = False
            reason = "Venue closed on this day of week"

        return VenueEffectiveAvailability(
            date=target_date,
            day_of_week=day_of_week,
            is_available=is_available,
            reason=reason,
            has_event=event is not None,
            event_id=event.id if event else None,
            event_name=event.name if event else None,
            is_operating_day=is_operating_day,
            has_explicit_block=explicit_block is not None,
            explicit_block_note=explicit_block.note if explicit_block else None,
            operating_hours=operating_hours,
        )

    @staticmethod
    def get_venue_availability_range(
        db: Session, venue: Venue, start_date: date, end_date: date
    ) -> List[VenueEffectiveAvailability]:
        """
        Calculate effective availability for a venue across a date range.
        """
        operating_hours_map = AvailabilityService._get_operating_hours_map(db, venue.id)

        availability_list = []
        current_date = start_date

        while current_date <= end_date:
            effective_availability = AvailabilityService.get_venue_effective_availability(
                db, venue, current_date, operating_hours_map
            )
            availability_list.append(effective_availability)
            current_date += timedelta(days=1)

        return availability_list

    @staticmethod
    def get_band_effective_availability(
        db: Session, band: Band, target_date: date
    ) -> tuple[bool, List[MemberAvailabilitySummary]]:
        """
        Calculate effective availability for a band on a specific date.
        Returns tuple of (is_available, member_details).
        """
        band_block = (
            db.query(BandAvailability)
            .filter(BandAvailability.band_id == band.id, BandAvailability.date == target_date)
            .first()
        )

        if band_block and band_block.status == AvailabilityStatus.UNAVAILABLE.value:
            return False, []

        member_details: List[MemberAvailabilitySummary] = []
        available_count = 0
        unavailable_count = 0
        tentative_count = 0

        for membership in band.members:
            member_availability = (
                db.query(BandMemberAvailability)
                .filter(
                    BandMemberAvailability.band_member_id == membership.id,
                    BandMemberAvailability.date == target_date,
                )
                .first()
            )

            if member_availability:
                status = AvailabilityStatus(member_availability.status)
                note = member_availability.note
            else:
                status = AvailabilityStatus.AVAILABLE
                note = None

            member_details.append(
                MemberAvailabilitySummary(
                    member_id=membership.id,
                    user_id=membership.user_id,
                    member_name=membership.user.full_name,
                    status=status,
                    note=note,
                )
            )

            if status == AvailabilityStatus.AVAILABLE:
                available_count += 1
            elif status == AvailabilityStatus.UNAVAILABLE:
                unavailable_count += 1
            elif status == AvailabilityStatus.TENTATIVE:
                tentative_count += 1

        is_band_available = unavailable_count < len(band.members)

        return is_band_available, member_details

    @staticmethod
    def filter_venue_availability_by_band(
        db: Session, venue_availability: List[VenueEffectiveAvailability], band: Band
    ) -> List[VenueEffectiveAvailability]:
        """
        Filter venue availability to only include dates where the band is also available.
        """
        filtered_availability = []

        for venue_date in venue_availability:
            if not venue_date.is_available:
                continue

            is_band_available, _ = AvailabilityService.get_band_effective_availability(
                db, band, venue_date.date
            )

            if is_band_available:
                filtered_availability.append(venue_date)

        return filtered_availability

    @staticmethod
    def _get_operating_hours_map(db: Session, venue_id: int) -> Dict[int, VenueOperatingHours]:
        """
        Get a mapping of day_of_week to operating hours for a venue.
        """
        operating_hours = (
            db.query(VenueOperatingHours).filter(VenueOperatingHours.venue_id == venue_id).all()
        )

        return {hours.day_of_week: hours for hours in operating_hours}

