"""
app/api/grades.py
──────────────────
Grades router:
  POST /grades                      → teacher inputs grade
  PUT  /grades/{id}                 → teacher updates grade
  GET  /grades/me                   → student views own grades
  GET  /grades/class/{class_id}     → teacher views all grades for a class
  GET  /grades/gpa/{student_id}     → GPA calculation (4.0 scale)
"""

from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import get_current_user, require_student, require_teacher
from app.database import get_db
from app.models.class_ import Class_
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.grade import Grade
from app.models.user import User
from app.schemas.auth import TokenData
from app.schemas.grade import (
    GRADE_GPA_MAP,
    GradeCreate,
    GradeOut,
    GradeUpdate,
    GPAResponse,
    GradeWhatIfRequest,
    GradeWhatIfResponse,
)

router = APIRouter(prefix="/grades", tags=["Grades"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_grade_or_404(grade_id: int, db: AsyncSession) -> Grade:
    result = await db.execute(select(Grade).where(Grade.id == grade_id))
    grade = result.scalar_one_or_none()
    if grade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grade not found")
    return grade


async def _get_student_or_404(student_id: int, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == student_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    if user.role.name != "student":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Specified user is not a student",
        )
    return user


async def _get_course_or_404(course_id: int, db: AsyncSession) -> Course:
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=GradeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Teacher inputs a grade for a student",
)
async def create_grade(
    payload: GradeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_teacher)],
) -> GradeOut:
    # Validate student and course exist
    await _get_student_or_404(payload.student_id, db)
    await _get_course_or_404(payload.course_id, db)

    # Prevent duplicate grade for same student + course + semester + academic_year
    dup = await db.execute(
        select(Grade).where(
            Grade.student_id == payload.student_id,
            Grade.course_id == payload.course_id,
            Grade.semester == payload.semester,
            Grade.academic_year == payload.academic_year,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Grade already exists for student {payload.student_id} "
                f"in course {payload.course_id} "
                f"for semester {payload.semester} ({payload.academic_year})"
            ),
        )

    grade = Grade(
        student_id=payload.student_id,
        course_id=payload.course_id,
        marks=payload.marks,
        grade=payload.grade,
        semester=payload.semester,
        academic_year=payload.academic_year,
    )
    db.add(grade)
    await db.flush()
    await db.refresh(grade)
    return GradeOut.model_validate(grade)


@router.put(
    "/{grade_id}",
    response_model=GradeOut,
    status_code=status.HTTP_200_OK,
    summary="Teacher updates an existing grade",
)
async def update_grade(
    grade_id: int,
    payload: GradeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_teacher)],
) -> GradeOut:
    grade = await _get_grade_or_404(grade_id, db)

    if payload.marks is not None:
        grade.marks = payload.marks
    if payload.grade is not None:
        grade.grade = payload.grade
    if payload.semester is not None:
        grade.semester = payload.semester
    if payload.academic_year is not None:
        grade.academic_year = payload.academic_year

    await db.flush()
    await db.refresh(grade)
    return GradeOut.model_validate(grade)


@router.get(
    "",
    response_model=list[GradeOut],
    status_code=status.HTTP_200_OK,
    summary="List all grades (admin and teacher only)",
)
async def list_all_grades(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_teacher)],
    student_id: int | None = Query(None, description="Filter by student ID"),
    course_id: int | None = Query(None, description="Filter by course ID"),
    semester: int | None = Query(None, description="Filter by semester"),
    academic_year: str | None = Query(None, description="Filter by academic year"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> list[GradeOut]:
    query = select(Grade)
    if student_id is not None:
        query = query.where(Grade.student_id == student_id)
    if course_id is not None:
        query = query.where(Grade.course_id == course_id)
    if semester is not None:
        query = query.where(Grade.semester == semester)
    if academic_year is not None:
        query = query.where(Grade.academic_year == academic_year)

    query = query.order_by(Grade.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    grades = result.scalars().all()
    return [GradeOut.model_validate(g) for g in grades]


@router.get(
    "/me",
    response_model=list[GradeOut],
    status_code=status.HTTP_200_OK,
    summary="Student views their own grades",
)
async def get_my_grades(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    semester: int | None = Query(None, description="Filter by semester"),
    course_id: int | None = Query(None, description="Filter by course ID"),
    academic_year: str | None = Query(None, description="Filter by academic year e.g. 2023-2024"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> list[GradeOut]:
    query = select(Grade).where(Grade.student_id == current_user.user_id)
    if semester is not None:
        query = query.where(Grade.semester == semester)
    if course_id is not None:
        query = query.where(Grade.course_id == course_id)
    if academic_year is not None:
        query = query.where(Grade.academic_year == academic_year)
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    grades = result.scalars().all()
    return [GradeOut.model_validate(g) for g in grades]



@router.get(
    "/class/{class_id}",
    response_model=list[GradeOut],
    status_code=status.HTTP_200_OK,
    summary="Teacher views all grades for students enrolled in a class",
)
async def get_class_grades(
    class_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_teacher)],
    course_id: int | None = Query(None, description="Filter by course ID"),
    semester: int | None = Query(None, description="Filter by semester"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> list[GradeOut]:
    # Validate class exists
    cls_result = await db.execute(select(Class_).where(Class_.id == class_id))
    if cls_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    # Get student IDs enrolled in this class
    enrollment_result = await db.execute(
        select(Enrollment.student_id).where(Enrollment.class_id == class_id)
    )
    student_ids = [row[0] for row in enrollment_result.all()]

    if not student_ids:
        return []

    query = select(Grade).where(Grade.student_id.in_(student_ids))
    if course_id is not None:
        query = query.where(Grade.course_id == course_id)
    if semester is not None:
        query = query.where(Grade.semester == semester)
    query = query.order_by(Grade.student_id, Grade.course_id).offset(skip).limit(limit)

    result = await db.execute(query)
    grades = result.scalars().all()
    return [GradeOut.model_validate(g) for g in grades]


@router.get(
    "/gpa/{student_id}",
    response_model=GPAResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate GPA (4.0 scale) for a student",
)
async def get_gpa(
    student_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_student)],
    academic_year: str | None = Query(None, description="Filter by academic year"),
) -> GPAResponse:
    # Students can only view their own GPA
    if current_user.role_name == "student" and current_user.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only view their own GPA",
        )

    student = await _get_student_or_404(student_id, db)

    query = select(Grade).where(Grade.student_id == student_id)
    if academic_year is not None:
        query = query.where(Grade.academic_year == academic_year)

    result = await db.execute(query)
    grades = result.scalars().all()

    if not grades:
        return GPAResponse(
            student_id=student_id,
            student_username=student.username,
            total_courses=0,
            gpa=0.0,
            grade_breakdown={g: 0 for g in GRADE_GPA_MAP},
        )

    # Count grade distribution
    breakdown: dict[str, int] = defaultdict(int)
    total_points = 0.0

    for g in grades:
        letter = g.grade
        breakdown[letter] += 1
        total_points += GRADE_GPA_MAP.get(letter, 0.0)

    gpa = round(total_points / len(grades), 2)

    # Ensure all grades appear in breakdown (even if count is 0)
    full_breakdown = {letter: breakdown.get(letter, 0) for letter in GRADE_GPA_MAP}

    return GPAResponse(
        student_id=student_id,
        student_username=student.username,
        total_courses=len(grades),
        gpa=gpa,
        grade_breakdown=full_breakdown,
    )


def _marks_to_gpa_points(marks: float) -> float:
    """Converts marks out of 100 to standard 4.0 scale GPA points."""
    if marks >= 90.0:
        return 4.0
    elif marks >= 80.0:
        return 3.0
    elif marks >= 70.0:
        return 2.0
    elif marks >= 60.0:
        return 1.0
    else:
        return 0.0


@router.post(
    "/whatif/{student_id}",
    response_model=GradeWhatIfResponse,
    status_code=status.HTTP_200_OK,
    summary="GPA What-If Simulator (recalculate GPA with hypothetical grade)",
)
async def gpa_what_if(
    student_id: int,
    payload: GradeWhatIfRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_student)],
) -> GradeWhatIfResponse:
    # Guard: Students can only run simulator for themselves
    if current_user.role_name == "student" and current_user.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only simulate GPA for themselves",
        )

    await _get_student_or_404(student_id, db)
    await _get_course_or_404(payload.course_id, db)

    # 1. Fetch current grades
    result = await db.execute(select(Grade).where(Grade.student_id == student_id))
    grades = result.scalars().all()

    # 2. Calculate current GPA
    if not grades:
        current_gpa = 0.0
    else:
        current_gpa = round(sum(GRADE_GPA_MAP.get(g.grade, 0.0) for g in grades) / len(grades), 2)

    # 3. Simulate replacement/addition
    simulated_points: list[float] = []
    replaced = False
    expected_points = _marks_to_gpa_points(payload.expected_marks)

    for g in grades:
        if g.course_id == payload.course_id:
            # Replace existing course grade points
            simulated_points.append(expected_points)
            replaced = True
        else:
            simulated_points.append(GRADE_GPA_MAP.get(g.grade, 0.0))

    if not replaced:
        # Add new course grade points
        simulated_points.append(expected_points)

    # 4. Calculate predicted GPA
    predicted_gpa = round(sum(simulated_points) / len(simulated_points), 2) if simulated_points else 0.0
    difference = round(predicted_gpa - current_gpa, 2)

    if difference > 0.0:
        impact = "positive"
    elif difference < 0.0:
        impact = "negative"
    else:
        impact = "neutral"

    return GradeWhatIfResponse(
        current_gpa=current_gpa,
        predicted_gpa=predicted_gpa,
        difference=difference,
        impact=impact,
    )

