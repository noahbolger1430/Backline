import re
from datetime import date, timedelta
from typing import Any, List, Optional


class ValidationPatterns:
    """Regex patterns for common validation scenarios."""

    FULL_NAME = r"^[a-zA-Z\s\-'\.]+$"
    GENRE = r"^[a-zA-Z0-9\s\-/&]+$"
    INSTRUMENT = r"^[a-zA-Z0-9\s\-/&,]+$"
    PASSWORD = {
        "uppercase": r"[A-Z]",
        "lowercase": r"[a-z]",
        "digit": r"\d",
        "special": r"[!@#$%^&*(),.?\":{}|<>]",
    }


class StringValidator:
    """Utility class for string validation and cleaning."""

    @staticmethod
    def clean_and_validate(
        value: Optional[str],
        pattern: Optional[str] = None,
        error_msg: Optional[str] = None,
        allow_none: bool = True,
    ) -> Optional[str]:
        """Clean whitespace and validate against pattern."""
        if value is None:
            if allow_none:
                return None
            raise ValueError("Value cannot be None")

        cleaned = " ".join(value.split())
        if not cleaned:
            if allow_none:
                return None
            raise ValueError("Value cannot be empty or only whitespace")

        if pattern and not re.match(pattern, cleaned):
            raise ValueError(error_msg or f"Value does not match pattern {pattern}")

        return cleaned


class DateRangeValidator:
    """Utility class for date range validation."""

    MAX_FUTURE_DAYS = 730  # 2 years
    MAX_PAST_DAYS = 365  # 1 year
    MAX_RANGE_DAYS = 365  # 1 year

    @staticmethod
    def validate_not_too_far_future(value: date) -> date:
        max_future_date = date.today() + timedelta(days=DateRangeValidator.MAX_FUTURE_DAYS)
        if value > max_future_date:
            raise ValueError(
                f"Cannot set date more than {DateRangeValidator.MAX_FUTURE_DAYS // 365} years in the future"
            )
        return value

    @staticmethod
    def validate_not_too_far_past(value: date) -> date:
        min_past_date = date.today() - timedelta(days=DateRangeValidator.MAX_PAST_DAYS)
        if value < min_past_date:
            raise ValueError(
                f"Cannot set date more than {DateRangeValidator.MAX_PAST_DAYS // 365} year(s) in the past"
            )
        return value

    @staticmethod
    def validate_date_range(start_date: date, end_date: date, max_days: Optional[int] = None) -> tuple[date, date]:
        if end_date < start_date:
            raise ValueError("end_date must be on or after start_date")

        max_days = max_days or DateRangeValidator.MAX_RANGE_DAYS
        date_range = (end_date - start_date).days
        if date_range > max_days:
            raise ValueError(f"Date range cannot exceed {max_days} days")

        return start_date, end_date


class EmailValidator:
    """Enhanced email validation beyond pydantic's EmailStr."""

    BLOCKED_DOMAINS = [
        "tempmail.com",
        "throwaway.email",
        "guerrillamail.com",
    ]

    @staticmethod
    def validate_email(email: str) -> str:
        email = email.lower().strip()

        domain = email.split("@")[-1]
        if domain in EmailValidator.BLOCKED_DOMAINS:
            raise ValueError("Email domain is not allowed")

        common_typos = {
            "gmial.com": "gmail.com",
            "gmai.com": "gmail.com",
            "yahooo.com": "yahoo.com",
            "yaho.com": "yahoo.com",
            "outlok.com": "outlook.com",
        }

        if domain in common_typos:
            raise ValueError(f"Did you mean @{common_typos[domain]}?")

        return email


class BulkOperationValidator:
    """Validator for bulk operations."""

    MAX_BULK_ENTRIES = 365

    @staticmethod
    def validate_bulk_entries(entries: List[Any], date_field: str = "date", max_entries: int = MAX_BULK_ENTRIES) -> List[Any]:
        if not entries:
            raise ValueError("Entries list cannot be empty")

        if len(entries) > max_entries:
            raise ValueError(f"Cannot create more than {max_entries} entries at once")

        if hasattr(entries[0], date_field):
            dates = [getattr(entry, date_field) for entry in entries]
            if len(dates) != len(set(dates)):
                raise ValueError(f"Duplicate {date_field}s found in entries")

        return entries

    @staticmethod
    def validate_unique_list(items: List[Any], field_name: str = "items") -> List[Any]:
        if len(items) != len(set(items)):
            raise ValueError(f"Duplicate {field_name} found")
        return items


class TimeValidator:
    """Validator for time-related fields."""

    @staticmethod
    def validate_time_order(
        start_time: Optional[Any],
        end_time: Optional[Any],
        start_field: str = "start_time",
        end_field: str = "end_time",
    ) -> Optional[Any]:
        if end_time is not None and start_time is not None:
            if end_time <= start_time:
                raise ValueError(f"{end_field} must be after {start_field}")
        return end_time


class PriceValidator:
    """Validator for price-related fields."""

    @staticmethod
    def validate_positive_price(value: Optional[int]) -> Optional[int]:
        if value is not None and value <= 0:
            raise ValueError("Price must be positive")
        return value

    @staticmethod
    def validate_price_required_if_ticketed(
        price: Optional[int], is_ticketed: bool, field_name: str = "ticket_price"
    ) -> Optional[int]:
        if is_ticketed:
            if price is None:
                raise ValueError(f"{field_name} is required when event is ticketed")
            if price <= 0:
                raise ValueError(f"{field_name} must be positive")
        return price

