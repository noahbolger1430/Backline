"""
Tour Generator Geocoding Utilities

Utility classes and functions for address parsing, geocoding, and distance calculations.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from math import radians, sin, cos, sqrt, atan2
import logging
import re

from app.models.venue import Venue

# Geocoding imports
try:
    from geopy.geocoders import Nominatim
    from geopy.exc import GeocoderTimedOut, GeocoderServiceError, GeocoderUnavailable
    GEOPY_AVAILABLE = True
except ImportError:
    GEOPY_AVAILABLE = False
    logging.warning("geopy not installed. Distance calculations will use fallback estimates. Install with: pip install geopy")

logger = logging.getLogger(__name__)


# Distance calculation constants
EARTH_RADIUS_KM = 6371.0
DEFAULT_UNKNOWN_DISTANCE_KM = 400.0
DEFAULT_SAME_CITY_DISTANCE_KM = 15.0
DEFAULT_SAME_STATE_DISTANCE_KM = 200.0
DEFAULT_DIFFERENT_STATE_DISTANCE_KM = 800.0


@dataclass
class ParsedAddress:
    """
    Represents a parsed and normalized address.
    """
    street_address: Optional[str] = None
    city: Optional[str] = None
    state_province: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    
    def to_geocoding_string(self, include_street: bool = True) -> str:
        """
        Convert to a string suitable for geocoding.
        
        Args:
            include_street: Whether to include street address
            
        Returns:
            Formatted address string
        """
        parts = []
        if include_street and self.street_address:
            parts.append(self.street_address)
        if self.city:
            parts.append(self.city)
        if self.state_province:
            parts.append(self.state_province)
        if self.postal_code:
            parts.append(self.postal_code)
        if self.country:
            parts.append(self.country)
        return ", ".join(parts)


class AddressParser:
    """
    Utility class for parsing and normalizing addresses for geocoding.
    
    Handles various address formats including:
    - Canadian addresses with postal codes
    - US addresses with ZIP codes
    - Free-form location strings
    """
    
    # Canadian postal code pattern (with or without space)
    CANADIAN_POSTAL_CODE_PATTERN = re.compile(
        r'^([A-Za-z]\d[A-Za-z])\s?(\d[A-Za-z]\d)$'
    )
    
    # US ZIP code patterns
    US_ZIP_PATTERN = re.compile(r'^(\d{5})(?:-?\d{4})?$')
    
    # Canadian province codes and names
    CANADIAN_PROVINCES = {
        'ab': 'Alberta',
        'bc': 'British Columbia',
        'mb': 'Manitoba',
        'nb': 'New Brunswick',
        'nl': 'Newfoundland and Labrador',
        'ns': 'Nova Scotia',
        'nt': 'Northwest Territories',
        'nu': 'Nunavut',
        'on': 'Ontario',
        'pe': 'Prince Edward Island',
        'qc': 'Quebec',
        'sk': 'Saskatchewan',
        'yt': 'Yukon',
    }
    
    # US state codes (subset of common ones)
    US_STATES = {
        'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga',
        'hi', 'id', 'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md',
        'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj',
        'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc',
        'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy',
        'dc'
    }
    
    # Common city name corrections/normalizations
    CITY_CORRECTIONS = {
        "st. catherine's": "St. Catharines",
        "st catherine's": "St. Catharines",
        "st. catharines": "St. Catharines",
        "st catharines": "St. Catharines",
        "st. john's": "St. John's",
        "st john's": "St. John's",
        "st. johns": "St. John's",
        "trois rivieres": "Trois-Rivières",
        "trois-rivieres": "Trois-Rivières",
        "montreal": "Montréal",
        "quebec city": "Québec",
        "quebec": "Québec",
    }
    
    @classmethod
    def parse_address(cls, address: str) -> ParsedAddress:
        """
        Parse a free-form address string into components.
        
        Handles formats like:
        - "11 Geneva St., St. Catherine's, ON, L2R3N2"
        - "932 Granville St., Vancouver, BC, V6Z1L2"
        - "123 Main St, Austin, TX 78701"
        - "Toronto, ON"
        
        Args:
            address: Raw address string
            
        Returns:
            ParsedAddress with normalized components
        """
        if not address:
            return ParsedAddress()
        
        # Split by comma and clean up
        parts = [p.strip() for p in address.split(',') if p.strip()]
        
        if not parts:
            return ParsedAddress()
        
        parsed = ParsedAddress()
        
        # Work backwards from the end to identify components
        remaining_parts = parts.copy()
        
        # Check last part for postal/zip code
        if remaining_parts:
            last_part = remaining_parts[-1].strip()
            postal_code, country = cls._extract_postal_code(last_part)
            
            if postal_code:
                parsed.postal_code = postal_code
                parsed.country = country
                # Remove postal code from the last part if it was combined with state
                remaining_text = last_part.replace(postal_code.replace(' ', ''), '').strip()
                remaining_text = remaining_text.replace(postal_code, '').strip()
                if remaining_text:
                    remaining_parts[-1] = remaining_text
                else:
                    remaining_parts.pop()
        
        # Check for state/province code
        if remaining_parts:
            last_part = remaining_parts[-1].strip().lower()
            # Check if it's just a state/province code
            if len(last_part) == 2:
                if last_part in cls.CANADIAN_PROVINCES:
                    parsed.state_province = cls.CANADIAN_PROVINCES[last_part]
                    parsed.country = parsed.country or 'Canada'
                    remaining_parts.pop()
                elif last_part in cls.US_STATES:
                    parsed.state_province = last_part.upper()
                    parsed.country = parsed.country or 'USA'
                    remaining_parts.pop()
            else:
                # Check if state code is embedded with postal code or city
                state_match = re.search(r'\b([A-Za-z]{2})\b', last_part)
                if state_match:
                    potential_state = state_match.group(1).lower()
                    if potential_state in cls.CANADIAN_PROVINCES:
                        parsed.state_province = cls.CANADIAN_PROVINCES[potential_state]
                        parsed.country = parsed.country or 'Canada'
                        # Remove state from the string
                        remaining_text = last_part.replace(state_match.group(0), '').strip()
                        remaining_text = re.sub(r'^[\s,]+|[\s,]+$', '', remaining_text)
                        if remaining_text:
                            remaining_parts[-1] = remaining_text
                        else:
                            remaining_parts.pop()
                    elif potential_state in cls.US_STATES:
                        parsed.state_province = potential_state.upper()
                        parsed.country = parsed.country or 'USA'
                        remaining_text = last_part.replace(state_match.group(0), '').strip()
                        remaining_text = re.sub(r'^[\s,]+|[\s,]+$', '', remaining_text)
                        if remaining_text:
                            remaining_parts[-1] = remaining_text
                        else:
                            remaining_parts.pop()
        
        # Next part should be city
        if remaining_parts:
            city = remaining_parts.pop().strip()
            parsed.city = cls._normalize_city_name(city)
        
        # Remaining parts are street address
        if remaining_parts:
            parsed.street_address = ', '.join(remaining_parts)
        
        return parsed
    
    @classmethod
    def _extract_postal_code(cls, text: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Extract and normalize postal/zip code from text.
        
        Args:
            text: Text that may contain a postal code
            
        Returns:
            Tuple of (normalized_postal_code, detected_country)
        """
        text = text.strip().upper()
        
        # Try Canadian postal code (handles both "L2R3N2" and "L2R 3N2")
        # Look for pattern anywhere in the text
        canadian_match = re.search(
            r'([A-Z]\d[A-Z])\s?(\d[A-Z]\d)',
            text
        )
        if canadian_match:
            # Format with space as per Canadian standard
            postal_code = f"{canadian_match.group(1)} {canadian_match.group(2)}"
            return postal_code, 'Canada'
        
        # Try US ZIP code
        us_match = re.search(r'(\d{5})(?:-\d{4})?', text)
        if us_match:
            return us_match.group(1), 'USA'
        
        return None, None
    
    @classmethod
    def _normalize_city_name(cls, city: str) -> str:
        """
        Normalize city name for better geocoding.
        
        Args:
            city: Raw city name
            
        Returns:
            Normalized city name
        """
        if not city:
            return city
        
        # Check corrections dictionary
        city_lower = city.lower().strip()
        if city_lower in cls.CITY_CORRECTIONS:
            return cls.CITY_CORRECTIONS[city_lower]
        
        # Handle common patterns
        # Fix "St." abbreviations
        city = re.sub(r'\bSt\b\.?\s*', 'St. ', city, flags=re.IGNORECASE)
        
        # Clean up multiple spaces
        city = ' '.join(city.split())
        
        # Title case while preserving apostrophes
        words = city.split()
        normalized_words = []
        for word in words:
            if word.lower() in ['the', 'of', 'and', 'de', 'la', 'le', 'du', 'des']:
                normalized_words.append(word.lower())
            else:
                normalized_words.append(word.capitalize())
        
        return ' '.join(normalized_words)
    
    @classmethod
    def normalize_for_geocoding(cls, address: str) -> List[str]:
        """
        Normalize an address and return multiple geocoding attempts.
        
        Returns a list of address strings to try in order, from most
        specific to least specific.
        
        Args:
            address: Raw address string
            
        Returns:
            List of formatted address strings to attempt geocoding
        """
        parsed = cls.parse_address(address)
        
        attempts = []
        
        # Attempt 1: Full address with street
        full_address = parsed.to_geocoding_string(include_street=True)
        if full_address:
            attempts.append(full_address)
        
        # Attempt 2: Without street address (city, state, country)
        city_only = parsed.to_geocoding_string(include_street=False)
        if city_only and city_only != full_address:
            attempts.append(city_only)
        
        # Attempt 3: Just city and state/province with country
        if parsed.city and parsed.state_province:
            simple = f"{parsed.city}, {parsed.state_province}"
            if parsed.country:
                simple += f", {parsed.country}"
            if simple not in attempts:
                attempts.append(simple)
        
        # Attempt 4: City and country only
        if parsed.city and parsed.country:
            minimal = f"{parsed.city}, {parsed.country}"
            if minimal not in attempts:
                attempts.append(minimal)
        
        return attempts if attempts else [address]


class GeocodingService:
    """
    Service for geocoding addresses to coordinates.
    
    Uses Nominatim (OpenStreetMap) for geocoding with caching to avoid
    rate limiting and improve performance.
    """
    
    _geocoder = None
    _cache: Dict[str, Optional[Tuple[float, float]]] = {}
    
    @classmethod
    def _get_geocoder(cls):
        """
        Get or create the geocoder instance.
        """
        if cls._geocoder is None and GEOPY_AVAILABLE:
            cls._geocoder = Nominatim(
                user_agent="tour_generator_service",
                timeout=10
            )
        return cls._geocoder
    
    @classmethod
    def geocode(cls, location: str) -> Optional[Tuple[float, float]]:
        """
        Geocode a location string to coordinates.
        
        Uses address parsing and normalization to improve geocoding success rate.
        Tries multiple address formats from most specific to least specific.
        
        Args:
            location: Location string (e.g., "Toronto, ON" or "123 Main St, Austin, TX")
            
        Returns:
            Tuple of (latitude, longitude) or None if geocoding fails
        """
        if not location:
            return None
        
        if not GEOPY_AVAILABLE:
            logger.warning("geopy not available, cannot geocode location")
            return None
        
        # Create a cache key from the original location
        cache_key = location.lower().strip()
        
        # Check cache first
        if cache_key in cls._cache:
            return cls._cache[cache_key]
        
        geocoder = cls._get_geocoder()
        if not geocoder:
            return None
        
        # Get normalized address attempts
        address_attempts = AddressParser.normalize_for_geocoding(location)
        
        for attempt in address_attempts:
            try:
                logger.debug(f"Attempting to geocode: '{attempt}'")
                result = geocoder.geocode(attempt)
                
                if result:
                    coords = (result.latitude, result.longitude)
                    cls._cache[cache_key] = coords
                    logger.debug(f"Successfully geocoded '{location}' as '{attempt}' to {coords}")
                    return coords
                    
            except GeocoderTimedOut:
                logger.warning(f"Geocoding timed out for: {attempt}")
                continue
            except (GeocoderServiceError, GeocoderUnavailable) as e:
                logger.warning(f"Geocoding service error for '{attempt}': {e}")
                continue
            except Exception as e:
                logger.error(f"Unexpected geocoding error for '{attempt}': {e}")
                continue
        
        # All attempts failed - cache the failure
        cls._cache[cache_key] = None
        logger.warning(f"Could not geocode location after {len(address_attempts)} attempts: {location}")
        
        # Log the parsed address for debugging
        parsed = AddressParser.parse_address(location)
        logger.debug(f"Parsed address components: street='{parsed.street_address}', "
                    f"city='{parsed.city}', state='{parsed.state_province}', "
                    f"postal='{parsed.postal_code}', country='{parsed.country}'")
        
        return None
    
    @classmethod
    def clear_cache(cls):
        """
        Clear the geocoding cache.
        """
        cls._cache.clear()
    
    @classmethod
    def get_cache_stats(cls) -> Dict:
        """
        Get statistics about the geocoding cache.
        
        Returns:
            Dict with cache statistics
        """
        total = len(cls._cache)
        successful = sum(1 for v in cls._cache.values() if v is not None)
        return {
            "total_entries": total,
            "successful_geocodes": successful,
            "failed_geocodes": total - successful
        }


def calculate_distance(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
) -> float:
    """
    Calculate distance between two points using Haversine formula.
    
    Args:
        lat1: Latitude of first point in degrees
        lon1: Longitude of first point in degrees
        lat2: Latitude of second point in degrees
        lon2: Longitude of second point in degrees
    
    Returns:
        Distance in kilometers
    """
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)
    
    a = sin(delta_lat / 2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    
    return EARTH_RADIUS_KM * c


def build_location_string(
    venue: Optional[Venue] = None, 
    city: Optional[str] = None, 
    state: Optional[str] = None,
    street_address: Optional[str] = None
) -> str:
    """
    Build a location string suitable for geocoding.
    
    Args:
        venue: Venue object to extract location from
        city: City name (used if venue not provided)
        state: State/province (used if venue not provided)
        street_address: Street address for more precise geocoding
        
    Returns:
        Location string for geocoding
    """
    if venue:
        parts = []
        if venue.street_address:
            parts.append(venue.street_address)
        if venue.city:
            parts.append(venue.city)
        if venue.state:
            parts.append(venue.state)
        if venue.zip_code:
            parts.append(venue.zip_code)
        return ", ".join(parts) if parts else ""
    else:
        parts = []
        if street_address:
            parts.append(street_address)
        if city:
            parts.append(city)
        if state:
            parts.append(state)
        return ", ".join(parts) if parts else ""


def estimate_distance_from_location(
    location1: str,
    location2: str
) -> float:
    """
    Calculate distance between two location strings using geocoding.
    
    This function attempts to geocode both locations and calculate the
    actual distance using the Haversine formula. If geocoding fails,
    it falls back to heuristic estimates based on location string matching.
    
    Args:
        location1: First location string (e.g., "Austin, TX" or "123 Main St, Toronto, ON")
        location2: Second location string
        
    Returns:
        Distance in kilometers
    """
    # Handle empty locations
    if not location1 or not location2:
        logger.debug("One or both locations empty, returning default distance")
        return DEFAULT_UNKNOWN_DISTANCE_KM
    
    # Normalize for comparison
    loc1_lower = location1.lower().strip()
    loc2_lower = location2.lower().strip()
    
    # Quick check for identical locations
    if loc1_lower == loc2_lower:
        return 0.0
    
    # Try geocoding both locations
    coords1 = GeocodingService.geocode(location1)
    coords2 = GeocodingService.geocode(location2)
    
    # If both geocoded successfully, calculate actual distance
    if coords1 and coords2:
        distance = calculate_distance(
            coords1[0], coords1[1],
            coords2[0], coords2[1]
        )
        logger.debug(f"Calculated distance from '{location1}' to '{location2}': {distance:.1f} km")
        return distance
    
    # Fallback to heuristic estimation if geocoding failed
    logger.debug(f"Geocoding failed for one or both locations, using heuristic estimate")
    return estimate_distance_heuristic(loc1_lower, loc2_lower)


def estimate_distance_heuristic(
    loc1_lower: str,
    loc2_lower: str
) -> float:
    """
    Estimate distance using heuristics when geocoding is unavailable.
    
    This is a fallback method that provides rough estimates based on
    location string analysis. It's less accurate than geocoding but
    provides reasonable estimates for routing optimization.
    
    Args:
        loc1_lower: First location string (lowercase)
        loc2_lower: Second location string (lowercase)
        
    Returns:
        Estimated distance in kilometers
    """
    # Parse both locations
    parsed1 = AddressParser.parse_address(loc1_lower)
    parsed2 = AddressParser.parse_address(loc2_lower)
    
    # Check for same city
    if parsed1.city and parsed2.city:
        city1_normalized = parsed1.city.lower().strip()
        city2_normalized = parsed2.city.lower().strip()
        if city1_normalized == city2_normalized:
            return DEFAULT_SAME_CITY_DISTANCE_KM
    
    # Check for same state/province
    if parsed1.state_province and parsed2.state_province:
        state1 = parsed1.state_province.lower().strip()
        state2 = parsed2.state_province.lower().strip()
        if state1 == state2:
            return DEFAULT_SAME_STATE_DISTANCE_KM
    
    # Check for neighboring regions
    neighboring_regions = {
        # Canadian provinces (full names, lowercase)
        ('ontario', 'quebec'), ('ontario', 'manitoba'), 
        ('british columbia', 'alberta'), ('alberta', 'saskatchewan'), 
        ('saskatchewan', 'manitoba'), ('nova scotia', 'new brunswick'),
        ('new brunswick', 'quebec'), ('quebec', 'newfoundland and labrador'),
        # US states
        ('ny', 'nj'), ('ny', 'pa'), ('ny', 'ct'), ('ny', 'ma'),
        ('ca', 'nv'), ('ca', 'az'), ('ca', 'or'),
        ('tx', 'ok'), ('tx', 'la'), ('tx', 'nm'),
        ('il', 'wi'), ('il', 'in'), ('il', 'mi'),
        ('fl', 'ga'), ('ga', 'sc'), ('sc', 'nc'), ('nc', 'va'),
        # Cross-border
        ('ontario', 'ny'), ('ontario', 'mi'), ('british columbia', 'wa'), 
        ('quebec', 'vt'), ('quebec', 'ny'), ('manitoba', 'nd'), ('manitoba', 'mn'),
    }
    
    if parsed1.state_province and parsed2.state_province:
        state1 = parsed1.state_province.lower().strip()
        state2 = parsed2.state_province.lower().strip()
        state_pair = tuple(sorted([state1, state2]))
        if state_pair in neighboring_regions:
            return DEFAULT_SAME_STATE_DISTANCE_KM * 1.5  # 300 km for neighbors
    
    # Different regions - assume longer distance
    return DEFAULT_DIFFERENT_STATE_DISTANCE_KM


def calculate_distance_between_venues(
    venue1: Optional[Venue],
    venue2: Optional[Venue]
) -> float:
    """
    Calculate distance between two venues.
    
    Args:
        venue1: First venue
        venue2: Second venue
        
    Returns:
        Distance in kilometers
    """
    if not venue1 or not venue2:
        return DEFAULT_UNKNOWN_DISTANCE_KM
    
    location1 = build_location_string(venue=venue1)
    location2 = build_location_string(venue=venue2)
    
    return estimate_distance_from_location(location1, location2)

