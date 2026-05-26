"""
app/models/__init__.py
──────────────────────
Re-exports all ORM models so that a single import of `app.models`
makes every table visible to Alembic and the seeder.
Sprint 1: roles, users, departments, courses, classes, student_profile, enrollment
Sprint 2: attendance, grades, timetable
"""

from app.models.role import Role
from app.models.user import User
from app.models.department import Department
from app.models.course import Course
from app.models.class_ import Class_
from app.models.student_profile import StudentProfile
from app.models.enrollment import Enrollment

# ── Sprint 2 ──────────────────────────────────────
from app.models.attendance import Attendance
from app.models.grade import Grade
from app.models.timetable import Timetable

# ── Sprint 3 ──────────────────────────────────────
from app.models.fee import Fee
from app.models.leave import LeaveRequest
from app.models.notice import Notice

# ── Sprint 4 ──────────────────────────────────────
from app.models.material import StudyMaterial

__all__ = [
    # Sprint 1
    "Role",
    "User",
    "Department",
    "Course",
    "Class_",
    "StudentProfile",
    "Enrollment",
    # Sprint 2
    "Attendance",
    "Grade",
    "Timetable",
    # Sprint 3
    "Fee",
    "LeaveRequest",
    "Notice",
    # Sprint 4
    "StudyMaterial",
]
