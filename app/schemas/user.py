"""
app/schemas/user.py
────────────────────
Pydantic v2 schemas for User CRUD endpoints.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class UserCreate(BaseModel):
    """Admin creates a new user."""

    username: str
    email: EmailStr
    password: str
    role_id: int

    @field_validator("username")
    @classmethod
    def username_no_spaces(cls, v: str) -> str:
        if " " in v:
            raise ValueError("Username must not contain spaces")
        return v.lower()

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserUpdate(BaseModel):
    """Admin updates an existing user (all fields optional)."""

    username: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    role_id: int | None = None
    is_active: bool | None = None


class RoleOut(BaseModel):
    """Nested role info returned inside UserOut."""

    id: int
    name: str

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    """User representation returned to callers."""

    id: int
    username: str
    email: str
    role: RoleOut
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ImportErrorItem(BaseModel):
    row: int
    reason: str


class UserImportResponse(BaseModel):
    created: int
    skipped: int
    errors: list[ImportErrorItem]

