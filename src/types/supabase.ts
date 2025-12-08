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
      business_structures: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          max_levels: number | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_levels?: number | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_levels?: number | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_structures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      business_unit_relationships: {
        Row: {
          business_structure_id: string
          child_unit_id: string
          created_at: string | null
          id: string
          parent_unit_id: string
        }
        Insert: {
          business_structure_id: string
          child_unit_id: string
          created_at?: string | null
          id?: string
          parent_unit_id: string
        }
        Update: {
          business_structure_id?: string
          child_unit_id?: string
          created_at?: string | null
          id?: string
          parent_unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_unit_relationships_business_structure_id_fkey"
            columns: ["business_structure_id"]
            isOneToOne: false
            referencedRelation: "business_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_unit_relationships_child_unit_id_fkey"
            columns: ["child_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_unit_relationships_parent_unit_id_fkey"
            columns: ["parent_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      business_units: {
        Row: {
          business_structure_id: string
          cost_center_id: string | null
          created_at: string | null
          id: string
          level: number
          name: string
          position_x: number | null
          position_y: number | null
          updated_at: string | null
        }
        Insert: {
          business_structure_id: string
          cost_center_id?: string | null
          created_at?: string | null
          id?: string
          level: number
          name: string
          position_x?: number | null
          position_y?: number | null
          updated_at?: string | null
        }
        Update: {
          business_structure_id?: string
          cost_center_id?: string | null
          created_at?: string | null
          id?: string
          level?: number
          name?: string
          position_x?: number | null
          position_y?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_units_business_structure_id_fkey"
            columns: ["business_structure_id"]
            isOneToOne: false
            referencedRelation: "business_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_units_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          field_name: string
          field_options: Json | null
          field_type: string
          id: string
          required: boolean | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_name: string
          field_options?: Json | null
          field_type: string
          id?: string
          required?: boolean | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_name?: string
          field_options?: Json | null
          field_type?: string
          id?: string
          required?: boolean | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          auth_created_count: number | null
          completed_at: string | null
          config: Json
          created_at: string | null
          data: Json
          errors: Json | null
          failed_count: number | null
          id: string
          processed_rows: number | null
          result: Json | null
          status: string
          success_count: number | null
          tenant_id: string
          total_rows: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth_created_count?: number | null
          completed_at?: string | null
          config: Json
          created_at?: string | null
          data: Json
          errors?: Json | null
          failed_count?: number | null
          id?: string
          processed_rows?: number | null
          result?: Json | null
          status: string
          success_count?: number | null
          tenant_id: string
          total_rows: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth_created_count?: number | null
          completed_at?: string | null
          config?: Json
          created_at?: string | null
          data?: Json
          errors?: Json | null
          failed_count?: number | null
          id?: string
          processed_rows?: number | null
          result?: Json | null
          status?: string
          success_count?: number | null
          tenant_id?: string
          total_rows?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          custom_fields: Json | null
          department_id: string | null
          email: string
          employee_number: string | null
          employment_status: Database["public"]["Enums"]["employment_status"]
          first_name: string
          hire_date: string | null
          id: string
          last_name: string
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          custom_fields?: Json | null
          department_id?: string | null
          email: string
          employee_number?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          first_name: string
          hire_date?: string | null
          id?: string
          last_name: string
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          custom_fields?: Json | null
          department_id?: string | null
          email?: string
          employee_number?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          first_name?: string
          hire_date?: string | null
          id?: string
          last_name?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_config: {
        Row: {
          created_at: string
          field_visibility_config: Json | null
          hr_import_config: Json | null
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_visibility_config?: Json | null
          hr_import_config?: Json | null
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_visibility_config?: Json | null
          hr_import_config?: Json | null
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          address: string | null
          badge_number: number | null
          base_wage_rate: number | null
          base_wage_rate_effective_date: string | null
          birth_date: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string
          employee_classification: string | null
          employee_type: string | null
          fte_full_time_hours: number | null
          fte_percent: number | null
          fte_standard_hours: number | null
          id: string
          is_union: boolean | null
          manager_flag: boolean | null
          middle_initial_name: string | null
          pay_frequency: string | null
          phone_1: string | null
          phone_2: string | null
          postal_code: string | null
          reports_to_manager: string | null
          role: Database["public"]["Enums"]["user_role"]
          seniority_date: string | null
          short_name: string | null
          standard_hours_daily: number | null
          standard_hours_pay_period: number | null
          standard_hours_weekly: number | null
          state: string | null
          tenant_id: string
          termination_effective_date: string | null
          time_zone: string | null
          updated_at: string
          user_account_name: string | null
          user_account_status: string | null
          user_password: string | null
          worker_type: string | null
        }
        Insert: {
          address?: string | null
          badge_number?: number | null
          base_wage_rate?: number | null
          base_wage_rate_effective_date?: string | null
          birth_date?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email: string
          employee_classification?: string | null
          employee_type?: string | null
          fte_full_time_hours?: number | null
          fte_percent?: number | null
          fte_standard_hours?: number | null
          id: string
          is_union?: boolean | null
          manager_flag?: boolean | null
          middle_initial_name?: string | null
          pay_frequency?: string | null
          phone_1?: string | null
          phone_2?: string | null
          postal_code?: string | null
          reports_to_manager?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          seniority_date?: string | null
          short_name?: string | null
          standard_hours_daily?: number | null
          standard_hours_pay_period?: number | null
          standard_hours_weekly?: number | null
          state?: string | null
          tenant_id: string
          termination_effective_date?: string | null
          time_zone?: string | null
          updated_at?: string
          user_account_name?: string | null
          user_account_status?: string | null
          user_password?: string | null
          worker_type?: string | null
        }
        Update: {
          address?: string | null
          badge_number?: number | null
          base_wage_rate?: number | null
          base_wage_rate_effective_date?: string | null
          birth_date?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string
          employee_classification?: string | null
          employee_type?: string | null
          fte_full_time_hours?: number | null
          fte_percent?: number | null
          fte_standard_hours?: number | null
          id?: string
          is_union?: boolean | null
          manager_flag?: boolean | null
          middle_initial_name?: string | null
          pay_frequency?: string | null
          phone_1?: string | null
          phone_2?: string | null
          postal_code?: string | null
          reports_to_manager?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          seniority_date?: string | null
          short_name?: string | null
          standard_hours_daily?: number | null
          standard_hours_pay_period?: number | null
          standard_hours_weekly?: number | null
          state?: string | null
          tenant_id?: string
          termination_effective_date?: string | null
          time_zone?: string | null
          updated_at?: string
          user_account_name?: string | null
          user_account_status?: string | null
          user_password?: string | null
          worker_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
    }
    Enums: {
      employment_status: "active" | "on_leave" | "terminated"
      user_role: "admin" | "manager" | "employee"
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
      employment_status: ["active", "on_leave", "terminated"],
      user_role: ["admin", "manager", "employee"],
    },
  },
} as const
