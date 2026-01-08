"""
Venue Distance Service

Service for calculating distances between bands and venues,
with support for filtering venues by radius.
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import logging

from sqlalchemy.orm import Session

from app.models.band import Band
from app.models.venue import Venue
from app.services.tour_generator_geocoding_utils import (
    GeocodingService,
    build_location_string,
    calculate_distance,
    estimate_distance_from_location,
)


logger = logging.getLogger(__name__)


@dataclass
class VenueWithDistance:
    """
    Container for a venue with its calculated distance from origin.
    """

    venue: Venue
    distance_km: float


class VenueDistanceService:
    """
    Service for calculating distances between locations and filtering
    venues by radius.
    """

    _coordinate_cache: Dict[int, Optional[Tuple[float, float]]] = {}

    @classmethod
    def get_band_location_string(cls, band: Band) -> str:
        """
        Build a location string from band's location fields.

        Args:
            band: Band model instance

        Returns:
            Location string suitable for geocoding
        """
        parts = []
        if band.location:
            parts.append(band.location)
        if band.city:
            parts.append(band.city)
        if band.state:
            parts.append(band.state)
        return ", ".join(parts) if parts else ""

    @classmethod
    def get_venue_location_string(cls, venue: Venue) -> str:
        """
        Build a location string from venue's location fields.

        Args:
            venue: Venue model instance

        Returns:
            Location string suitable for geocoding
        """
        return build_location_string(venue=venue)

    @classmethod
    def get_band_coordinates(
        cls,
        band: Band,
        use_cache: bool = True
    ) -> Optional[Tuple[float, float]]:
        """
        Get geocoded coordinates for a band's location.

        Args:
            band: Band model instance
            use_cache: Whether to use coordinate cache

        Returns:
            Tuple of (latitude, longitude) or None if geocoding fails
        """
        cache_key = f"band_{band.id}"

        if use_cache and cache_key in cls._coordinate_cache:
            return cls._coordinate_cache[cache_key]

        location_string = cls.get_band_location_string(band)
        if not location_string:
            cls._coordinate_cache[cache_key] = None
            return None

        coords = GeocodingService.geocode(location_string)
        cls._coordinate_cache[cache_key] = coords
        return coords

    @classmethod
    def get_venue_coordinates(
        cls,
        venue: Venue,
        use_cache: bool = True
    ) -> Optional[Tuple[float, float]]:
        """
        Get geocoded coordinates for a venue's location.

        Args:
            venue: Venue model instance
            use_cache: Whether to use coordinate cache

        Returns:
            Tuple of (latitude, longitude) or None if geocoding fails
        """
        cache_key = f"venue_{venue.id}"

        if use_cache and cache_key in cls._coordinate_cache:
            return cls._coordinate_cache[cache_key]

        location_string = cls.get_venue_location_string(venue)
        if not location_string:
            cls._coordinate_cache[cache_key] = None
            return None

        coords = GeocodingService.geocode(location_string)
        cls._coordinate_cache[cache_key] = coords
        return coords

    @classmethod
    def calculate_distance_between_band_and_venue(
        cls,
        band: Band,
        venue: Venue
    ) -> Optional[float]:
        """
        Calculate the distance in km between a band and venue.

        Args:
            band: Band model instance
            venue: Venue model instance

        Returns:
            Distance in kilometers, or None if calculation fails
        """
        band_coords = cls.get_band_coordinates(band)
        venue_coords = cls.get_venue_coordinates(venue)

        if band_coords and venue_coords:
            return calculate_distance(
                band_coords[0], band_coords[1],
                venue_coords[0], venue_coords[1]
            )

        band_location = cls.get_band_location_string(band)
        venue_location = cls.get_venue_location_string(venue)

        if band_location and venue_location:
            return estimate_distance_from_location(band_location, venue_location)

        return None

    @classmethod
    def filter_venues_by_distance(
        cls,
        venues: List[Venue],
        band: Band,
        max_distance_km: float,
        include_unknown: bool = False
    ) -> List[VenueWithDistance]:
        """
        Filter venues to only include those within the specified radius.

        Args:
            venues: List of Venue model instances
            band: Band model instance (origin point)
            max_distance_km: Maximum distance in kilometers
            include_unknown: Whether to include venues where distance
                           cannot be calculated

        Returns:
            List of VenueWithDistance objects within the radius,
            sorted by distance ascending
        """
        results: List[VenueWithDistance] = []

        band_coords = cls.get_band_coordinates(band)
        band_location = cls.get_band_location_string(band)

        if not band_coords and not band_location:
            logger.warning(
                f"Cannot filter by distance: Band {band.id} has no location"
            )
            if include_unknown:
                return [
                    VenueWithDistance(venue=v, distance_km=-1)
                    for v in venues
                ]
            return []

        for venue in venues:
            distance = cls.calculate_distance_between_band_and_venue(band, venue)

            if distance is not None:
                if distance <= max_distance_km:
                    results.append(VenueWithDistance(
                        venue=venue,
                        distance_km=round(distance, 1)
                    ))
            elif include_unknown:
                results.append(VenueWithDistance(
                    venue=venue,
                    distance_km=-1
                ))

        results.sort(key=lambda x: (x.distance_km < 0, x.distance_km))

        return results

    @classmethod
    def add_distances_to_venues(
        cls,
        venues: List[Venue],
        band: Band
    ) -> List[VenueWithDistance]:
        """
        Calculate and add distance information to all venues.

        Args:
            venues: List of Venue model instances
            band: Band model instance (origin point)

        Returns:
            List of VenueWithDistance objects with calculated distances
        """
        results: List[VenueWithDistance] = []

        for venue in venues:
            distance = cls.calculate_distance_between_band_and_venue(band, venue)
            results.append(VenueWithDistance(
                venue=venue,
                distance_km=round(distance, 1) if distance is not None else -1
            ))

        return results

    @classmethod
    def clear_cache(cls):
        """
        Clear the coordinate cache.
        """
        cls._coordinate_cache.clear()
        GeocodingService.clear_cache()

    @classmethod
    def get_cache_stats(cls) -> Dict:
        """
        Get statistics about the coordinate cache.

        Returns:
            Dict with cache statistics
        """
        total = len(cls._coordinate_cache)
        successful = sum(
            1 for v in cls._coordinate_cache.values() if v is not None
        )
        geocoding_stats = GeocodingService.get_cache_stats()

        return {
            "coordinate_cache": {
                "total_entries": total,
                "successful_geocodes": successful,
                "failed_geocodes": total - successful
            },
            "geocoding_cache": geocoding_stats
        }
