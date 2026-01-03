"""
Tour Generator Date Utilities

Utility functions for date-related operations, particularly weekend detection and preferences.
"""

from datetime import date
from typing import Dict, List, Optional

# Weekend days for touring purposes (Friday and Saturday)
# Sunday is not included as it's typically a travel/rest day
WEEKEND_DAYS = [4, 5]  # Friday=4, Saturday=5 in Python's weekday()

DEFAULT_WEIGHT_WEEKEND_BONUS = 10.0


def is_weekend(check_date: date) -> bool:
    """
    Check if a date is a weekend day (Friday or Saturday).
    
    Args:
        check_date: Date to check
        
    Returns:
        True if the date is Friday or Saturday
    """
    return check_date.weekday() in WEEKEND_DAYS


def calculate_weekend_penalty(
    scaled_weights: Dict[str, float],
    is_weekend: bool,
    prioritize_weekends: bool
) -> float:
    """
    Calculate weekend bonus or weekday penalty based on preferences.
    
    Args:
        scaled_weights: Dictionary of scaled weight values
        is_weekend: Whether the date is a weekend (Friday/Saturday)
        prioritize_weekends: Whether to prioritize weekend dates
        
    Returns:
        Positive value for weekend bonus, negative value for weekday penalty, or 0
    """
    if not prioritize_weekends:
        return 0.0
    
    if is_weekend:
        return scaled_weights.get('weekend_bonus', DEFAULT_WEIGHT_WEEKEND_BONUS)
    else:
        # Apply a stronger penalty for weekdays/Sundays when weekends are prioritized
        # Increased from 0.3 to 0.6 to make weekend preference more impactful
        return -scaled_weights.get('weekend_bonus', DEFAULT_WEIGHT_WEEKEND_BONUS) * 0.6


def find_nearest_weekend(target_date: date, available_dates: List[date]) -> Optional[date]:
    """
    Find the nearest available weekend date to the target date.
    
    Args:
        target_date: The date to find a weekend near
        available_dates: List of available dates
        
    Returns:
        Nearest available weekend date, or None if no weekend dates available
    """
    weekend_dates = [d for d in available_dates if is_weekend(d)]
    if not weekend_dates:
        return None
    
    # Find the weekend date with minimum distance to target
    return min(weekend_dates, key=lambda d: abs((d - target_date).days))

