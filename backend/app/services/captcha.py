"""
CAPTCHA service.

Modes (configured via CAPTCHA_PROVIDER env var):
  none        – verification skipped (NOT recommended outside of tests)
  dev-math    – built-in arithmetic challenge, suitable for local development
  turnstile   – Cloudflare Turnstile
  recaptcha   – Google reCAPTCHA v2/v3
  hcaptcha    – hCaptcha

Provider verification is performed server-side against the vendor's
siteverify endpoint. A captcha answer is NEVER trusted from the client
alone.
"""

import hashlib
import random
import time
from typing import Dict, Optional, Tuple

import httpx

from app.core.config import settings

# In-memory store for dev-math challenges: id -> (answer_hash, expiry)
_challenges: Dict[str, Tuple[str, float]] = {}

_VERIFY_URLS = {
    "turnstile": "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    "recaptcha": "https://www.google.com/recaptcha/api/siteverify",
    "hcaptcha": "https://hcaptcha.com/siteverify",
}


def captcha_config() -> dict:
    """Configuration surfaced to the frontend."""
    return {
        "provider": settings.CAPTCHA_PROVIDER,
        "site_key": settings.CAPTCHA_SITE_KEY
        if settings.CAPTCHA_PROVIDER in ("turnstile", "recaptcha", "hcaptcha")
        else None,
    }


def issue_dev_challenge() -> dict:
    """Create a new dev-math arithmetic challenge."""
    a, b = random.randint(3, 19), random.randint(3, 19)
    op = random.choice(["+", "-", "×"])
    if op == "-":
        question = f"What is {max(a, b)} − {min(a, b)}?"
        answer = abs(a - b)
    elif op == "×":
        question = f"What is {a} × {b}?"
        answer = a * b
    else:
        question = f"What is {a} + {b}?"
        answer = a + b

    import secrets

    challenge_id = secrets.token_urlsafe(24)
    _challenges[challenge_id] = (
        hashlib.sha256(str(answer).encode()).hexdigest(),
        time.time() + 300,  # 5 minute validity
    )
    return {"captcha_id": challenge_id, "question": question}


def _verify_dev_challenge(captcha_id: Optional[str], answer: Optional[str]) -> bool:
    if not captcha_id or answer is None:
        return False
    stored = _challenges.pop(captcha_id, None)
    if not stored:
        return False
    expected_hash, expiry = stored
    if time.time() > expiry:
        return False
    return hashlib.sha256(str(answer).strip().encode()).hexdigest() == expected_hash


async def verify_captcha(
    captcha_token: Optional[str] = None,
    captcha_id: Optional[str] = None,
    captcha_answer: Optional[str] = None,
    remote_ip: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    Verify a CAPTCHA for an abuse-prone endpoint.
    Returns (ok, reason_if_failed).
    """
    mode = settings.CAPTCHA_PROVIDER

    if mode == "none":
        return True, ""

    if mode == "dev-math":
        if _verify_dev_challenge(captcha_id, captcha_answer):
            return True, ""
        return False, "CAPTCHA answer is missing or incorrect."

    if mode in _VERIFY_URLS:
        if not settings.CAPTCHA_SECRET_KEY:
            return False, "CAPTCHA is not configured on the server."
        if not captcha_token:
            return False, "CAPTCHA token is required."
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    _VERIFY_URLS[mode],
                    data={
                        "secret": settings.CAPTCHA_SECRET_KEY,
                        "response": captcha_token,
                        **({"remoteip": remote_ip} if remote_ip else {}),
                    },
                )
            data = resp.json()
            if data.get("success"):
                return True, ""
            return False, "CAPTCHA verification failed."
        except Exception as exc:  # pragma: no cover - network dependent
            return False, f"CAPTCHA verification error: {exc}"

    return False, "Unknown CAPTCHA provider configuration."
