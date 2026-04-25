export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" }
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_verified: boolean | null
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_verified?: boolean | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          client_id: string
          title: string
          description: string | null
          status: "pending" | "in_progress" | "review" | "completed" | "cancelled"
          project_type: "ai_red_teaming" | "llm_security_audit" | "secure_agent_development" | "ml_model_hardening" | "prompt_engineering" | "consultation" | "other"
          budget_range: string | null
          deadline: string | null
          progress: number
          github_url: string | null
          demo_url: string | null
          loom_url: string | null
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          title: string
          description?: string | null
          status?: "pending" | "in_progress" | "review" | "completed" | "cancelled"
          project_type: "ai_red_teaming" | "llm_security_audit" | "secure_agent_development" | "ml_model_hardening" | "prompt_engineering" | "consultation" | "other"
          budget_range?: string | null
          deadline?: string | null
          progress?: number
          github_url?: string | null
          demo_url?: string | null
          loom_url?: string | null
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>
        Relationships: []
      }
      project_files: {
        Row: {
          id: string
          project_id: string
          file_name: string
          file_url: string
          file_type: string | null
          file_size: number | null
          uploaded_by: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          file_name: string
          file_url: string
          file_type?: string | null
          file_size?: number | null
          uploaded_by?: string | null
          description?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["project_files"]["Insert"]>
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string | null
          project_id: string | null
          content: string
          is_read: boolean
          attachments: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id?: string | null
          project_id?: string | null
          content: string
          is_read?: boolean
          attachments?: Json | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>
        Relationships: []
      }
      bookings: {
        Row: {
          id: string
          client_id: string
          project_type: "ai_red_teaming" | "llm_security_audit" | "secure_agent_development" | "ml_model_hardening" | "prompt_engineering" | "consultation" | "other"
          title: string
          description: string
          budget_range: string | null
          preferred_start_date: string | null
          urgency: "low" | "normal" | "high" | "urgent"
          status: "pending" | "approved" | "rejected" | "completed"
          admin_response: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          project_type: "ai_red_teaming" | "llm_security_audit" | "secure_agent_development" | "ml_model_hardening" | "prompt_engineering" | "consultation" | "other"
          title: string
          description: string
          budget_range?: string | null
          preferred_start_date?: string | null
          urgency?: "low" | "normal" | "high" | "urgent"
          status?: "pending" | "approved" | "rejected" | "completed"
          admin_response?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>
        Relationships: []
      }
      services: {
        Row: {
          id: string
          name: string
          slug: string
          description: string
          short_description: string | null
          features: Json
          starting_price: number | null
          estimated_duration: string | null
          icon: string | null
          is_active: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description: string
          short_description?: string | null
          features?: Json
          starting_price?: number | null
          estimated_duration?: string | null
          icon?: string | null
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["services"]["Insert"]>
        Relationships: []
      }
      skills: {
        Row: {
          id: string
          name: string
          category: "ai_ml_tools" | "red_teaming_tools" | "programming" | "deployment" | "security" | "other"
          proficiency: number | null
          icon: string | null
          description: string | null
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          category: "ai_ml_tools" | "red_teaming_tools" | "programming" | "deployment" | "security" | "other"
          proficiency?: number | null
          icon?: string | null
          description?: string | null
          display_order?: number
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["skills"]["Insert"]>
        Relationships: []
      }
      showcase_projects: {
        Row: {
          id: string
          title: string
          slug: string
          description: string
          short_description: string | null
          thumbnail_url: string | null
          images: Json
          technologies: Json
          github_url: string | null
          demo_url: string | null
          loom_url: string | null
          category: string | null
          is_featured: boolean
          is_active: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          description: string
          short_description?: string | null
          thumbnail_url?: string | null
          images?: Json
          technologies?: Json
          github_url?: string | null
          demo_url?: string | null
          loom_url?: string | null
          category?: string | null
          is_featured?: boolean
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["showcase_projects"]["Insert"]>
        Relationships: []
      }
      contact_submissions: {
        Row: {
          id: string
          name: string
          email: string
          subject: string
          message: string
          is_read: boolean
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          subject: string
          message: string
          is_read?: boolean
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["contact_submissions"]["Insert"]>
        Relationships: []
      }
      project_submissions: {
        Row: {
          id: string
          client_id: string
          github_url: string | null
          service_type: "ai_red_teaming" | "secure_ai_agents" | "ml_hardening" | "prompt_engineering" | "consultation"
          description: string
          budget_range: string | null
          timeline: string | null
          status: "pending" | "in_progress" | "completed" | "rejected"
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          github_url?: string | null
          service_type: "ai_red_teaming" | "secure_ai_agents" | "ml_hardening" | "prompt_engineering" | "consultation"
          description: string
          budget_range?: string | null
          timeline?: string | null
          status?: "pending" | "in_progress" | "completed" | "rejected"
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["project_submissions"]["Insert"]>
        Relationships: []
      }
      scans: {
        Row: {
          completed_at: string | null
          created_at: string
          finding_count: number
          high_severity_count: number
          id: string
          notes: string | null
          progress_pct: number
          started_at: string | null
          status: "queued" | "probing" | "triage" | "sealed" | "failed"
          target_credential_encrypted: string | null
          target_model: string
          target_url: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          finding_count?: number
          high_severity_count?: number
          id?: string
          notes?: string | null
          progress_pct?: number
          started_at?: string | null
          status?: "queued" | "probing" | "triage" | "sealed" | "failed"
          target_credential_encrypted?: string | null
          target_model: string
          target_url: string
          user_id: string
        }
        Update: Partial<Database["public"]["Tables"]["scans"]["Insert"]>
        Relationships: []
      }
      scan_logs: {
        Row: {
          attack_name: string | null
          created_at: string
          id: number
          payload: Json
          scan_id: string
          severity: "info" | "low" | "medium" | "high" | "critical"
          type: "progress" | "finding" | "attempt" | "audit" | "error" | "info"
        }
        Insert: {
          attack_name?: string | null
          created_at?: string
          id?: number
          payload?: Json
          scan_id: string
          severity?: "info" | "low" | "medium" | "high" | "critical"
          type: "progress" | "finding" | "attempt" | "audit" | "error" | "info"
        }
        Update: Partial<Database["public"]["Tables"]["scan_logs"]["Insert"]>
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["activity_logs"]["Insert"]>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
