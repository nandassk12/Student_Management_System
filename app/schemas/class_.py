"""
app/schemas/class_.py
──────────────────────
Pydantic v2 schemas for Class CRUD endpoints.
"""

from pydantic import BaseModel, field_validator

from app.schemas.department import DepartmentOut


class ClassCreate(BaseModel):
    """Admin creates a new class/batch."""

    name: str
    department_id: int
    year: int
    semester: int

    @field_validator("year")
    @classmethod
    def year_reasonable(cls, v: int) -> int:
        if v < 2000 or v > 2100:
            raise ValueError("Year must be between 2000 and 2100")
        return v

    @field_validator("semester")
    @classmethod
    def semester_range(cls, v: int) -> int:
        if v < 1 or v > 8:
            raise ValueError("Semester must be between 1 and 8")
        return v


class ClassUpdate(BaseModel):
    """Admin updates an existing class (all fields optional)."""

    name: str | None = None
    department_id: int | None = None
    year: int | None = None
    semester: int | None = None


class ClassOut(BaseModel):
    """Class representation returned to callers."""

    id: int
    name: str
    department_id: int
    department: DepartmentOut
    year: int
    semester: int

    model_config = {"from_attributes": True}
