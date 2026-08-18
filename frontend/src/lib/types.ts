// ============================================================
// Core domain types for the HR Contact Intelligence platform
// ============================================================

export type SearchStatus =
  | "pending"
  | "processing"
  | "completed"
  | "no_results"
  | "failed"
  | "cancelled";

export type VerificationStatus =
  "verified" | "partially_verified" | "unverified";

export type ContactCategory =
  "verified_hr" | "possible_hr" | "company_email" | "linkedin";

export interface Company {
  id: string;
  name: string;
  website: string;
  location?: string;
  linkedin_url?: string;
  industry?: string;
  created_at?: string;
}

export interface Search {
  id: string;
  user_id?: string;
  company_id: string;
  company?: Company;
  status: SearchStatus;
  progress_pct: number;
  current_step: string;
  pages_crawled: number;
  emails_found: number;
  profiles_found: number;
  summary?: string | null;
  error_message?: string | null;
  discovery_method?: string | null;
  duration_seconds?: number;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
}

export interface SearchLog {
  id: string;
  search_id?: string;
  level: "info" | "success" | "warning" | "error" | string;
  message: string;
  created_at?: string;
}

export interface Contact {
  id: string;
  search_id: string;
  company_id: string;
  name?: string | null;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  source_type: string;
  source_url?: string | null;
  provider_name?: string | null;
  verification_status: VerificationStatus;
  confidence_score: number;
  contact_category: ContactCategory;
  discovery_method: string;
  created_at?: string;
  // Denormalized for display convenience
  company_name?: string;
  company_website?: string;
  company_location?: string;
}

export interface DashboardStats {
  total_companies: number;
  total_searches: number;
  searches_pending: number;
  searches_processing: number;
  searches_completed: number;
  searches_failed: number;
  searches_no_results: number;
  total_contacts: number;
  verified_contacts: number;
  possible_contacts: number;
  company_emails: number;
  linkedin_profiles: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  profile_picture?: string | null;
  auth_provider: string;
  account_status: string;
  is_email_verified: boolean;
  created_at?: string;
  last_login_at?: string;
}

export interface Provider {
  id?: string;
  capability: string;
  provider_key: string;
  display_name: string;
  is_free: boolean;
  configured_via_env?: boolean;
  api_key_masked?: string | null;
  has_api_key?: boolean;
  enabled: boolean;
  status: string;
  status_detail?: string | null;
  last_tested_at?: string | null;
  signup_url?: string | null;
  config?: Record<string, string>;
}

export interface ProviderTestResult {
  ok: boolean;
  provider_key: string;
  message: string;
  latency_ms: number;
  details?: Record<string, unknown>;
}

export interface CaptchaChallenge {
  enabled?: boolean;
  provider: string;
  site_key?: string | null;
  captcha_id?: string | null;
  question?: string | null;
}

// UI label helpers
export const CATEGORY_LABELS: Record<ContactCategory, string> = {
  verified_hr: "Verified HR Email",
  possible_hr: "Possible HR Email",
  company_email: "Company Email",
  linkedin: "HR Profile",
};

export const STATUS_LABELS: Record<SearchStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  no_results: "No Results",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  verified: "Verified",
  partially_verified: "Partial",
  unverified: "Unverified",
};

export const CAPABILITY_LABELS: Record<string, string> = {
  crawler: "Website Crawler",
  email_verifier: "Email Verifier",
  search: "Public Search",
  email_finder: "Email Finder",
  people: "People Search",
};
