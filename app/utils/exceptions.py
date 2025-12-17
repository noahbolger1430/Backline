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

