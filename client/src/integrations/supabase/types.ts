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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      business_categories: {
        Row: {
          category_code: string
          name_th: string
          name_en: string | null
          description_th: string | null
          description_en: string | null
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          category_code: string
          name_th: string
          name_en?: string | null
          description_th?: string | null
          description_en?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          category_code?: string
          name_th?: string
          name_en?: string | null
          description_th?: string | null
          description_en?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      checkins: {
        Row: {
          checkin_id: string
          checkin_time: string
          meeting_id: string
          participant_id: string
          source: Database["public"]["Enums"]["checkin_source"]
          tenant_id: string
        }
        Insert: {
          checkin_id?: string
          checkin_time?: string
          meeting_id: string
          participant_id: string
          source?: Database["public"]["Enums"]["checkin_source"]
          tenant_id: string
        }
        Update: {
          checkin_id?: string
          checkin_time?: string
          meeting_id?: string
          participant_id?: string
          source?: Database["public"]["Enums"]["checkin_source"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["meeting_id"]
          },
          {
            foreignKeyName: "checkins_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "checkins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          created_at: string
          event_type: string
          log_id: string
          metadata: Json | null
          payload: Json | null
          source: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          log_id?: string
          metadata?: Json | null
          payload?: Json | null
          source: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          log_id?: string
          metadata?: Json | null
          payload?: Json | null
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          invoice_id: string
          issued_at: string
          paid_at: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["invoice_status"]
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          invoice_id?: string
          issued_at?: string
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["invoice_status"]
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          invoice_id?: string
          issued_at?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      meeting_registrations: {
        Row: {
          created_at: string | null
          meeting_id: string
          notes: string | null
          participant_id: string
          registered_at: string | null
          registration_id: string
          registration_status: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          meeting_id: string
          notes?: string | null
          participant_id: string
          registered_at?: string | null
          registration_id?: string
          registration_status?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          meeting_id?: string
          notes?: string | null
          participant_id?: string
          registered_at?: string | null
          registration_id?: string
          registration_status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_registrations_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["meeting_id"]
          },
          {
            foreignKeyName: "meeting_registrations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "meeting_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          description: string | null
          location_details: string | null
          location_lat: number | null
          location_lng: number | null
          meeting_date: string
          meeting_id: string
          meeting_time: string | null
          parent_meeting_id: string | null
          recurrence_days_of_week: string[] | null
          recurrence_end_date: string | null
          recurrence_interval: number | null
          recurrence_pattern: string | null
          tenant_id: string
          theme: string | null
          venue: string | null
          visitor_fee: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          location_details?: string | null
          location_lat?: number | null
          location_lng?: number | null
          meeting_date: string
          meeting_id?: string
          meeting_time?: string | null
          parent_meeting_id?: string | null
          recurrence_days_of_week?: string[] | null
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_pattern?: string | null
          tenant_id: string
          theme?: string | null
          venue?: string | null
          visitor_fee?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          location_details?: string | null
          location_lat?: number | null
          location_lng?: number | null
          meeting_date?: string
          meeting_id?: string
          meeting_time?: string | null
          parent_meeting_id?: string | null
          recurrence_days_of_week?: string[] | null
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_pattern?: string | null
          tenant_id?: string
          theme?: string | null
          venue?: string | null
          visitor_fee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_parent_meeting_id_fkey"
            columns: ["parent_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["meeting_id"]
          },
          {
            foreignKeyName: "meetings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      participants: {
        Row: {
          business_address: string | null
          business_type: string | null
          business_type_code: string | null
          company: string | null
          company_logo_url: string | null
          created_at: string
          email: string | null
          facebook_url: string | null
          full_name_th: string
          full_name_en: string | null
          goal: string | null
          instagram_url: string | null
          invited_by: string | null
          joined_date: string | null
          line_id: string | null
          line_user_id: string | null
          linkedin_url: string | null
          member_type: string | null
          nickname: string | null
          nickname_en: string | null
          nickname_th: string | null
          notes: string | null
          onepage_url: string | null
          participant_id: string
          phone: string | null
          photo_url: string | null
          position: string | null
          referral_origin: Database["public"]["Enums"]["referral_origin"] | null
          referred_by_participant_id: string | null
          status: Database["public"]["Enums"]["participant_status"]
          tagline: string | null
          tags: string[] | null
          tenant_id: string
          updated_at: string
          user_id: string | null
          website_url: string | null
        }
        Insert: {
          business_address?: string | null
          business_type?: string | null
          business_type_code?: string | null
          company?: string | null
          company_logo_url?: string | null
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          full_name_th: string
          full_name_en?: string | null
          goal?: string | null
          instagram_url?: string | null
          invited_by?: string | null
          joined_date?: string | null
          line_id?: string | null
          line_user_id?: string | null
          linkedin_url?: string | null
          member_type?: string | null
          nickname?: string | null
          nickname_en?: string | null
          nickname_th?: string | null
          notes?: string | null
          onepage_url?: string | null
          participant_id?: string
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          referral_origin?: Database["public"]["Enums"]["referral_origin"] | null
          referred_by_participant_id?: string | null
          status?: Database["public"]["Enums"]["participant_status"]
          tagline?: string | null
          tags?: string[] | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
        }
        Update: {
          business_address?: string | null
          business_type?: string | null
          business_type_code?: string | null
          company?: string | null
          company_logo_url?: string | null
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          full_name_th?: string
          full_name_en?: string | null
          goal?: string | null
          instagram_url?: string | null
          invited_by?: string | null
          joined_date?: string | null
          line_id?: string | null
          line_user_id?: string | null
          linkedin_url?: string | null
          member_type?: string | null
          nickname?: string | null
          nickname_en?: string | null
          nickname_th?: string | null
          notes?: string | null
          onepage_url?: string | null
          participant_id?: string
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          referral_origin?: Database["public"]["Enums"]["referral_origin"] | null
          referred_by_participant_id?: string | null
          status?: Database["public"]["Enums"]["participant_status"]
          tagline?: string | null
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "participants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          meeting_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string | null
          participant_id: string
          payment_id: string
          provider_ref: string | null
          slip_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          meeting_id?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string | null
          participant_id: string
          payment_id?: string
          provider_ref?: string | null
          slip_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          meeting_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string | null
          participant_id?: string
          payment_id?: string
          provider_ref?: string | null
          slip_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["meeting_id"]
          },
          {
            foreignKeyName: "payments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          features: Json | null
          limits: Json | null
          monthly_price: number
          name: string
          plan_id: string
        }
        Insert: {
          created_at?: string
          features?: Json | null
          limits?: Json | null
          monthly_price: number
          name: string
          plan_id?: string
        }
        Update: {
          created_at?: string
          features?: Json | null
          limits?: Json | null
          monthly_price?: number
          name?: string
          plan_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          admin_notes: string | null
          approved_by: string | null
          created_at: string
          payment_id: string
          processed_at: string | null
          reason: string
          request_id: string
          requested_at: string
          requested_by: string
          status: Database["public"]["Enums"]["approval_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          approved_by?: string | null
          created_at?: string
          payment_id: string
          processed_at?: string | null
          reason: string
          request_id?: string
          requested_at?: string
          requested_by: string
          status?: Database["public"]["Enums"]["approval_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          approved_by?: string | null
          created_at?: string
          payment_id?: string
          processed_at?: string | null
          reason?: string
          request_id?: string
          requested_at?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["approval_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "refund_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      status_audit: {
        Row: {
          audit_id: string
          changed_by: string | null
          created_at: string
          participant_id: string
          reason: string | null
          tenant_id: string
        }
        Insert: {
          audit_id?: string
          changed_by?: string | null
          created_at?: string
          participant_id: string
          reason?: string | null
          tenant_id: string
        }
        Update: {
          audit_id?: string
          changed_by?: string | null
          created_at?: string
          participant_id?: string
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_audit_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "status_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          plan_id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          subscription_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          current_period_end: string
          plan_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_id?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          plan_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenant_secrets: {
        Row: {
          created_at: string
          liff_id_checkin: string | null
          liff_id_share: string | null
          line_access_token: string | null
          line_channel_id: string | null
          line_channel_secret: string | null
          payment_provider_keys: Json | null
          payment_qr_payload: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          liff_id_checkin?: string | null
          liff_id_share?: string | null
          line_access_token?: string | null
          line_channel_id?: string | null
          line_channel_secret?: string | null
          payment_provider_keys?: Json | null
          payment_qr_payload?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          liff_id_checkin?: string | null
          liff_id_share?: string | null
          line_access_token?: string | null
          line_channel_id?: string | null
          line_channel_secret?: string | null
          payment_provider_keys?: Json | null
          payment_qr_payload?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_secrets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          branding_color: string | null
          created_at: string
          currency: string | null
          default_visitor_fee: number | null
          language: string | null
          logo_url: string | null
          require_visitor_payment: boolean | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branding_color?: string | null
          created_at?: string
          currency?: string | null
          default_visitor_fee?: number | null
          language?: string | null
          logo_url?: string | null
          require_visitor_payment?: boolean | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branding_color?: string | null
          created_at?: string
          currency?: string | null
          default_visitor_fee?: number | null
          language?: string | null
          logo_url?: string | null
          require_visitor_payment?: boolean | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          line_bot_basic_id: string | null
          line_official_url: string | null
          logo_url: string | null
          subdomain: string
          tenant_id: string
          tenant_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          line_bot_basic_id?: string | null
          line_official_url?: string | null
          logo_url?: string | null
          subdomain: string
          tenant_id?: string
          tenant_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          line_bot_basic_id?: string | null
          line_official_url?: string | null
          logo_url?: string | null
          subdomain?: string
          tenant_id?: string
          tenant_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      usage_metrics: {
        Row: {
          active_members: number | null
          api_calls: number | null
          created_at: string
          date: string
          messages_sent: number | null
          metric_id: string
          storage_mb: number | null
          tenant_id: string
          visitors_checked_in: number | null
        }
        Insert: {
          active_members?: number | null
          api_calls?: number | null
          created_at?: string
          date: string
          messages_sent?: number | null
          metric_id?: string
          storage_mb?: number | null
          tenant_id: string
          visitors_checked_in?: number | null
        }
        Update: {
          active_members?: number | null
          api_calls?: number | null
          created_at?: string
          date?: string
          messages_sent?: number | null
          metric_id?: string
          storage_mb?: number | null
          tenant_id?: string
          visitors_checked_in?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_access: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "chapter_admin" | "member"
      approval_status: "pending" | "approved" | "rejected"
      checkin_source: "qr" | "line" | "manual"
      invoice_status: "paid" | "unpaid" | "void"
      participant_status:
        | "prospect"
        | "visitor"
        | "declined"
        | "member"
        | "alumni"
      payment_method: "promptpay" | "transfer" | "cash"
      payment_status: "pending" | "paid" | "waived" | "failed" | "refunded"
      referral_origin: "member" | "central" | "external"
      subscription_status: "active" | "canceled" | "past_due"
      tenant_status: "active" | "suspended" | "cancelled"
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
      app_role: ["super_admin", "chapter_admin", "member"],
      approval_status: ["pending", "approved", "rejected"],
      checkin_source: ["qr", "line", "manual"],
      invoice_status: ["paid", "unpaid", "void"],
      participant_status: [
        "prospect",
        "visitor",
        "declined",
        "member",
        "alumni",
      ],
      payment_method: ["promptpay", "transfer", "cash"],
      payment_status: ["pending", "paid", "waived", "failed", "refunded"],
      subscription_status: ["active", "canceled", "past_due"],
      tenant_status: ["active", "suspended", "cancelled"],
    },
  },
} as const
