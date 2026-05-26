"""
app/models/student_profile.py
──────────────────────────────
StudentProfile table — extended info for student users.
One-to-one with users table.
"""

import datetime

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class StudentProfile(Base):
    __tablename__ = "student_profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True
    )
    department_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=False, index=True
    )
    class_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("classes.id"), nullable=False, index=True
    )
    roll_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    dob: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    blood_group: Mapped[str | None] = mapped_column(String(10), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    emergency_contact: Mapped[str | None] = mapped_column(String(100), nullable=True)
    profile_photo: Mapped[str | None] = mapped_column(String(300), nullable=True)  # file path

    # ── Relationships ─────────────────────────────────
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="student_profile", lazy="selectin"
    )
    department: Mapped["Department"] = relationship(  # noqa: F821
        "Department", back_populates="student_profiles", lazy="selectin"
    )
    class_: Mapped["Class_"] = relationship(  # noqa: F821
        "Class_", back_populates="student_profiles", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<StudentProfile id={self.id} user_id={self.user_id} roll={self.roll_number!r}>"
