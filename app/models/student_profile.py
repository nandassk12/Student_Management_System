"""
app/models/student_profile.py
──────────────────────────────
StudentProfile table — extended info for student users.
One-to-one with users table.
"""

import datetime

from sqlalchemy import Date, ForeignKey, Integer, String, Text, DateTime
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

    # New Columns
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(50), nullable=True)
    state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    year_of_study: Mapped[int | None] = mapped_column(Integer, nullable=True)
    batch_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    admission_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    hostel_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    personal_email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    current_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    permanent_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    parent_relationship: Mapped[str | None] = mapped_column(String(50), nullable=True)
    parent_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    emergency_contact_rel: Mapped[str | None] = mapped_column(String(50), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    signature: Mapped[str | None] = mapped_column(String(300), nullable=True)
    profile_completed_pct: Mapped[int | None] = mapped_column(Integer, default=0, server_default="0", nullable=True)
    last_edited_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

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
    documents: Mapped[list["StudentDocument"]] = relationship(
        "StudentDocument", back_populates="student", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<StudentProfile id={self.id} user_id={self.user_id} roll={self.roll_number!r}>"


class StudentDocument(Base):
    __tablename__ = "student_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("student_profile.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doc_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=False
    )

    # Relationship
    student: Mapped["StudentProfile"] = relationship("StudentProfile", back_populates="documents")

    def __repr__(self) -> str:
        return f"<StudentDocument id={self.id} student_id={self.student_id} doc_type={self.doc_type!r}>"

