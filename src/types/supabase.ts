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
          company_domain: string | null
          company_name: string | null
          company_tag: string | null
          created_at: string | null
          domain_verified: boolean
          domain_token: string | null
          domain_verify_token: string | null
          email: string
          full_name: string | null
          hacker_rank: "RECRUIT" | "HACKER" | "ELITE" | "TRAITOR"
          id: string
          identity_proofed: boolean | null
          is_verified: boolean | null
          phone: string | null
          reputation: number | null
          role: string | null
          signature_at: string | null
          signature_data: string | null
          stripe_customer_id: string | null
          updated_at: string | null
          user_type: "client" | "hacker" | "developer"
          access_level: number
          username: string | null
          phone_verified: boolean
          identity_verified: boolean
          clearance_tier: "pending" | "tactical" | "professional" | "sovereign"
          identity_document_path: string | null
          identity_audit_score: number | null
          identity_audit_status: "none" | "pending" | "passed" | "failed" | "review"
          identity_audit_notes: string | null
          sovereign_pending: boolean
        }
        Insert: {
          avatar_url?: string | null
          company_domain?: string | null
          company_name?: string | null
          company_tag?: string | null
          created_at?: string | null
          domain_verified?: boolean
          domain_token?: string | null
          domain_verify_token?: string | null
          email: string
          full_name?: string | null
          hacker_rank?: "RECRUIT" | "HACKER" | "ELITE" | "TRAITOR"
          id: string
          identity_proofed?: boolean | null
          is_verified?: boolean | null
          phone?: string | null
          reputation?: number | null
          role?: string | null
          signature_at?: string | null
          signature_data?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          user_type?: "client" | "hacker" | "developer"
          access_level?: number
          username?: string | null
          phone_verified?: boolean
          identity_verified?: boolean
          clearance_tier?: "pending" | "tactical" | "professional" | "sovereign"
          identity_document_path?: string | null
          identity_audit_score?: number | null
          identity_audit_status?: "none" | "pending" | "passed" | "failed" | "review"
          identity_audit_notes?: string | null
          sovereign_pending?: boolean
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
          discovery_report: Json | null
          ale_usd: number | null
          social_templates: Json | null
          aegis_zip_b64: string | null
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
          discovery_report?: Json | null
          ale_usd?: number | null
          social_templates?: Json | null
          aegis_zip_b64?: string | null
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
      user_wallets: {
        Row: {
          id: string
          user_id: string
          balance_usd: number
          is_frozen: boolean
          frozen_reason: string | null
          frozen_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          balance_usd?: number
          is_frozen?: boolean
          frozen_reason?: string | null
          frozen_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["user_wallets"]["Insert"]>
        Relationships: []
      }
      bazaar_scripts: {
        Row: {
          id: string
          author_id: string
          name: string
          description: string
          language: "python" | "bash" | "javascript" | "rust"
          tags: string[]
          code: string
          price_usd: number
          is_free: boolean
          purchase_count: number
          revenue_usd: number
          audit_verdict: "pending" | "cleared" | "flagged" | "rejected" | "pending_audit"
          audit_risk_score: number
          audit_findings: Json | null
          audit_reason: string | null
          audited_at: string | null
          is_published: boolean
          is_removed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          author_id: string
          name: string
          description?: string
          language?: "python" | "bash" | "javascript" | "rust"
          tags?: string[]
          code: string
          price_usd?: number
          purchase_count?: number
          revenue_usd?: number
          audit_verdict?: "pending" | "cleared" | "flagged" | "rejected" | "pending_audit"
          audit_risk_score?: number
          audit_findings?: Json | null
          audit_reason?: string | null
          audited_at?: string | null
          is_published?: boolean
          is_removed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["bazaar_scripts"]["Insert"]>
        Relationships: []
      }
      bazaar_purchases: {
        Row: {
          id: string
          script_id: string
          buyer_id: string
          author_id: string
          amount_usd: number
          created_at: string
        }
        Insert: {
          id?: string
          script_id: string
          buyer_id: string
          author_id: string
          amount_usd?: number
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["bazaar_purchases"]["Insert"]>
        Relationships: []
      }
      hacker_repos: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string
          language: string
          tags: string[]
          code: string
          is_public: boolean
          is_archived: boolean
          star_count: number
          version: string
          commit_count: number
          access_level: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          description?: string
          language?: string
          tags?: string[]
          code?: string
          is_public?: boolean
          is_archived?: boolean
          star_count?: number
          version?: string
          commit_count?: number
          access_level?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["hacker_repos"]["Insert"]>
        Relationships: []
      }
      repos: {
        Row: {
          id: string
          owner_id: string
          user_id: string | null
          name: string
          description: string | null
          language: string | null
          tags: string[] | null
          code: string | null
          is_public: boolean
          is_archived: boolean
          star_count: number
          access_level: string | null
          version: string | null
          commit_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          user_id?: string | null
          name: string
          description?: string | null
          language?: string | null
          tags?: string[] | null
          code?: string | null
          is_public?: boolean
          is_archived?: boolean
          star_count?: number
          access_level?: string | null
          version?: string | null
          commit_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["repos"]["Insert"]>
        Relationships: []
      }
      repo_stars: {
        Row: {
          id: string
          repo_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          repo_id: string
          user_id: string
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["repo_stars"]["Insert"]>
        Relationships: []
      }
      repo_files: {
        Row: {
          id: string
          repo_id: string
          user_id: string
          path: string
          name: string
          size_bytes: number
          mime_type: string
          storage_key: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          repo_id: string
          user_id: string
          path: string
          name: string
          size_bytes?: number
          mime_type?: string
          storage_key: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["repo_files"]["Insert"]>
        Relationships: []
      }
      enterprise_api_keys: {
        Row: {
          id: string
          org_id: string
          api_key: string
          plan: "starter" | "professional" | "enterprise" | "admin"
          is_active: boolean
          hit_count: number
          last_hit: string | null
          expires_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          api_key: string
          plan?: "starter" | "professional" | "enterprise" | "admin"
          is_active?: boolean
          hit_count?: number
          last_hit?: string | null
          expires_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["enterprise_api_keys"]["Insert"]>
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          status: "active" | "cancelled" | "past_due" | "trialing"
          plan: "free" | "pro" | "enterprise"
          started_at: string
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?: "active" | "cancelled" | "past_due" | "trialing"
          plan?: "free" | "pro" | "enterprise"
          started_at?: string
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>
        Relationships: []
      }
      promo_codes: {
        Row: {
          id: string
          code: string
          reward_type: string
          target_plan: "startup" | "enterprise"
          scans_to_add: number
          uses_left: number
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          reward_type?: string
          target_plan: "startup" | "enterprise"
          scans_to_add?: number
          uses_left?: number
          expires_at?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["promo_codes"]["Insert"]>
        Relationships: []
      }
      redeemed_codes: {
        Row: {
          id: string
          code_id: string
          user_id: string
          redeemed_at: string
        }
        Insert: {
          id?: string
          code_id: string
          user_id: string
          redeemed_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["redeemed_codes"]["Insert"]>
        Relationships: []
      }
      agent_memories: {
        Row: {
          id: string
          scan_id: string
          user_id: string
          agent_role: "general" | "soldier_payload" | "soldier_recon" | "reporter"
          model_id: string
          thought: string
          tool_call: Json | null
          tool_result: Json | null
          step_index: number
          created_at: string
        }
        Insert: {
          id?: string
          scan_id: string
          user_id: string
          agent_role: "general" | "soldier_payload" | "soldier_recon" | "reporter"
          model_id: string
          thought: string
          tool_call?: Json | null
          tool_result?: Json | null
          step_index?: number
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["agent_memories"]["Insert"]>
        Relationships: []
      }
      target_verifications: {
        Row: {
          id: string
          user_id: string
          target_domain: string
          method: "dns_txt" | "file_upload" | "email_confirm"
          token: string
          verified: boolean
          verified_at: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          target_domain: string
          method: "dns_txt" | "file_upload" | "email_confirm"
          token: string
          verified?: boolean
          verified_at?: string | null
          expires_at?: string
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["target_verifications"]["Insert"]>
        Relationships: []
      }
      bounty_escrow: {
        Row: {
          id: string
          submission_id: string
          user_id: string
          amount_usd: number
          currency: string
          status: "held" | "released" | "refunded" | "pending"
          held_at: string
          released_at: string | null
          release_note: string | null
          processor: string | null
          processor_ref: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          submission_id: string
          user_id: string
          amount_usd?: number
          currency?: string
          status?: "held" | "released" | "refunded" | "pending"
          held_at?: string
          released_at?: string | null
          release_note?: string | null
          processor?: string | null
          processor_ref?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["bounty_escrow"]["Insert"]>
        Relationships: []
      }
      terminal_inputs: {
        Row: {
          id: string
          user_id: string
          session_id: string
          content: string
          consumed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_id: string
          content: string
          consumed?: boolean
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["terminal_inputs"]["Insert"]>
        Relationships: []
      }
      recon_targets: {
        Row: {
          id: string
          user_id: string
          target: string
          status: "queued" | "running" | "done" | "failed"
          surface_map: Json | null
          scan_depth: number
          started_at: string | null
          completed_at: string | null
          error_msg: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          target: string
          status?: "queued" | "running" | "done" | "failed"
          surface_map?: Json | null
          scan_depth?: number
          started_at?: string | null
          completed_at?: string | null
          error_msg?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["recon_targets"]["Insert"]>
        Relationships: []
      }
      scheduled_scans: {
        Row: {
          id: string
          user_id: string
          name: string
          target_model: string
          target_url: string
          target_credential_encrypted: string
          frequency: "daily" | "weekly" | "monthly"
          active: boolean
          last_run_at: string | null
          next_run_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          target_model: string
          target_url: string
          target_credential_encrypted: string
          frequency?: "daily" | "weekly" | "monthly"
          active?: boolean
          last_run_at?: string | null
          next_run_at: string
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["scheduled_scans"]["Insert"]>
        Relationships: []
      }
      user_api_keys: {
        Row: {
          id: string
          user_id: string
          name: string
          key_prefix: string
          key_hash: string
          created_at: string
          last_used_at: string | null
          revoked_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          key_prefix: string
          key_hash: string
          created_at?: string
          last_used_at?: string | null
          revoked_at?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["user_api_keys"]["Insert"]>
        Relationships: []
      }
      intel_messages: {
        Row: {
          id: number
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          content: string
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["intel_messages"]["Insert"]>
        Relationships: []
      }
      missions: {
        Row: {
          id: string
          client_id: string
          title: string
          description: string
          scope: string | null
          budget_credits: number
          required_rank: string
          company_tag: string | null
          domain_verified: boolean
          status: "open" | "in_progress" | "completed" | "cancelled"
          selected_hacker_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          title: string
          description: string
          scope?: string | null
          budget_credits?: number
          required_rank?: string
          company_tag?: string | null
          domain_verified?: boolean
          status?: "open" | "in_progress" | "completed" | "cancelled"
          selected_hacker_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["missions"]["Insert"]>
        Relationships: []
      }
      mission_proposals: {
        Row: {
          id: string
          mission_id: string
          hacker_id: string
          pitch: string
          timeline: string | null
          ask_credits: number
          status: "pending" | "accepted" | "rejected"
          created_at: string
        }
        Insert: {
          id?: string
          mission_id: string
          hacker_id: string
          pitch: string
          timeline?: string | null
          ask_credits?: number
          status?: "pending" | "accepted" | "rejected"
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["mission_proposals"]["Insert"]>
        Relationships: []
      }
      /** Alias for mission_proposals (Stronghold 2.0 naming) */
      mission_applications: {
        Row: Database["public"]["Tables"]["mission_proposals"]["Row"]
        Insert: Database["public"]["Tables"]["mission_proposals"]["Insert"]
        Update: Partial<Database["public"]["Tables"]["mission_proposals"]["Insert"]>
        Relationships: []
      }
      mission_messages: {
        Row: {
          id: string
          mission_id: string
          sender_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          mission_id: string
          sender_id: string
          body: string
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["mission_messages"]["Insert"]>
        Relationships: []
      }
      aegis_rules: {
        Row: {
          id: number
          scan_id: string
          rule_id: string
          pattern: string
          description: string
          action: "block" | "challenge" | "log"
          format: "cloudflare" | "python"
          enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          scan_id: string
          rule_id: string
          pattern: string
          description: string
          action: "block" | "challenge" | "log"
          format?: "cloudflare" | "python"
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["aegis_rules"]["Insert"]>
        Relationships: []
      }
      legal_authorizations: {
        Row: {
          id: string
          user_id: string
          scan_id: string | null
          full_name: string
          ip_address: string
          user_agent: string | null
          intensity: "high" | "nuclear"
          consented: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          scan_id?: string | null
          full_name: string
          ip_address: string
          user_agent?: string | null
          intensity: "high" | "nuclear"
          consented?: boolean
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["legal_authorizations"]["Insert"]>
        Relationships: []
      }
      legal_signatures: {
        Row: {
          id: string
          user_id: string
          signature_data: string
          custody_hash: string
          signed_at: string
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          signature_data: string
          custody_hash: string
          signed_at?: string
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["legal_signatures"]["Insert"]>
        Relationships: []
      }
      platform_transactions: {
        Row: {
          id: string
          buyer_id: string | null
          seller_id: string | null
          script_id: string | null
          amount_usd: number
          platform_fee: number
          author_payout: number
          tx_type: "bazaar_purchase" | "bounty_release" | "top_up" | "refund"
          created_at: string
        }
        Insert: {
          id?: string
          buyer_id?: string | null
          seller_id?: string | null
          script_id?: string | null
          amount_usd?: number
          platform_fee?: number
          author_payout?: number
          tx_type?: "bazaar_purchase" | "bounty_release" | "top_up" | "refund"
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["platform_transactions"]["Insert"]>
        Relationships: []
      }
      verification_otps: {
        Row: {
          id: string
          user_id: string
          phone: string
          code_hash: string
          expires_at: string
          consumed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          phone: string
          code_hash: string
          expires_at: string
          consumed?: boolean
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["verification_otps"]["Insert"]>
        Relationships: []
      }
      scan_reports: {
        Row: {
          id: string
          scan_id: string
          generated_at: string
          generator_model: string
          executive_summary_md: string
          cvss_overall: number
          risk_label: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
          findings: Json
          attack_path: Json
          optimization_suggestions_md: string | null
          owasp_coverage: Json | null
          pdf_storage_key: string | null
          generation_input_tokens: number | null
          generation_output_tokens: number | null
          generation_cost_usd: number | null
          audit_report_md: string | null
          discovery_report: Json | null
          ale_usd: number | null
          social_templates: Json | null
          aegis_zip_b64: string | null
        }
        Insert: {
          id?: string
          scan_id: string
          generated_at?: string
          generator_model?: string
          executive_summary_md: string
          cvss_overall: number
          risk_label: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
          findings?: Json
          attack_path?: Json
          optimization_suggestions_md?: string | null
          owasp_coverage?: Json | null
          pdf_storage_key?: string | null
          generation_input_tokens?: number | null
          generation_output_tokens?: number | null
          generation_cost_usd?: number | null
          audit_report_md?: string | null
          discovery_report?: Json | null
          ale_usd?: number | null
          social_templates?: Json | null
          aegis_zip_b64?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["scan_reports"]["Insert"]>
        Relationships: []
      }
      leads: {
        Row: {
          id: string
          company_name: string
          website_url: string | null
          founder_name: string | null
          email: string | null
          description: string | null
          source: "yc" | "producthunt" | "x" | "manual"
          batch: string | null
          rank: "Recruit" | "Lieutenant" | "Admiral"
          scare_hook: string | null
          vulnerability: string | null
          subject_line: string | null
          status: "new" | "emailed" | "clicked" | "responded" | "converted" | "bounced" | "unsubscribed"
          click_token: string
          created_at: string
          emailed_at: string | null
          clicked_at: string | null
          responded_at: string | null
          resend_msg_id: string | null
        }
        Insert: {
          id?: string
          company_name: string
          website_url?: string | null
          founder_name?: string | null
          email?: string | null
          description?: string | null
          source?: "yc" | "producthunt" | "x" | "manual"
          batch?: string | null
          rank?: "Recruit" | "Lieutenant" | "Admiral"
          scare_hook?: string | null
          vulnerability?: string | null
          subject_line?: string | null
          status?: "new" | "emailed" | "clicked" | "responded" | "converted" | "bounced" | "unsubscribed"
          click_token?: string
          created_at?: string
          emailed_at?: string | null
          clicked_at?: string | null
          responded_at?: string | null
          resend_msg_id?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>
        Relationships: []
      }
    }
    Views: Record<string, { Row: Record<string, unknown>; Relationships: never[] }>
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      increment_wallet: {
        Args: { p_user_id: string; p_amount: number }
        Returns: undefined
      }
      increment_purchase: {
        Args: { p_script_id: string; p_revenue: number }
        Returns: undefined
      }
      freeze_wallet: {
        Args: { p_user_id: string; p_reason?: string }
        Returns: undefined
      }
    }
    Enums: Record<string, string>
    CompositeTypes: Record<string, Record<string, unknown>>
  }
}

// Convenience row-type aliases
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
export type ScanRow = Database["public"]["Tables"]["scans"]["Row"]
export type ActivityLogRow = Database["public"]["Tables"]["activity_logs"]["Row"]
export type WalletRow = Database["public"]["Tables"]["user_wallets"]["Row"]
export type BazaarScriptRow = Database["public"]["Tables"]["bazaar_scripts"]["Row"]
export type HackerRepoRow = Database["public"]["Tables"]["hacker_repos"]["Row"]
export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"]
export type AegisRuleRow = Database["public"]["Tables"]["aegis_rules"]["Row"]
export type MissionRow = Database["public"]["Tables"]["missions"]["Row"]
export type MissionProposalRow = Database["public"]["Tables"]["mission_proposals"]["Row"]
