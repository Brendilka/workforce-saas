// Database types

export type UserRole = 'admin' | 'manager' | 'employee';

export type EmploymentStatus = 'active' | 'on_leave' | 'terminated';

export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'select';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldDefinition {
  id: string;
  tenant_id: string;
  field_name: string;
  field_type: FieldType;
  field_options: Record<string, any> | null;
  required: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string | null;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_number: string | null;
  hire_date: string | null;
  employment_status: EmploymentStatus;
  department_id: string | null;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TenantConfig {
  id: string;
  tenant_id: string;
  hr_import_config: HRImportConfig | null;
  field_visibility_config: FieldVisibilityConfig | null;
  created_at: string;
  updated_at: string;
}

// HR Import Config structure
export interface HRImportConfig {
  systemName: string;
  sourceFields: string[];
  fieldMapping: Record<string, string>;
  requiredFields: string[];
}

// Field Visibility Config structure
export interface FieldVisibilityConfig {
  [pageName: string]: PageConfig;
}

export interface PageConfig {
  visibleFields: string[];
  fieldGroups: FieldGroup[];
}

export interface FieldGroup {
  groupName: string;
  fields: string[];
}

// Import Job types
export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ImportJobError {
  row: number;
  email?: string;
  message: string;
}

export interface ImportJobResult {
  success: number;
  failed: number;
  duration: number;
}

export interface ImportJob {
  id: string;
  tenant_id: string;
  user_id: string;
  status: ImportJobStatus;
  total_rows: number;
  processed_rows: number;
  success_count: number;
  failed_count: number;
  auth_created_count: number;
  errors: ImportJobError[];
  config: HRImportConfig;
  data: any[]; // Temporary storage of CSV data
  result: ImportJobResult | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// Database schema type for Supabase client
export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: Tenant;
        Insert: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Tenant, 'id' | 'created_at' | 'updated_at'>>;
      };
      departments: {
        Row: Department;
        Insert: Omit<Department, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Department, 'id' | 'created_at' | 'updated_at'>>;
      };
      custom_field_definitions: {
        Row: CustomFieldDefinition;
        Insert: Omit<CustomFieldDefinition, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CustomFieldDefinition, 'id' | 'created_at' | 'updated_at'>>;
      };
      users: {
        Row: User;
        Insert: Omit<User, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      tenant_config: {
        Row: TenantConfig;
        Insert: Omit<TenantConfig, 'id' | 'created_at' | 'updated_at'>;
        Update: {
          tenant_id?: string;
          hr_import_config?: HRImportConfig | null;
          field_visibility_config?: FieldVisibilityConfig | null;
        };
      };
      import_jobs: {
        Row: ImportJob;
        Insert: Omit<ImportJob, 'id' | 'processed_rows' | 'success_count' | 'failed_count' | 'auth_created_count' | 'errors' | 'result' | 'created_at' | 'updated_at' | 'completed_at'>;
        Update: Partial<Omit<ImportJob, 'id' | 'tenant_id' | 'user_id' | 'created_at'>>;
      };
    };
  };
}
