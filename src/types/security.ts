// =====================================================
// Security Type Definitions
// =====================================================

export type ScanCategory =
  | 'prompt_injection'
  | 'jailbreak'
  | 'data_exposure'
  | 'policy_violation'
  | 'unsafe_behavior'
  | 'other';

export type ScanSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ScanResult {
  id: string;
  input: string;
  category: ScanCategory;
  severity: ScanSeverity;
  summary: string;
  details: string;
  blocked: boolean;
  confidence: number;
  created_at: string;
}

export interface SanitizedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface UserSessionContext {
  userId: string;
  email: string;
  role: 'admin' | 'client';
  expiresAt: string;
}

export interface RateLimitStatus {
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface ProjectSubmission {
  id: string;
  client_id: string;
  service_type: 'ai_red_teaming' | 'secure_ai_agents' | 'ml_hardening' | 'prompt_engineering' | 'consultation';
  github_url: string | null;
  description: string;
  budget_range: string | null;
  timeline: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  company_name: string | null;
  role: 'admin' | 'client';
  created_at: string;
  updated_at: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  details?: ValidationError[];
  status: number;
}
