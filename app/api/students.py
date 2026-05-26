from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.models.student import Student
from app.schemas.student import StudentCreate, StudentResponse, StudentUpdate
from app.auth.auth import verify_token

router = APIRouter(prefix="/students", tags=["Students"])



# ──────────────────────────────────────────
# POST /students  — create a new student
# ──────────────────────────────────────────
@router.post("/", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(payload: StudentCreate, db: AsyncSession = Depends(get_db),token: dict = Depends(verify_token)):
    new_student = Student(**payload.model_dump())
    db.add(new_student)
    await db.commit()
    await db.refresh(new_student)
    return new_student


# ──────────────────────────────────────────
# GET /students  — fetch all students
# ──────────────────────────────────────────
@router.get("/", response_model=list[StudentResponse])
async def get_all_students(db: AsyncSession = Depends(get_db),token: dict = Depends(verify_token)):
    result = await db.execute(select(Student))
    students = result.scalars().all()
    return students


# ──────────────────────────────────────────
# GET /students/{id}  — fetch one student
# ──────────────────────────────────────────
@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(student_id: int, db: AsyncSession = Depends(get_db),token: dict = Depends(verify_token)):
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()

    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with id {student_id} not found"
        )

    return student


# ──────────────────────────────────────────
# PUT /students/{id}  — update a student
# ──────────────────────────────────────────
@router.put("/{student_id}", response_model=StudentResponse,status_code=status.HTTP_200_OK)
async def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: AsyncSession = Depends(get_db),token: dict = Depends(verify_token)
):
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()

    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with id {student_id} not found"
        )

    # Only update fields that were actually sent in the request
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(student, field, value)

    await db.commit()
    await db.refresh(student)
    return student


# ──────────────────────────────────────────
# DELETE /students/{id}  — delete a student
# ──────────────────────────────────────────
@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(student_id: int, db: AsyncSession = Depends(get_db),token: dict = Depends(verify_token)):
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()

    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with id {student_id} not found"
        )

    await db.delete(student)
    await db.commit()

