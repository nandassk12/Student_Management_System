"""
app/models/attendance.py
─────────────────────────
Attendance table — records daily attendance per student per course.
Each record is scoped to a student, course, class, and specific date.
"""

import datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.database import Base

# Valid attendance status values
VALID_STATUSES = {"present", "absent", "late"}


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    course_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("courses.id"), nullable=False, index=True
    )
    class_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("classes.id"), nullable=False, index=True
    )
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False, index=True)

    # "present" | "absent" | "late"
    status: Mapped[str] = mapped_column(String(10), nullable=False)

    marked_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── ORM Validators ────────────────────────────────
    @validates("status")
    def validate_status(self, key: str, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_STATUSES:
            raise ValueError(
                f"Invalid status '{value}'. Must be one of: {VALID_STATUSES}"
            )
        return normalized

    # ── Relationships ──────────────────────────────────
    student: Mapped["User"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[student_id],
        lazy="selectin",
    )
    course: Mapped["Course"] = relationship(  # noqa: F821
        "Course",
        lazy="selectin",
    )
    class_: Mapped["Class_"] = relationship(  # noqa: F821
        "Class_",
        lazy="selectin",
    )
    marker: Mapped["User"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[marked_by],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Attendance id={self.id} student={self.student_id} "
            f"course={self.course_id} date={self.date} status={self.status!r}>"
        )
