"""
Lightweight in-process sliding-window rate limiter.

Used for authentication / abuse-prone endpoints. For multi-instance
production deployments, back this with Redis (see docker-compose service);
the interface is intentionally tiny so it can be swapped later.
"""

import time
import threading
from typing import Callable, Dict, List

from fastapi import HTTPException, Request, status


def _parse_limit(spec: str) -> tuple[int, float]:
    """Parse strings like '8/minute' -> (8, 60.0)."""
    try:
        count, window = spec.split("/")
        count = int(count)
        window = window.strip().lower()
        seconds = {
            "second": 1,
            "minute": 60,
            "hour": 3600,
            "day": 86400,
        }.get(window.rstrip("s"), 60)
        return count, float(seconds)
    except Exception:
        return 60, 60.0


class SlidingWindowRateLimiter:
    def __init__(self) -> None:
        self._hits: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window: float) -> None:
        now = time.monotonic()
        with self._lock:
            hits = [t for t in self._hits.get(key, []) if now - t < window]
            if len(hits) >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please slow down and try again shortly.",
                )
            hits.append(now)
            self._hits[key] = hits
            # opportunistic cleanup
            if len(self._hits) > 10_000:
                cutoff = now - window
                self._hits = {k: v for k, v in self._hits.items() if v and v[-1] > cutoff}


_limiter = SlidingWindowRateLimiter()


def rate_limit(spec: str, scope: str = "default") -> Callable:
    """FastAPI dependency factory enforcing a per-IP rate limit."""
    limit, window = _parse_limit(spec)

    async def dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        _limiter.check(f"{scope}:{client_ip}", limit, window)

    return dependency
