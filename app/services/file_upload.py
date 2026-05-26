"""
app/services/file_upload.py
───────────────────────────
Service logic for checking file sizes, extensions, and saving uploaded files securely.
"""

import os
import uuid
import inspect
from fastapi import UploadFile, HTTPException, status

ALLOWED_EXTENSIONS = {"pdf", "docx", "mp4", "png", "jpg"}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50MB

# Base upload directory - resolved absolute to current working directory
UPLOAD_DIR = os.path.abspath(os.path.join(os.getcwd(), "uploads"))


async def get_file_size(file: UploadFile) -> int:
    contents = await file.read()
    await file.seek(0)
    return len(contents)


async def save_uploaded_file(file: UploadFile) -> tuple[str, str, int]:
    """
    Validates extension and file size.
    Saves the file to the workspace uploads directory with a unique identifier.
    Returns: (saved_file_path, file_extension, file_size_in_bytes)
    """
    # 1. Validate file extension
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File has no name"
        )

    parts = file.filename.split(".")
    if len(parts) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is missing an extension"
        )

    ext = parts[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '.{ext}'. Supported types: {sorted(ALLOWED_EXTENSIONS)}"
        )

    # 2. Validate file size
    size = await get_file_size(file)
    if size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of 50MB. (Uploaded: {size / (1024*1024):.2f}MB)"
        )

    # 3. Ensure uploads folder exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # 4. Generate unique secure filename to prevent collision/directory traversal
    unique_name = f"{uuid.uuid4().hex}_{parts[0]}"
    # Clean non-alphanumeric chars from filename segment for extra safety
    cleaned_segment = "".join(c for c in unique_name if c.isalnum() or c == "_")
    final_filename = f"{cleaned_segment}.{ext}"
    dest_path = os.path.join(UPLOAD_DIR, final_filename)

    # 5. Write file in chunks to prevent large memory footprints
    try:
        with open(dest_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                buffer.write(chunk)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save file to disk: {str(e)}"
        )

    # Return final absolute path (or path relative to project for DB storage)
    # Storing path as relative to help containerized/moving workspaces, but absolute is fine.
    # Let's save the relative path to workspace root so it remains portable
    relative_path = os.path.join("uploads", final_filename)

    return relative_path, ext, size
