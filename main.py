from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.auth import router as auth_router
from app.api.students import router as student_router
from app.database import engine, Base
from app.models import student  # noqa: F401 — ensures Student model is registered with Base
from app.models import user



# ──────────────────────────────────────────
# Lifespan: runs on startup & shutdown
# ──────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create all tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created / verified")
    yield
    # Shutdown: dispose the connection pool cleanly
    await engine.dispose()
    print("🛑 Database connection closed")


# ──────────────────────────────────────────
# App instance
# ──────────────────────────────────────────
app = FastAPI(
    title="Student Management System",
    description="A REST API for managing students",
    version="1.0.0",
    lifespan=lifespan,
)


# ──────────────────────────────────────────
# CORS middleware
# ──────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # restrict to your frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────
# Routers
# ──────────────────────────────────────────
app.include_router(student_router)

app.include_router(auth_router)
# ──────────────────────────────────────────
# Root health-check
# ──────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "message": "Welcome to the Student Management System API"}

