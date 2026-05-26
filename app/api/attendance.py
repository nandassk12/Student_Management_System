"""
app/api/attendance.py
──────────────────────
Attendance router:
  POST /attendance                          → teacher marks attendance
  GET  /attendance/student/{student_id}     → student/teacher views by student
  GET  /attendance/class/{class_id}         → teacher views full class attendance
  GET  /attendance/percentage/{student_id}  → attendance % per course
"""

from collections import defaultdict
from typing import Annotated
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import get_current_user, require_student, require_teacher
from app.database import get_db
from app.models.attendance import Attendance
from app.models.class_ import Class_
from app.models.course import Course
from app.models.user import User
from app.schemas.attendance import (
    AttendanceCreate,
    AttendanceOut,
    AttendancePercentage,
    AttendancePrediction,
)
from app.schemas.auth import TokenData

router = APIRouter(prefix="/attendance", tags=["Attendance"])


# ── Helpers ───────────────────────────────────────────────────────────────────

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


async def _get_class_or_404(class_id: int, db: AsyncSession) -> Class_:
    result = await db.execute(select(Class_).where(Class_.id == class_id))
    cls = result.scalar_one_or_none()
    if cls is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    return cls


async def _get_course_or_404(course_id: int, db: AsyncSession) -> Course:
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=AttendanceOut,
    status_code=status.HTTP_201_CREATED,
    summary="Teacher marks attendance for a student",
)
async def mark_attendance(
    payload: AttendanceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_teacher)],
) -> AttendanceOut:
    # Validate referenced entities exist
    await _get_student_or_404(payload.student_id, db)
    await _get_course_or_404(payload.course_id, db)
    await _get_class_or_404(payload.class_id, db)

    # Prevent duplicate attendance for same student + course + date
    dup = await db.execute(
        select(Attendance).where(
            Attendance.student_id == payload.student_id,
            Attendance.course_id == payload.course_id,
            Attendance.date == payload.date,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Attendance already marked for student {payload.student_id} "
                f"in course {payload.course_id} on {payload.date}"
            ),
        )

    record = Attendance(
        student_id=payload.student_id,
        course_id=payload.course_id,
        class_id=payload.class_id,
        date=payload.date,
        status=payload.status,
        marked_by=current_user.user_id,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return AttendanceOut.model_validate(record)


@router.get(
    "",
    response_model=list[AttendanceOut],
    status_code=status.HTTP_200_OK,
    summary="List all attendance records (admin and teacher only)",
)
async def list_all_attendance(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_teacher)],
    student_id: int | None = Query(None, description="Filter by student ID"),
    course_id: int | None = Query(None, description="Filter by course ID"),
    class_id: int | None = Query(None, description="Filter by class ID"),
    start_date: date | None = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="End date (YYYY-MM-DD)"),
    status_val: str | None = Query(None, alias="status", description="Filter by status (present/absent/late)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> list[AttendanceOut]:
    query = select(Attendance)
    if student_id is not None:
        query = query.where(Attendance.student_id == student_id)
    if course_id is not None:
        query = query.where(Attendance.course_id == course_id)
    if class_id is not None:
        query = query.where(Attendance.class_id == class_id)
    if start_date is not None:
        query = query.where(Attendance.date >= start_date)
    if end_date is not None:
        query = query.where(Attendance.date <= end_date)
    if status_val is not None:
        query = query.where(Attendance.status == status_val.strip().lower())

    query = query.order_by(Attendance.date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    records = result.scalars().all()
    return [AttendanceOut.model_validate(r) for r in records]


@router.get(
    "/student/{student_id}",
    response_model=list[AttendanceOut],
    status_code=status.HTTP_200_OK,
    summary="View attendance records for a student",
)
async def get_student_attendance(
    student_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_student)],
    course_id: int | None = Query(None, description="Filter by course ID"),
    start_date: date | None = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="End date (YYYY-MM-DD)"),
    status_val: str | None = Query(None, alias="status", description="Filter by status (present/absent/late)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> list[AttendanceOut]:
    # Students can only view their own attendance
    if current_user.role_name == "student" and current_user.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only view their own attendance",
        )

    await _get_student_or_404(student_id, db)

    query = select(Attendance).where(Attendance.student_id == student_id)
    if course_id is not None:
        query = query.where(Attendance.course_id == course_id)
    if start_date is not None:
        query = query.where(Attendance.date >= start_date)
    if end_date is not None:
        query = query.where(Attendance.date <= end_date)
    if status_val is not None:
        query = query.where(Attendance.status == status_val.strip().lower())

    query = query.order_by(Attendance.date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    records = result.scalars().all()
    return [AttendanceOut.model_validate(r) for r in records]


@router.get(
    "/class/{class_id}",
    response_model=list[AttendanceOut],
    status_code=status.HTTP_200_OK,
    summary="Teacher views full attendance for a class",
)
async def get_class_attendance(
    class_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_teacher)],
    course_id: int | None = Query(None, description="Filter by course ID"),
    start_date: date | None = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="End date (YYYY-MM-DD)"),
    status_val: str | None = Query(None, alias="status", description="Filter by status (present/absent/late)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> list[AttendanceOut]:
    await _get_class_or_404(class_id, db)

    query = select(Attendance).where(Attendance.class_id == class_id)
    if course_id is not None:
        query = query.where(Attendance.course_id == course_id)
    if start_date is not None:
        query = query.where(Attendance.date >= start_date)
    if end_date is not None:
        query = query.where(Attendance.date <= end_date)
    if status_val is not None:
        query = query.where(Attendance.status == status_val.strip().lower())

    query = query.order_by(Attendance.date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    records = result.scalars().all()
    return [AttendanceOut.model_validate(r) for r in records]



@router.get(
    "/percentage/{student_id}",
    response_model=list[AttendancePercentage],
    status_code=status.HTTP_200_OK,
    summary="Attendance percentage per course for a student",
)
async def get_attendance_percentage(
    student_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_student)],
) -> list[AttendancePercentage]:
    # Students can only view their own percentage
    if current_user.role_name == "student" and current_user.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only view their own attendance percentage",
        )

    student = await _get_student_or_404(student_id, db)

    # Fetch all attendance records for this student (no pagination — aggregate all)
    result = await db.execute(
        select(Attendance).where(Attendance.student_id == student_id)
    )
    records = result.scalars().all()

    if not records:
        return []

    # Group by course
    # course_id → {"course": Course, "present": int, "absent": int, "late": int}
    course_stats: dict[int, dict] = defaultdict(
        lambda: {"present": 0, "absent": 0, "late": 0, "course": None}
    )

    for rec in records:
        cid = rec.course_id
        course_stats[cid]["course"] = rec.course          # loaded via selectin
        course_stats[cid][rec.status] += 1                # "present"|"absent"|"late"

    summaries: list[AttendancePercentage] = []
    for cid, stats in course_stats.items():
        present = stats["present"]
        late = stats["late"]
        absent = stats["absent"]
        total = present + late + absent
        percentage = round((present + late) / total * 100, 2) if total > 0 else 0.0
        course_obj = stats["course"]
        summaries.append(
            AttendancePercentage(
                course_id=cid,
                course_name=course_obj.name,
                course_code=course_obj.code,
                total_classes=total,
                present_count=present,
                late_count=late,
                absent_count=absent,
                attendance_percentage=percentage,
            )
        )

    # Sort by course_id for deterministic output
    summaries.sort(key=lambda s: s.course_id)
    return summaries


@router.get(
    "/predictor/{student_id}",
    response_model=list[AttendancePrediction],
    status_code=status.HTTP_200_OK,
    summary="Predict remaining classes needed to reach 75% attendance per course",
)
async def predict_attendance(
    student_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_student)],
) -> list[AttendancePrediction]:
    # Guard: Students can only view their own attendance predictor
    if current_user.role_name == "student" and current_user.user_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only view their own attendance predictions",
        )

    student = await _get_student_or_404(student_id, db)

    # Fetch all attendance records for this student
    result = await db.execute(
        select(Attendance).where(Attendance.student_id == student_id)
    )
    records = result.scalars().all()

    if not records:
        return []

    # Group by course
    course_stats: dict[int, dict] = defaultdict(
        lambda: {"attended": 0, "total": 0, "course": None}
    )

    for rec in records:
        cid = rec.course_id
        course_stats[cid]["course"] = rec.course
        course_stats[cid]["total"] += 1
        if rec.status in ("present", "late"):
            course_stats[cid]["attended"] += 1

    predictions: list[AttendancePrediction] = []
    for cid, stats in course_stats.items():
        total = stats["total"]
        attended = stats["attended"]
        course_obj = stats["course"]

        current_percentage = round((attended / total * 100), 2) if total > 0 else 0.0

        # Math logic:
        # (attended + X) / (total + X) >= 0.75
        # attended + X >= 0.75 * total + 0.75 * X
        # 0.25 * X >= 0.75 * total - attended
        # X >= 3 * total - 4 * attended
        needed_for_75 = max(0, 3 * total - 4 * attended)

        if current_percentage >= 75.0:
            status_str = "Safe"
        elif current_percentage >= 60.0:
            status_str = "At Risk"
        else:
            status_str = "Detained"

        predictions.append(
            AttendancePrediction(
                course=course_obj.name,
                current_percentage=current_percentage,
                classes_attended=attended,
                total_classes=total,
                needed_for_75=needed_for_75,
                status=status_str,
            )
        )

    # Sort by course name for predictable output order
    predictions.sort(key=lambda p: p.course)
    return predictions

