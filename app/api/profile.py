"""
app/api/profile.py
───────────────────
Student Profile + Enrollment router:

  Profile:
    POST   /profile                    → admin creates profile for student
    GET    /profile/me                 → student views own profile
    PUT    /profile/me                 → student updates own profile
    GET    /profile/{user_id}          → admin/teacher views any student profile

  Enrollment:
    POST   /enrollment                 → admin enrolls student in class
    GET    /enrollment/class/{class_id}→ teacher/admin views class roster
    DELETE /enrollment/{id}            → admin removes enrollment
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import (
    get_current_user,
    require_admin,
    require_teacher,
)
from app.database import get_db
from app.models.class_ import Class_
from app.models.department import Department
from app.models.enrollment import Enrollment
from app.models.student_profile import StudentProfile
from app.models.user import User
from app.schemas.auth import TokenData
from app.schemas.profile import (
    EnrollmentCreate,
    EnrollmentOut,
    ProfileCreate,
    ProfileOut,
    ProfileUpdate,
)

router = APIRouter(tags=["Profile & Enrollment"])


# ═══════════════════════════════════════════════════════════════════════════════
# Student Profile Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/profile",
    response_model=ProfileOut,
    status_code=status.HTTP_201_CREATED,
    summary="Admin creates a student profile",
)
async def create_profile(
    payload: ProfileCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> ProfileOut:
    # Validate student user exists
    user_result = await db.execute(select(User).where(User.id == payload.user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found")
    if user.role.name != "student":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profile can only be created for users with the 'student' role",
        )

    # Validate department
    dept = await db.execute(select(Department).where(Department.id == payload.department_id))
    if dept.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department not found")

    # Validate class
    cls = await db.execute(select(Class_).where(Class_.id == payload.class_id))
    if cls.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Class not found")

    # Check duplicate profile
    existing = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == payload.user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profile already exists for this user",
        )

    # Check duplicate roll number
    roll_dup = await db.execute(
        select(StudentProfile).where(StudentProfile.roll_number == payload.roll_number)
    )
    if roll_dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Roll number '{payload.roll_number}' is already assigned",
        )

    profile = StudentProfile(
        user_id=payload.user_id,
        department_id=payload.department_id,
        class_id=payload.class_id,
        roll_number=payload.roll_number,
        dob=payload.dob,
        blood_group=payload.blood_group,
        phone=payload.phone,
        address=payload.address,
        emergency_contact=payload.emergency_contact,
        profile_photo=payload.profile_photo,
    )
    db.add(profile)
    await db.flush()
    await db.refresh(profile)
    return ProfileOut.model_validate(profile)


@router.get(
    "/profile/me",
    response_model=ProfileOut,
    status_code=status.HTTP_200_OK,
    summary="Student views their own profile",
)
async def get_my_profile(
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProfileOut:
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.user_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return ProfileOut.model_validate(profile)


@router.put(
    "/profile/me",
    response_model=ProfileOut,
    status_code=status.HTTP_200_OK,
    summary="Student updates their own profile",
)
async def update_my_profile(
    payload: ProfileUpdate,
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProfileOut:
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.user_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    if payload.dob is not None:
        profile.dob = payload.dob
    if payload.blood_group is not None:
        profile.blood_group = payload.blood_group
    if payload.phone is not None:
        profile.phone = payload.phone
    if payload.address is not None:
        profile.address = payload.address
    if payload.emergency_contact is not None:
        profile.emergency_contact = payload.emergency_contact
    if payload.profile_photo is not None:
        profile.profile_photo = payload.profile_photo

    await db.flush()
    await db.refresh(profile)
    return ProfileOut.model_validate(profile)


@router.get(
    "/profile/{user_id}",
    response_model=ProfileOut,
    status_code=status.HTTP_200_OK,
    summary="Admin or teacher views any student's profile",
)
async def get_profile_by_user(
    user_id: int,
    current_user: Annotated[TokenData, Depends(require_teacher)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProfileOut:
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return ProfileOut.model_validate(profile)


# ═══════════════════════════════════════════════════════════════════════════════
# Enrollment Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/enrollment",
    response_model=EnrollmentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Admin enrolls a student in a class",
)
async def enroll_student(
    payload: EnrollmentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> EnrollmentOut:
    # Validate student
    student_result = await db.execute(select(User).where(User.id == payload.student_id))
    student = student_result.scalar_one_or_none()
    if student is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student not found")
    if student.role.name != "student":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only users with the 'student' role can be enrolled",
        )

    # Validate class
    cls_result = await db.execute(select(Class_).where(Class_.id == payload.class_id))
    if cls_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Class not found")

    enrollment = Enrollment(student_id=payload.student_id, class_id=payload.class_id)
    db.add(enrollment)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is already enrolled in this class",
        )
    await db.refresh(enrollment)
    return EnrollmentOut.model_validate(enrollment)


@router.get(
    "/enrollment/class/{class_id}",
    response_model=list[EnrollmentOut],
    status_code=status.HTTP_200_OK,
    summary="Teacher or admin views all students in a class",
)
async def get_class_roster(
    class_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_teacher)],
) -> list[EnrollmentOut]:
    # Validate class exists
    cls_result = await db.execute(select(Class_).where(Class_.id == class_id))
    if cls_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    result = await db.execute(
        select(Enrollment).where(Enrollment.class_id == class_id)
    )
    enrollments = result.scalars().all()
    return [EnrollmentOut.model_validate(e) for e in enrollments]


@router.delete(
    "/enrollment/{enrollment_id}",
    status_code=status.HTTP_200_OK,
    summary="Admin removes a student enrollment",
)
async def remove_enrollment(
    enrollment_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> dict:
    result = await db.execute(select(Enrollment).where(Enrollment.id == enrollment_id))
    enrollment = result.scalar_one_or_none()
    if enrollment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")

    await db.delete(enrollment)
    await db.flush()
    return {"detail": f"Enrollment {enrollment_id} removed"}
