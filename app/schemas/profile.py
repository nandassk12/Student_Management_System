"""
app/schemas/profile.py
───────────────────────
Pydantic v2 schemas for StudentProfile and Enrollment endpoints.
"""

import datetime

from pydantic import BaseModel, ConfigDict, model_validator

from app.schemas.user import UserOut
from app.schemas.department import DepartmentOut
from app.schemas.class_ import ClassOut
from typing import Any


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
    roll_number: str | None = None

    model_config = {"from_attributes": True}


class ClassStudentOut(BaseModel):
    """Slim student record for class roster dropdowns."""

    id: int
    username: str
    full_name: str | None = None
    roll_number: str | None = None

    model_config = {"from_attributes": True}


# ── Extended Student/Teacher Profiles & Documents ─────────────────────────────

class StudentProfileUpdate(BaseModel):
    dob: datetime.date | None = None
    blood_group: str | None = None
    phone: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    profile_photo: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    gender: str | None = None
    nationality: str | None = None
    state: str | None = None
    year_of_study: int | None = None
    batch_year: int | None = None
    hostel_status: str | None = None
    personal_email: str | None = None
    current_address: str | None = None
    permanent_address: str | None = None
    parent_name: str | None = None
    parent_relationship: str | None = None
    parent_phone: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_rel: str | None = None
    emergency_contact_phone: str | None = None
    signature: str | None = None


class StudentProfileOut(BaseModel):
    id: int
    user_id: int
    user: UserOut
    department_id: int
    department: DepartmentOut
    class_id: int
    class_: ClassOut
    roll_number: str
    dob: datetime.date | None = None
    blood_group: str | None = None
    phone: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    profile_photo: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    gender: str | None = None
    nationality: str | None = None
    state: str | None = None
    year_of_study: int | None = None
    batch_year: int | None = None
    admission_date: datetime.date | None = None
    hostel_status: str | None = None
    personal_email: str | None = None
    current_address: str | None = None
    permanent_address: str | None = None
    parent_name: str | None = None
    parent_relationship: str | None = None
    parent_phone: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_rel: str | None = None
    emergency_contact_phone: str | None = None
    signature: str | None = None
    profile_completed_pct: int | None = 0
    last_edited_at: datetime.datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class StudentDocumentOut(BaseModel):
    id: int
    doc_type: str
    file_name: str
    uploaded_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class TeacherProfileUpdate(BaseModel):
    full_name: str | None = None
    gender: str | None = None
    date_of_birth: datetime.date | None = None
    highest_qualification: str | None = None
    phone: str | None = None
    alternate_phone: str | None = None
    profile_photo: str | None = None
    signature: str | None = None
    personal_email: str | None = None
    current_address: str | None = None
    permanent_address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_rel: str | None = None
    emergency_contact_phone: str | None = None
    bank_name: str | None = None
    account_number: str | None = None
    ifsc_code: str | None = None


class TeacherProfileOut(BaseModel):
    id: int
    user_id: int
    user: UserOut
    department_id: int | None = None
    department: DepartmentOut | None = None
    full_name: str | None = None
    gender: str | None = None
    date_of_birth: datetime.date | None = None
    employee_id: str | None = None
    designation: str | None = None
    employment_type: str | None = None
    highest_qualification: str | None = None
    phone: str | None = None
    alternate_phone: str | None = None
    profile_photo: str | None = None
    signature: str | None = None
    personal_email: str | None = None
    current_address: str | None = None
    permanent_address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_rel: str | None = None
    emergency_contact_phone: str | None = None
    bank_name: str | None = None
    account_number: str | None = None
    ifsc_code: str | None = None
    profile_completed_pct: int | None = 0
    last_edited_at: datetime.datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TeacherDocumentOut(BaseModel):
    id: int
    doc_type: str
    file_name: str
    uploaded_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

