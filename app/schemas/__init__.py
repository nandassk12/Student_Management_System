"""
app/schemas/__init__.py
────────────────────────
Re-exports all Pydantic schemas for convenient top-level imports.
"""

from app.schemas.auth import LoginRequest, Token, TokenData
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentOut
from app.schemas.course import CourseCreate, CourseUpdate, CourseOut
from app.schemas.class_ import ClassCreate, ClassUpdate, ClassOut
from app.schemas.profile import ProfileCreate, ProfileUpdate, ProfileOut, EnrollmentCreate, EnrollmentOut

__all__ = [
    "LoginRequest",
    "Token",
    "TokenData",
    "UserCreate",
    "UserUpdate",
    "UserOut",
    "DepartmentCreate",
    "DepartmentUpdate",
    "DepartmentOut",
    "CourseCreate",
    "CourseUpdate",
    "CourseOut",
    "ClassCreate",
    "ClassUpdate",
    "ClassOut",
    "ProfileCreate",
    "ProfileUpdate",
    "ProfileOut",
    "EnrollmentCreate",
    "EnrollmentOut",
]
