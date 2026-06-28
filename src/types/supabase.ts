export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
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
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_rank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "visible_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action_taken: string | null
          admin_id: string | null
          created_at: string | null
          id: string
          reason: string | null
          target_user_id: string | null
        }
        Insert: {
          action_taken?: string | null
          admin_id?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_taken?: string | null
          admin_id?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      aegis_firewall_rules: {
        Row: {
          blocked_pattern: string
          client_id: string | null
          created_at: string | null
          id: string
          rule_description: string | null
          scan_id: string | null
        }
        Insert: {
          blocked_pattern: string
          client_id?: string | null
          created_at?: string | null
          id?: string
          rule_description?: string | null
          scan_id?: string | null
        }
        Update: {
          blocked_pattern?: string
          client_id?: string | null
          created_at?: string | null
          id?: string
          rule_description?: string | null
          scan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aegis_firewall_rules_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      aegis_rules: {
        Row: {
          action: string | null
          app_id: string | null
          cloudflare_rule_id: string | null
          created_at: string | null
          description: string | null
          enabled: boolean
          finding_id: string | null
          format: string
          id: string
          is_active: boolean | null
          pattern: string | null
          pattern_to_block: string | null
          rule_content: string | null
          rule_id: string | null
          rule_name: string | null
          scan_id: string | null
          updated_at: string
          user_id: string | null
          verified_blocks_attack: boolean | null
        }
        Insert: {
          action?: string | null
          app_id?: string | null
          cloudflare_rule_id?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean
          finding_id?: string | null
          format?: string
          id?: string
          is_active?: boolean | null
          pattern?: string | null
          pattern_to_block?: string | null
          rule_content?: string | null
          rule_id?: string | null
          rule_name?: string | null
          scan_id?: string | null
          updated_at?: string
          user_id?: string | null
          verified_blocks_attack?: boolean | null
        }
        Update: {
          action?: string | null
          app_id?: string | null
          cloudflare_rule_id?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean
          finding_id?: string | null
          format?: string
          id?: string
          is_active?: boolean | null
          pattern?: string | null
          pattern_to_block?: string | null
          rule_content?: string | null
          rule_id?: string | null
          rule_name?: string | null
          scan_id?: string | null
          updated_at?: string
          user_id?: string | null
          verified_blocks_attack?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "aegis_rules_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      aegis_shield_rules: {
        Row: {
          action: string
          app_id: string
          blocked_pattern: string
          client_id: string | null
          created_at: string | null
          description: string
          enabled: boolean
          finding_id: string | null
          id: string
          is_active: boolean | null
          pattern: string | null
          pattern_type: string | null
          rule_content: string | null
          scan_id: string | null
          user_id: string | null
        }
        Insert: {
          action?: string
          app_id?: string
          blocked_pattern: string
          client_id?: string | null
          created_at?: string | null
          description?: string
          enabled?: boolean
          finding_id?: string | null
          id?: string
          is_active?: boolean | null
          pattern?: string | null
          pattern_type?: string | null
          rule_content?: string | null
          scan_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          app_id?: string
          blocked_pattern?: string
          client_id?: string | null
          created_at?: string | null
          description?: string
          enabled?: boolean
          finding_id?: string | null
          id?: string
          is_active?: boolean | null
          pattern?: string | null
          pattern_type?: string | null
          rule_content?: string | null
          scan_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aegis_shield_rules_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memories: {
        Row: {
          action_taken: string | null
          agent_role: string | null
          created_at: string | null
          id: string
          model_id: string | null
          scan_id: string | null
          step_index: number
          thought: string | null
          thought_process: string | null
          tool_call: Json | null
          tool_result: Json | null
          user_id: string | null
        }
        Insert: {
          action_taken?: string | null
          agent_role?: string | null
          created_at?: string | null
          id?: string
          model_id?: string | null
          scan_id?: string | null
          step_index?: number
          thought?: string | null
          thought_process?: string | null
          tool_call?: Json | null
          tool_result?: Json | null
          user_id?: string | null
        }
        Update: {
          action_taken?: string | null
          agent_role?: string | null
          created_at?: string | null
          id?: string
          model_id?: string | null
          scan_id?: string | null
          step_index?: number
          thought?: string | null
          thought_process?: string | null
          tool_call?: Json | null
          tool_result?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_memories_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tasks: {
        Row: {
          agent_type: string | null
          created_at: string | null
          id: string
          results: Json | null
          status: string | null
          target_email: string | null
          user_id: string | null
        }
        Insert: {
          agent_type?: string | null
          created_at?: string | null
          id?: string
          results?: Json | null
          status?: string | null
          target_email?: string | null
          user_id?: string | null
        }
        Update: {
          agent_type?: string | null
          created_at?: string | null
          id?: string
          results?: Json | null
          status?: string | null
          target_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      attack_lessons: {
        Row: {
          breach_count: number
          fail_count: number
          family: string
          id: string
          last_seen_at: string
          lesson_text: string
          model: string
          provider: string
          updated_at: string
        }
        Insert: {
          breach_count?: number
          fail_count?: number
          family: string
          id?: string
          last_seen_at?: string
          lesson_text: string
          model: string
          provider: string
          updated_at?: string
        }
        Update: {
          breach_count?: number
          fail_count?: number
          family?: string
          id?: string
          last_seen_at?: string
          lesson_text?: string
          model?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      attack_logs: {
        Row: {
          blocked_at: string
          country_code: string | null
          id: string
          ip_address: string
          latitude: number | null
          longitude: number | null
          metadata: Json | null
          method: string | null
          path: string | null
          reason: string
          user_agent: string | null
        }
        Insert: {
          blocked_at?: string
          country_code?: string | null
          id?: string
          ip_address: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          method?: string | null
          path?: string | null
          reason?: string
          user_agent?: string | null
        }
        Update: {
          blocked_at?: string
          country_code?: string | null
          id?: string
          ip_address?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          method?: string | null
          path?: string | null
          reason?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      bazaar_purchases: {
        Row: {
          amount_usd: number | null
          author_id: string | null
          buyer_id: string | null
          created_at: string | null
          id: string
          script_id: string | null
        }
        Insert: {
          amount_usd?: number | null
          author_id?: string | null
          buyer_id?: string | null
          created_at?: string | null
          id?: string
          script_id?: string | null
        }
        Update: {
          amount_usd?: number | null
          author_id?: string | null
          buyer_id?: string | null
          created_at?: string | null
          id?: string
          script_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bazaar_purchases_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "bazaar_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      bazaar_scripts: {
        Row: {
          audit_findings: Json | null
          audit_notes_raw: string | null
          audit_reason: string | null
          audit_risk_score: number | null
          audit_verdict: string | null
          audited_at: string | null
          author_id: string
          code: string | null
          code_content: string | null
          compliance_score: number | null
          created_at: string | null
          description: string | null
          id: string
          is_archived: boolean
          is_certified: boolean
          is_free: boolean
          is_published: boolean | null
          is_removed: boolean | null
          language: string | null
          metadata: Json
          name: string | null
          price_usd: number | null
          purchase_count: number | null
          revenue_usd: number | null
          safety_report: Json | null
          safety_score: number | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          audit_findings?: Json | null
          audit_notes_raw?: string | null
          audit_reason?: string | null
          audit_risk_score?: number | null
          audit_verdict?: string | null
          audited_at?: string | null
          author_id: string
          code?: string | null
          code_content?: string | null
          compliance_score?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_certified?: boolean
          is_free?: boolean
          is_published?: boolean | null
          is_removed?: boolean | null
          language?: string | null
          metadata?: Json
          name?: string | null
          price_usd?: number | null
          purchase_count?: number | null
          revenue_usd?: number | null
          safety_report?: Json | null
          safety_score?: number | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          audit_findings?: Json | null
          audit_notes_raw?: string | null
          audit_reason?: string | null
          audit_risk_score?: number | null
          audit_verdict?: string | null
          audited_at?: string | null
          author_id?: string
          code?: string | null
          code_content?: string | null
          compliance_score?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_certified?: boolean
          is_free?: boolean
          is_published?: boolean | null
          is_removed?: boolean | null
          language?: string | null
          metadata?: Json
          name?: string | null
          price_usd?: number | null
          purchase_count?: number | null
          revenue_usd?: number | null
          safety_report?: Json | null
          safety_score?: number | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bazaar_scripts_author_profiles_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bazaar_scripts_author_profiles_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bazaar_scripts_author_profiles_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_rank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bazaar_scripts_author_profiles_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "visible_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bazaar_tools: {
        Row: {
          author_id: string | null
          category: string | null
          code_content: string | null
          created_at: string | null
          description: string | null
          id: string
          price_usd: number | null
          status: string | null
          title: string
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          code_content?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          price_usd?: number | null
          status?: string | null
          title: string
        }
        Update: {
          author_id?: string | null
          category?: string | null
          code_content?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          price_usd?: number | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      "black-hole_telemetry": {
        Row: {
          created_at: string | null
          data_delivered_gb: number | null
          id: string
          ip_address: string | null
          ua_detected: string | null
        }
        Insert: {
          created_at?: string | null
          data_delivered_gb?: number | null
          id?: string
          ip_address?: string | null
          ua_detected?: string | null
        }
        Update: {
          created_at?: string | null
          data_delivered_gb?: number | null
          id?: string
          ip_address?: string | null
          ua_detected?: string | null
        }
        Relationships: []
      }
      blacklisted_entities: {
        Row: {
          cpu_trap_active: boolean | null
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          poisoned_at: string
          reason: string
          user_agent: string | null
          violation_type: string | null
        }
        Insert: {
          cpu_trap_active?: boolean | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          poisoned_at?: string
          reason?: string
          user_agent?: string | null
          violation_type?: string | null
        }
        Update: {
          cpu_trap_active?: boolean | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          poisoned_at?: string
          reason?: string
          user_agent?: string | null
          violation_type?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          admin_response: string | null
          budget_range: string | null
          client_id: string
          created_at: string | null
          description: string
          duration_hours: number | null
          id: string
          notes: string | null
          preferred_start_date: string | null
          project_type: string
          scheduled_date: string | null
          service_type: string | null
          status: string | null
          title: string
          updated_at: string | null
          urgency: string | null
        }
        Insert: {
          admin_response?: string | null
          budget_range?: string | null
          client_id: string
          created_at?: string | null
          description: string
          duration_hours?: number | null
          id?: string
          notes?: string | null
          preferred_start_date?: string | null
          project_type: string
          scheduled_date?: string | null
          service_type?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          urgency?: string | null
        }
        Update: {
          admin_response?: string | null
          budget_range?: string | null
          client_id?: string
          created_at?: string | null
          description?: string
          duration_hours?: number | null
          id?: string
          notes?: string | null
          preferred_start_date?: string | null
          project_type?: string
          scheduled_date?: string | null
          service_type?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_rank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "visible_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bounties: {
        Row: {
          company_name: string | null
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          reward_amount: string | null
          reward_usd: number
          severity: string
          status: string | null
          target_system: string
          target_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          reward_amount?: string | null
          reward_usd?: number
          severity?: string
          status?: string | null
          target_system?: string
          target_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          reward_amount?: string | null
          reward_usd?: number
          severity?: string
          status?: string | null
          target_system?: string
          target_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bounty_escrow: {
        Row: {
          amount_usd: number
          created_at: string
          currency: string
          held_at: string
          id: string
          mission_id: string | null
          processor: string | null
          processor_ref: string | null
          release_note: string | null
          released_at: string | null
          status: string
          submission_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_usd?: number
          created_at?: string
          currency?: string
          held_at?: string
          id?: string
          mission_id?: string | null
          processor?: string | null
          processor_ref?: string | null
          release_note?: string | null
          released_at?: string | null
          status?: string
          submission_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          currency?: string
          held_at?: string
          id?: string
          mission_id?: string | null
          processor?: string | null
          processor_ref?: string | null
          release_note?: string | null
          released_at?: string | null
          status?: string
          submission_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_escrow_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      bounty_escrows: {
        Row: {
          amount_usd: number | null
          bounty_id: string | null
          created_at: string | null
          hacker_id: string | null
          id: string
          payout_reference: string | null
          status: string | null
        }
        Insert: {
          amount_usd?: number | null
          bounty_id?: string | null
          created_at?: string | null
          hacker_id?: string | null
          id?: string
          payout_reference?: string | null
          status?: string | null
        }
        Update: {
          amount_usd?: number | null
          bounty_id?: string | null
          created_at?: string | null
          hacker_id?: string | null
          id?: string
          payout_reference?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bounty_escrows_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "bounties"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_transcripts: {
        Row: {
          cache_read_tokens: number | null
          cache_write_tokens: number | null
          content: Json
          created_at: string
          id: number
          input_tokens: number | null
          latency_ms: number | null
          model: string | null
          output_tokens: number | null
          role: string
          scan_id: string
          turn_index: number | null
          user_id: string | null
        }
        Insert: {
          cache_read_tokens?: number | null
          cache_write_tokens?: number | null
          content: Json
          created_at?: string
          id?: number
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          role: string
          scan_id: string
          turn_index?: number | null
          user_id?: string | null
        }
        Update: {
          cache_read_tokens?: number | null
          cache_write_tokens?: number | null
          content?: Json
          created_at?: string
          id?: number
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          role?: string
          scan_id?: string
          turn_index?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brain_transcripts_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      community_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          message: string | null
          status: string | null
          subject: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          message?: string | null
          status?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          message?: string | null
          status?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string | null
          email: string
          id: string
          ip_address: string | null
          is_read: boolean | null
          message: string
          name: string
          subject: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          ip_address?: string | null
          is_read?: boolean | null
          message: string
          name: string
          subject: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          ip_address?: string | null
          is_read?: boolean | null
          message?: string
          name?: string
          subject?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      crypto_deposits: {
        Row: {
          address_generated: string
          amount_usd: number
          amount_usdt: number | null
          confirmed_at: string | null
          created_at: string | null
          credit_amount: number | null
          credits_granted: boolean
          currency_type: string | null
          deposit_address: string | null
          deposit_type: string | null
          id: string
          invoice_url: string | null
          order_id: string | null
          pay_amount: number | null
          pay_currency: string | null
          payment_id: string | null
          plan_id: string | null
          plan_name: string | null
          status: string | null
          tx_hash: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address_generated: string
          amount_usd: number
          amount_usdt?: number | null
          confirmed_at?: string | null
          created_at?: string | null
          credit_amount?: number | null
          credits_granted?: boolean
          currency_type?: string | null
          deposit_address?: string | null
          deposit_type?: string | null
          id?: string
          invoice_url?: string | null
          order_id?: string | null
          pay_amount?: number | null
          pay_currency?: string | null
          payment_id?: string | null
          plan_id?: string | null
          plan_name?: string | null
          status?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address_generated?: string
          amount_usd?: number
          amount_usdt?: number | null
          confirmed_at?: string | null
          created_at?: string | null
          credit_amount?: number | null
          credits_granted?: boolean
          currency_type?: string | null
          deposit_address?: string | null
          deposit_type?: string | null
          id?: string
          invoice_url?: string | null
          order_id?: string | null
          pay_amount?: number | null
          pay_currency?: string | null
          payment_id?: string | null
          plan_id?: string | null
          plan_name?: string | null
          status?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ctf_challenges: {
        Row: {
          category: string
          created_at: string
          description_md: string
          difficulty: string
          flag_hash: string
          hint: string | null
          id: string
          is_published: boolean
          points: number
          prompt: string
          slug: string
          solves: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description_md?: string
          difficulty?: string
          flag_hash: string
          hint?: string | null
          id?: string
          is_published?: boolean
          points?: number
          prompt?: string
          slug: string
          solves?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description_md?: string
          difficulty?: string
          flag_hash?: string
          hint?: string | null
          id?: string
          is_published?: boolean
          points?: number
          prompt?: string
          slug?: string
          solves?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ctf_submissions: {
        Row: {
          awarded_points: number
          challenge_id: string
          created_at: string
          id: string
          is_correct: boolean
          submitted_flag: string
          user_id: string
        }
        Insert: {
          awarded_points?: number
          challenge_id: string
          created_at?: string
          id?: string
          is_correct: boolean
          submitted_flag?: string
          user_id: string
        }
        Update: {
          awarded_points?: number
          challenge_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          submitted_flag?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctf_submissions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "ctf_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_attack_tools: {
        Row: {
          audit_result: string | null
          author_id: string
          code: string
          created_at: string
          family: string
          id: string
          intensity_min: string
          name: string
          network_allowed: boolean
          status: string
          updated_at: string
        }
        Insert: {
          audit_result?: string | null
          author_id: string
          code: string
          created_at?: string
          family?: string
          id?: string
          intensity_min?: string
          name: string
          network_allowed?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          audit_result?: string | null
          author_id?: string
          code?: string
          created_at?: string
          family?: string
          id?: string
          intensity_min?: string
          name?: string
          network_allowed?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      operator_tool_executions: {
        Row: {
          author_id: string | null
          created_at: string
          exit_code: number | null
          id: string
          scan_id: string | null
          stderr_preview: string | null
          stdout_preview: string | null
          tool_id: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          exit_code?: number | null
          id?: string
          scan_id?: string | null
          stderr_preview?: string | null
          stdout_preview?: string | null
          tool_id: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          exit_code?: number | null
          id?: string
          scan_id?: string | null
          stderr_preview?: string | null
          stdout_preview?: string | null
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_tool_executions_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "custom_attack_tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_tool_executions_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_tool_executions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_tools: {
        Row: {
          created_at: string
          description: string | null
          executions_count: number
          id: string
          is_archived: boolean
          name: string
          origin_scan_id: string | null
          safety_review: Json | null
          safety_status: Database["public"]["Enums"]["tool_safety_status"]
          spec: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          executions_count?: number
          id?: string
          is_archived?: boolean
          name: string
          origin_scan_id?: string | null
          safety_review?: Json | null
          safety_status?: Database["public"]["Enums"]["tool_safety_status"]
          spec: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          executions_count?: number
          id?: string
          is_archived?: boolean
          name?: string
          origin_scan_id?: string | null
          safety_review?: Json | null
          safety_status?: Database["public"]["Enums"]["tool_safety_status"]
          spec?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_tools_origin_scan_id_fkey"
            columns: ["origin_scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_api_keys: {
        Row: {
          api_key: string
          created_at: string
          expires_at: string | null
          hit_count: number
          id: string
          is_active: boolean
          last_hit: string | null
          notes: string | null
          org_id: string
          plan: string
        }
        Insert: {
          api_key: string
          created_at?: string
          expires_at?: string | null
          hit_count?: number
          id?: string
          is_active?: boolean
          last_hit?: string | null
          notes?: string | null
          org_id: string
          plan?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          expires_at?: string | null
          hit_count?: number
          id?: string
          is_active?: boolean
          last_hit?: string | null
          notes?: string | null
          org_id?: string
          plan?: string
        }
        Relationships: []
      }
      hacker_repos: {
        Row: {
          code: string
          code_content: string | null
          commit_count: number
          created_at: string | null
          description: string | null
          id: string
          is_archived: boolean
          is_private: boolean
          is_public: boolean | null
          language: string | null
          name: string | null
          owner_id: string | null
          script_name: string
          star_count: number
          tags: string[]
          updated_at: string | null
          user_id: string | null
          version: string
        }
        Insert: {
          code?: string
          code_content?: string | null
          commit_count?: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_private?: boolean
          is_public?: boolean | null
          language?: string | null
          name?: string | null
          owner_id?: string | null
          script_name?: string
          star_count?: number
          tags?: string[]
          updated_at?: string | null
          user_id?: string | null
          version?: string
        }
        Update: {
          code?: string
          code_content?: string | null
          commit_count?: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_private?: boolean
          is_public?: boolean | null
          language?: string | null
          name?: string | null
          owner_id?: string | null
          script_name?: string
          star_count?: number
          tags?: string[]
          updated_at?: string | null
          user_id?: string | null
          version?: string
        }
        Relationships: []
      }
      hacker_wallets: {
        Row: {
          created_at: string
          credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      intel_messages: {
        Row: {
          content: string
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: number
          user_id?: string
        }
        Relationships: []
      }
      intel_vault_audit: {
        Row: {
          action: string
          created_at: string
          id: string
          meta: Json
          query_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          meta?: Json
          query_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          meta?: Json
          query_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intel_vault_audit_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "intel_vault_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_vault_items: {
        Row: {
          category: string
          created_at: string
          id: string
          legal_attestation: boolean
          moderated_at: string | null
          moderated_by: string | null
          moderation_notes: string | null
          moderation_status: string
          source_url: string | null
          summary_md: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          legal_attestation?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          moderation_status?: string
          source_url?: string | null
          summary_md: string
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          legal_attestation?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          moderation_status?: string
          source_url?: string | null
          summary_md?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      intel_vault_queries: {
        Row: {
          created_at: string
          id: string
          query_type: string
          scan_id: string | null
          status: string
          target_domain: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query_type: string
          scan_id?: string | null
          status?: string
          target_domain: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query_type?: string
          scan_id?: string | null
          status?: string
          target_domain?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intel_vault_queries_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_vault_results: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          query_id: string
          query_type: string
          result: Json
          scan_id: string | null
          target_domain: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          query_id: string
          query_type: string
          result?: Json
          scan_id?: string | null
          target_domain: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          query_id?: string
          query_type?: string
          result?: Json
          scan_id?: string | null
          target_domain?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intel_vault_results_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "intel_vault_queries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_vault_results_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due_cents: number
          amount_paid_cents: number
          created_at: string
          currency: string
          hosted_invoice_url: string | null
          id: string
          invoice_pdf_url: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          status: string
          stripe_invoice_id: string
          user_id: string
        }
        Insert: {
          amount_due_cents?: number
          amount_paid_cents?: number
          created_at?: string
          currency?: string
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf_url?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status: string
          stripe_invoice_id: string
          user_id: string
        }
        Update: {
          amount_due_cents?: number
          amount_paid_cents?: number
          created_at?: string
          currency?: string
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf_url?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_invoice_id?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          click_token: string | null
          company_name: string
          created_at: string | null
          description: string | null
          emails_sent_count: number | null
          founder_name: string | null
          id: string
          last_email_sent_at: string | null
          rank: string | null
          source: string | null
          status: string | null
          vulnerability_summary: string | null
          website_url: string | null
        }
        Insert: {
          click_token?: string | null
          company_name: string
          created_at?: string | null
          description?: string | null
          emails_sent_count?: number | null
          founder_name?: string | null
          id?: string
          last_email_sent_at?: string | null
          rank?: string | null
          source?: string | null
          status?: string | null
          vulnerability_summary?: string | null
          website_url?: string | null
        }
        Update: {
          click_token?: string | null
          company_name?: string
          created_at?: string | null
          description?: string | null
          emails_sent_count?: number | null
          founder_name?: string | null
          id?: string
          last_email_sent_at?: string | null
          rank?: string | null
          source?: string | null
          status?: string | null
          vulnerability_summary?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      legal_acceptance: {
        Row: {
          accepted_at: string | null
          id: string
          policy_version: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          policy_version?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          id?: string
          policy_version?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      legal_authorizations: {
        Row: {
          consented: boolean
          created_at: string
          full_name: string | null
          id: string
          intensity: string | null
          ip_address: string | null
          policy_version: string
          scan_id: string | null
          signature_hash: string
          signed_at: string | null
          target_host: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          consented?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          intensity?: string | null
          ip_address?: string | null
          policy_version?: string
          scan_id?: string | null
          signature_hash?: string
          signed_at?: string | null
          target_host?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          consented?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          intensity?: string | null
          ip_address?: string | null
          policy_version?: string
          scan_id?: string | null
          signature_hash?: string
          signed_at?: string | null
          target_host?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      legal_signatures: {
        Row: {
          created_at: string | null
          custody_hash: string | null
          id: string
          ip_address: string | null
          mission_id: string | null
          signature_data: string | null
          signature_svg: string | null
          signed_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          custody_hash?: string | null
          id?: string
          ip_address?: string | null
          mission_id?: string | null
          signature_data?: string | null
          signature_svg?: string | null
          signed_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          custody_hash?: string | null
          id?: string
          ip_address?: string | null
          mission_id?: string | null
          signature_data?: string | null
          signature_svg?: string | null
          signed_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_signatures_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_tools: {
        Row: {
          author_id: string | null
          code_content: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          price_usd: number | null
          sales_count: number | null
          status: string | null
        }
        Insert: {
          author_id?: string | null
          code_content?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          price_usd?: number | null
          sales_count?: number | null
          status?: string | null
        }
        Update: {
          author_id?: string | null
          code_content?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          price_usd?: number | null
          sales_count?: number | null
          status?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          project_id: string | null
          receiver_id: string | null
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          project_id?: string | null
          receiver_id?: string | null
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          project_id?: string | null
          receiver_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_rank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "visible_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_rank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "visible_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_applications: {
        Row: {
          created_at: string | null
          hacker_id: string | null
          id: string
          mission_id: string | null
          proposal_text: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          hacker_id?: string | null
          id?: string
          mission_id?: string | null
          proposal_text?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          hacker_id?: string | null
          id?: string
          mission_id?: string | null
          proposal_text?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_applications_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_chats: {
        Row: {
          created_at: string | null
          id: string
          message: string
          mission_id: string | null
          sender_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          mission_id?: string | null
          sender_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          mission_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_chats_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          mission_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          mission_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          mission_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_messages_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_proposals: {
        Row: {
          ask_credits: number
          created_at: string
          hacker_id: string
          id: string
          mission_id: string
          pitch: string
          status: string
          timeline: string | null
        }
        Insert: {
          ask_credits?: number
          created_at?: string
          hacker_id: string
          id?: string
          mission_id: string
          pitch?: string
          status?: string
          timeline?: string | null
        }
        Update: {
          ask_credits?: number
          created_at?: string
          hacker_id?: string
          id?: string
          mission_id?: string
          pitch?: string
          status?: string
          timeline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_proposals_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          budget_credits: number | null
          client_id: string | null
          company_tag: string | null
          created_at: string | null
          description: string | null
          domain_verified: boolean | null
          id: string
          required_rank: string | null
          rules_of_engagement_signed: boolean | null
          scope: string | null
          selected_hacker_id: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          budget_credits?: number | null
          client_id?: string | null
          company_tag?: string | null
          created_at?: string | null
          description?: string | null
          domain_verified?: boolean | null
          id?: string
          required_rank?: string | null
          rules_of_engagement_signed?: boolean | null
          scope?: string | null
          selected_hacker_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          budget_credits?: number | null
          client_id?: string | null
          company_tag?: string | null
          created_at?: string | null
          description?: string | null
          domain_verified?: boolean | null
          id?: string
          required_rank?: string | null
          rules_of_engagement_signed?: boolean | null
          scope?: string | null
          selected_hacker_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      otp_logs: {
        Row: {
          action: string | null
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          phone: string | null
          provider: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          phone?: string | null
          provider?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          phone?: string | null
          provider?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          last4: string | null
          stripe_pm_id: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_pm_id: string
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_pm_id?: string
          user_id?: string
        }
        Relationships: []
      }
      perimeter_events: {
        Row: {
          created_at: string
          geo_country: string | null
          geo_lat: number
          geo_lng: number
          id: string
          ip_hash: string
          path: string | null
          reason: string | null
          severity: string
          source: string
          threat_delta: number | null
        }
        Insert: {
          created_at?: string
          geo_country?: string | null
          geo_lat: number
          geo_lng: number
          id?: string
          ip_hash: string
          path?: string | null
          reason?: string | null
          severity?: string
          source?: string
          threat_delta?: number | null
        }
        Update: {
          created_at?: string
          geo_country?: string | null
          geo_lat?: number
          geo_lng?: number
          id?: string
          ip_hash?: string
          path?: string | null
          reason?: string | null
          severity?: string
          source?: string
          threat_delta?: number | null
        }
        Relationships: []
      }
      perimeter_ip_blocklist: {
        Row: {
          created_at: string
          expires_at: string
          geo_country: string | null
          id: string
          ip_hash: string
          reason: string
          threat_score: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          geo_country?: string | null
          id?: string
          ip_hash: string
          reason: string
          threat_score?: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          geo_country?: string | null
          id?: string
          ip_hash?: string
          reason?: string
          threat_score?: number
        }
        Relationships: []
      }
      phishing_audits: {
        Row: {
          created_at: string | null
          generated_templates: Json | null
          id: string
          status: string | null
          target_org: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          generated_templates?: Json | null
          id?: string
          status?: string | null
          target_org?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          generated_templates?: Json | null
          id?: string
          status?: string | null
          target_org?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      platform_flags: {
        Row: {
          key: string
          updated_at: string
          value: boolean
        }
        Insert: {
          key: string
          updated_at?: string
          value?: boolean
        }
        Update: {
          key?: string
          updated_at?: string
          value?: boolean
        }
        Relationships: []
      }
      platform_transactions: {
        Row: {
          amount_credits: number | null
          amount_usd: number | null
          author_payout: number | null
          buyer_id: string | null
          created_at: string | null
          fee_credits: number | null
          id: string
          platform_fee: number | null
          receiver_id: string | null
          reference_id: string | null
          script_id: string | null
          seller_id: string | null
          sender_id: string | null
          transaction_type: string | null
          tx_type: string | null
        }
        Insert: {
          amount_credits?: number | null
          amount_usd?: number | null
          author_payout?: number | null
          buyer_id?: string | null
          created_at?: string | null
          fee_credits?: number | null
          id?: string
          platform_fee?: number | null
          receiver_id?: string | null
          reference_id?: string | null
          script_id?: string | null
          seller_id?: string | null
          sender_id?: string | null
          transaction_type?: string | null
          tx_type?: string | null
        }
        Update: {
          amount_credits?: number | null
          amount_usd?: number | null
          author_payout?: number | null
          buyer_id?: string | null
          created_at?: string | null
          fee_credits?: number | null
          id?: string
          platform_fee?: number | null
          receiver_id?: string | null
          reference_id?: string | null
          script_id?: string | null
          seller_id?: string | null
          sender_id?: string | null
          transaction_type?: string | null
          tx_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_transactions_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "bazaar_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_level: number | null
          account_status: string
          active_view_mode: string | null
          ai_audit_score: number | null
          avatar_url: string | null
          banned_until: string | null
          bio: string | null
          clearance_tier: string | null
          company_domain: string | null
          company_name: string | null
          company_tag: string | null
          cookie_consent_at: string | null
          cookie_consent_version: string | null
          created_at: string | null
          current_persona: string | null
          current_plan: string
          data_processing_agreed: boolean | null
          deleted_at: string | null
          deletion_requested_at: string | null
          domain_token: string | null
          domain_verified: boolean | null
          domain_verify_token: string | null
          email: string
          entitlements: Json
          face_liveness_at: string | null
          face_liveness_pose_count: number
          face_liveness_verified: boolean
          full_name: string | null
          hacker_rank: string | null
          id: string
          identity_audit_notes: string | null
          identity_audit_score: number | null
          identity_audit_status: string | null
          identity_document_path: string | null
          identity_failure_reason: string | null
          identity_proofed: boolean | null
          identity_raw_ocr_data: Json | null
          identity_status: string | null
          identity_verified: boolean | null
          is_admin: boolean | null
          is_banned: boolean | null
          is_ghost_active: boolean | null
          is_verified: boolean | null
          job_title: string | null
          last_billing_sync_at: string | null
          manual_verification_override: boolean | null
          period_resets_at: string | null
          phone: string | null
          phone_number: string | null
          phone_verified: boolean | null
          profile_completeness: number | null
          reputation: number | null
          revenue_simulation_mode: boolean | null
          role: string | null
          scans_used_this_period: number
          signature_at: string | null
          signature_data: string | null
          sovereign_manual_verify: boolean | null
          sovereign_pending: boolean | null
          stripe_customer_id: string | null
          subscription_tier: string | null
          theme_preference: string | null
          training_corpus_opt_out: boolean
          trust_score: number | null
          twilio_simulation_mode: boolean | null
          updated_at: string | null
          user_type: string | null
          verification_data: Json | null
          work_email_verified: boolean
        }
        Insert: {
          access_level?: number | null
          account_status?: string
          active_view_mode?: string | null
          ai_audit_score?: number | null
          avatar_url?: string | null
          banned_until?: string | null
          bio?: string | null
          clearance_tier?: string | null
          company_domain?: string | null
          company_name?: string | null
          company_tag?: string | null
          cookie_consent_at?: string | null
          cookie_consent_version?: string | null
          created_at?: string | null
          current_persona?: string | null
          current_plan?: string
          data_processing_agreed?: boolean | null
          deleted_at?: string | null
          deletion_requested_at?: string | null
          domain_token?: string | null
          domain_verified?: boolean | null
          domain_verify_token?: string | null
          email: string
          entitlements?: Json
          face_liveness_at?: string | null
          face_liveness_pose_count?: number
          face_liveness_verified?: boolean
          full_name?: string | null
          hacker_rank?: string | null
          id: string
          identity_audit_notes?: string | null
          identity_audit_score?: number | null
          identity_audit_status?: string | null
          identity_document_path?: string | null
          identity_failure_reason?: string | null
          identity_proofed?: boolean | null
          identity_raw_ocr_data?: Json | null
          identity_status?: string | null
          identity_verified?: boolean | null
          is_admin?: boolean | null
          is_banned?: boolean | null
          is_ghost_active?: boolean | null
          is_verified?: boolean | null
          job_title?: string | null
          last_billing_sync_at?: string | null
          manual_verification_override?: boolean | null
          period_resets_at?: string | null
          phone?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          profile_completeness?: number | null
          reputation?: number | null
          revenue_simulation_mode?: boolean | null
          role?: string | null
          scans_used_this_period?: number
          signature_at?: string | null
          signature_data?: string | null
          sovereign_manual_verify?: boolean | null
          sovereign_pending?: boolean | null
          stripe_customer_id?: string | null
          subscription_tier?: string | null
          theme_preference?: string | null
          training_corpus_opt_out?: boolean
          trust_score?: number | null
          twilio_simulation_mode?: boolean | null
          updated_at?: string | null
          user_type?: string | null
          verification_data?: Json | null
          work_email_verified?: boolean
        }
        Update: {
          access_level?: number | null
          account_status?: string
          active_view_mode?: string | null
          ai_audit_score?: number | null
          avatar_url?: string | null
          banned_until?: string | null
          bio?: string | null
          clearance_tier?: string | null
          company_domain?: string | null
          company_name?: string | null
          company_tag?: string | null
          cookie_consent_at?: string | null
          cookie_consent_version?: string | null
          created_at?: string | null
          current_persona?: string | null
          current_plan?: string
          data_processing_agreed?: boolean | null
          deleted_at?: string | null
          deletion_requested_at?: string | null
          domain_token?: string | null
          domain_verified?: boolean | null
          domain_verify_token?: string | null
          email?: string
          entitlements?: Json
          face_liveness_at?: string | null
          face_liveness_pose_count?: number
          face_liveness_verified?: boolean
          full_name?: string | null
          hacker_rank?: string | null
          id?: string
          identity_audit_notes?: string | null
          identity_audit_score?: number | null
          identity_audit_status?: string | null
          identity_document_path?: string | null
          identity_failure_reason?: string | null
          identity_proofed?: boolean | null
          identity_raw_ocr_data?: Json | null
          identity_status?: string | null
          identity_verified?: boolean | null
          is_admin?: boolean | null
          is_banned?: boolean | null
          is_ghost_active?: boolean | null
          is_verified?: boolean | null
          job_title?: string | null
          last_billing_sync_at?: string | null
          manual_verification_override?: boolean | null
          period_resets_at?: string | null
          phone?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          profile_completeness?: number | null
          reputation?: number | null
          revenue_simulation_mode?: boolean | null
          role?: string | null
          scans_used_this_period?: number
          signature_at?: string | null
          signature_data?: string | null
          sovereign_manual_verify?: boolean | null
          sovereign_pending?: boolean | null
          stripe_customer_id?: string | null
          subscription_tier?: string | null
          theme_preference?: string | null
          training_corpus_opt_out?: boolean
          trust_score?: number | null
          twilio_simulation_mode?: boolean | null
          updated_at?: string | null
          user_type?: string | null
          verification_data?: Json | null
          work_email_verified?: boolean
        }
        Relationships: []
      }
      project_files: {
        Row: {
          created_at: string | null
          description: string | null
          file_name: string
          file_path: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          project_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_name: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          project_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          project_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_rank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "visible_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_submissions: {
        Row: {
          admin_notes: string | null
          budget_range: string | null
          client_id: string
          created_at: string | null
          description: string
          github_url: string | null
          id: string
          service_type: string
          status: string | null
          timeline: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          budget_range?: string | null
          client_id: string
          created_at?: string | null
          description: string
          github_url?: string | null
          id?: string
          service_type: string
          status?: string | null
          timeline?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          budget_range?: string | null
          client_id?: string
          created_at?: string | null
          description?: string
          github_url?: string | null
          id?: string
          service_type?: string
          status?: string | null
          timeline?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_rank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "visible_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          admin_notes: string | null
          budget_range: string | null
          client_id: string
          created_at: string | null
          deadline: string | null
          demo_url: string | null
          description: string | null
          github_url: string | null
          id: string
          loom_url: string | null
          progress: number | null
          project_type: string
          status: string | null
          submission_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          budget_range?: string | null
          client_id: string
          created_at?: string | null
          deadline?: string | null
          demo_url?: string | null
          description?: string | null
          github_url?: string | null
          id?: string
          loom_url?: string | null
          progress?: number | null
          project_type: string
          status?: string | null
          submission_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          budget_range?: string | null
          client_id?: string
          created_at?: string | null
          deadline?: string | null
          demo_url?: string | null
          description?: string | null
          github_url?: string | null
          id?: string
          loom_url?: string | null
          progress?: number | null
          project_type?: string
          status?: string | null
          submission_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_rank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "visible_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "project_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          reward_type: string
          scans_to_add: number
          target_plan: string
          uses_left: number
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          reward_type?: string
          scans_to_add?: number
          target_plan: string
          uses_left?: number
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          reward_type?: string
          scans_to_add?: number
          target_plan?: string
          uses_left?: number
        }
        Relationships: []
      }
      recon_results: {
        Row: {
          created_at: string | null
          id: string
          status: string | null
          surface_map: Json | null
          target_url: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          status?: string | null
          surface_map?: Json | null
          target_url: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          status?: string | null
          surface_map?: Json | null
          target_url?: string
          user_id?: string | null
        }
        Relationships: []
      }
      recon_targets: {
        Row: {
          completed_at: string | null
          created_at: string
          error_msg: string | null
          id: string
          scan_depth: number
          started_at: string | null
          status: string
          surface_map: Json | null
          target: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_msg?: string | null
          id?: string
          scan_depth?: number
          started_at?: string | null
          status?: string
          surface_map?: Json | null
          target: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_msg?: string | null
          id?: string
          scan_depth?: number
          started_at?: string | null
          status?: string
          surface_map?: Json | null
          target?: string
          user_id?: string
        }
        Relationships: []
      }
      redeemed_codes: {
        Row: {
          code_id: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code_id: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code_id?: string
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redeemed_codes_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      repo_files: {
        Row: {
          created_at: string | null
          id: string
          mime_type: string
          name: string
          path: string
          repo_id: string | null
          size_bytes: number
          storage_key: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mime_type?: string
          name?: string
          path: string
          repo_id?: string | null
          size_bytes?: number
          storage_key: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mime_type?: string
          name?: string
          path?: string
          repo_id?: string | null
          size_bytes?: number
          storage_key?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repo_files_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "hacker_repos"
            referencedColumns: ["id"]
          },
        ]
      }
      repo_stars: {
        Row: {
          created_at: string
          id: string
          repo_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          repo_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          repo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repo_stars_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "hacker_repos"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_audit_events: {
        Row: {
          created_at: string
          event: string
          event_hash: string
          id: string
          policy_version: string | null
          prev_hash: string | null
          scan_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          event_hash: string
          id?: string
          policy_version?: string | null
          prev_hash?: string | null
          scan_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          event_hash?: string
          id?: string
          policy_version?: string | null
          prev_hash?: string | null
          scan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_audit_events_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_logs: {
        Row: {
          attack_name: string | null
          created_at: string
          id: number
          payload: Json
          scan_id: string
          severity: string
          type: string
        }
        Insert: {
          attack_name?: string | null
          created_at?: string
          id?: number
          payload?: Json
          scan_id: string
          severity?: string
          type: string
        }
        Update: {
          attack_name?: string | null
          created_at?: string
          id?: number
          payload?: Json
          scan_id?: string
          severity?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_logs_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_reports: {
        Row: {
          aegis_zip_b64: string | null
          ale_usd: number | null
          attack_path: Json
          attacks_run: number | null
          audit_report_md: string | null
          cvss_overall: number
          data_record_value: number | null
          discovery_report: Json | null
          executive_summary: string | null
          executive_summary_md: string
          financial_liability_usd: number | null
          financial_loss_projection: number | null
          findings: Json
          generated_at: string
          generation_cost_usd: number | null
          generation_input_tokens: number | null
          generation_output_tokens: number | null
          generator_model: string
          id: string
          optimization_suggestions_md: string | null
          owasp_coverage: Json | null
          pdf_storage_key: string | null
          proof_of_work_status: string | null
          real_world_impact: string | null
          remediation_code_snippet: string | null
          remediation_steps: string | null
          risk_label: string
          scan_id: string
          social_templates: Json | null
          target_type: string | null
          technical_proof_of_concept: string | null
          total_exposed_records: number | null
          total_vectors_tested: number | null
        }
        Insert: {
          aegis_zip_b64?: string | null
          ale_usd?: number | null
          attack_path?: Json
          attacks_run?: number | null
          audit_report_md?: string | null
          cvss_overall: number
          data_record_value?: number | null
          discovery_report?: Json | null
          executive_summary?: string | null
          executive_summary_md: string
          financial_liability_usd?: number | null
          financial_loss_projection?: number | null
          findings?: Json
          generated_at?: string
          generation_cost_usd?: number | null
          generation_input_tokens?: number | null
          generation_output_tokens?: number | null
          generator_model?: string
          id?: string
          optimization_suggestions_md?: string | null
          owasp_coverage?: Json | null
          pdf_storage_key?: string | null
          proof_of_work_status?: string | null
          real_world_impact?: string | null
          remediation_code_snippet?: string | null
          remediation_steps?: string | null
          risk_label: string
          scan_id: string
          social_templates?: Json | null
          target_type?: string | null
          technical_proof_of_concept?: string | null
          total_exposed_records?: number | null
          total_vectors_tested?: number | null
        }
        Update: {
          aegis_zip_b64?: string | null
          ale_usd?: number | null
          attack_path?: Json
          attacks_run?: number | null
          audit_report_md?: string | null
          cvss_overall?: number
          data_record_value?: number | null
          discovery_report?: Json | null
          executive_summary?: string | null
          executive_summary_md?: string
          financial_liability_usd?: number | null
          financial_loss_projection?: number | null
          findings?: Json
          generated_at?: string
          generation_cost_usd?: number | null
          generation_input_tokens?: number | null
          generation_output_tokens?: number | null
          generator_model?: string
          id?: string
          optimization_suggestions_md?: string | null
          owasp_coverage?: Json | null
          pdf_storage_key?: string | null
          proof_of_work_status?: string | null
          real_world_impact?: string | null
          remediation_code_snippet?: string | null
          remediation_steps?: string | null
          risk_label?: string
          scan_id?: string
          social_templates?: Json | null
          target_type?: string | null
          technical_proof_of_concept?: string | null
          total_exposed_records?: number | null
          total_vectors_tested?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_reports_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: true
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          ale_usd: number | null
          asset_value_usd: number | null
          brain_input_tokens_used: number
          brain_output_tokens_used: number
          completed_at: string | null
          compute_seconds_used: number
          created_at: string
          custom_tools_count: number
          failure_reason: string | null
          finding_count: number
          high_severity_count: number
          id: string
          intensity: Database["public"]["Enums"]["scan_intensity"]
          notes: string | null
          progress_pct: number
          report_id: string | null
          scope_host: string | null
          scope_verified_at: string | null
          started_at: string | null
          status: string
          surface_kind: Database["public"]["Enums"]["scan_surface_kind"]
          target_credential_encrypted: string | null
          target_diagnostic_logs: string | null
          target_model: string
          target_type: string | null
          target_url: string
          target_vector: string | null
          user_id: string
        }
        Insert: {
          ale_usd?: number | null
          asset_value_usd?: number | null
          brain_input_tokens_used?: number
          brain_output_tokens_used?: number
          completed_at?: string | null
          compute_seconds_used?: number
          created_at?: string
          custom_tools_count?: number
          failure_reason?: string | null
          finding_count?: number
          high_severity_count?: number
          id?: string
          intensity?: Database["public"]["Enums"]["scan_intensity"]
          notes?: string | null
          progress_pct?: number
          report_id?: string | null
          scope_host?: string | null
          scope_verified_at?: string | null
          started_at?: string | null
          status?: string
          surface_kind?: Database["public"]["Enums"]["scan_surface_kind"]
          target_credential_encrypted?: string | null
          target_diagnostic_logs?: string | null
          target_model: string
          target_type?: string | null
          target_url: string
          target_vector?: string | null
          user_id: string
        }
        Update: {
          ale_usd?: number | null
          asset_value_usd?: number | null
          brain_input_tokens_used?: number
          brain_output_tokens_used?: number
          completed_at?: string | null
          compute_seconds_used?: number
          created_at?: string
          custom_tools_count?: number
          failure_reason?: string | null
          finding_count?: number
          high_severity_count?: number
          id?: string
          intensity?: Database["public"]["Enums"]["scan_intensity"]
          notes?: string | null
          progress_pct?: number
          report_id?: string | null
          scope_host?: string | null
          scope_verified_at?: string | null
          started_at?: string | null
          status?: string
          surface_kind?: Database["public"]["Enums"]["scan_surface_kind"]
          target_credential_encrypted?: string | null
          target_diagnostic_logs?: string | null
          target_model?: string
          target_type?: string | null
          target_url?: string
          target_vector?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scans_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "scan_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_rank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "visible_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_scans: {
        Row: {
          active: boolean
          created_at: string
          frequency: Database["public"]["Enums"]["scheduled_scan_frequency"]
          id: string
          last_run_at: string | null
          name: string
          next_run_at: string
          target_credential_encrypted: string
          target_model: string
          target_url: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          frequency?: Database["public"]["Enums"]["scheduled_scan_frequency"]
          id?: string
          last_run_at?: string | null
          name: string
          next_run_at: string
          target_credential_encrypted: string
          target_model: string
          target_url: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          frequency?: Database["public"]["Enums"]["scheduled_scan_frequency"]
          id?: string
          last_run_at?: string | null
          name?: string
          next_run_at?: string
          target_credential_encrypted?: string
          target_model?: string
          target_url?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          category: string | null
          created_at: string | null
          description: string
          display_order: number | null
          estimated_duration: string | null
          features: Json | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          short_description: string | null
          slug: string
          starting_price: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description: string
          display_order?: number | null
          estimated_duration?: string | null
          features?: Json | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          short_description?: string | null
          slug: string
          starting_price?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string
          display_order?: number | null
          estimated_duration?: string | null
          features?: Json | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          short_description?: string | null
          slug?: string
          starting_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      showcase_projects: {
        Row: {
          category: string | null
          created_at: string | null
          demo_url: string | null
          description: string
          display_order: number | null
          featured: boolean | null
          github_url: string | null
          id: string
          image_url: string | null
          images: Json | null
          is_active: boolean | null
          is_featured: boolean | null
          loom_url: string | null
          short_description: string | null
          slug: string
          technologies: Json | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          demo_url?: string | null
          description: string
          display_order?: number | null
          featured?: boolean | null
          github_url?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          is_active?: boolean | null
          is_featured?: boolean | null
          loom_url?: string | null
          short_description?: string | null
          slug: string
          technologies?: Json | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          demo_url?: string | null
          description?: string
          display_order?: number | null
          featured?: boolean | null
          github_url?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          is_active?: boolean | null
          is_featured?: boolean | null
          loom_url?: string | null
          short_description?: string | null
          slug?: string
          technologies?: Json | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      skills: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          name: string
          proficiency: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name: string
          proficiency?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name?: string
          proficiency?: number | null
        }
        Relationships: []
      }
      social_post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          like_count: number
          media_path: string | null
          team_id: string | null
          user_id: string
          visibility: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          like_count?: number
          media_path?: string | null
          team_id?: string | null
          user_id: string
          visibility?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          like_count?: number
          media_path?: string | null
          team_id?: string | null
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          ls_customer_id: string | null
          ls_order_id: string | null
          ls_subscription_id: string | null
          ls_variant_id: string | null
          period_ends_at: string | null
          period_starts_at: string
          plan: string
          scans_used_this_period: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ls_customer_id?: string | null
          ls_order_id?: string | null
          ls_subscription_id?: string | null
          ls_variant_id?: string | null
          period_ends_at?: string | null
          period_starts_at?: string
          plan?: string
          scans_used_this_period?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ls_customer_id?: string | null
          ls_order_id?: string | null
          ls_subscription_id?: string | null
          ls_variant_id?: string | null
          period_ends_at?: string | null
          period_starts_at?: string
          plan?: string
          scans_used_this_period?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_integrity_reports: {
        Row: {
          created_at: string | null
          id: string
          report_body: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          report_body?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          report_body?: string | null
        }
        Relationships: []
      }
      target_ownership_tokens: {
        Row: {
          created_at: string | null
          id: string
          target_url: string
          token: string
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          target_url: string
          token: string
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          target_url?: string
          token?: string
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      target_verifications: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          is_verified: boolean | null
          method: string | null
          target_domain: string | null
          target_url: string | null
          token: string | null
          user_id: string | null
          verification_token: string | null
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_verified?: boolean | null
          method?: string | null
          target_domain?: string | null
          target_url?: string | null
          token?: string | null
          user_id?: string | null
          verification_token?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_verified?: boolean | null
          method?: string | null
          target_domain?: string | null
          target_url?: string | null
          token?: string | null
          user_id?: string | null
          verification_token?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          team_id: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email: string
          expires_at?: string
          id?: string
          team_id: string
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
        }
        Relationships: []
      }
      terminal_inputs: {
        Row: {
          consumed: boolean
          content: string | null
          created_at: string | null
          id: string
          input_text: string | null
          session_id: string
          user_id: string | null
        }
        Insert: {
          consumed?: boolean
          content?: string | null
          created_at?: string | null
          id?: string
          input_text?: string | null
          session_id: string
          user_id?: string | null
        }
        Update: {
          consumed?: boolean
          content?: string | null
          created_at?: string | null
          id?: string
          input_text?: string | null
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      terminal_sessions: {
        Row: {
          container_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          user_id: string | null
        }
        Insert: {
          container_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          user_id?: string | null
        }
        Update: {
          container_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      tool_audits: {
        Row: {
          ai_decision: string | null
          created_at: string | null
          id: string
          safety_score: number | null
          tool_id: string | null
          vulnerabilities_found: Json | null
        }
        Insert: {
          ai_decision?: string | null
          created_at?: string | null
          id?: string
          safety_score?: number | null
          tool_id?: string | null
          vulnerabilities_found?: Json | null
        }
        Update: {
          ai_decision?: string | null
          created_at?: string | null
          id?: string
          safety_score?: number | null
          tool_id?: string | null
          vulnerabilities_found?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_audits_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "marketplace_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_executions: {
        Row: {
          duration_ms: number | null
          ended_at: string | null
          exit_code: number | null
          id: number
          result: Json | null
          sandbox_image: string | null
          sandbox_runtime_s: number | null
          scan_id: string | null
          started_at: string
          stderr_preview: string | null
          stdout_preview: string | null
          tool_id: string
        }
        Insert: {
          duration_ms?: number | null
          ended_at?: string | null
          exit_code?: number | null
          id?: number
          result?: Json | null
          sandbox_image?: string | null
          sandbox_runtime_s?: number | null
          scan_id?: string | null
          started_at?: string
          stderr_preview?: string | null
          stdout_preview?: string | null
          tool_id: string
        }
        Update: {
          duration_ms?: number | null
          ended_at?: string | null
          exit_code?: number | null
          id?: number
          result?: Json | null
          sandbox_image?: string | null
          sandbox_runtime_s?: number | null
          scan_id?: string | null
          started_at?: string
          stderr_preview?: string | null
          stdout_preview?: string | null
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_executions_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_executions_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "custom_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      training_corpus_events: {
        Row: {
          created_at: string
          event_type: string
          exportable: boolean
          id: string
          payload_json: Json
          redacted: boolean
          scan_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          exportable?: boolean
          id?: string
          payload_json?: Json
          redacted?: boolean
          scan_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          exportable?: boolean
          id?: string
          payload_json?: Json
          redacted?: boolean
          scan_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_corpus_events_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["usage_kind"]
          quantity: number
          reported_to_stripe_at: string | null
          scan_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          kind: Database["public"]["Enums"]["usage_kind"]
          quantity: number
          reported_to_stripe_at?: string | null
          scan_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          kind?: Database["public"]["Enums"]["usage_kind"]
          quantity?: number
          reported_to_stripe_at?: string | null
          scan_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_api_keys: {
        Row: {
          created_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_wallets: {
        Row: {
          balance: number | null
          balance_usd: number
          bazaar_credits: number | null
          created_at: string | null
          credits: number | null
          frozen_at: string | null
          frozen_reason: string | null
          id: string
          is_frozen: boolean
          pending_bounties: number | null
          pending_escrow: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          balance?: number | null
          balance_usd?: number
          bazaar_credits?: number | null
          created_at?: string | null
          credits?: number | null
          frozen_at?: string | null
          frozen_reason?: string | null
          id?: string
          is_frozen?: boolean
          pending_bounties?: number | null
          pending_escrow?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          balance?: number | null
          balance_usd?: number
          bazaar_credits?: number | null
          created_at?: string | null
          credits?: number | null
          frozen_at?: string | null
          frozen_reason?: string | null
          id?: string
          is_frozen?: boolean
          pending_bounties?: number | null
          pending_escrow?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      verification_otps: {
        Row: {
          code_hash: string | null
          consumed: boolean
          created_at: string
          expires_at: string | null
          id: string
          phone: string | null
          salt: string | null
          user_id: string | null
        }
        Insert: {
          code_hash?: string | null
          consumed?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          phone?: string | null
          salt?: string | null
          user_id?: string | null
        }
        Update: {
          code_hash?: string | null
          consumed?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          phone?: string | null
          salt?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      vulnerability_almanac_entries: {
        Row: {
          attack_hash: string
          created_at: string
          cve_id: string | null
          cvss_severity: string | null
          cvss_v3_score: number | null
          epss_percentile: number | null
          epss_score: number | null
          family: string
          first_seen_at: string
          id: string
          last_seen_at: string
          merged_into_id: string | null
          nvd_published: string | null
          owasp_id: string | null
          poc_redacted: string | null
          published: boolean
          severity: string
          slug: string
          source_scan_id: string | null
          source_type: string
          summary_md: string
          title: string
          updated_at: string
        }
        Insert: {
          attack_hash: string
          created_at?: string
          cve_id?: string | null
          cvss_severity?: string | null
          cvss_v3_score?: number | null
          epss_percentile?: number | null
          epss_score?: number | null
          family: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          merged_into_id?: string | null
          nvd_published?: string | null
          owasp_id?: string | null
          poc_redacted?: string | null
          published?: boolean
          severity?: string
          slug: string
          source_scan_id?: string | null
          source_type?: string
          summary_md?: string
          title: string
          updated_at?: string
        }
        Update: {
          attack_hash?: string
          created_at?: string
          cve_id?: string | null
          cvss_severity?: string | null
          cvss_v3_score?: number | null
          epss_percentile?: number | null
          epss_score?: number | null
          family?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          merged_into_id?: string | null
          nvd_published?: string | null
          owasp_id?: string | null
          poc_redacted?: string | null
          published?: boolean
          severity?: string
          slug?: string
          source_scan_id?: string | null
          source_type?: string
          summary_md?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vulnerability_almanac_entries_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "vulnerability_almanac_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vulnerability_almanac_entries_source_scan_id_fkey"
            columns: ["source_scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      war_machine_stats: {
        Row: {
          id: string
          total_clicks: number | null
          total_emailed: number | null
          total_scraped: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          total_clicks?: number | null
          total_emailed?: number | null
          total_scraped?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          total_clicks?: number | null
          total_emailed?: number | null
          total_scraped?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      intel_messages_with_profile: {
        Row: {
          content: string | null
          created_at: string | null
          display_name: string | null
          id: number | null
          user_id: string | null
        }
        Relationships: []
      }
      my_scan_quota: {
        Row: {
          period_ends_at: string | null
          period_expired: boolean | null
          plan: string | null
          scans_allowed: number | null
          scans_used_this_period: number | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          period_ends_at?: string | null
          period_expired?: never
          plan?: string | null
          scans_allowed?: never
          scans_used_this_period?: number | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          period_ends_at?: string | null
          period_expired?: never
          plan?: string | null
          scans_allowed?: never
          scans_used_this_period?: number | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          clearance_tier: string | null
          company_domain: string | null
          company_tag: string | null
          created_at: string | null
          domain_verified: boolean | null
          full_name: string | null
          hacker_rank: string | null
          id: string | null
          identity_verified: boolean | null
          is_ghost_active: boolean | null
          job_title: string | null
          reputation: number | null
          sovereign_pending: boolean | null
          work_email_verified: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          clearance_tier?: string | null
          company_domain?: string | null
          company_tag?: string | null
          created_at?: string | null
          domain_verified?: boolean | null
          full_name?: string | null
          hacker_rank?: string | null
          id?: string | null
          identity_verified?: boolean | null
          is_ghost_active?: boolean | null
          job_title?: string | null
          reputation?: number | null
          sovereign_pending?: boolean | null
          work_email_verified?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          clearance_tier?: string | null
          company_domain?: string | null
          company_tag?: string | null
          created_at?: string | null
          domain_verified?: boolean | null
          full_name?: string | null
          hacker_rank?: string | null
          id?: string | null
          identity_verified?: boolean | null
          is_ghost_active?: boolean | null
          job_title?: string | null
          reputation?: number | null
          sovereign_pending?: boolean | null
          work_email_verified?: boolean | null
        }
        Relationships: []
      }
      profiles_with_rank: {
        Row: {
          access_level: number | null
          account_status: string | null
          active_view_mode: string | null
          ai_audit_score: number | null
          avatar_url: string | null
          banned_until: string | null
          bio: string | null
          clearance_tier: string | null
          company_domain: string | null
          company_name: string | null
          company_tag: string | null
          cookie_consent_at: string | null
          cookie_consent_version: string | null
          created_at: string | null
          current_persona: string | null
          current_plan: string | null
          data_processing_agreed: boolean | null
          deleted_at: string | null
          deletion_requested_at: string | null
          domain_token: string | null
          domain_verified: boolean | null
          domain_verify_token: string | null
          email: string | null
          entitlements: Json | null
          full_name: string | null
          hacker_rank: string | null
          id: string | null
          identity_audit_notes: string | null
          identity_audit_score: number | null
          identity_audit_status: string | null
          identity_document_path: string | null
          identity_failure_reason: string | null
          identity_proofed: boolean | null
          identity_raw_ocr_data: Json | null
          identity_status: string | null
          identity_verified: boolean | null
          is_admin: boolean | null
          is_banned: boolean | null
          is_ghost_active: boolean | null
          is_verified: boolean | null
          job_title: string | null
          last_billing_sync_at: string | null
          manual_verification_override: boolean | null
          period_resets_at: string | null
          phone: string | null
          phone_number: string | null
          phone_verified: boolean | null
          profile_completeness: number | null
          rank_ceiling: number | null
          rank_label: string | null
          rank_progress: number | null
          reputation: number | null
          revenue_simulation_mode: boolean | null
          role: string | null
          scans_used_this_period: number | null
          signature_at: string | null
          signature_data: string | null
          sovereign_manual_verify: boolean | null
          sovereign_pending: boolean | null
          stripe_customer_id: string | null
          subscription_tier: string | null
          theme_preference: string | null
          trust_score: number | null
          twilio_simulation_mode: boolean | null
          updated_at: string | null
          user_type: string | null
          verification_data: Json | null
        }
        Insert: {
          access_level?: number | null
          account_status?: string | null
          active_view_mode?: string | null
          ai_audit_score?: number | null
          avatar_url?: string | null
          banned_until?: string | null
          bio?: string | null
          clearance_tier?: string | null
          company_domain?: string | null
          company_name?: string | null
          company_tag?: string | null
          cookie_consent_at?: string | null
          cookie_consent_version?: string | null
          created_at?: string | null
          current_persona?: string | null
          current_plan?: string | null
          data_processing_agreed?: boolean | null
          deleted_at?: string | null
          deletion_requested_at?: string | null
          domain_token?: string | null
          domain_verified?: boolean | null
          domain_verify_token?: string | null
          email?: string | null
          entitlements?: Json | null
          full_name?: string | null
          hacker_rank?: string | null
          id?: string | null
          identity_audit_notes?: string | null
          identity_audit_score?: number | null
          identity_audit_status?: string | null
          identity_document_path?: string | null
          identity_failure_reason?: string | null
          identity_proofed?: boolean | null
          identity_raw_ocr_data?: Json | null
          identity_status?: string | null
          identity_verified?: boolean | null
          is_admin?: boolean | null
          is_banned?: boolean | null
          is_ghost_active?: boolean | null
          is_verified?: boolean | null
          job_title?: string | null
          last_billing_sync_at?: string | null
          manual_verification_override?: boolean | null
          period_resets_at?: string | null
          phone?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          profile_completeness?: number | null
          rank_ceiling?: never
          rank_label?: never
          rank_progress?: never
          reputation?: number | null
          revenue_simulation_mode?: boolean | null
          role?: string | null
          scans_used_this_period?: number | null
          signature_at?: string | null
          signature_data?: string | null
          sovereign_manual_verify?: boolean | null
          sovereign_pending?: boolean | null
          stripe_customer_id?: string | null
          subscription_tier?: string | null
          theme_preference?: string | null
          trust_score?: number | null
          twilio_simulation_mode?: boolean | null
          updated_at?: string | null
          user_type?: string | null
          verification_data?: Json | null
        }
        Update: {
          access_level?: number | null
          account_status?: string | null
          active_view_mode?: string | null
          ai_audit_score?: number | null
          avatar_url?: string | null
          banned_until?: string | null
          bio?: string | null
          clearance_tier?: string | null
          company_domain?: string | null
          company_name?: string | null
          company_tag?: string | null
          cookie_consent_at?: string | null
          cookie_consent_version?: string | null
          created_at?: string | null
          current_persona?: string | null
          current_plan?: string | null
          data_processing_agreed?: boolean | null
          deleted_at?: string | null
          deletion_requested_at?: string | null
          domain_token?: string | null
          domain_verified?: boolean | null
          domain_verify_token?: string | null
          email?: string | null
          entitlements?: Json | null
          full_name?: string | null
          hacker_rank?: string | null
          id?: string | null
          identity_audit_notes?: string | null
          identity_audit_score?: number | null
          identity_audit_status?: string | null
          identity_document_path?: string | null
          identity_failure_reason?: string | null
          identity_proofed?: boolean | null
          identity_raw_ocr_data?: Json | null
          identity_status?: string | null
          identity_verified?: boolean | null
          is_admin?: boolean | null
          is_banned?: boolean | null
          is_ghost_active?: boolean | null
          is_verified?: boolean | null
          job_title?: string | null
          last_billing_sync_at?: string | null
          manual_verification_override?: boolean | null
          period_resets_at?: string | null
          phone?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          profile_completeness?: number | null
          rank_ceiling?: never
          rank_label?: never
          rank_progress?: never
          reputation?: number | null
          revenue_simulation_mode?: boolean | null
          role?: string | null
          scans_used_this_period?: number | null
          signature_at?: string | null
          signature_data?: string | null
          sovereign_manual_verify?: boolean | null
          sovereign_pending?: boolean | null
          stripe_customer_id?: string | null
          subscription_tier?: string | null
          theme_preference?: string | null
          trust_score?: number | null
          twilio_simulation_mode?: boolean | null
          updated_at?: string | null
          user_type?: string | null
          verification_data?: Json | null
        }
        Relationships: []
      }
      visible_profiles: {
        Row: {
          clearance_tier: string | null
          display_name: string | null
          hacker_rank: string | null
          id: string | null
        }
        Insert: {
          clearance_tier?: string | null
          display_name?: never
          hacker_rank?: string | null
          id?: string | null
        }
        Update: {
          clearance_tier?: string | null
          display_name?: never
          hacker_rank?: string | null
          id?: string | null
        }
        Relationships: []
      }
      war_machine_leads: {
        Row: {
          click_token: string | null
          company_name: string | null
          created_at: string | null
          description: string | null
          emails_sent_count: number | null
          founder_name: string | null
          id: string | null
          last_email_sent_at: string | null
          rank: string | null
          source: string | null
          status: string | null
          vulnerability_summary: string | null
          website_url: string | null
        }
        Insert: {
          click_token?: string | null
          company_name?: string | null
          created_at?: string | null
          description?: string | null
          emails_sent_count?: number | null
          founder_name?: string | null
          id?: string | null
          last_email_sent_at?: string | null
          rank?: string | null
          source?: string | null
          status?: string | null
          vulnerability_summary?: string | null
          website_url?: string | null
        }
        Update: {
          click_token?: string | null
          company_name?: string | null
          created_at?: string | null
          description?: string | null
          emails_sent_count?: number | null
          founder_name?: string | null
          id?: string | null
          last_email_sent_at?: string | null
          rank?: string | null
          source?: string | null
          status?: string | null
          vulnerability_summary?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      freeze_wallet: {
        Args: { p_reason?: string; p_user_id: string }
        Returns: undefined
      }
      generate_domain_token: { Args: { p_user_id: string }; Returns: string }
      increment_hacker_credits: {
        Args: { p_credits: number; p_user_id: string }
        Returns: undefined
      }
      increment_purchase: {
        Args: { p_revenue: number; p_script_id: string }
        Returns: undefined
      }
      increment_reputation: {
        Args: { p_delta: number; p_user_id: string }
        Returns: undefined
      }
      increment_wallet:
        | { Args: { p_amount: number; p_user_id: string }; Returns: undefined }
        | { Args: { amount: number; user_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      log_activity: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity_id?: string
          p_entity_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      operator_public_stats: { Args: { p_user_id: string }; Returns: Json }
      purchase_bazaar_script: {
        Args: { p_buyer_id: string; p_script_id: string }
        Returns: Json
      }
      release_kinetic_bounty: { Args: { p_escrow_id: string }; Returns: Json }
      submit_ctf_flag: {
        Args: { p_challenge_id: string; p_flag: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      billing_plan: "free" | "operator" | "red_team" | "enterprise"
      scan_intensity: "recon" | "standard" | "aggressive" | "greasy"
      scan_surface_kind: "llm" | "web" | "mobile" | "code"
      scheduled_scan_frequency: "daily" | "weekly" | "monthly"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "incomplete"
        | "incomplete_expired"
        | "paused"
      tool_safety_status: "approved" | "rejected" | "pending"
      usage_kind:
        | "compute_seconds"
        | "brain_input_tokens"
        | "brain_output_tokens"
        | "custom_tool_runs"
        | "scans"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      billing_plan: ["free", "operator", "red_team", "enterprise"],
      scan_intensity: ["recon", "standard", "aggressive", "greasy"],
      scan_surface_kind: ["llm", "web", "mobile", "code"],
      scheduled_scan_frequency: ["daily", "weekly", "monthly"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "incomplete",
        "incomplete_expired",
        "paused",
      ],
      tool_safety_status: ["approved", "rejected", "pending"],
      usage_kind: [
        "compute_seconds",
        "brain_input_tokens",
        "brain_output_tokens",
        "custom_tool_runs",
        "scans",
      ],
    },
  },
} as const
