# Google OAuth 2.0 Setup Guide

This guide walks you through configuring **Google Sign-In & Sign-Up** for **HR Contact Intelligence**.

---

## 1. Credentials Needed

To enable Google OAuth on the platform, you need two credentials from the **Google Cloud Console**:

| Variable | Description | Example |
|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID | `1234567890-abcdefg.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret | `GOCSPX-abc123def456` |

These are set in your backend `.env` file located at `backend/.env`.

---

## 2. Step-by-Step Setup in Google Cloud Console

### Step 1: Create or Select a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown at the top and select **New Project**.
3. Name your project (e.g. `HR-Contact-Intelligence`) and click **Create**.

---

### Step 2: Configure the OAuth Consent Screen
1. In the left navigation menu, go to **APIs & Services** → **OAuth consent screen**.
2. Select **External** user type and click **Create**.
3. Fill in the required application details:
   - **App name**: `HR Contact Intelligence`
   - **User support email**: Your email address.
   - **Developer contact information**: Your email address.
4. Click **Save and Continue**.
5. Under **Scopes**, click **Add or Remove Scopes** and select:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
6. Click **Save and Continue**.
7. Under **Test Users**, add your own Google email address (if keeping the app in Testing mode).
8. Click **Save and Continue**.

---

### Step 3: Create OAuth 2.0 Client Credentials
1. In the left navigation menu, go to **APIs & Services** → **Credentials**.
2. Click **+ Create Credentials** → **OAuth client ID**.
3. In the **Application type** dropdown, select **Web application**.
4. Set the **Name** (e.g. `HR Contact Intelligence Web Client`).
5. Under **Authorized JavaScript origins**, add:
   ```text
   http://localhost:3000
   http://localhost:8000
   https://your-production-domain.com
   ```
6. Under **Authorized redirect URIs**, add the exact backend callback URL:
   ```text
   http://localhost:8000/api/v1/auth/google/callback
   http://127.0.0.1:8000/api/v1/auth/google/callback
   https://your-backend-api.com/api/v1/auth/google/callback
   ```
7. Click **Create**.
8. A modal will appear displaying your **Client ID** and **Client Secret**.

---

### Step 4: Add Credentials to Backend `.env`

Open `backend/.env` (or project root `.env`) and paste your keys:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here

# Frontend and Backend URLs
BACKEND_PUBLIC_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

---

## 3. How the Authentication Flow Works

```
1. User clicks "Continue with Google" on Login or Register
                │
                ▼
2. GET /api/v1/auth/google/login (generates signed JWT state & redirects to Google)
                │
                ▼
3. User logs in on Google & grants email/profile permissions
                │
                ▼
4. Google redirects to: http://localhost:8000/api/v1/auth/google/callback?code=...
                │
                ▼
5. Backend verifies ID token, upserts User record, and sets secure auth cookie
                │
                ▼
6. Redirects to Frontend: http://localhost:3000/login?oauth=success -> Home Dashboard
```

---

## 4. Testing & Verification

1. Restart your backend server (`uvicorn app.main:app --reload`).
2. Open `http://localhost:3000/login` or `http://localhost:3000/register`.
3. Click **"Continue with Google"** / **"Sign up with Google"**.
4. Choose your Google account.
5. You will be authenticated immediately and redirected into the dashboard!
