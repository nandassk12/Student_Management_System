"""
app/schemas/course.py
──────────────────────
Pydantic v2 schemas for Course CRUD endpoints.
"""

from pydantic import BaseModel, field_validator

from app.schemas.department import DepartmentOut


class CourseCreate(BaseModel):
    """Admin creates a new course."""

    name: str
    code: str
    department_id: int
    credits: int
    semester: int

    @field_validator("code")
    @classmethod
    def code_upper(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("credits")
    @classmethod
    def credits_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Credits must be positive")
        return v

    @field_validator("semester")
    @classmethod
    def semester_range(cls, v: int) -> int:
        if v < 1 or v > 8:
            raise ValueError("Semester must be between 1 and 8")
        return v


class CourseUpdate(BaseModel):
    """Admin updates an existing course (all fields optional)."""

    name: str | None = None
    code: str | None = None
    department_id: int | None = None
    credits: int | None = None
    semester: int | None = None


class CourseOut(BaseModel):
    """Course representation returned to callers."""

    id: int
    name: str
    code: str
    department_id: int
    department: DepartmentOut
    credits: int
    semester: int

    model_config = {"from_attributes": True}
