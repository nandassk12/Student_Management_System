"""
app/schemas/grade.py
─────────────────────
Pydantic v2 schemas for Grades endpoints.
"""

import datetime
from typing import Literal

from pydantic import BaseModel, field_validator,Field

from app.schemas.user import UserOut
from app.schemas.course import CourseOut

# Enforce valid letter grades at schema level
LetterGrade = Literal["O", "A+", "A", "B+", "B", "C", "D", "F"]

# GPA scale used for calculation responses
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


class GradeCreate(BaseModel):
    """Teacher inputs a grade for a student."""

    student_id: int
    course_id: int
    marks: float
    grade: LetterGrade
    semester: int
    academic_year: str  # e.g. "2023-2024"

    @field_validator("marks")
    @classmethod
    def marks_range(cls, v: float) -> float:
        if not (0.0 <= v <= 100.0):
            raise ValueError("Marks must be between 0.0 and 100.0")
        return round(v, 2)

    @field_validator("semester")
    @classmethod
    def semester_range(cls, v: int) -> int:
        if not (1 <= v <= 8):
            raise ValueError("Semester must be between 1 and 8")
        return v

    @field_validator("academic_year")
    @classmethod
    def academic_year_format(cls, v: str) -> str:
        """Validates format 'YYYY-YYYY' and that end year = start year + 1."""
        parts = v.strip().split("-")
        if len(parts) != 2 or not all(p.isdigit() and len(p) == 4 for p in parts):
            raise ValueError("academic_year must be in 'YYYY-YYYY' format (e.g. '2023-2024')")
        start, end = int(parts[0]), int(parts[1])
        if end != start + 1:
            raise ValueError("End year must be exactly one year after start year")
        return v.strip()


class GradeUpdate(BaseModel):
    """Teacher updates an existing grade (all fields optional)."""

    marks: float | None = None
    grade: LetterGrade | None = None
    semester: int | None = None
    academic_year: str | None = None

    @field_validator("marks")
    @classmethod
    def marks_range(cls, v: float | None) -> float | None:
        if v is not None and not (0.0 <= v <= 100.0):
            raise ValueError("Marks must be between 0.0 and 100.0")
        return round(v, 2) if v is not None else v


class GradeOut(BaseModel):
    """Full grade record returned to callers."""

    id: int
    student_id: int
    course_id: int
    marks: float
    grade: LetterGrade
    gpa_points: float        # computed property from the ORM model
    semester: int
    academic_year: str
    created_at: datetime.datetime

    student: UserOut
    course: CourseOut

    model_config = {"from_attributes": True}


class GPAResponse(BaseModel):
    """GPA summary for a student (4.0 scale)."""

    student_id: int
    student_username: str
    total_courses: int
    gpa: float               # weighted average on 4.0 scale
    grade_breakdown: dict[str, int]   # {"A": 3, "B": 2, "C": 1, ...}


class GradeWhatIfRequest(BaseModel):
    """Simulated marks for GPA simulation."""

    course_id: int
    expected_marks: float = Field(..., ge=0.0, le=100.0, description="Marks must be between 0.0 and 100.0")

    @field_validator("expected_marks")
    @classmethod
    def marks_precision(cls, v: float) -> float:
        return round(v, 2)


class GradeWhatIfResponse(BaseModel):
    """Result of GPA simulation comparison."""

    current_gpa: float
    predicted_gpa: float
    difference: float        # e.g. +0.3 or -0.1
    impact: Literal["positive", "negative", "neutral"]


class CourseResult(BaseModel):
    course: str
    marks: float
    grade: str
    result: Literal["distinction", "pass", "fail"]


class ResultCalculationOut(BaseModel):
    courses: list[CourseResult]
    overall_result: Literal["PASS", "FAIL", "DISTINCTION"]
    semester_gpa: float


class SgpaCourseOut(BaseModel):
    course_id: int
    course_name: str
    credits: int
    marks: float
    grade: str
    points: int


class SgpaResponse(BaseModel):
    semester: int
    sgpa: float
    total_credits: int
    courses: list[SgpaCourseOut]


class SemesterCgpaDetail(BaseModel):
    semester: int
    sgpa: float
    credits: int


class CgpaResponse(BaseModel):
    cgpa: float
    total_credits: int
    semesters: list[SemesterCgpaDetail]


class CgpaPredictionItem(BaseModel):
    course_id: int
    expected_marks: float


class SemesterBreakdownItem(BaseModel):
    semester: int
    sgpa: float
    credits: int


class CgpaPredictionResponse(BaseModel):
    current_cgpa: float
    predicted_cgpa: float
    difference: float
    impact: Literal["positive", "negative", "neutral"]
    breakdown: list[SemesterBreakdownItem]



