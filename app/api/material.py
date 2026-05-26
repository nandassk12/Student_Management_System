"""
app/api/material.py
───────────────────
Study Material router:
  POST   /material                      → teacher uploads file
  GET    /material/course/{course_id}   → all roles view study materials for course
  GET    /material/{id}                 → view/download file
  DELETE /material/{id}                 → teacher (own) or admin deletes
  GET    /material/me                   → teacher views their own uploads
"""

import os
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth import get_current_user, require_teacher
from app.database import get_db
from app.models.course import Course
from app.models.material import StudyMaterial
from app.schemas.auth import TokenData
from app.schemas.material import MaterialOut
from app.services.file_upload import save_uploaded_file

router = APIRouter(prefix="/material", tags=["Study Material"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_material_or_404(material_id: int, db: AsyncSession) -> StudyMaterial:
    result = await db.execute(select(StudyMaterial).where(StudyMaterial.id == material_id))
    material = result.scalar_one_or_none()
    if material is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study material record not found"
        )
    return material


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=MaterialOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload study material (teacher and admin only)",
)
async def upload_material(
    course_id: Annotated[int, Form(..., description="ID of the course this material belongs to")],
    title: Annotated[str, Form(..., description="Title of the material")],
    description: str | None = Form(default=None),
    file: UploadFile = File(..., description="Multipart file upload (pdf, docx, mp4, png, jpg) max 50MB"),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    current_user: Annotated[TokenData, Depends(require_teacher)] = None,
) -> MaterialOut:
    # 1. Validate course exists
    course_res = await db.execute(select(Course).where(Course.id == course_id))
    course = course_res.scalar_one_or_none()
    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target course not found"
        )

    # 2. Save file via service (handles extension and size validation)
    relative_path, file_ext, file_size = await save_uploaded_file(file)

    # 3. Create database record
    material = StudyMaterial(
        teacher_id=current_user.user_id,
        course_id=course_id,
        title=title.strip(),
        description=description.strip() if description else None,
        file_path=relative_path,
        file_type=file_ext,
        file_size=file_size,
    )
    db.add(material)
    await db.flush()
    await db.refresh(material)

    return MaterialOut.model_validate(material)


@router.get(
    "/course/{course_id}",
    response_model=list[MaterialOut],
    status_code=status.HTTP_200_OK,
    summary="Get all study materials for a course (all authenticated roles)",
)
async def list_course_materials(
    course_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> list[MaterialOut]:
    # Validate course exists
    course_res = await db.execute(select(Course).where(Course.id == course_id))
    if course_res.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )

    query = (
        select(StudyMaterial)
        .where(StudyMaterial.course_id == course_id)
        .order_by(StudyMaterial.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    materials = result.scalars().all()
    return [MaterialOut.model_validate(m) for m in materials]


@router.get(
    "/me",
    response_model=list[MaterialOut],
    status_code=status.HTTP_200_OK,
    summary="Get materials uploaded by current teacher",
)
async def get_my_materials(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(require_teacher)],
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> list[MaterialOut]:
    query = (
        select(StudyMaterial)
        .where(StudyMaterial.teacher_id == current_user.user_id)
        .order_by(StudyMaterial.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    materials = result.scalars().all()
    return [MaterialOut.model_validate(m) for m in materials]


@router.get(
    "/{material_id}",
    summary="Download or view a specific study material file",
)
async def download_material(
    material_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[TokenData, Depends(get_current_user)],
):
    material = await _get_material_or_404(material_id, db)

    # Resolve absolute path to check existence on disk
    abs_path = os.path.abspath(os.path.join(os.getcwd(), material.file_path))
    if not os.path.exists(abs_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File content not found on disk storage"
        )

    # Use the original stored file extension
    ext = material.file_type
    original_title = "".join(c for c in material.title if c.isalnum() or c in (" ", "_", "-"))
    friendly_name = f"{original_title}.{ext}"

    # Return FileResponse to either stream to browser or force download
    return FileResponse(
        path=abs_path,
        filename=friendly_name,
        # Will dynamically detect media types for PDF/MP4/PNG/JPG
    )


@router.delete(
    "/{material_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a study material (author or admin only)",
)
async def delete_material(
    material_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> dict:
    material = await _get_material_or_404(material_id, db)

    # Guard permissions: only admin or the teacher who uploaded the file
    if current_user.role_name != "admin" and material.teacher_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this study material"
        )

    # 1. Attempt to remove the file from disk storage to avoid orphaned data
    abs_path = os.path.abspath(os.path.join(os.getcwd(), material.file_path))
    if os.path.exists(abs_path):
        try:
            os.remove(abs_path)
        except Exception as e:
            # We log or output warning, but proceed with DB deletion so we don't lock database
            print(f"⚠️ Warning: Could not delete disk file {abs_path}: {e}")

    # 2. Delete database record
    await db.delete(material)
    await db.flush()

    return {"detail": f"Study material '{material.title}' successfully deleted"}
