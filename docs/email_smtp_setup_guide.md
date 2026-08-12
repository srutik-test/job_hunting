# Email Confirmation & SMTP Setup Guide

This guide explains how **Email Confirmation & Password Reset** works in **HR Contact Intelligence**, how to configure SMTP (such as Gmail, Brevo, SendGrid, Resend, or Outlook), and provides a full code breakdown.

---

## 1. How the Confirmation Email Flow Works

```
1. User registers with Name, Email & Password on /register
                 │
                 ▼
2. Backend creates User with `is_email_verified = False` and `account_status = "pending"`
                 │
                 ▼
3. Backend generates a signed JWT verification token & records hash in `auth_tokens` table
                 │
                 ▼
4. Backend builds Confirmation Link:
   http://localhost:3000/verify-email?token=<signed_jwt_token>
                 │
                 ▼
5. Is SMTP configured in .env?
   ├─► YES: aiosmtplib sends styled HTML confirmation email directly to user's inbox.
   └─► NO (Dev mode): URL is logged to backend console and surfaced on screen in a yellow box.
                 │
                 ▼
6. User clicks the button/URL in email -> Opens /verify-email?token=...
                 │
                 ▼
7. Frontend calls POST /api/v1/auth/verify-email -> Backend marks `is_email_verified = True`
   and sets `account_status = "active"`, issuing an authenticated session cookie.
```

---

## 2. SMTP Setup Guide (Step-by-Step)

### Option A: Free Gmail SMTP (Recommended for Personal/Testing)

Gmail allows you to send transactional emails using an **App Password**:

1. Open your **Google Account** (https://myaccount.google.com/).
2. Go to the **Security** tab.
3. Under *"How you sign in to Google"*, ensure **2-Step Verification** is turned **ON**.
4. Search for **"App passwords"** in the top search bar (or go to https://myaccount.google.com/apppasswords).
5. Enter an app name (e.g. `HR Platform Mailer`) and click **Create**.
6. Google will display a **16-character password** (e.g. `abcd efgh ijkl mnop`).
7. Copy this 16-character password (without spaces).
8. Open your `.env` (and `backend/.env`) and configure:

```env
# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_gmail_address@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
SMTP_FROM=your_gmail_address@gmail.com
SMTP_STARTTLS=true
```

---

### Option B: Brevo / Sendinblue (Recommended for Production / 300 free emails/day)

1. Sign up at [https://www.brevo.com](https://www.brevo.com).
2. Go to **Settings** → **SMTP & API**.
3. Under **SMTP**, copy your login and generate an SMTP Key.
4. Add to `.env`:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USERNAME=your_brevo_login_email
SMTP_PASSWORD=your_brevo_smtp_key
SMTP_FROM=your_verified_sender@domain.com
SMTP_STARTTLS=true
```

---

### Option C: Resend / SendGrid / Mailgun

#### Resend:
```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USERNAME=resend
SMTP_PASSWORD=re_123456789...
SMTP_FROM=onboarding@resend.dev
SMTP_STARTTLS=true
```

#### SendGrid:
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=SG.your_sendgrid_api_key...
SMTP_FROM=your_verified_sender@domain.com
SMTP_STARTTLS=true
```

---

## 3. Environment Variables Reference

| Variable | Description | Example |
|---|---|---|
| `SMTP_HOST` | Hostname of SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | Port (usually 587 for TLS, 465 for SSL) | `587` |
| `SMTP_USERNAME` | SMTP account username / email | `user@example.com` |
| `SMTP_PASSWORD` | SMTP password or App Password | `app_password_here` |
| `SMTP_FROM` | Sender address appearing in "From:" | `no-reply@yourdomain.com` |
| `SMTP_STARTTLS` | Use STARTTLS encryption | `true` |
| `FRONTEND_URL` | Base URL used to build the verification link | `http://localhost:3000` |
| `EMAIL_VERIFICATION_EXPIRE_MINUTES` | Link validity duration | `1440` (24 hours) |

---

## 4. Key Code Implementation

### A. The Mailer Service (`backend/app/services/mailer.py`)

Sends asynchronously via `aiosmtplib` with a styled responsive HTML template:

```python
async def send_verification_email(to: str, name: str, link: str) -> bool:
    return await _send(
        to,
        "Verify your email address",
        _button_page(
            "Verify your email",
            f"Hi {name},<br/>confirm this email address to activate your account.",
            link,
            "Verify email",
        ),
    )
```

### B. The Registration Endpoint (`backend/app/api/endpoints/auth.py`)

Generates the single-use token and sends the verification email:

```python
token = create_email_verification_token(user.id)
db.add(AuthToken(
    user_id=user.id,
    purpose="verify-email",
    token_hash=token_fingerprint(token),
    expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES),
))
await db.commit()

link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
sent = await mailer.send_verification_email(user.email, user.name, link)
```

### C. The Verification Endpoint (`backend/app/api/endpoints/auth.py`)

Verifies the cryptographic signature and activates the account:

```python
@router.post("/verify-email", response_model=UserPublic)
async def verify_email(payload: VerifyEmailRequest, response: Response, db: AsyncSession = Depends(get_db)):
    data = decode_token(payload.token, "verify-email")
    if not data:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link.")
    
    # Marks user as verified and active
    user.is_email_verified = True
    user.account_status = "active"
    ...
```

---

## 5. Testing & Verification

1. Set your SMTP credentials in `.env` and `backend/.env`.
2. Restart backend:
   ```bash
   cd backend
   uvicorn app.main:app --reload --port 8000
   ```
3. Check health status at [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health) (will show `"smtp": true`).
4. Register a new user at [http://localhost:3000/register](http://localhost:3000/register).
5. Open your email inbox and click the **Verify Email** button!
