"""
app/api/dashboard.py
────────────────────
Dashboard router:
  GET /dashboard/admin    → Admin analytics (fees, users, leaves, materials)
  GET /dashboard/teacher  → Teacher analytics (classes, leaves, attendance, uploads)
  GET /dashboard/student  → Student analytics (attendance, fees, GPA, today's timetable)
"""

import datetime
from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import get_current_user, require_admin, require_teacher
from app.database import get_db
from app.models.attendance import Attendance
from app.models.class_ import Class_
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.fee import Fee
from app.models.grade import Grade
from app.models.leave import LeaveRequest
from app.models.material import StudyMaterial
from app.models.role import Role
from app.models.student_profile import StudentProfile
from app.models.timetable import Timetable
from app.models.user import User
from app.schemas.auth import TokenData
from app.schemas.timetable import TimetableOut
from app.schemas.grade import GRADE_GPA_MAP

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class AdminDashboardOut(BaseModel):
    total_students: int
    total_teachers: int
    total_fees_collected: float
    total_pending_fees: float
    pending_leave_requests_count: int
    total_study_materials_uploaded: int


class TeacherDashboardOut(BaseModel):
    assigned_classes_count: int
    pending_leave_requests_count: int
    today_attendance_count: int
    total_materials_uploaded: int


class StudentAttendancePercentage(BaseModel):
    course_name: str
    attendance_percentage: float


class StudentDashboardOut(BaseModel):
    attendance_percentage_per_course: list[StudentAttendancePercentage]
    pending_fees_amount: float
    current_gpa: float
    today_timetable: list[TimetableOut]


# ── Helper ────────────────────────────────────────────────────────────────────

async def _get_student_class_id(student_id: int, db: AsyncSession) -> int | None:
    # Resolve student class from profile or enrollment fallback
    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == student_id)
    )
    profile = profile_result.scalar_one_or_none()
    if profile is not None and profile.class_id is not None:
        return profile.class_id

    enrollment_result = await db.execute(
        select(Enrollment).where(Enrollment.student_id == student_id)
    )
    enrollment = enrollment_result.scalar_one_or_none()
    if enrollment is not None:
        return enrollment.class_id

    return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "/admin",
    response_model=AdminDashboardOut,
    status_code=status.HTTP_200_OK,
    summary="Admin dashboard analytics",
)
async def get_admin_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> AdminDashboardOut:
    # 1. Total students & teachers
    stud_count_res = await db.execute(
        select(func.count(User.id)).join(Role).where(Role.name == "student", User.is_active == True)
    )
    total_students = stud_count_res.scalar() or 0

    teach_count_res = await db.execute(
        select(func.count(User.id)).join(Role).where(Role.name == "teacher", User.is_active == True)
    )
    total_teachers = teach_count_res.scalar() or 0

    # 2. Total fees collected & pending
    fees_collected_res = await db.execute(
        select(func.sum(Fee.amount)).where(Fee.status == "paid")
    )
    total_fees_collected = float(fees_collected_res.scalar() or 0.0)

    fees_pending_res = await db.execute(
        select(func.sum(Fee.amount)).where(Fee.status.in_(["pending", "overdue"]))
    )
    total_pending_fees = float(fees_pending_res.scalar() or 0.0)

    # 3. Pending leave requests count
    pending_leaves_res = await db.execute(
        select(func.count(LeaveRequest.id)).where(LeaveRequest.status == "pending")
    )
    pending_leave_requests_count = pending_leaves_res.scalar() or 0

    # 4. Total study materials uploaded
    materials_count_res = await db.execute(select(func.count(StudyMaterial.id)))
    total_study_materials_uploaded = materials_count_res.scalar() or 0

    return AdminDashboardOut(
        total_students=total_students,
        total_teachers=total_teachers,
        total_fees_collected=total_fees_collected,
        total_pending_fees=total_pending_fees,
        pending_leave_requests_count=pending_leave_requests_count,
        total_study_materials_uploaded=total_study_materials_uploaded,
    )


@router.get(
    "/teacher",
    response_model=TeacherDashboardOut,
    status_code=status.HTTP_200_OK,
    summary="Teacher dashboard analytics",
)
async def get_teacher_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_teacher)],
) -> TeacherDashboardOut:
    # 1. Assigned classes count
    classes_res = await db.execute(
        select(func.count(distinct(Timetable.class_id))).where(Timetable.teacher_id == current_user.user_id)
    )
    assigned_classes_count = classes_res.scalar() or 0

    # 2. Pending leave requests for their students
    leaves_res = await db.execute(
        select(func.count(LeaveRequest.id)).where(
            LeaveRequest.teacher_id == current_user.user_id,
            LeaveRequest.status == "pending"
        )
    )
    pending_leave_requests_count = leaves_res.scalar() or 0

    # 3. Today's attendance count marked by them
    attendance_res = await db.execute(
        select(func.count(Attendance.id)).where(
            Attendance.marked_by == current_user.user_id,
            Attendance.date == datetime.date.today()
        )
    )
    today_attendance_count = attendance_res.scalar() or 0

    # 4. Total materials uploaded by them
    materials_res = await db.execute(
        select(func.count(StudyMaterial.id)).where(StudyMaterial.teacher_id == current_user.user_id)
    )
    total_materials_uploaded = materials_res.scalar() or 0

    return TeacherDashboardOut(
        assigned_classes_count=assigned_classes_count,
        pending_leave_requests_count=pending_leave_requests_count,
        today_attendance_count=today_attendance_count,
        total_materials_uploaded=total_materials_uploaded,
    )


@router.get(
    "/student",
    response_model=StudentDashboardOut,
    status_code=status.HTTP_200_OK,
    summary="Student dashboard analytics",
)
async def get_student_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> StudentDashboardOut:
    # Guard: only students can query their own student dashboard
    if current_user.role_name != "student":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only student accounts can access the student dashboard"
        )

    student_id = current_user.user_id

    # 1. Attendance percentage per course
    attendance_res = await db.execute(
        select(Attendance).where(Attendance.student_id == student_id)
    )
    records = attendance_res.scalars().all()
    course_stats = defaultdict(lambda: {"attended": 0, "total": 0, "name": ""})
    for rec in records:
        cid = rec.course_id
        course_stats[cid]["name"] = rec.course.name
        course_stats[cid]["total"] += 1
        if rec.status in ("present", "late"):
            course_stats[cid]["attended"] += 1

    attendance_list = []
    for stats in course_stats.values():
        total = stats["total"]
        pct = round(stats["attended"] / total * 100, 2) if total > 0 else 0.0
        attendance_list.append(
            StudentAttendancePercentage(course_name=stats["name"], attendance_percentage=pct)
        )

    # 2. Pending fees amount
    fees_res = await db.execute(
        select(func.sum(Fee.amount)).where(
            Fee.student_id == student_id,
            Fee.status.in_(["pending", "overdue"])
        )
    )
    pending_fees_amount = float(fees_res.scalar() or 0.0)

    # 3. Current GPA
    grades_res = await db.execute(select(Grade).where(Grade.student_id == student_id))
    grades = grades_res.scalars().all()
    if not grades:
        current_gpa = 0.0
    else:
        current_gpa = round(sum(GRADE_GPA_MAP.get(g.grade, 0.0) for g in grades) / len(grades), 2)

    # 4. Today's timetable
    class_id = await _get_student_class_id(student_id, db)
    today_slots = []
    if class_id is not None:
        today_name = datetime.date.today().strftime("%A")  # e.g. "Monday"
        slots_res = await db.execute(
            select(Timetable).where(
                Timetable.class_id == class_id,
                Timetable.day == today_name
            ).order_by(Timetable.start_time)
        )
        today_slots = slots_res.scalars().all()

    return StudentDashboardOut(
        attendance_percentage_per_course=attendance_list,
        pending_fees_amount=pending_fees_amount,
        current_gpa=current_gpa,
        today_timetable=[TimetableOut.model_validate(s) for s in today_slots],
    )
