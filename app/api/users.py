"""
app/api/users.py
─────────────────
Users router (Admin only):
  POST   /users         → create user
  GET    /users         → list users (paginated)
  GET    /users/{id}    → get single user
  PUT    /users/{id}    → update user
  DELETE /users/{id}    → deactivate user (soft delete)
"""

from typing import Annotated
import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query, status, File, UploadFile
from sqlalchemy import select,func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import require_admin,require_teacher, hash_password
from app.database import get_db
from app.models.role import Role
from app.models.user import User
from app.models.student_profile import StudentProfile
from app.models.department import Department
from app.models.class_ import Class_
from app.models.enrollment import Enrollment
from app.schemas.auth import TokenData
from app.schemas.user import UserCreate, UserOut, UserUpdate, UserImportResponse, ImportErrorItem

router = APIRouter(prefix="/users", tags=["Users"])


# ── Helper ────────────────────────────────────────────────────────────────────

async def _get_user_or_404(user_id: int, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user (admin only)",
)
async def create_user(
    payload: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> UserOut:
    # Validate role exists
    role_result = await db.execute(select(Role).where(Role.id == payload.role_id))
    role = role_result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role not found")

    # Check duplicate username / email
    dup = await db.execute(
        select(User).where(
            (User.username == payload.username) | (User.email == payload.email)
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered",
        )

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role_id=payload.role_id,
    )
    db.add(user)
    await db.flush()   # get auto-assigned id before commit
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.get(
    "",
    response_model=list[UserOut],
    status_code=status.HTTP_200_OK,
    summary="List all users (admin only, paginated with filters)",
)
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_teacher)],
    role_id: int | None = Query(None, description="Filter by role ID"),
    role_name: str | None = Query(None, alias="role", description="Filter by role name"),
    username: str | None = Query(None, description="Filter/search by username (substring, case-insensitive)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(10, ge=1, le=100, description="Max records to return"),
) -> list[UserOut]:
    role = current_user.role_name.strip().lower()
    if role == "teacher":
        from app.models.student_profile import StudentProfile
        from app.models.timetable import Timetable
        query = select(User).join(
            StudentProfile, User.id == StudentProfile.user_id
        ).join(
            Timetable, Timetable.class_id == StudentProfile.class_id
        ).where(
            Timetable.teacher_id == current_user.user_id
        ).distinct()
        if username is not None:
            query = query.where(User.username.ilike(f"%{username.strip()}%"))
    else:
        query = select(User)
        if role_id is not None:
            query = query.where(User.role_id == role_id)
        if role_name is not None:
            query = query.join(Role).where(func.lower(Role.name) == role_name.strip().lower())
        if username is not None:
            query = query.where(User.username.ilike(f"%{username.strip()}%"))

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()
    return [UserOut.model_validate(u) for u in users]



@router.get(
    "/{user_id}",
    response_model=UserOut,
    status_code=status.HTTP_200_OK,
    summary="Get a single user by ID (admin only)",
)
async def get_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> UserOut:
    user = await _get_user_or_404(user_id, db)
    return UserOut.model_validate(user)


@router.put(
    "/{user_id}",
    response_model=UserOut,
    status_code=status.HTTP_200_OK,
    summary="Update a user (admin only)",
)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
) -> UserOut:
    user = await _get_user_or_404(user_id, db)

    if payload.username is not None:
        user.username = payload.username
    if payload.email is not None:
        user.email = payload.email
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
    if payload.role_id is not None:
        role_result = await db.execute(select(Role).where(Role.id == payload.role_id))
        if role_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role not found")
        user.role_id = payload.role_id
    if payload.is_active is not None:
        user.is_active = payload.is_active

    await db.flush()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate a user (admin only — soft delete)",
)
async def deactivate_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_admin)],
) -> dict:
    if user_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )
    user = await _get_user_or_404(user_id, db)
    user.is_active = False
    await db.flush()
    return {"detail": f"User '{user.username}' has been deactivated"}


@router.post(
    "/import",
    response_model=UserImportResponse,
    status_code=status.HTTP_200_OK,
    summary="Bulk import users (students/teachers) from a CSV file (admin only)",
)
async def import_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(require_admin)],
    role: str = Query("student", description="Role to import ('student' or 'teacher')"),
    file: UploadFile = File(...),
) -> UserImportResponse:
    # Read file content
    contents = await file.read()
    try:
        decoded = contents.decode("utf-8")
    except UnicodeDecodeError:
        decoded = contents.decode("latin-1")
    
    # Parse CSV
    f = io.StringIO(decoded)
    reader = csv.DictReader(f)
    
    # Check headers
    if not reader.fieldnames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file is empty or has no headers",
        )
        
    cleaned_headers = [h.strip() for h in reader.fieldnames if h]
    
    # Standardize and validate role
    role_name = role.strip().lower()
    if role_name not in ("student", "teacher"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role specified. Must be 'student' or 'teacher'."
        )

    if role_name == "teacher":
        required_cols = {"username", "email", "password"}
    else:
        required_cols = {"username", "email", "password", "department_code", "class_name", "roll_number"}
    
    if not required_cols.issubset(set(cleaned_headers)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV file must contain the following columns: {', '.join(required_cols)}",
        )
        
    # Get target role from database
    role_result = await db.execute(select(Role).where(Role.name == role_name))
    target_role = role_result.scalar_one_or_none()
    if not target_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Role '{role_name}' not found in database",
        )
        
    created = 0
    skipped = 0
    errors = []
    
    # Sets to track duplicates within this CSV batch
    seen_usernames = set()
    seen_emails = set()
    seen_roll_numbers = set()
    
    # Read rows
    rows = []
    for r in reader:
        cleaned_row = {k.strip() if k else "": v.strip() if v else "" for k, v in r.items()}
        rows.append(cleaned_row)
        
    # Process each row
    for idx, row in enumerate(rows, start=2):
        username = row.get("username")
        email = row.get("email")
        password = row.get("password")
        
        # 1. Validation: check missing fields
        missing = []
        if not username: missing.append("username")
        if not email: missing.append("email")
        if not password: missing.append("password")
        
        if role_name == "student":
            department_code = row.get("department_code")
            class_name = row.get("class_name")
            roll_number = row.get("roll_number")
            if not department_code: missing.append("department_code")
            if not class_name: missing.append("class_name")
            if not roll_number: missing.append("roll_number")
            
        if missing:
            errors.append(ImportErrorItem(row=idx, reason=f"Missing values for columns: {', '.join(missing)}"))
            continue
            
        # Standardize fields
        username = username.lower()
        email = email.lower()
        
        # Basic validation checks
        if " " in username:
            errors.append(ImportErrorItem(row=idx, reason="Username must not contain spaces"))
            continue
        if len(password) < 6:
            errors.append(ImportErrorItem(row=idx, reason="Password must be at least 6 characters"))
            continue
        if "@" not in email or "." not in email:
            errors.append(ImportErrorItem(row=idx, reason=f"Invalid email format: '{email}'"))
            continue
            
        # 2. Check duplicates in CSV file
        if username in seen_usernames:
            skipped += 1
            continue
        if email in seen_emails:
            skipped += 1
            continue
        if role_name == "student" and roll_number in seen_roll_numbers:
            skipped += 1
            continue
            
        # 3. Look up department and class (Student only)
        dept = None
        cls = None
        if role_name == "student":
            # Department lookup
            dept_result = await db.execute(select(Department).where(Department.code == department_code))
            dept = dept_result.scalar_one_or_none()
            if not dept:
                errors.append(ImportErrorItem(row=idx, reason=f"Department with code '{department_code}' not found"))
                continue
                
            # Class lookup
            class_result = await db.execute(
                select(Class_).where(Class_.name == class_name, Class_.department_id == dept.id)
            )
            cls = class_result.scalar_one_or_none()
            if not cls:
                errors.append(ImportErrorItem(row=idx, reason=f"Class '{class_name}' not found in department '{department_code}'"))
                continue
            
        # 4. Check duplicates in DB
        # User duplicates (username or email)
        user_dup_result = await db.execute(
            select(User).where((User.username == username) | (User.email == email))
        )
        if user_dup_result.scalar_one_or_none():
            skipped += 1
            continue
            
        if role_name == "student":
            # StudentProfile duplicates (roll number)
            roll_dup_result = await db.execute(
                select(StudentProfile).where(StudentProfile.roll_number == roll_number)
            )
            if roll_dup_result.scalar_one_or_none():
                skipped += 1
                continue
            
        # 5. Create records in a nested transaction
        try:
            async with await db.begin_nested():
                # Create user
                user = User(
                    username=username,
                    email=email,
                    password_hash=hash_password(password),
                    role_id=target_role.id,
                    is_active=True
                )
                db.add(user)
                await db.flush()
                
                if role_name == "student":
                    # Create profile
                    profile = StudentProfile(
                        user_id=user.id,
                        department_id=dept.id,
                        class_id=cls.id,
                        roll_number=roll_number
                    )
                    db.add(profile)
                    await db.flush()
                    
                    # Create enrollment
                    enrollment = Enrollment(
                        student_id=user.id,
                        class_id=cls.id
                    )
                    db.add(enrollment)
                    await db.flush()
                
            created += 1
            seen_usernames.add(username)
            seen_emails.add(email)
            if role_name == "student":
                seen_roll_numbers.add(roll_number)
        except Exception as e:
            errors.append(ImportErrorItem(row=idx, reason=f"Database insertion failed: {str(e)}"))
            
    # Commit the changes (if any records created)
    if created > 0:
        await db.commit()
        
    return UserImportResponse(created=created, skipped=skipped, errors=errors)
