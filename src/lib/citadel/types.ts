/** Citadel compartment types — Compartment Zero */

export const DEFAULT_COMPARTMENT_ID =
  "00000000-0000-4000-8000-000000000001" as const;

export type AgencyRole = "commander" | "analyst" | "viewer";

export type CaseStatus = "open" | "active" | "closed" | "archived";
export type CasePriority = "low" | "medium" | "high" | "critical";

export type EntityType =
  | "domain"
  | "subdomain"
  | "ip"
  | "email"
  | "url"
  | "hash"
  | "org"
  | "person";

export type TaskStatus = "pending" | "in_progress" | "done" | "cancelled";

export interface AgencyCompartment {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface AgencyMember {
  id: string;
  compartment_id: string;
  user_id: string;
  role: AgencyRole;
  invited_by: string | null;
  created_at: string;
}

export interface AgencyCase {
  id: string;
  compartment_id: string;
  title: string;
  status: CaseStatus;
  priority: CasePriority;
  target_domain: string | null;
  created_by: string;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgencyEntity {
  id: string;
  compartment_id: string;
  case_id: string | null;
  entity_type: EntityType;
  value: string;
  source: string;
  confidence: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgencyLink {
  id: string;
  compartment_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship: string;
  created_at: string;
}

export interface AgencyWatchlist {
  id: string;
  compartment_id: string;
  name: string;
  created_by: string;
  last_run_at: string | null;
  created_at: string;
}

export interface AgencyWatchlistItem {
  id: string;
  watchlist_id: string;
  entity_id: string | null;
  raw_value: string;
  created_at: string;
}

export interface AgencyTask {
  id: string;
  compartment_id: string;
  case_id: string | null;
  title: string;
  status: TaskStatus;
  assignee_id: string | null;
  due_at: string | null;
  created_at: string;
}

export interface AgencyAuditEvent {
  id: string;
  compartment_id: string;
  actor_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface AgencyCaseNote {
  id: string;
  case_id: string;
  author_id: string;
  body_md: string;
  created_at: string;
  updated_at: string;
}

export interface LeadRow {
  id: string;
  company_name: string;
  website_url: string | null;
  founder_name: string | null;
  email: string | null;
  status: string;
  rank: string;
  source: string;
  created_at: string;
}

export interface FusionDashboardData {
  compartment: AgencyCompartment | null;
  member: AgencyMember | null;
  cases: AgencyCase[];
  entities: AgencyEntity[];
  tasks: AgencyTask[];
  watchlists: AgencyWatchlist[];
  auditEvents: AgencyAuditEvent[];
  leadsCount: number;
}

export interface ExtractedEntity {
  entity_type: EntityType;
  value: string;
  source: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface EntityUpsertRow {
  compartment_id: string;
  case_id: string | null;
  entity_type: EntityType;
  value: string;
  source: string;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface EntityLinkRow {
  compartment_id: string;
  source_value: string;
  target_value: string;
  relationship: string;
}
