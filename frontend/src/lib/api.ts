// ============================================================
// API client for the HR Contact Intelligence platform
// ============================================================

import type {
  Company,
  Contact,
  DashboardStats,
  Provider,
  ProviderTestResult,
  Search,
  SearchLog,
  User,
} from "./types";

const BASE = "/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown
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
      body
    );
  }
  return res.json() as Promise<T>;
}

async function requestText(path: string, init?: RequestInit): Promise<string> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return res.text();
}

async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail || `HTTP ${res.status}`);
  }
}

export const api = {
  // ---- Dashboard
  dashboard(): Promise<DashboardStats> {
    return request("/endpoints/dashboard");
  },

  // ---- User/Auth
  me(): Promise<User> {
    return request("/endpoints/auth/me");
  },

  login(email: string, password: string): Promise<User> {
    return request("/endpoints/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  register(
    email: string,
    password: string,
    confirm_password: string
  ): Promise<{ message?: string; dev_link?: string }> {
    return request("/endpoints/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, confirm_password }),
    });
  },

  logout(): Promise<void> {
    return requestVoid("/endpoints/auth/logout", { method: "POST" });
  },

  forgotPassword(
    email: string,
    captcha_id?: string,
    captcha_answer?: string,
    captcha_token?: string
  ): Promise<{ message?: string; dev_link?: string }> {
    return request("/endpoints/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email, captcha_id, captcha_answer, captcha_token }),
    });
  },

  resetPassword(token: string, password: string): Promise<User> {
    return request("/endpoints/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  },

  verifyEmail(token: string): Promise<void> {
    return requestVoid("/endpoints/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  resendVerification(): Promise<void> {
    return requestVoid("/endpoints/auth/resend-verification", { method: "POST" });
  },

  // ---- Searches
  listSearches(): Promise<Search[]> {
    return request("/endpoints/searches");
  },

  getSearch(id: string): Promise<Search> {
    return request(`/endpoints/searches/${id}`);
  },

  startSearch(
    companies: Array<{
      name: string;
      website: string;
      location?: string;
      linkedin_url?: string;
      industry?: string;
    }>
  ): Promise<Search[]> {
    return request("/endpoints/searches", {
      method: "POST",
      body: JSON.stringify({ companies }),
    });
  },

  cancelSearch(id: string): Promise<Search> {
    return request(`/endpoints/searches/${id}/cancel`, { method: "POST" });
  },

  // ---- Contacts
  listContacts(): Promise<Contact[]> {
    return request("/endpoints/contacts");
  },

  getSearchContacts(searchId: string): Promise<Contact[]> {
    return request(`/endpoints/searches/${searchId}/contacts`);
  },

  // ---- Logs
  getSearchLogs(searchId: string): Promise<SearchLog[]> {
    return request(`/endpoints/searches/${searchId}/logs`);
  },

  // ---- Providers
  listProviders(): Promise<Provider[]> {
    return request("/endpoints/providers");
  },

  saveProvider(
    key: string,
    apiKey: string,
    enabled: boolean,
    config?: Record<string, string>
  ): Promise<Provider> {
    return request(`/endpoints/providers/${key}`, {
      method: "PUT",
      body: JSON.stringify({ api_key: apiKey, enabled, config }),
    });
  },

  testProvider(key: string): Promise<ProviderTestResult> {
    return request(`/endpoints/providers/${key}/test`, { method: "POST" });
  },

  // ---- Captcha
  fetchCaptcha(): Promise<{ id: string; image_url: string }> {
    return request("/endpoints/auth/captcha");
  },

  // ---- Bulk upload
  async uploadSearch(file: File): Promise<void> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/endpoints/export/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { detail?: string }).detail || `Upload failed: HTTP ${res.status}`);
    }
  },
};

export function exportExcelUrl(searchId: string): string {
  return `${BASE}/endpoints/export/search/${searchId}/excel`;
}

export function sampleTemplateUrl(): string {
  return `${BASE}/endpoints/export/sample-template`;
}

export function googleLoginUrl(): string {
  return `${BASE}/endpoints/auth/google`;
}
