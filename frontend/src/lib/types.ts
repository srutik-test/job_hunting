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

export type VerificationStatus = "verified" | "partially_verified" | "unverified";

export type ContactCategory =
  | "verified_hr"
  | "possible_hr"
  | "company_email"
  | "linkedin";

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
  user_id: string;
  company_id: string;
  company?: Company;
  status: SearchStatus;
  progress_pct: number;
  current_step: string;
  pages_crawled: number;
  emails_found: number;
  profiles_found: number;
  summary?: string;
  error_message?: string;
  discovery_method?: string;
  duration_seconds?: number;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
}

export interface SearchLog {
  id: string;
  search_id: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  created_at?: string;
}

export interface Contact {
  id: string;
  search_id: string;
  company_id: string;
  name?: string;
  designation?: string;
  email?: string;
  linkedin_url?: string;
  source_type: string;
  source_url?: string;
  provider_name?: string;
  verification_status: VerificationStatus;
  confidence_score: number;
  contact_category: ContactCategory;
  discovery_method: string;
  created_at?: string;
  // Denormalized for display convenience
  company_name?: string;
}

export interface DashboardStats {
  total_companies: number;
  verified_contacts: number;
  possible_contacts: number;
  company_emails: number;
  linkedin_profiles: number;
  total_searches: number;
  searches_no_results: number;
  searches_failed: number;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  profile_picture?: string | null;
  auth_provider?: string;
  account_status?: string;
  is_email_verified?: boolean;
  created_at?: string;
}

export interface Provider {
  id: string;
  name: string;
  key: string;
  provider_key?: string;
  capability: string;
  api_key_configured: boolean;
  api_key_hint?: string;
  enabled: boolean;
  config?: Record<string, string>;
}

export interface ProviderTestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface CaptchaChallenge {
  id: string;
  image_url: string;
  expires_at?: string;
  provider?: string;
  site_key?: string;
  question?: string;
  enabled?: boolean;
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
