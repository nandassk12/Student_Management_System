"""
app/api/timetable.py
─────────────────────
Timetable router:
  POST   /timetable                   → admin creates slot
  GET    /timetable/class/{class_id}  → all roles view class schedule
  GET    /timetable/me                → student views own timetable
  GET    /timetable/teacher/me        → teacher views own assigned slots
  DELETE /timetable/{id}              → admin only
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import get_current_user, require_admin, require_teacher
from app.database import get_db
from app.models.class_ import Class_
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.student_profile import StudentProfile
from app.models.timetable import Timetable
from app.models.user import User
from app.schemas.auth import TokenData
from app.schemas.timetable import TimetableCreate, TimetableOut
from fastapi_cache.decorator import cache

router = APIRouter(prefix="/timetable", tags=["Timetable"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_slot_or_404(slot_id: int, db: AsyncSession) -> Timetable:
    result = await db.execute(select(Timetable).where(Timetable.id == slot_id))
    slot = result.scalar_one_or_none()
    if slot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timetable slot not found")
    return slot


async def _get_class_or_404(class_id: int, db: AsyncSession) -> Class_:
    result = await db.execute(select(Class_).where(Class_.id == class_id))
    cls = result.scalar_one_or_none()
    if cls is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    return cls


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=TimetableOut,
    status_code=status.HTTP_201_CREATED,
    summary="Admin creates a timetable slot",
)
async def create_timetable_slot(
    payload: TimetableCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> TimetableOut:
    # Validate class exists
    await _get_class_or_404(payload.class_id, db)

    # Validate course exists
    course_result = await db.execute(select(Course).where(Course.id == payload.course_id))
    if course_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Course not found")

    # Validate teacher exists and has teacher/admin role
    teacher_result = await db.execute(select(User).where(User.id == payload.teacher_id))
    teacher = teacher_result.scalar_one_or_none()
    if teacher is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Teacher not found")
    if teacher.role.name not in ("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assigned user must have the 'teacher' or 'admin' role",
        )

    # Prevent clashing slots: same class + day + overlapping time window
    clash_result = await db.execute(
        select(Timetable).where(
            Timetable.class_id == payload.class_id,
            Timetable.day == payload.day,
            Timetable.start_time < payload.end_time,
            Timetable.end_time > payload.start_time,
        )
    )
    if clash_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"A timetable slot already exists for class {payload.class_id} "
                f"on {payload.day} that overlaps with "
                f"{payload.start_time}–{payload.end_time}"
            ),
        )

    slot = Timetable(
        class_id=payload.class_id,
        course_id=payload.course_id,
        teacher_id=payload.teacher_id,
        day=payload.day,
        start_time=payload.start_time,
        end_time=payload.end_time,
        room=payload.room,
    )
    db.add(slot)
    await db.flush()
    await db.refresh(slot)
    return TimetableOut.model_validate(slot)


@router.get(
    "/class/{class_id}",
    response_model=list[TimetableOut],
    status_code=status.HTTP_200_OK,
    summary="View full weekly timetable for a class (all roles)",
)
@cache(expire=3600)
async def get_class_timetable(
    class_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(get_current_user)],
    day: str | None = Query(None, description="Filter by day e.g. Monday"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> list[TimetableOut]:
    await _get_class_or_404(class_id, db)

    query = select(Timetable).where(Timetable.class_id == class_id)
    if day is not None:
        query = query.where(Timetable.day == day.strip().capitalize())
    # Order by day weight then start time for a logical schedule view
    day_order = {
        "Monday": 1, "Tuesday": 2, "Wednesday": 3,
        "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7,
    }
    result = await db.execute(query.offset(skip).limit(limit))
    slots = result.scalars().all()

    # Sort in Python for consistent weekly ordering
    slots_sorted = sorted(
        slots,
        key=lambda s: (day_order.get(s.day, 99), s.start_time),
    )
    return [TimetableOut.model_validate(s) for s in slots_sorted]


@router.get(
    "/me",
    response_model=list[TimetableOut],
    status_code=status.HTTP_200_OK,
    summary="Student views their own timetable based on enrolled class",
)
@cache(expire=3600)
async def get_my_timetable(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    day: str | None = Query(None, description="Filter by day e.g. Monday"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> list[TimetableOut]:
    # Resolve the student's class via their profile
    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.user_id)
    )
    profile = profile_result.scalar_one_or_none()

    # Also check enrollment as a fallback
    class_id: int | None = None
    if profile is not None:
        class_id = profile.class_id
    else:
        enrollment_result = await db.execute(
            select(Enrollment).where(Enrollment.student_id == current_user.user_id)
        )
        enrollment = enrollment_result.scalar_one_or_none()
        if enrollment is not None:
            class_id = enrollment.class_id

    if class_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No class assigned. Please contact your administrator.",
        )

    query = select(Timetable).where(Timetable.class_id == class_id)
    if day is not None:
        query = query.where(Timetable.day == day.strip().capitalize())

    result = await db.execute(query.offset(skip).limit(limit))
    slots = result.scalars().all()

    day_order = {
        "Monday": 1, "Tuesday": 2, "Wednesday": 3,
        "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7,
    }
    slots_sorted = sorted(
        slots,
        key=lambda s: (day_order.get(s.day, 99), s.start_time),
    )
    return [TimetableOut.model_validate(s) for s in slots_sorted]


@router.get(
    "/teacher/me",
    response_model=list[TimetableOut],
    status_code=status.HTTP_200_OK,
    summary="Teacher views their own assigned timetable slots",
)
async def get_teacher_timetable(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_teacher)],
) -> list[TimetableOut]:
    """Returns all timetable slots where this teacher is the assigned instructor."""
    result = await db.execute(
        select(Timetable).where(Timetable.teacher_id == current_user.user_id)
    )
    slots = result.scalars().all()

    day_order = {
        "Monday": 1, "Tuesday": 2, "Wednesday": 3,
        "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7,
    }
    slots_sorted = sorted(
        slots,
        key=lambda s: (day_order.get(s.day, 99), s.start_time),
    )
    return [TimetableOut.model_validate(s) for s in slots_sorted]


@router.delete(
    "/{slot_id}",
    status_code=status.HTTP_200_OK,
    summary="Admin deletes a timetable slot",
)
async def delete_timetable_slot(
    slot_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> dict:
    slot = await _get_slot_or_404(slot_id, db)
    await db.delete(slot)
    await db.flush()
    return {
        "detail": (
            f"Timetable slot {slot_id} "
            f"({slot.day} {slot.start_time}–{slot.end_time}) deleted"
        )
    }
