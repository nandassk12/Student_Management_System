from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.testclient import TestClient
from main import app

# ── Mock Lifespan to Bypass Database Connection ──────────────────────────────
# By default, FastAPI runs startup lifespan events which connect to the database.
# We override the lifespan with a dummy to test endpoints without a database.
@asynccontextmanager
async def dummy_lifespan(app: FastAPI):
    # Initialize cache to prevent errors on endpoints that cache responses
    from fastapi_cache import FastAPICache
    from fastapi_cache.backends.inmemory import InMemoryBackend
    try:
        FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
    except Exception:
        pass  # Already initialized
    yield

# Override the lifespan context manager
app.router.lifespan_context = dummy_lifespan

client = TestClient(app)

# ── Health Endpoint Test ──────────────────────────────────────────────────────
def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "Student Management System API"
    }
