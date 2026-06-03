import os
import threading
import time

from fastapi import Depends, HTTPException, Request, status

from app.deps import get_current_user
from app.models.user import User

_lock = threading.Lock()
_buckets: dict[str, tuple[int, float]] = {}
_prune_counter = 0


def _limit(name: str, default: int) -> int:
    return max(1, int(os.getenv(name, str(default))))


def _window(name: str, default: int) -> int:
    return max(1, int(os.getenv(name, str(default))))


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _prune_stale_buckets(max_age_seconds: int = 3600) -> None:
    now = time.monotonic()
    stale_keys = [
        key for key, (_, window_start) in _buckets.items()
        if now - window_start > max_age_seconds
    ]
    for key in stale_keys:
        _buckets.pop(key, None)


def check_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    global _prune_counter

    now = time.monotonic()

    with _lock:
        count, window_start = _buckets.get(key, (0, now))
        if now - window_start >= window_seconds:
            count = 0
            window_start = now

        count += 1
        _buckets[key] = (count, window_start)

        _prune_counter += 1
        if _prune_counter % 500 == 0:
            _prune_stale_buckets()

        if count > limit:
            retry_after = max(1, int(window_seconds - (now - window_start)))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Muitas requisições. Tente novamente em instantes.",
                headers={"Retry-After": str(retry_after)},
            )


def rate_limit_auth_login(request: Request) -> None:
    check_rate_limit(
        f"auth:login:{get_client_ip(request)}",
        limit=_limit("RATE_LIMIT_LOGIN_MAX", 10),
        window_seconds=_window("RATE_LIMIT_LOGIN_WINDOW", 60),
    )


def rate_limit_auth_register(request: Request) -> None:
    check_rate_limit(
        f"auth:register:{get_client_ip(request)}",
        limit=_limit("RATE_LIMIT_REGISTER_MAX", 5),
        window_seconds=_window("RATE_LIMIT_REGISTER_WINDOW", 60),
    )


def rate_limit_auth_refresh(request: Request) -> None:
    check_rate_limit(
        f"auth:refresh:{get_client_ip(request)}",
        limit=_limit("RATE_LIMIT_REFRESH_MAX", 20),
        window_seconds=_window("RATE_LIMIT_REFRESH_WINDOW", 60),
    )


def rate_limit_chat_user(current_user: User = Depends(get_current_user)) -> User:
    check_rate_limit(
        f"chat:minute:{current_user.id}",
        limit=_limit("RATE_LIMIT_CHAT_MAX", 20),
        window_seconds=_window("RATE_LIMIT_CHAT_WINDOW", 60),
    )
    check_rate_limit(
        f"chat:hour:{current_user.id}",
        limit=_limit("RATE_LIMIT_CHAT_HOURLY_MAX", 100),
        window_seconds=_window("RATE_LIMIT_CHAT_HOURLY_WINDOW", 3600),
    )
    return current_user
