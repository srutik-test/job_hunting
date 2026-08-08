"""
Transactional email sender (verification & password-reset emails).

When SMTP is not configured (typical for local development), messages are
logged to the application log instead and the caller may surface the action
link in the API response in DEBUG mode.
"""

import logging
from typing import Optional

import aiosmtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("platform.mail")


def smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM)


async def _send(to: str, subject: str, html: str) -> bool:
    if not smtp_configured():
        logger.info(
            "SMTP not configured. Email to %s with subject %r was written to the log:\n%s",
            to, subject, html,
        )
        return False

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content("Please view this message in an HTML-capable client.")
    msg.add_alternative(html, subtype="html")

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            start_tls=settings.SMTP_STARTTLS,
            timeout=20,
        )
        return True
    except Exception as exc:  # pragma: no cover - network dependent
        logger.error("Failed to send email to %s: %s", to, exc)
        return False


def _button_page(title: str, body: str, link: str, cta: str) -> str:
    return f"""
    <html><body style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:32px">
      <div style="max-width:480px;margin:auto;background:#fff;border-radius:12px;
                  padding:32px;border:1px solid #e2e8f0">
        <h2 style="color:#0f172a;margin-top:0">{title}</h2>
        <p style="color:#334155;line-height:1.5">{body}</p>
        <p style="text-align:center;margin:28px 0">
          <a href="{link}" style="background:#2563eb;color:#fff;padding:12px 28px;
             border-radius:8px;text-decoration:none;font-weight:600">{cta}</a>
        </p>
        <p style="color:#94a3b8;font-size:12px;word-break:break-all">
          If the button does not work, open this link: {link}</p>
      </div>
    </body></html>"""


async def send_verification_email(to: str, name: str, link: str) -> bool:
    return await _send(
        to,
        "Verify your email address",
        _button_page(
            "Verify your email",
            f"Hi {name},<br/>confirm this email address to activate your "
            "HR Contact Intelligence account.",
            link,
            "Verify email",
        ),
    )


async def send_password_reset_email(to: str, name: str, link: str) -> bool:
    return await _send(
        to,
        "Reset your password",
        _button_page(
            "Reset your password",
            f"Hi {name},<br/>we received a request to reset your password. "
            "This link expires shortly. If you did not request this, ignore this email.",
            link,
            "Reset password",
        ),
    )
