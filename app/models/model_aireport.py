from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class AiReport(Base):
    __tablename__ = "ai_reports"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    semester = Column(Integer, nullable=False)
    academic_year = Column(String(20), nullable=False)
    narrative = Column(Text, nullable=False)
    edited_narrative = Column(Text, nullable=True)
    risk_flags = Column(JSONB, default=list)
    status = Column(String(20), nullable=False, default="draft")
    current_cgpa = Column(Numeric(4, 2), nullable=True)
    overall_attendance = Column(Numeric(5, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("status IN ('draft', 'approved')", name="ai_reports_status_check"),
    )

    student = relationship("User", foreign_keys=[student_id])
    teacher = relationship("User", foreign_keys=[teacher_id])

    @property
    def student_name(self) -> str:
        return self.student.username if self.student else ""

    @property
    def roll_number(self) -> str | None:
        if self.student and self.student.student_profile:
            return self.student.student_profile.roll_number
        return None

    @property
    def department(self) -> str | None:
        if self.student and self.student.student_profile and self.student.student_profile.department:
            return self.student.student_profile.department.name
        return None

