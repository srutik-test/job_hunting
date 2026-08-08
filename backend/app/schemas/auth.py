"""Authentication request/response schemas."""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class CaptchaChallenge(BaseModel):
    enabled: bool = True
    provider: str = "dev-math"               # none | dev-math | turnstile | recaptcha | hcaptcha
    site_key: Optional[str] = None           # for client-rendered widgets
    captcha_id: Optional[str] = None         # for dev-math flow
    question: Optional[str] = None           # for dev-math flow


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    captcha_id: Optional[str] = None
    captcha_answer: Optional[str] = None
    captcha_token: Optional[str] = None      # provider-verified token


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    captcha_id: Optional[str] = None
    captcha_answer: Optional[str] = None
    captcha_token: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    message: str
    # In development (no SMTP configured) the platform surfaces the action
    # link here so flows can be tested end to end.
    dev_link: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    captcha_id: Optional[str] = None
    captcha_answer: Optional[str] = None
    captcha_token: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    token: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    profile_picture: Optional[str] = None
    auth_provider: str
    is_email_verified: bool
    account_status: str
    created_at: Optional[str] = None
    last_login_at: Optional[str] = None
