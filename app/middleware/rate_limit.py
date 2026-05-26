"""
app/middleware/rate_limit.py
────────────────────────────
Configures the slowapi Limiter instance for the application.
Provides a default rate limit of 100 requests per minute per IP address.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Configure limiter to track clients by IP (remote address)
# and apply a default global threshold of 100 requests/minute.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"]
)
