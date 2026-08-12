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
            to,
            subject,
            html,
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
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f1f5f9;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%);padding:24px 32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:19px;font-weight:700;letter-spacing:-0.5px;">HR Contact Intelligence</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 28px 32px;">
              <h2 style="color:#0f172a;margin-top:0;font-size:20px;font-weight:600;">{title}</h2>
              <p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:28px;">{body}</p>
              
              <div style="text-align:center;margin:32px 0;">
                <a href="{link}" style="display:inline-block;background-color:#2563eb;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 32px;border-radius:8px;box-shadow:0 4px 12px rgba(37,99,235,0.25);">
                  {cta}
                </a>
              </div>
              
              <hr style="border:none;border-top:1px solid #f1f5f9;margin:28px 0;">
              <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:0;">
                If the button above does not work, copy and paste this URL into your browser:<br>
                <a href="{link}" style="color:#2563eb;word-break:break-all;font-size:12px;">{link}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #f1f5f9;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">This link is single-use and will expire in 24 hours.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


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
