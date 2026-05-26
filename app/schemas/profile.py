"""
app/schemas/profile.py
───────────────────────
Pydantic v2 schemas for StudentProfile and Enrollment endpoints.
"""

import datetime

from pydantic import BaseModel

from app.schemas.user import UserOut
from app.schemas.department import DepartmentOut
from app.schemas.class_ import ClassOut


# ── Student Profile ────────────────────────────────────────────────────────────

class ProfileCreate(BaseModel):
    """Admin creates a student profile."""

    user_id: int
    department_id: int
    class_id: int
    roll_number: str
    dob: datetime.date | None = None
    blood_group: str | None = None
    phone: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    profile_photo: str | None = None


class ProfileUpdate(BaseModel):
    """Student updates their own profile (all fields optional)."""

    dob: datetime.date | None = None
    blood_group: str | None = None
    phone: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    profile_photo: str | None = None


class ProfileOut(BaseModel):
    """Full student profile returned to callers."""

    id: int
    user_id: int
    user: UserOut
    department_id: int
    department: DepartmentOut
    class_id: int
    class_: ClassOut
    roll_number: str
    dob: datetime.date | None
    blood_group: str | None
    phone: str | None
    address: str | None
    emergency_contact: str | None
    profile_photo: str | None

    model_config = {"from_attributes": True}


# ── Enrollment ─────────────────────────────────────────────────────────────────

class EnrollmentCreate(BaseModel):
    """Admin enrolls a student into a class."""

    student_id: int
    class_id: int


class EnrollmentOut(BaseModel):
    """Enrollment record returned to callers."""

    id: int
    student_id: int
    class_id: int
    student: UserOut
    class_: ClassOut

    model_config = {"from_attributes": True}
