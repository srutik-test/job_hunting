export interface CompanyInput {
  name: string;
  location?: string;
  website: string;
  linkedin_url?: string;
}

export interface CompanyUploadPreview {
  total_parsed: number;
  valid_count: number;
  invalid_count: number;
  preview_items: CompanyInput[];
  detected_columns: string[];
  missing_columns: string[];
  warnings: string[];
}

export interface JobProgress {
  id: string;
  status:
    "pending" | "running" | "completed" | "failed" | "cancelled" | "paused";
  total_companies: number;
  processed_companies: number;
  progress_percentage: number;
  current_company_name: string;
  current_page: string;
  pages_crawled_count: number;
  emails_found_count: number;
  profiles_found_count: number;
  started_at?: string;
  completed_at?: string;
  estimated_remaining_seconds: number;
  error_message?: string;
}

export interface JobLog {
  job_id: string;
  level: "INFO" | "WARNING" | "ERROR" | "DEBUG";
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ExtractionResult {
  id: string;
  job_id?: string;
  company_id?: string;
  company_name: string;
  location: string;
  website: string;
  linkedin_url: string;
  hr_email: string;
  recruitment_email: string;
  careers_email: string;
  general_email: string;
  hr_name: string;
  hr_position: string;
  linkedin_profile: string;
  linkedin_profile_url?: string;
  confidence_score: number;
  source: string;
  status: string;
  crawled_pages_count: number;
  raw_details?: {
    company_name?: string;
    website?: string;
    location?: string;
    steps?: {
      crawl?: {
        pages_crawled: number;
        duration_seconds: number;
        sitemap_found: boolean;
        errors: string[];
      };
      search?: {
        queries: string[];
        search_emails_found: number;
        search_profiles_found: number;
      };
    };
    verification?: {
      status: string;
      confidence_score: number;
      best_source: string;
      hr_email_syntax_valid: boolean;
      all_emails_discovered: Array<{
        email: string;
        category: string;
        source_url: string;
        is_generic: boolean;
        confidence_weight: number;
      }>;
      all_profiles_discovered: Array<{
        name: string;
        job_title: string;
        linkedin_profile_url: string;
        source: string;
        confidence: number;
      }>;
      pages_summary: Array<{
        url: string;
        type: string;
        status: number;
        title: string;
        emails_found: string[];
        linkedin_found: string[];
      }>;
    };
  };
  created_at?: string;
}

export interface ResultListResponse {
  items: ExtractionResult[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface GlobalStats {
  total_jobs: number;
  total_companies_processed: number;
  total_verified_hr_emails: number;
  total_recruitment_emails: number;
  total_general_emails: number;
  total_linkedin_profiles: number;
  overall_hr_discovery_rate: number;
  average_confidence_score: number;
  active_job_id?: string;
}
