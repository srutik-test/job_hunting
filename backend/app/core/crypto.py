"""
Symmetric encryption for provider API keys stored in the database.

Keys are encrypted with Fernet (AES-128-CBC + HMAC) so the raw secret never
appears in the database dump, logs, or API responses. The encryption key
comes from the ENCRYPTION_KEY environment variable; if unset it is derived
from SECRET_KEY (production deployments MUST set a dedicated ENCRYPTION_KEY).
"""

import base64
import hashlib
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _fernet() -> Fernet:
    if settings.ENCRYPTION_KEY:
        key = settings.ENCRYPTION_KEY.encode()
    else:
        # Deterministic derivation so restarts keep working in dev.
        derived = hashlib.sha256(
            f"provider-key-store::{settings.SECRET_KEY}".encode()
        ).digest()
        key = base64.urlsafe_b64encode(derived)
    return Fernet(key)


def encrypt_secret(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_secret(ciphertext: str) -> Optional[str]:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, ValueError):
        return None


def mask_secret(plain: str) -> str:
    """Display-safe mask such as '…xK9p' – never reveals the key itself."""
    if not plain:
        return ""
    tail = plain[-4:] if len(plain) >= 4 else plain
    return "••••••••" + tail
