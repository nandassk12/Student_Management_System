"""
app/schemas/department.py
──────────────────────────
Pydantic v2 schemas for Department CRUD endpoints.
"""

from pydantic import BaseModel, field_validator


class DepartmentCreate(BaseModel):
    """Admin creates a new department."""

    name: str
    code: str

    @field_validator("code")
    @classmethod
    def code_upper(cls, v: str) -> str:
        return v.strip().upper()


class DepartmentUpdate(BaseModel):
    """Admin updates an existing department (all fields optional)."""

    name: str | None = None
    code: str | None = None

    @field_validator("code")
    @classmethod
    def code_upper(cls, v: str | None) -> str | None:
        if v is not None:
            return v.strip().upper()
        return v


class DepartmentOut(BaseModel):
    """Department representation returned to callers."""

    id: int
    name: str
    code: str

    model_config = {"from_attributes": True}
