"""
app/models/course.py
────────────────────
Courses table — belongs to a department, has credits and semester.
"""

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    department_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=False, index=True
    )
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Relationships ─────────────────────────────────
    department: Mapped["Department"] = relationship(  # noqa: F821
        "Department", back_populates="courses", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Course id={self.id} code={self.code!r} dept={self.department_id}>"
