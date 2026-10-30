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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ai_credit_config: {
        Row: {
          daily_allowance: number
          est_credits: number
          feature: string
          max_output_tokens: number | null
          model: string | null
          updated_at: string
        }
        Insert: {
          daily_allowance?: number
          est_credits?: number
          feature: string
          max_output_tokens?: number | null
          model?: string | null
          updated_at?: string
        }
        Update: {
          daily_allowance?: number
          est_credits?: number
          feature?: string
          max_output_tokens?: number | null
          model?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_credit_envelope: {
        Row: {
          credits_cap: number
          credits_reserved: number
          credits_used: number
          day: string
          denials_allowance: number
          denials_budget: number
          updated_at: string
        }
        Insert: {
          credits_cap: number
          credits_reserved?: number
          credits_used?: number
          day: string
          denials_allowance?: number
          denials_budget?: number
          updated_at?: string
        }
        Update: {
          credits_cap?: number
          credits_reserved?: number
          credits_used?: number
          day?: string
          denials_allowance?: number
          denials_budget?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_credit_ledger: {
        Row: {
          cap: number
          credits_used: number
          feature: string
          reserved: number
          updated_at: string
          used: number
          user_id: string
          window_key: string
        }
        Insert: {
          cap?: number
          credits_used?: number
          feature: string
          reserved?: number
          updated_at?: string
          used?: number
          user_id: string
          window_key: string
        }
        Update: {
          cap?: number
          credits_used?: number
          feature?: string
          reserved?: number
          updated_at?: string
          used?: number
          user_id?: string
          window_key?: string
        }
        Relationships: []
      }
      ai_model_calls: {
        Row: {
          cached_input_tokens: number | null
          created_at: string
          credits: number | null
          feature: string
          gateway_request_id: string | null
          id: string
          input_tokens: number | null
          model: string
          output_tokens: number | null
          pricing_snapshot: Json | null
          status: string
          usage: Json | null
          user_id: string
        }
        Insert: {
          cached_input_tokens?: number | null
          created_at?: string
          credits?: number | null
          feature: string
          gateway_request_id?: string | null
          id?: string
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          pricing_snapshot?: Json | null
          status?: string
          usage?: Json | null
          user_id: string
        }
        Update: {
          cached_input_tokens?: number | null
          created_at?: string
          credits?: number | null
          feature?: string
          gateway_request_id?: string | null
          id?: string
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          pricing_snapshot?: Json | null
          status?: string
          usage?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      ai_model_pricing: {
        Row: {
          fetched_at: string
          model: string
          pricing: Json
          source: string
        }
        Insert: {
          fetched_at?: string
          model: string
          pricing: Json
          source?: string
        }
        Update: {
          fetched_at?: string
          model?: string
          pricing?: Json
          source?: string
        }
        Relationships: []
      }
      kreto_attachments: {
        Row: {
          conversation_id: string | null
          created_at: string
          expires_at: string
          extracted_text: string
          id: string
          message_id: string | null
          mime: string
          name: string
          object_path: string
          owner_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          extracted_text: string
          id?: string
          message_id?: string | null
          mime: string
          name: string
          object_path: string
          owner_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          extracted_text?: string
          id?: string
          message_id?: string | null
          mime?: string
          name?: string
          object_path?: string
          owner_id?: string
        }
        Relationships: []
      }
      public_presence_search_quota: {
        Row: {
          bucket: string
          updated_at: string
          used: number
        }
        Insert: {
          bucket: string
          updated_at?: string
          used?: number
        }
        Update: {
          bucket?: string
          updated_at?: string
          used?: number
        }
        Relationships: []
      }
      username_auth_attempts: {
        Row: {
          bucket: string
          updated_at: string
          used: number
        }
        Insert: {
          bucket: string
          updated_at?: string
          used?: number
        }
        Update: {
          bucket?: string
          updated_at?: string
          used?: number
        }
        Relationships: []
      }
      username_login_links: {
        Row: {
          email: string
          legacy_user_id: string
          updated_at: string
        }
        Insert: {
          email: string
          legacy_user_id: string
          updated_at?: string
        }
        Update: {
          email?: string
          legacy_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      commit_ai_credit: {
        Args: {
          _credits: number
          _feature: string
          _units: number
          _user_id: string
        }
        Returns: undefined
      }
      consume_public_presence_search: { Args: never; Returns: boolean }
      consume_username_auth_attempt: {
        Args: { _bucket: string; _day_cap: number; _minute_cap: number }
        Returns: boolean
      }
      get_ai_credit_overview: { Args: { _user_id?: string }; Returns: Json }
      record_ai_model_usage: {
        Args: {
          _cached: number
          _call_id: string
          _credits: number
          _input: number
          _output: number
          _pricing: Json
          _usage: Json
        }
        Returns: undefined
      }
      release_ai_credit: {
        Args: {
          _est_credits?: number
          _feature: string
          _units: number
          _user_id: string
        }
        Returns: undefined
      }
      try_reserve_ai_credit: {
        Args: {
          _est_credits?: number
          _feature: string
          _units: number
          _user_id: string
        }
        Returns: {
          allowed: boolean
          cap: number
          reason: string
          used: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
