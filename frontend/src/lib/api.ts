// ============================================================
// API client for the HR Contact Intelligence platform
// ============================================================

import type {
  CaptchaChallenge,
  Company,
  Contact,
  DashboardStats,
  Provider,
  ProviderTestResult,
  Search,
  SearchLog,
  User,
} from "./types";

const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      (body as { detail?: string }).detail || `HTTP ${res.status}`,
      res.status,
      body,
    );
  }
  return res.json() as Promise<T>;
}

async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      (body as { detail?: string }).detail || `HTTP ${res.status}`,
      res.status,
      body,
    );
  }
}

export const api = {
  // ---- Dashboard
  dashboard(): Promise<DashboardStats> {
    return request("/dashboard");
  },

  // ---- User/Auth
  me(): Promise<User> {
    return request("/auth/me");
  },

  updateProfile(payload: {
    name?: string;
    profile_picture?: string;
  }): Promise<User> {
    return request("/auth/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  login(payload: {
    email: string;
    password: string;
    captcha_id?: string;
    captcha_answer?: string;
    captcha_token?: string;
  }): Promise<User> {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  register(payload: {
    name: string;
    email: string;
    password: string;
    captcha_id?: string;
    captcha_answer?: string;
    captcha_token?: string;
  }): Promise<{ message: string; dev_link?: string }> {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  logout(): Promise<void> {
    return requestVoid("/auth/logout", { method: "POST" });
  },

  forgotPassword(payload: {
    email: string;
    captcha_id?: string;
    captcha_answer?: string;
    captcha_token?: string;
  }): Promise<{ message: string; dev_link?: string }> {
    return request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  resetPassword(payload: {
    token: string;
    new_password: string;
  }): Promise<{ message: string }> {
    return request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  verifyEmail(token: string): Promise<User> {
    return request("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  resendVerification(): Promise<{ message: string; dev_link?: string }> {
    return request("/auth/resend-verification", {
      method: "POST",
    });
  },

  // ---- Captcha
  fetchCaptcha(): Promise<CaptchaChallenge> {
    return request("/auth/captcha/challenge");
  },

  // ---- Searches
  listSearches(status?: string): Promise<Search[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return request(`/searches${q}`);
  },

  getSearch(id: string): Promise<Search> {
    return request(`/searches/${id}`);
  },

  startSearch(
    companies: Array<{
      name: string;
      website: string;
      location?: string;
      linkedin_url?: string;
      industry?: string;
    }>,
  ): Promise<Search[]> {
    return request("/searches", {
      method: "POST",
      body: JSON.stringify({ companies }),
    });
  },

  restartSearch(id: string): Promise<Search> {
    return request(`/searches/${id}/restart`, { method: "POST" });
  },

  cancelSearch(id: string): Promise<Search> {
    return request(`/searches/${id}/cancel`, { method: "POST" });
  },

  deleteSearch(id: string): Promise<void> {
    return requestVoid(`/searches/${id}`, { method: "DELETE" });
  },

  // ---- Bulk upload
  async uploadSearch(file: File): Promise<Search[]> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/searches/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(
        (body as { detail?: string }).detail ||
          `Upload failed: HTTP ${res.status}`,
        res.status,
        body,
      );
    }
    return res.json() as Promise<Search[]>;
  },

  // ---- Logs
  getSearchLogs(searchId: string): Promise<SearchLog[]> {
    return request(`/searches/${searchId}/logs`);
  },

  // ---- Contacts
  listContacts(params?: {
    q?: string;
    category?: string;
    verification_status?: string;
    company_name?: string;
    min_confidence?: number;
    limit?: number;
    offset?: number;
  }): Promise<Contact[]> {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set("q", params.q);
    if (params?.category) searchParams.set("category", params.category);
    if (params?.verification_status)
      searchParams.set("verification_status", params.verification_status);
    if (params?.company_name)
      searchParams.set("company_name", params.company_name);
    if (params?.min_confidence !== undefined && params.min_confidence !== null)
      searchParams.set("min_confidence", String(params.min_confidence));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    const qs = searchParams.toString();
    return request(`/contacts${qs ? `?${qs}` : ""}`);
  },

  getSearchContacts(searchId: string): Promise<Contact[]> {
    return request(`/searches/${searchId}/contacts`);
  },

  deleteContact(id: string): Promise<void> {
    return requestVoid(`/contacts/${id}`, { method: "DELETE" });
  },

  bulkDeleteContacts(
    ids: string[],
  ): Promise<{ ok: boolean; deleted_count: number; message: string }> {
    return request("/contacts/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ contact_ids: ids }),
    });
  },

  async sendToN8nWebhook(
    webhookUrl: string,
    contacts: Contact[],
  ): Promise<{ ok: boolean; message: string }> {
    const payload = {
      event: "outreach_campaign",
      timestamp: new Date().toISOString(),
      total_contacts: contacts.length,
      contacts: contacts.map((c) => ({
        id: c.id,
        company_name: c.company_name,
        company_website: c.company_website,
        company_location: c.company_location,
        name: c.name,
        email: c.email,
        designation: c.designation,
        linkedin_url: c.linkedin_url,
        source_type: c.source_type,
        source_url: c.source_url,
        verification_status: c.verification_status,
        confidence_score: c.confidence_score,
        contact_category: c.contact_category,
        discovery_method: c.discovery_method,
      })),
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Webhook returned HTTP ${res.status}`);
    }

    return {
      ok: true,
      message: `Successfully dispatched ${contacts.length} contact(s) to n8n workflow!`,
    };
  },

  // ---- Companies
  listCompanies(params?: { q?: string; limit?: number }): Promise<Company[]> {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set("q", params.q);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return request(`/companies${qs ? `?${qs}` : ""}`);
  },

  deleteCompany(id: string): Promise<void> {
    return requestVoid(`/companies/${id}`, { method: "DELETE" });
  },

  // ---- Providers
  listProviders(): Promise<Provider[]> {
    return request("/providers");
  },

  saveProvider(
    key: string,
    payload:
      | {
          api_key?: string;
          enabled?: boolean;
          config?: Record<string, string>;
        }
      | Record<string, unknown>,
  ): Promise<Provider> {
    return request(`/providers/${key}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  testProvider(key: string, apiKey?: string): Promise<ProviderTestResult> {
    return request(`/providers/${key}/test`, {
      method: "POST",
      body: JSON.stringify({ api_key: apiKey }),
    });
  },
};

export function exportExcelUrl(
  params?:
    | string
    | {
        search_id?: string;
        category?: string;
        verification_status?: string;
        company_name?: string;
        min_confidence?: number;
        q?: string;
        contact_ids?: string[];
      },
): string {
  if (typeof params === "string") {
    return `${BASE}/export/excel?search_id=${encodeURIComponent(params)}`;
  }
  if (!params) return `${BASE}/export/excel`;
  const searchParams = new URLSearchParams();
  if (params.search_id) searchParams.set("search_id", params.search_id);
  if (params.category) searchParams.set("category", params.category);
  if (params.verification_status)
    searchParams.set("verification_status", params.verification_status);
  if (params.company_name)
    searchParams.set("company_name", params.company_name);
  if (params.min_confidence !== undefined && params.min_confidence !== null)
    searchParams.set("min_confidence", String(params.min_confidence));
  if (params.q) searchParams.set("q", params.q);
  if (params.contact_ids && params.contact_ids.length > 0) {
    searchParams.set("contact_ids", params.contact_ids.join(","));
  }
  const qs = searchParams.toString();
  return `${BASE}/export/excel${qs ? `?${qs}` : ""}`;
}

export function sampleTemplateUrl(): string {
  return `${BASE}/export/template`;
}

export function googleLoginUrl(): string {
  return `${BASE}/auth/google/login`;
}
