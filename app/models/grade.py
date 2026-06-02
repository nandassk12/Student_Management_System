"""
app/models/grade.py
────────────────────
Grades table — records marks and letter grade per student per course.
Scoped to a semester and academic year for historical tracking.
"""

import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.database import Base

# Valid letter grades and their GPA equivalents (4.0 scale)
GRADE_GPA_MAP: dict[str, float] = {
    "O": 4.0,
    "A+": 4.0,
    "A": 4.0,
    "B+": 3.0,
    "B": 3.0,
    "C": 2.0,
    "D": 1.0,
    "F": 0.0,
}


class Grade(Base):
    __tablename__ = "grades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    course_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("courses.id"), nullable=False, index=True
    )

    marks: Mapped[float] = mapped_column(Float, nullable=False)

    # "A" | "B" | "C" | "D" | "F"
    grade: Mapped[str] = mapped_column(String(2), nullable=False)

    semester: Mapped[int] = mapped_column(Integer, nullable=False)

    # e.g. "2023-2024"
    academic_year: Mapped[str] = mapped_column(String(20), nullable=False)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── ORM Validators ────────────────────────────────
    @validates("grade")
    def validate_grade(self, key: str, value: str) -> str:
        normalized = value.strip().upper()
        if normalized not in GRADE_GPA_MAP:
            raise ValueError(
                f"Invalid grade '{value}'. Must be one of: {list(GRADE_GPA_MAP.keys())}"
            )
        return normalized

    @validates("marks")
    def validate_marks(self, key: str, value: float) -> float:
        if not (0.0 <= value <= 100.0):
            raise ValueError("Marks must be between 0.0 and 100.0")
        return value

    @validates("semester")
    def validate_semester(self, key: str, value: int) -> int:
        if not (1 <= value <= 8):
            raise ValueError("Semester must be between 1 and 8")
        return value

    # ── Convenience property ──────────────────────────
    @property
    def gpa_points(self) -> float:
        """Returns the GPA point value for this grade (4.0 scale)."""
        return GRADE_GPA_MAP.get(self.grade, 0.0)

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

    def __repr__(self) -> str:
        return (
            f"<Grade id={self.id} student={self.student_id} "
            f"course={self.course_id} grade={self.grade!r} marks={self.marks}>"
        )
