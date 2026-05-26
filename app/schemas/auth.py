"""
app/schemas/auth.py
────────────────────
Pydantic v2 schemas for authentication endpoints.
"""

from pydantic import BaseModel


class LoginRequest(BaseModel):
    """Payload for POST /auth/login"""

    username: str
    password: str


class Token(BaseModel):
    """JWT token response"""

    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Decoded JWT payload used internally for dependency injection"""

    user_id: int
    username: str
    role_name: str
