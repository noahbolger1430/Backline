from fastapi import HTTPException, status


class CredentialsException(HTTPException):
    """
    Exception raised when authentication credentials are invalid.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


class InactiveUserException(HTTPException):
    """
    Exception raised when user account is inactive.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )


class UserAlreadyExistsException(HTTPException):
    """
    Exception raised when attempting to create a user with existing email.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists",
        )


class BandNotFoundException(HTTPException):
    """
    Exception raised when band is not found.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Band not found",
        )


class UnauthorizedBandAccessException(HTTPException):
    """
    Exception raised when user attempts unauthorized band operation.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to perform this action",
        )


class BandAlreadyExistsException(HTTPException):
    """
    Exception raised when attempting to create a band with existing name.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Band with this name already exists",
        )


class AvailabilityNotFoundException(HTTPException):
    """
    Exception raised when availability entry is not found.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability entry not found",
        )


class AvailabilityConflictException(HTTPException):
    """
    Exception raised when availability entry already exists for the date.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail="Availability entry already exists for this date",
        )


class InvalidDateRangeException(HTTPException):
    """
    Exception raised when an invalid date range is provided.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date range: end_date must be on or after start_date",
        )


class BandMemberNotFoundException(HTTPException):
    """
    Exception raised when band member is not found.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Band member not found",
        )


class VenueNotFoundException(HTTPException):
    """
    Exception raised when venue is not found.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found",
        )


class VenueAlreadyExistsException(HTTPException):
    """
    Exception raised when attempting to create a venue with existing name.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Venue with this name already exists",
        )


class UnauthorizedVenueAccessException(HTTPException):
    """
    Exception raised when user attempts unauthorized venue operation.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to perform this action on this venue",
        )


class EventNotFoundException(HTTPException):
    """
    Exception raised when event is not found.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )


class EventApplicationNotFoundException(HTTPException):
    """
    Exception raised when event application is not found.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event application not found",
        )


class EventApplicationAlreadyExistsException(HTTPException):
    """
    Exception raised when band has already applied to an event.
    """

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail="Band has already applied to this event",
        )


class InvalidApplicationStatusException(HTTPException):
    """
    Exception raised when attempting an invalid application status transition.
    """

    def __init__(self, message: str = "Invalid application status transition") -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )

