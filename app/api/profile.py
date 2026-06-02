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

import datetime
import os
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.auth import (
    get_current_user,
    require_admin,
    require_teacher,
)
from app.database import get_db
from app.models.class_ import Class_
from app.models.department import Department
from app.models.enrollment import Enrollment
from app.models.student_profile import StudentProfile, StudentDocument
from app.models.teacher_profile import TeacherProfile, TeacherDocument
from app.models.user import User
from app.schemas.auth import TokenData
from app.schemas.profile import (
    ClassStudentOut,
    EnrollmentCreate,
    EnrollmentOut,
    ProfileCreate,
    ProfileOut,
    ProfileUpdate,
    StudentProfileUpdate,
    StudentProfileOut,
    StudentDocumentOut,
    TeacherProfileUpdate,
    TeacherProfileOut,
    TeacherDocumentOut,
)
from app.services.file_upload import save_uploaded_file

router = APIRouter(tags=["Profile & Enrollment"])


def calculate_completion_pct(profile) -> int:
    # Count non-null fields out of all expected profile fields
    # Return integer 0–100
    if isinstance(profile, StudentProfile):
        fields = [
            "user_id", "department_id", "class_id", "roll_number", "dob", "blood_group",
            "phone", "address", "emergency_contact", "profile_photo", "first_name", "last_name",
            "gender", "nationality", "state", "year_of_study", "batch_year", "admission_date",
            "hostel_status", "personal_email", "current_address", "permanent_address", "parent_name",
            "parent_relationship", "parent_phone", "emergency_contact_name", "emergency_contact_rel",
            "emergency_contact_phone", "signature"
        ]
    elif isinstance(profile, TeacherProfile):
        fields = [
            "user_id", "department_id", "full_name", "gender", "date_of_birth", "employee_id",
            "designation", "employment_type", "highest_qualification", "phone", "alternate_phone",
            "profile_photo", "signature", "personal_email", "current_address", "permanent_address",
            "emergency_contact_name", "emergency_contact_rel", "emergency_contact_phone", "bank_name",
            "account_number", "ifsc_code"
        ]
    else:
        return 0

    non_null_count = sum(1 for f in fields if getattr(profile, f, None) is not None)
    return int(round((non_null_count / len(fields)) * 100))


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
    profile = result.unique().scalar_one_or_none()
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
    profile = result.unique().scalar_one_or_none()
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
    profile = result.unique().scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    if current_user.role_name.strip().lower() == "teacher":
        from app.models.timetable import Timetable
        check_teach = await db.execute(
            select(Timetable).where(
                (Timetable.class_id == profile.class_id) & (Timetable.teacher_id == current_user.user_id)
            )
        )
        if check_teach.scalars().first() is None: 
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not teach this student"
            )

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
    current_user: Annotated[TokenData, Depends(require_teacher)],
) -> list[EnrollmentOut]:

    # Validate class exists
    cls_result = await db.execute(select(Class_).where(Class_.id == class_id))
    if cls_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    # If teacher, only allow if they teach this class in the timetable
    if current_user.role_name.strip().lower() == "teacher":
        from app.models.timetable import Timetable
        check_teach = await db.execute(
            select(Timetable).where(
                (Timetable.class_id == class_id) & (Timetable.teacher_id == current_user.user_id)
            )
        )
        if check_teach.scalars().first() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not teach this class"
            )

    result = await db.execute(
        select(Enrollment)
        .options(
            selectinload(Enrollment.student).selectinload(User.student_profile)
        )
        .where(Enrollment.class_id == class_id)
        .order_by(Enrollment.id)
    )
    enrollments = result.scalars().all()

    # Build response, injecting roll_number from the eagerly-loaded student_profile
    out = []
    for e in enrollments:
        sp = getattr(e.student, "student_profile", None)
        roll = sp.roll_number if sp else None
        out.append(EnrollmentOut(
            id=e.id,
            student_id=e.student_id,
            class_id=e.class_id,
            student=e.student,
            class_=e.class_,
            roll_number=roll,
        ))
    return out



@router.get(
    "/enrollment/class/{class_id}/students",
    response_model=list[ClassStudentOut],
    status_code=status.HTTP_200_OK,
    summary="Teacher gets slim student list for a class (id, username, full_name, roll_number)",
)
async def get_class_students(
    class_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_teacher)],
) -> list[ClassStudentOut]:
    from app.models.timetable import Timetable

    # Validate class exists
    cls_result = await db.execute(select(Class_).where(Class_.id == class_id))
    if cls_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    # Teachers may only query classes they are assigned to teach
    if current_user.role_name.strip().lower() == "teacher":
        check_teach = await db.execute(
            select(Timetable).where(
                (Timetable.class_id == class_id) & (Timetable.teacher_id == current_user.user_id)
            )
        )
        if check_teach.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not teach this class",
            )

    # JOIN enrollment → users → student_profile in one query
    stmt = (
        select(
            User.id,
            User.username,
            StudentProfile.roll_number,
            StudentProfile.first_name,
            StudentProfile.last_name,
        )
        .select_from(Enrollment)
        .join(User, User.id == Enrollment.student_id)
        .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
        .where(Enrollment.class_id == class_id)
        .order_by(StudentProfile.roll_number)
    )
    rows = (await db.execute(stmt)).all()

    students = []
    for row in rows:
        user_id, username, roll_number, first_name, last_name = (
            row[0], row[1], row[2], row[3], row[4]
        )
        # Build full_name from first+last; fall back to username if both null
        if first_name or last_name:
            full_name = " ".join(filter(None, [first_name, last_name]))
        else:
            full_name = username
        students.append(
            ClassStudentOut(
                id=user_id,
                username=username,
                full_name=full_name,
                roll_number=roll_number,
            )
        )
    return students


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


# ═══════════════════════════════════════════════════════════════════════════════
# Teacher Profile Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/profile/teacher/me",
    response_model=TeacherProfileOut,
    status_code=status.HTTP_200_OK,
    summary="Teacher views their own profile",
)
async def get_teacher_profile_me(
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TeacherProfileOut:
    if current_user.role_name != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher access required"
        )
    result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == current_user.user_id)
    )
    profile = result.unique().scalar_one_or_none()
    if profile is None:
        profile = TeacherProfile(user_id=current_user.user_id)
        db.add(profile)
        await db.flush()
        await db.refresh(profile)

    profile.profile_completed_pct = calculate_completion_pct(profile)
    await db.flush()
    await db.refresh(profile)
    return TeacherProfileOut.model_validate(profile)


@router.put(
    "/profile/teacher/me",
    response_model=TeacherProfileOut,
    status_code=status.HTTP_200_OK,
    summary="Teacher updates their own profile",
)
async def update_teacher_profile_me(
    payload: TeacherProfileUpdate,
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TeacherProfileOut:
    if current_user.role_name != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher access required"
        )
    result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == current_user.user_id)
    )
    profile = result.unique().scalar_one_or_none()
    if profile is None:
        profile = TeacherProfile(user_id=current_user.user_id)
        db.add(profile)
        await db.flush()
        await db.refresh(profile)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    profile.last_edited_at = datetime.datetime.now(datetime.timezone.utc)
    profile.profile_completed_pct = calculate_completion_pct(profile)

    await db.flush()
    await db.refresh(profile)
    return TeacherProfileOut.model_validate(profile)


@router.post(
    "/profile/teacher/me/photo",
    response_model=TeacherProfileOut,
    status_code=status.HTTP_200_OK,
    summary="Teacher uploads their profile photo",
)
async def upload_teacher_photo(
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> TeacherProfileOut:
    if current_user.role_name != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher access required"
        )
    result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == current_user.user_id)
    )
    profile = result.unique().scalar_one_or_none()
    if profile is None:
        profile = TeacherProfile(user_id=current_user.user_id)
        db.add(profile)
        await db.flush()
        await db.refresh(profile)

    relative_path, ext, size = await save_uploaded_file(file)
    profile.profile_photo = relative_path
    profile.last_edited_at = datetime.datetime.now(datetime.timezone.utc)
    profile.profile_completed_pct = calculate_completion_pct(profile)

    await db.flush()
    await db.refresh(profile)
    return TeacherProfileOut.model_validate(profile)


@router.post(
    "/profile/teacher/me/signature",
    response_model=TeacherProfileOut,
    status_code=status.HTTP_200_OK,
    summary="Teacher uploads their signature",
)
async def upload_teacher_signature(
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> TeacherProfileOut:
    if current_user.role_name != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher access required"
        )
    result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == current_user.user_id)
    )
    profile = result.unique().scalar_one_or_none()
    if profile is None:
        profile = TeacherProfile(user_id=current_user.user_id)
        db.add(profile)
        await db.flush()
        await db.refresh(profile)

    relative_path, ext, size = await save_uploaded_file(file)
    profile.signature = relative_path
    profile.last_edited_at = datetime.datetime.now(datetime.timezone.utc)
    profile.profile_completed_pct = calculate_completion_pct(profile)

    await db.flush()
    await db.refresh(profile)
    return TeacherProfileOut.model_validate(profile)


@router.post(
    "/profile/teacher/me/documents",
    response_model=TeacherDocumentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Teacher uploads a document",
)
async def upload_teacher_document(
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    doc_type: str,
    file: UploadFile = File(...),
) -> TeacherDocumentOut:
    if current_user.role_name != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher access required"
        )
    result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == current_user.user_id)
    )
    profile = result.unique().scalar_one_or_none()
    if profile is None:
        profile = TeacherProfile(user_id=current_user.user_id)
        db.add(profile)
        await db.flush()
        await db.refresh(profile)

    relative_path, ext, size = await save_uploaded_file(file)
    
    doc = TeacherDocument(
        teacher_id=profile.id,
        doc_type=doc_type,
        file_name=file.filename,
        file_path=relative_path,
    )
    db.add(doc)
    
    profile.last_edited_at = datetime.datetime.now(datetime.timezone.utc)
    profile.profile_completed_pct = calculate_completion_pct(profile)

    await db.flush()
    await db.refresh(doc)
    await db.refresh(profile)
    return TeacherDocumentOut.model_validate(doc)


@router.get(
    "/profile/teacher/me/documents",
    response_model=list[TeacherDocumentOut],
    status_code=status.HTTP_200_OK,
    summary="Teacher lists their own documents",
)
async def get_teacher_documents(
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[TeacherDocumentOut]:
    if current_user.role_name != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher access required"
        )
    result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == current_user.user_id)
    )
    profile = result.unique().scalar_one_or_none()
    if profile is None:
        profile = TeacherProfile(user_id=current_user.user_id)
        db.add(profile)
        await db.flush()
        await db.refresh(profile)

    doc_result = await db.execute(
        select(TeacherDocument).where(TeacherDocument.teacher_id == profile.id)
    )
    docs = doc_result.scalars().all()
    return [TeacherDocumentOut.model_validate(d) for d in docs]


@router.delete(
    "/profile/teacher/me/documents/{doc_id}",
    status_code=status.HTTP_200_OK,
    summary="Teacher deletes their own document",
)
async def delete_teacher_document(
    doc_id: int,
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    if current_user.role_name != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher access required"
        )
    result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == current_user.user_id)
    )
    profile = result.unique().scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    doc_result = await db.execute(
        select(TeacherDocument).where(
            (TeacherDocument.id == doc_id) & (TeacherDocument.teacher_id == profile.id)
        )
    )
    doc = doc_result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or does not belong to you"
        )

    await db.delete(doc)
    
    profile.last_edited_at = datetime.datetime.now(datetime.timezone.utc)
    profile.profile_completed_pct = calculate_completion_pct(profile)
    
    await db.flush()
    await db.refresh(profile)
    return {"detail": "Document deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# Student Profile New Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/profile/student/me",
    response_model=StudentProfileOut,
    status_code=status.HTTP_200_OK,
    summary="Student views their own profile",
)
async def get_student_profile_me(
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StudentProfileOut:
    if current_user.role_name != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required"
        )
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.user_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    profile.profile_completed_pct = calculate_completion_pct(profile)
    await db.flush()
    await db.refresh(profile)
    return StudentProfileOut.model_validate(profile)


@router.put(
    "/profile/student/me",
    response_model=StudentProfileOut,
    status_code=status.HTTP_200_OK,
    summary="Student updates their own profile",
)
async def update_student_profile_me(
    payload: StudentProfileUpdate,
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StudentProfileOut:
    if current_user.role_name != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required"
        )
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.user_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    profile.last_edited_at = datetime.datetime.now(datetime.timezone.utc)
    profile.profile_completed_pct = calculate_completion_pct(profile)

    await db.flush()
    await db.refresh(profile)
    return StudentProfileOut.model_validate(profile)


@router.post(
    "/profile/student/me/photo",
    response_model=StudentProfileOut,
    status_code=status.HTTP_200_OK,
    summary="Student uploads their profile photo",
)
async def upload_student_photo(
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> StudentProfileOut:
    if current_user.role_name != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required"
        )
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.user_id)
    )
    profile = result.unique().scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    relative_path, ext, size = await save_uploaded_file(file)
    profile.profile_photo = relative_path
    profile.last_edited_at = datetime.datetime.now(datetime.timezone.utc)
    profile.profile_completed_pct = calculate_completion_pct(profile)

    await db.flush()
    await db.refresh(profile)
    return StudentProfileOut.model_validate(profile)


@router.post(
    "/profile/student/me/signature",
    response_model=StudentProfileOut,
    status_code=status.HTTP_200_OK,
    summary="Student uploads their signature",
)
async def upload_student_signature(
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> StudentProfileOut:
    if current_user.role_name != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required"
        )
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.user_id)
    )
    profile = result.unique().scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    relative_path, ext, size = await save_uploaded_file(file)
    profile.signature = relative_path
    profile.last_edited_at = datetime.datetime.now(datetime.timezone.utc)
    profile.profile_completed_pct = calculate_completion_pct(profile)

    await db.flush()
    await db.refresh(profile)
    return StudentProfileOut.model_validate(profile)


@router.post(
    "/profile/student/me/documents",
    response_model=StudentDocumentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Student uploads a document",
)
async def upload_student_document(
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    doc_type: str,
    file: UploadFile = File(...),
) -> StudentDocumentOut:
    if current_user.role_name != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required"
        )
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.user_id)
    )
    profile = result.unique().scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    relative_path, ext, size = await save_uploaded_file(file)
    
    doc = StudentDocument(
        student_id=profile.id,
        doc_type=doc_type,
        file_name=file.filename,
        file_path=relative_path,
    )
    db.add(doc)
    
    profile.last_edited_at = datetime.datetime.now(datetime.timezone.utc)
    profile.profile_completed_pct = calculate_completion_pct(profile)

    await db.flush()
    await db.refresh(doc)
    await db.refresh(profile)
    return StudentDocumentOut.model_validate(doc)


@router.get(
    "/profile/student/me/documents",
    response_model=list[StudentDocumentOut],
    status_code=status.HTTP_200_OK,
    summary="Student lists their own documents",
)
async def get_student_documents(
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[StudentDocumentOut]:
    if current_user.role_name != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required"
        )
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.user_id)
    )
    profile = result.unique().scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    doc_result = await db.execute(
        select(StudentDocument).where(StudentDocument.student_id == profile.id)
    )
    docs = doc_result.scalars().all()
    return [StudentDocumentOut.model_validate(d) for d in docs]


@router.delete(
    "/profile/student/me/documents/{doc_id}",
    status_code=status.HTTP_200_OK,
    summary="Student deletes their own document",
)
async def delete_student_document(
    doc_id: int,
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    if current_user.role_name != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required"
        )
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.user_id)
    )
    profile = result.unique().scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    doc_result = await db.execute(
        select(StudentDocument).where(
            (StudentDocument.id == doc_id) & (StudentDocument.student_id == profile.id)
        )
    )
    doc = doc_result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or does not belong to you"
        )

    await db.delete(doc)
    
    profile.last_edited_at = datetime.datetime.now(datetime.timezone.utc)
    profile.profile_completed_pct = calculate_completion_pct(profile)
    
    await db.flush()
    await db.refresh(profile)
    return {"detail": "Document deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# Admin Profile & Document Access Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/admin/users/{user_id}/profile",
    status_code=status.HTTP_200_OK,
    summary="Admin views any user profile",
)
async def admin_get_user_profile(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
):
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.role.name == "student":
        profile_result = await db.execute(
            select(StudentProfile).where(StudentProfile.user_id == user_id)
        )
        profile = profile_result.unique().scalar_one_or_none()
        if profile is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")
        profile.profile_completed_pct = calculate_completion_pct(profile)
        await db.flush()
        await db.refresh(profile)
        return StudentProfileOut.model_validate(profile)
        
    elif user.role.name == "teacher":
        profile_result = await db.execute(
            select(TeacherProfile).where(TeacherProfile.user_id == user_id)
        )
        profile = profile_result.unique().scalar_one_or_none()
        if profile is None:
            profile = TeacherProfile(user_id=user_id)
            db.add(profile)
            await db.flush()
            await db.refresh(profile)
        profile.profile_completed_pct = calculate_completion_pct(profile)
        await db.flush()
        await db.refresh(profile)
        return TeacherProfileOut.model_validate(profile)
        
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User role '{user.role.name}' does not have a profile type"
        )


@router.get(
    "/admin/users/{user_id}/documents",
    status_code=status.HTTP_200_OK,
    summary="Admin lists any user documents",
)
async def admin_list_user_documents(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
):
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.role.name == "student":
        profile_result = await db.execute(
            select(StudentProfile).where(StudentProfile.user_id == user_id)
        )
        profile = profile_result.unique().scalar_one_or_none()
        if profile is None:
            return []
        doc_result = await db.execute(
            select(StudentDocument).where(StudentDocument.student_id == profile.id)
        )
        docs = doc_result.scalars().all()
        return [StudentDocumentOut.model_validate(d) for d in docs]
        
    elif user.role.name == "teacher":
        profile_result = await db.execute(
            select(TeacherProfile).where(TeacherProfile.user_id == user_id)
        )
        profile = profile_result.unique().scalar_one_or_none()
        if profile is None:
            return []
        doc_result = await db.execute(
            select(TeacherDocument).where(TeacherDocument.teacher_id == profile.id)
        )
        docs = doc_result.scalars().all()
        return [TeacherDocumentOut.model_validate(d) for d in docs]
        
    else:
        return []


@router.get(
    "/admin/users/{user_id}/documents/{doc_id}/download",
    summary="Admin downloads any user document",
)
async def admin_download_user_document(
    user_id: int,
    doc_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> FileResponse:
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    file_path = None
    file_name = None

    if user.role.name == "student":
        profile_result = await db.execute(
            select(StudentProfile).where(StudentProfile.user_id == user_id)
        )
        profile = profile_result.unique().scalar_one_or_none()
        if profile is not None:
            doc_result = await db.execute(
                select(StudentDocument).where(
                    (StudentDocument.id == doc_id) & (StudentDocument.student_id == profile.id)
                )
            )
            doc = doc_result.scalar_one_or_none()
            if doc is not None:
                file_path = doc.file_path
                file_name = doc.file_name
                
    elif user.role.name == "teacher":
        profile_result = await db.execute(
            select(TeacherProfile).where(TeacherProfile.user_id == user_id)
        )
        profile = profile_result.unique().scalar_one_or_none()
        if profile is not None:
            doc_result = await db.execute(
                select(TeacherDocument).where(
                    (TeacherDocument.id == doc_id) & (TeacherDocument.teacher_id == profile.id)
                )
            )
            doc = doc_result.scalar_one_or_none()
            if doc is not None:
                file_path = doc.file_path
                file_name = doc.file_name

    if not file_path or not file_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    import mimetypes
    abs_path = os.path.abspath(os.path.join(os.getcwd(), file_path))
    if not os.path.exists(abs_path) or not os.path.isfile(abs_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on disk"
        )

    mime_type, _ = mimetypes.guess_type(abs_path)
    media_type = mime_type or "application/octet-stream"

    return FileResponse(
        path=abs_path,
        filename=file_name,
        media_type=media_type
    )


@router.get(
    "/profile/student/me/documents/{doc_id}/download",
    summary="Student downloads their own document",
)
async def student_download_my_document(
    doc_id: int,
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FileResponse:
    if current_user.role_name != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access required")
    
    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == current_user.user_id)
    )
    profile = profile_result.unique().scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
        
    doc_result = await db.execute(
        select(StudentDocument).where(
            (StudentDocument.id == doc_id) & (StudentDocument.student_id == profile.id)
        )
    )
    doc = doc_result.unique().scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
        
    import mimetypes
    abs_path = os.path.abspath(os.path.join(os.getcwd(), doc.file_path))
    if not os.path.exists(abs_path) or not os.path.isfile(abs_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")
        
    mime_type, _ = mimetypes.guess_type(abs_path)
    media_type = mime_type or "application/octet-stream"
    return FileResponse(path=abs_path, filename=doc.file_name, media_type=media_type)


@router.get(
    "/profile/teacher/me/documents/{doc_id}/download",
    summary="Teacher downloads their own document",
)
async def teacher_download_my_document(
    doc_id: int,
    current_user: Annotated[TokenData, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FileResponse:
    if current_user.role_name != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teacher access required")
    
    profile_result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == current_user.user_id)
    )
    profile = profile_result.unique().scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
        
    doc_result = await db.execute(
        select(TeacherDocument).where(
            (TeacherDocument.id == doc_id) & (TeacherDocument.teacher_id == profile.id)
        )
    )
    doc = doc_result.unique().scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
        
    import mimetypes
    abs_path = os.path.abspath(os.path.join(os.getcwd(), doc.file_path))
    if not os.path.exists(abs_path) or not os.path.isfile(abs_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")
        
    mime_type, _ = mimetypes.guess_type(abs_path)
    media_type = mime_type or "application/octet-stream"
    return FileResponse(path=abs_path, filename=doc.file_name, media_type=media_type)


