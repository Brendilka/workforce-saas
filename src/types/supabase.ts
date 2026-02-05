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
      pattern_template_details: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string | null
          id: string
          label: string | null
          pattern_template_id: string
          shift_template_id: string | null
          spans_midnight: boolean
          start_time: string | null
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time?: string | null
          id?: string
          label?: string | null
          pattern_template_id: string
          shift_template_id?: string | null
          spans_midnight?: boolean
          start_time?: string | null
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string | null
          id?: string
          label?: string | null
          pattern_template_id?: string
          shift_template_id?: string | null
          spans_midnight?: boolean
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pattern_template_details_pattern_template_id_fkey"
            columns: ["pattern_template_id"]
            isOneToOne: false
            referencedRelation: "pattern_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pattern_template_details_shift_template_id_fkey"
            columns: ["shift_template_id"]
            isOneToOne: false
            referencedRelation: "shift_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pattern_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pattern_templates_tenant_id_fkey"
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
      schedule_shifts: {
        Row: {
          comment: string | null
          created_at: string
          department_id: string | null
          end_time: string | null
          id: string
          is_locked: boolean
          profile_id: string
          shift_template_id: string | null
          source_pattern_template_id: string | null
          spans_midnight: boolean
          start_time: string | null
          tenant_id: string
          updated_at: string
          work_date: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          department_id?: string | null
          end_time?: string | null
          id?: string
          is_locked?: boolean
          profile_id: string
          shift_template_id?: string | null
          source_pattern_template_id?: string | null
          spans_midnight?: boolean
          start_time?: string | null
          tenant_id: string
          updated_at?: string
          work_date: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          department_id?: string | null
          end_time?: string | null
          id?: string
          is_locked?: boolean
          profile_id?: string
          shift_template_id?: string | null
          source_pattern_template_id?: string | null
          spans_midnight?: boolean
          start_time?: string | null
          tenant_id?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_shifts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_shifts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_shifts_shift_template_id_fkey"
            columns: ["shift_template_id"]
            isOneToOne: false
            referencedRelation: "shift_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_shifts_source_pattern_template_id_fkey"
            columns: ["source_pattern_template_id"]
            isOneToOne: false
            referencedRelation: "pattern_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_shifts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_templates: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          name: string
          spans_midnight: boolean
          start_time: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          name: string
          spans_midnight?: boolean
          start_time: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          spans_midnight?: boolean
          start_time?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_config: {
        Row: {
          created_at: string
          day_periods: Json | null
          field_visibility_config: Json | null
          hr_import_config: Json | null
          id: string
          min_hours_between_shifts: number | null
          shift_types: Json | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_periods?: Json | null
          field_visibility_config?: Json | null
          hr_import_config?: Json | null
          id?: string
          min_hours_between_shifts?: number | null
          shift_types?: Json | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_periods?: Json | null
          field_visibility_config?: Json | null
          hr_import_config?: Json | null
          id?: string
          min_hours_between_shifts?: number | null
          shift_types?: Json | null
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
      work_schedule_timeframes: {
        Row: {
          created_at: string
          end_time: string
          frame_order: number
          id: string
          meal_end: string | null
          meal_start: string | null
          meal_type: string | null
          start_time: string
          updated_at: string
          work_schedule_id: string
        }
        Insert: {
          created_at?: string
          end_time: string
          frame_order: number
          id?: string
          meal_end?: string | null
          meal_start?: string | null
          meal_type?: string | null
          start_time: string
          updated_at?: string
          work_schedule_id: string
        }
        Update: {
          created_at?: string
          end_time?: string
          frame_order?: number
          id?: string
          meal_end?: string | null
          meal_start?: string | null
          meal_type?: string | null
          start_time?: string
          updated_at?: string
          work_schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_schedule_timeframes_work_schedule_id_fkey"
            columns: ["work_schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      work_schedules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          shift_id: string
          shift_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          shift_id: string
          shift_type: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          shift_id?: string
          shift_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_patterns: {
        Row: {
          id: string
          shift_id: string
          start_date: string | null
          end_date_type: string
          end_date: string | null
          weeks_pattern: string
          start_pattern_week: string
          start_day: string
          pattern_rows: Json
          created_at: string
        }
        Insert: {
          id?: string
          shift_id: string
          start_date?: string | null
          end_date_type?: string
          end_date?: string | null
          weeks_pattern?: string
          start_pattern_week?: string
          start_day?: string
          pattern_rows: Json
          created_at?: string
        }
        Update: {
          id?: string
          shift_id?: string
          start_date?: string | null
          end_date_type?: string
          end_date?: string | null
          weeks_pattern?: string
          start_pattern_week?: string
          start_day?: string
          pattern_rows?: Json
          created_at?: string
        }
        Relationships: []
      }
      workload_pattern_details: {
        Row: {
          day_of_week: number | null
          id: string
          notes: string | null
          pattern_id: string
          required_headcount: number
          required_hours: number | null
          span_end: string | null
          span_start: string | null
        }
        Insert: {
          day_of_week?: number | null
          id?: string
          notes?: string | null
          pattern_id: string
          required_headcount?: number
          required_hours?: number | null
          span_end?: string | null
          span_start?: string | null
        }
        Update: {
          day_of_week?: number | null
          id?: string
          notes?: string | null
          pattern_id?: string
          required_headcount?: number
          required_hours?: number | null
          span_end?: string | null
          span_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workload_pattern_details_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "workload_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      workload_patterns: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          job_title: string | null
          location_id: string | null
          name: string
          recurrence: string
          skill_profile: string | null
          start_date: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          location_id?: string | null
          name: string
          recurrence: string
          skill_profile?: string | null
          start_date: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          location_id?: string | null
          name?: string
          recurrence?: string
          skill_profile?: string | null
          start_date?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workload_patterns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workload_patterns_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workload_patterns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workload_requirements: {
        Row: {
          created_at: string | null
          id: string
          is_override: boolean | null
          is_published: boolean | null
          job_title: string | null
          location_id: string | null
          notes: string | null
          required_headcount: number
          required_hours: number | null
          requirement_date: string
          skill_profile: string | null
          source_pattern_id: string | null
          span_end: string | null
          span_start: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_override?: boolean | null
          is_published?: boolean | null
          job_title?: string | null
          location_id?: string | null
          notes?: string | null
          required_headcount?: number
          required_hours?: number | null
          requirement_date: string
          skill_profile?: string | null
          source_pattern_id?: string | null
          span_end?: string | null
          span_start?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_override?: boolean | null
          is_published?: boolean | null
          job_title?: string | null
          location_id?: string | null
          notes?: string | null
          required_headcount?: number
          required_hours?: number | null
          requirement_date?: string
          skill_profile?: string | null
          source_pattern_id?: string | null
          span_end?: string | null
          span_start?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workload_requirements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workload_requirements_source_pattern_id_fkey"
            columns: ["source_pattern_id"]
            isOneToOne: false
            referencedRelation: "workload_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workload_requirements_tenant_id_fkey"
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
      apply_workload_pattern: {
        Args: { p_end_date: string; p_pattern_id: string; p_start_date: string }
        Returns: number
      }
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
