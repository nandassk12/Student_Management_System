"""
app/middleware/logging.py
─────────────────────────
FastAPI middleware that logs details of every HTTP request, including:
  - HTTP Method
  - Path
  - HTTP Status Code
  - Latency / Processing time
Outputs logs to both console and logs/app.log file.
"""

import logging
import os
import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Ensure directory for log files exists
LOGS_DIR = "logs"
os.makedirs(LOGS_DIR, exist_ok=True)
LOG_FILE_PATH = os.path.join(LOGS_DIR, "app.log")

# Setup logger configuration
logger = logging.getLogger("sms_logger")
logger.setLevel(logging.INFO)

# Add handlers if they are not already set up (to avoid duplication on reload)
if not logger.handlers:
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Console / Stdout handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # Persistent File handler
    file_handler = logging.FileHandler(LOG_FILE_PATH, encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log request details and compute response latency."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.perf_counter()
        
        # Process the request
        try:
            response = await call_next(request)
        except Exception as e:
            # Log uncaught server errors
            duration = time.perf_counter() - start_time
            logger.error(
                f"Method: {request.method} | Path: {request.url.path} | "
                f"Status: 500 (Unhandled Exception: {str(e)}) | Time: {duration:.4f}s"
            )
            raise e

        # Calculate time taken
        duration = time.perf_counter() - start_time
        
        # Log successful/handled responses
        logger.info(
            f"Method: {request.method} | Path: {request.url.path} | "
            f"Status: {response.status_code} | Time: {duration:.4f}s"
        )
        
        return response
