// =====================================================
// ForgeGuard AI - TypeScript Type Definitions
// =====================================================

// User & Profile Types
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: 'admin' | 'client';
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  user: Profile | null;
  isLoading: boolean;
}

// Project Types
export type ProjectStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled';
export type ProjectType = 
  | 'ai_red_teaming' 
  | 'llm_security_audit' 
  | 'secure_agent_development' 
  | 'ml_model_hardening' 
  | 'prompt_engineering' 
  | 'consultation' 
  | 'other';

export interface Project {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  project_type: ProjectType;
  budget_range: string | null;
  deadline: string | null;
  progress: number;
  github_url: string | null;
  demo_url: string | null;
  loom_url: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  files?: ProjectFile[];
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  description: string | null;
  created_at: string;
}

// Project Submission Types (Client Requests)
export type SubmissionStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';
export type ServiceType = 'ai_red_teaming' | 'secure_ai_agents' | 'ml_hardening' | 'prompt_engineering' | 'consultation';

export interface ProjectSubmission {
  id: string;
  client_id: string;
  github_url: string | null;
  service_type: ServiceType;
  description: string;
  budget_range: string | null;
  timeline: string | null;
  status: SubmissionStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  client?: Profile;
}

// Message Types
export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  project_id: string | null;
  content: string;
  is_read: boolean;
  attachments: Record<string, unknown> | null;
  created_at: string;
  sender?: Profile;
}

// Booking Types
export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export type UrgencyLevel = 'low' | 'normal' | 'high' | 'urgent';

export interface Booking {
  id: string;
  client_id: string;
  project_type: ProjectType;
  title: string;
  description: string;
  budget_range: string | null;
  preferred_start_date: string | null;
  urgency: UrgencyLevel;
  status: BookingStatus;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
}

// Service Types
export interface Service {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description: string | null;
  features: string[];
  starting_price: number | null;
  estimated_duration: string | null;
  icon: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Skill Types
export type SkillCategory = 
  | 'ai_ml_tools' 
  | 'red_teaming_tools' 
  | 'programming' 
  | 'deployment' 
  | 'security' 
  | 'other';

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  proficiency: number;
  icon: string | null;
  description: string | null;
  display_order: number;
  created_at: string;
}

// Showcase Project Types
export interface ShowcaseProject {
  id: string;
  title: string;
  slug: string;
  description: string;
  short_description: string | null;
  thumbnail_url: string | null;
  images: string[];
  technologies: string[];
  github_url: string | null;
  demo_url: string | null;
  loom_url: string | null;
  category: string | null;
  is_featured: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Contact Form Types
export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  is_read: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Activity Log Types
export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// Chat Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

// Demo Types
export interface PromptInjectionTest {
  id: string;
  prompt: string;
  isMalicious: boolean;
  category: string;
  description: string;
}

export interface DemoResult {
  input: string;
  threatDetected: boolean;
  confidence: number;
  category: string | null;
  explanation: string;
}

// Form Types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignupFormData {
  email: string;
  password: string;
  full_name: string;
  company_name?: string;
}

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface BookingFormData {
  project_type: ProjectType;
  title: string;
  description: string;
  budget_range?: string;
  preferred_start_date?: string;
  urgency: UrgencyLevel;
}

// Navigation Types
export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

// Stats Types
export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  unreadMessages: number;
  pendingBookings: number;
}

// API Response Types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// Realtime Event Types
export interface RealtimeMessageEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Message;
  old_record: Message | null;
}

export interface RealtimeProjectEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Project;
  old_record: Project | null;
}

export * from './security';
