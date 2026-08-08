"""
Email verification pipeline (free, local stages).

Stages:
  1. Syntax (RFC 5322 via email-validator, with regex fallback)
  2. Domain validation (resolves via DNS)
  3. MX record validation (domain has mail exchangers)
  4. Optional SMTP handshake probing (ENABLE_SMTP_VERIFICATION)
  5. Optional third-party verifier providers (Hunter etc.) handled elsewhere

`verified` is only returned by a stage that performed an actual check —
we never report a syntactically-valid address as "verified".
"""

import asyncio
import re
import smtplib
from enum import Enum
from typing import Optional

import dns.resolver
import dns.exception

try:
    from email_validator import validate_email, EmailNotValidError

    _HAS_EMAIL_VALIDATOR = True
except ImportError:  # pragma: no cover
    _HAS_EMAIL_VALIDATOR = False

from app.core.config import settings


class VerificationLevel(str, Enum):
    SYNTAX_ONLY = "syntax_only"
    DOMAIN_OK = "domain_ok"
    MX_OK = "mx_ok"
    SMTP_OK = "smtp_ok"
    INVALID = "invalid"
    ERROR = "error"


_BASIC_RE = re.compile(r"^[A-Za-z0-9._%+\-']+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def syntax_valid(email: str) -> bool:
    if not email or "@" not in email or len(email) > 254:
        return False
    if _HAS_EMAIL_VALIDATOR:
        try:
            validate_email(email, check_deliverability=False)
            return True
        except EmailNotValidError:
            return False
        except Exception:
            pass
    return bool(_BASIC_RE.match(email))


def _dns_query(domain: str, rtype: str, lifetime: float = 4.0):
    resolver = dns.resolver.Resolver()
    resolver.lifetime = lifetime
    resolver.timeout = min(3.0, lifetime)
    return resolver.resolve(domain, rtype)


async def domain_resolves(domain: str) -> bool:
    def _check() -> bool:
        for rtype in ("A", "AAAA"):
            try:
                if _dns_query(domain, rtype):
                    return True
            except Exception:
                continue
        return False

    return await asyncio.to_thread(_check)


async def mx_records(domain: str) -> list[str]:
    def _check() -> list[str]:
        hosts: list[str] = []
        try:
            for rdata in _dns_query(domain, "MX"):
                hosts.append(str(rdata.exchange).rstrip("."))
        except dns.exception.DNSException:
            pass
        except Exception:
            pass
        return hosts

    return await asyncio.to_thread(_check)


def _smtp_probe(mx_host: str, domain: str, email: str) -> bool:
    try:
        with smtplib.SMTP(mx_host, 25, timeout=10) as server:
            server.ehlo_or_helo_if_needed()
            server.mail(settings.SMTP_VERIFICATION_FROM)
            code, _ = server.rcpt(email)
            return code in (250, 251, 252)
    except Exception:
        return False


async def smtp_verify(email: str, mx_host: str) -> bool:
    domain = email.split("@")[-1]
    return await asyncio.to_thread(_smtp_probe, mx_host, domain, email)


async def verify_email_local(email: str) -> VerificationLevel:
    """
    Execute the free local verification stages for one address.
    Returns the deepest stage that succeeded.
    """
    email = (email or "").strip().lower()
    if not syntax_valid(email):
        return VerificationLevel.INVALID
    domain = email.split("@")[-1]

    if not await domain_resolves(domain):
        return VerificationLevel.SYNTAX_ONLY

    mx = await mx_records(domain)
    if not mx:
        return VerificationLevel.DOMAIN_OK

    if settings.ENABLE_SMTP_VERIFICATION:
        try:
            if await smtp_verify(email, mx[0]):
                return VerificationLevel.SMTP_OK
            return VerificationLevel.MX_OK  # mailbox probe inconclusive
        except Exception:
            return VerificationLevel.MX_OK

    return VerificationLevel.MX_OK
