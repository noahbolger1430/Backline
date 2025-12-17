from typing import Optional

from pydantic import BaseModel


class Token(BaseModel):
    """
    Schema for JWT token response.
    """

    access_token: str
    token_type: str


class TokenData(BaseModel):
    """
    Schema for data stored in JWT token.
    """

    email: Optional[str] = None


class LoginRequest(BaseModel):
    """
    Schema for login credentials.
    """

    email: str
    password: str

