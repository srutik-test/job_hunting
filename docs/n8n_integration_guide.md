# n8n Email Outreach Workflow Integration Guide

This guide explains how to connect **HR Contact Intelligence** with your **n8n automated workflow (deployed on Railway or self-hosted)** to send email outreach campaigns to discovered and verified HR contacts.

---

## 1. Overview of the Integration

When you select contacts on the **All Contacts** page and click **"Send to n8n Workflow"**, the platform dispatches a clean, structured `POST` HTTP request to your n8n Webhook endpoint containing all selected contact records and company metadata.

```
[HR Contact Intelligence Platform]
                │
                │ (HTTP POST with JSON payload)
                ▼
      [n8n Webhook Node (Railway)]
                │
                ├─────────────────────────────────────────┐
                ▼                                         ▼
   [Google Sheets Node]                         [Email Dispatch Node]
 (Append contacts for records)                 (Gmail / Outlook / SendGrid / SMTP)
                                               (Send personalized HR pitch)
```

---

## 2. Webhook Payload Schema

Your n8n webhook receives a JSON body formatted as follows:

```json
{
  "event": "outreach_campaign",
  "timestamp": "2026-08-10T23:50:00Z",
  "total_contacts": 2,
  "contacts": [
    {
      "id": "c122de92-681f-4f1b-a102-1efd18d8c5b0",
      "company_name": "Aspiresoftserv Pvt Ltd",
      "company_website": "https://www.aspiresoftserv.com",
      "company_location": "Ahmedabad, India",
      "name": "Priya Sharma",
      "email": "careers@aspiresoftserv.com",
      "designation": "Talent Acquisition Lead",
      "linkedin_url": "https://www.linkedin.com/in/priya-sharma",
      "source_type": "company_website",
      "source_url": "https://www.aspiresoftserv.com/contact-us",
      "verification_status": "verified",
      "confidence_score": 95,
      "contact_category": "verified_hr",
      "discovery_method": "website_crawl"
    }
  ]
}
```

---

## 3. Setting Up the Webhook Node in n8n

1. Open your **n8n instance on Railway**.
2. Click **Create New Workflow**.
3. Add a **Webhook** node:
   - **HTTP Method**: `POST`
   - **Path**: `hr-outreach` (or any custom slug, e.g. `send-hr-emails`)
   - **Authentication**: `None` or `Header Auth` (optional)
   - **Response Mode**: `When Last Node Finishes` (or `Immediately`)
4. Copy the **Production Webhook URL** (e.g. `https://n8n-production-xxxx.up.railway.app/webhook/hr-outreach`).

---

## 4. Connecting n8n to Google Sheets & Email Dispatch

### Step 4.1: Split Out Contacts (Item Lists)
Add an **Item Lists** node (or Code node) to iterate through the array:
- **Operation**: `Split Out Items`
- **Field to Split Out**: `body.contacts`

### Step 4.2: Append to Google Sheets (Optional)
Add a **Google Sheets** node:
- **Operation**: `Append Row`
- Map the fields:
  - `Company`: `{{ $json.company_name }}`
  - `Name`: `{{ $json.name }}`
  - `Email`: `{{ $json.email }}`
  - `Designation`: `{{ $json.designation }}`
  - `LinkedIn`: `{{ $json.linkedin_url }}`
  - `Confidence`: `{{ $json.confidence_score }}%`

### Step 4.3: Send Email (Gmail / Outlook / SMTP)
Add an **Email** node (e.g. Gmail / SendGrid / Custom SMTP):
- **To**: `{{ $json.email }}`
- **Subject**: `Job Application / Introduction — {{ $json.name || "Hiring Team" }} at {{ $json.company_name }}`
- **Body**:
  ```text
  Hi {{ $json.name ? $json.name.split(' ')[0] : 'Team' }},

  I came across {{ $json.company_name }} and wanted to reach out regarding potential opportunities in your team.

  [Your Personalized Pitch / Resume Link]

  Best regards,
  [Your Name]
  ```

---

## 5. Saving Your Webhook URL in the Platform

1. In the platform, go to **Settings** → **Account & Integrations**.
2. Scroll to **n8n Webhook Configuration**.
3. Paste your Railway Webhook URL:
   ```
   https://n8n-production-xxxx.up.railway.app/webhook/hr-outreach
   ```
4. Click **Save & Test Connection**.
5. Navigate to **All Contacts**, select contacts with the checkboxes, and click **Send to n8n Workflow**!
