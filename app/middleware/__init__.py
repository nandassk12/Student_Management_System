"""
app/middleware/__init__.py
──────────────────────────
Registers all middleware on the FastAPI application instance.
Called from main.py during app setup.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.middleware.logging import LoggingMiddleware
from app.middleware.rate_limit import limiter


def register_middleware(app: FastAPI) -> None:
    """
    Attach all middleware to the FastAPI app.
    Extend this function as the project grows.
    """
    # 1. Rate Limiting Exception Handler & Middleware
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    # 2. Logging Middleware
    app.add_middleware(LoggingMiddleware)

    # 3. CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],        # tighten in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

