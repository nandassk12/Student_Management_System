"""
main.py
────────
FastAPI application entry point.
  - Registers all routers
  - Registers CORS middleware
  - Lifespan: creates DB tables + seeds default data on startup
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from app.database import AsyncSessionLocal, Base, engine
from app.middleware import register_middleware

# ── Import all models so Base.metadata knows about every table ────────────────
import app.models  # noqa: F401  (side-effect import)

# ── Routers ───────────────────────────────────────────────────────────────────
# Sprint 1
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.departments import router as departments_router
from app.api.courses import router as courses_router
from app.api.classes import router as classes_router
from app.api.profile import router as profile_router

# Sprint 2
from app.api.attendance import router as attendance_router
from app.api.grades import router as grades_router
from app.api.timetable import router as timetable_router

# Sprint 3
from app.api.fees import router as fees_router
from app.api.leave import router as leave_router
from app.api.notice import router as notice_router

# Sprint 4
from app.api.material import router as material_router

# Sprint 5
from app.api.dashboard import router as dashboard_router
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend




# ── Seeder ────────────────────────────────────────────────────────────────────

async def seed_database(db: AsyncSession) -> None:
    """
    Idempotently seeds:
      - 3 roles: admin, teacher, student
      - 1 default admin user: admin / admin123
    """
    from sqlalchemy import select
    from app.models.role import Role
    from app.models.user import User
    from app.auth.auth import hash_password

    # ── Roles ─────────────────────────────────────────────────────────────────
    for role_name in ("admin", "teacher", "student"):
        result = await db.execute(select(Role).where(Role.name == role_name))
        if result.scalar_one_or_none() is None:
            db.add(Role(name=role_name))

    await db.flush()  # persist roles so we can query their ids

    # ── Default admin user ─────────────────────────────────────────────────────
    user_result = await db.execute(select(User).where(User.username == "admin"))
    if user_result.scalar_one_or_none() is None:
        admin_role = await db.execute(select(Role).where(Role.name == "admin"))
        admin_role_obj = admin_role.scalar_one()

        admin_user = User(
            username="admin",
            email="admin@sms.local",
            password_hash=hash_password("admin123"),
            role_id=admin_role_obj.id,
            is_active=True,
        )
        db.add(admin_user)

    await db.commit()
    print("✅  Seed data applied (roles + default admin user)")


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Runs on startup:
      1. Creates all DB tables (create_all is a no-op if they exist)
      2. Seeds default data

    Runs on shutdown:
      - Disposes the async engine connection pool
    """
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅  Database tables created / verified")

    async with AsyncSessionLocal() as db:
        await seed_database(db)

    FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
    print("✅  In-memory cache initialized")

    yield  # app is running

    # Shutdown
    await engine.dispose()
    print("🛑  Database engine disposed")


# ── Application factory ───────────────────────────────────────────────────────

def create_app() -> FastAPI:
    application = FastAPI(
        title="Student Management System API",
        description=(
            "**Sprint 1 + Sprint 2 + Sprint 3 + Sprint 4 + Sprint 5** — College Student Management System.\n\n"
            "### Sprints\n"
            "- **Sprint 1:** Auth, Users, Departments, Courses, Classes, Profile, Enrollment\n"
            "- **Sprint 2:** Attendance, Grades, GPA, Timetable\n"
            "- **Sprint 3:** Fees, Leave requests, Notice Board\n"
            "- **Sprint 4:** Resources, Uploads, Analytics Predictors\n"
            "- **Sprint 5:** Polish (Logging, Rate Limits, Cache, Dashboards)\n\n"
            "### Quick Start\n"
            "**Default admin credentials:** `admin` / `admin123`\n\n"
            "1. Use **POST /auth/login** to get a JWT token.\n"
            "2. Click **Authorize** ↗️ and paste: `Bearer <token>`"
        ),
        version="5.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    register_middleware(application)

    # ── Register routers ──────────────────────────────────────────────────────
    # Sprint 1
    application.include_router(auth_router)
    application.include_router(users_router)
    application.include_router(departments_router)
    application.include_router(courses_router)
    application.include_router(classes_router)
    application.include_router(profile_router)

    # Sprint 2
    application.include_router(attendance_router)
    application.include_router(grades_router)
    application.include_router(timetable_router)

    # Sprint 3
    application.include_router(fees_router)
    application.include_router(leave_router)
    application.include_router(notice_router)

    # Sprint 4
    application.include_router(material_router)

    # Sprint 5
    application.include_router(dashboard_router)

    return application


app = create_app()


# ── Health-check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"], summary="Health check endpoint")
async def health() -> dict:
    return {"status": "ok", "service": "Student Management System API"}
