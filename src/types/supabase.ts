// =====================================================
// Supabase Database Types
// =====================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          company_name: string | null
          phone: string | null
          avatar_url: string | null
          role: 'admin' | 'client'
          is_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          company_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          role?: 'admin' | 'client'
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          company_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          role?: 'admin' | 'client'
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          client_id: string
          title: string
          description: string | null
          status: 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled'
          project_type: string
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
          status?: 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled'
          project_type: string
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
        Update: {
          id?: string
          client_id?: string
          title?: string
          description?: string | null
          status?: 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled'
          project_type?: string
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
      }
      project_submissions: {
        Row: {
          id: string
          client_id: string
          github_url: string | null
          service_type: 'ai_red_teaming' | 'secure_ai_agents' | 'ml_hardening' | 'prompt_engineering' | 'consultation'
          description: string
          budget_range: string | null
          timeline: string | null
          status: 'pending' | 'in_progress' | 'completed' | 'rejected'
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          github_url?: string | null
          service_type: 'ai_red_teaming' | 'secure_ai_agents' | 'ml_hardening' | 'prompt_engineering' | 'consultation'
          description: string
          budget_range?: string | null
          timeline?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'rejected'
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          github_url?: string | null
          service_type?: 'ai_red_teaming' | 'secure_ai_agents' | 'ml_hardening' | 'prompt_engineering' | 'consultation'
          description?: string
          budget_range?: string | null
          timeline?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'rejected'
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
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
        Update: {
          id?: string
          project_id?: string
          file_name?: string
          file_url?: string
          file_type?: string | null
          file_size?: number | null
          uploaded_by?: string | null
          description?: string | null
          created_at?: string
        }
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
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string | null
          project_id?: string | null
          content?: string
          is_read?: boolean
          attachments?: Json | null
          created_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          client_id: string
          project_type: string
          title: string
          description: string
          budget_range: string | null
          preferred_start_date: string | null
          urgency: 'low' | 'normal' | 'high' | 'urgent'
          status: 'pending' | 'approved' | 'rejected' | 'completed'
          admin_response: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          project_type: string
          title: string
          description: string
          budget_range?: string | null
          preferred_start_date?: string | null
          urgency?: 'low' | 'normal' | 'high' | 'urgent'
          status?: 'pending' | 'approved' | 'rejected' | 'completed'
          admin_response?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          project_type?: string
          title?: string
          description?: string
          budget_range?: string | null
          preferred_start_date?: string | null
          urgency?: 'low' | 'normal' | 'high' | 'urgent'
          status?: 'pending' | 'approved' | 'rejected' | 'completed'
          admin_response?: string | null
          created_at?: string
          updated_at?: string
        }
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
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string
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
      }
      skills: {
        Row: {
          id: string
          name: string
          category: string
          proficiency: number
          icon: string | null
          description: string | null
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          category: string
          proficiency: number
          icon?: string | null
          description?: string | null
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          proficiency?: number
          icon?: string | null
          description?: string | null
          display_order?: number
          created_at?: string
        }
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
        Update: {
          id?: string
          title?: string
          slug?: string
          description?: string
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
        Update: {
          id?: string
          name?: string
          email?: string
          subject?: string
          message?: string
          is_read?: boolean
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          details: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          details?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          details?: Json | null
          ip_address?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
