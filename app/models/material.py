"""
app/models/material.py
───────────────────────
Study material ORM model — stores information about materials uploaded by teachers
for courses, such as PDFs, videos, documents, or external resource links.
"""

import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.database import Base

# Allowed file type categories
VALID_FILE_TYPES = {"pdf", "video", "doc", "link"}


class StudyMaterial(Base):
    __tablename__ = "study_materials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Teacher who uploaded the material
    teacher_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )

    # Course this material belongs to
    course_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("courses.id"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Path to the uploaded file on disk, or URL link
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)

    # "pdf" | "video" | "doc" | "link"
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # Size of the file in bytes (can be null for links)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── ORM Validators ────────────────────────────────
    @validates("file_type")
    def validate_file_type(self, key: str, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_FILE_TYPES:
            raise ValueError(
                f"Invalid file_type '{value}'. "
                f"Must be one of: {sorted(VALID_FILE_TYPES)}"
            )
        return normalized

    @validates("title")
    def validate_title(self, key: str, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be empty")
        if len(value) < 3:
            raise ValueError("Title must be at least 3 characters")
        if len(value) > 200:
            raise ValueError("Title cannot exceed 200 characters")
        return value

    @validates("file_path")
    def validate_file_path(self, key: str, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("File path / link cannot be empty")
        return value

    # ── Relationships ──────────────────────────────────
    teacher: Mapped["User"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[teacher_id],
        lazy="selectin",
    )
    course: Mapped["Course"] = relationship(  # noqa: F821
        "Course",
        foreign_keys=[course_id],
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<StudyMaterial id={self.id} course={self.course_id} "
            f"teacher={self.teacher_id} title={self.title!r} type={self.file_type!r}>"
        )
