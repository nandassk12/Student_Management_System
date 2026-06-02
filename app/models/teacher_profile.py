"""
app/models/teacher_profile.py
──────────────────────────────
TeacherProfile and TeacherDocument tables.
"""

import datetime
from sqlalchemy import Date, ForeignKey, Integer, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TeacherProfile(Base):
    __tablename__ = "teacher_profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True
    )
    department_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=True, index=True
    )
    full_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    date_of_birth: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    employee_id: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True, index=True)
    designation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    employment_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    highest_qualification: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    alternate_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    profile_photo: Mapped[str | None] = mapped_column(String(300), nullable=True)
    signature: Mapped[str | None] = mapped_column(String(300), nullable=True)
    personal_email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    current_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    permanent_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    emergency_contact_rel: Mapped[str | None] = mapped_column(String(50), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    account_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ifsc_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    profile_completed_pct: Mapped[int | None] = mapped_column(Integer, default=0, server_default="0", nullable=True)
    last_edited_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", lazy="selectin"
    )
    department: Mapped["Department"] = relationship(  # noqa: F821
        "Department", lazy="selectin"
    )
    documents: Mapped[list["TeacherDocument"]] = relationship(
        "TeacherDocument", back_populates="teacher", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<TeacherProfile id={self.id} user_id={self.user_id} full_name={self.full_name!r}>"


class TeacherDocument(Base):
    __tablename__ = "teacher_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    teacher_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teacher_profile.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doc_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=False
    )

    # Relationship
    teacher: Mapped["TeacherProfile"] = relationship("TeacherProfile", back_populates="documents")

    def __repr__(self) -> str:
        return f"<TeacherDocument id={self.id} teacher_id={self.teacher_id} doc_type={self.doc_type!r}>"
