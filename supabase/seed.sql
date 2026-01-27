-- Seed data for local development
-- This script creates sample tenants, users, and profiles for testing

-- Clean up existing data (for re-running seed)
TRUNCATE TABLE public.tenant_config CASCADE;
TRUNCATE TABLE public.profiles CASCADE;
TRUNCATE TABLE public.users CASCADE;
TRUNCATE TABLE public.departments CASCADE;
TRUNCATE TABLE public.custom_field_definitions CASCADE;
TRUNCATE TABLE public.tenants CASCADE;

-- ============================================================================
-- TENANTS
-- ============================================================================

INSERT INTO public.tenants (id, name, slug) VALUES
  ('d5cb6bd8-dfbf-40a1-83e2-84d308b617a9', 'Acme Corporation', 'acme-corp'),
  ('e8f9a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b', 'TechStart Inc', 'techstart-inc');

-- ============================================================================
-- DEPARTMENTS
-- ============================================================================

INSERT INTO public.departments (id, tenant_id, name, description) VALUES
  -- Acme Corp departments
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'd5cb6bd8-dfbf-40a1-83e2-84d308b617a9', 'Engineering', 'Software Engineering Team'),
  ('b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'd5cb6bd8-dfbf-40a1-83e2-84d308b617a9', 'Human Resources', 'HR Department'),
  ('c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', 'd5cb6bd8-dfbf-40a1-83e2-84d308b617a9', 'Sales', 'Sales Team'),

  -- TechStart departments
  ('d4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a', 'e8f9a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b', 'Product', 'Product Development'),
  ('e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', 'e8f9a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b', 'Marketing', 'Marketing Team');

-- ============================================================================
-- CUSTOM FIELD DEFINITIONS (Optional examples)
-- ============================================================================

INSERT INTO public.custom_field_definitions (tenant_id, field_name, field_type, required, field_options) VALUES
  -- Acme Corp custom fields
  ('d5cb6bd8-dfbf-40a1-83e2-84d308b617a9', 'employee_id', 'text', true, NULL),
  ('d5cb6bd8-dfbf-40a1-83e2-84d308b617a9', 'office_location', 'select', false, '{"options": ["New York", "San Francisco", "Remote"]}'::jsonb),

  -- TechStart custom fields
  ('e8f9a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b', 'github_username', 'text', false, NULL),
  ('e8f9a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b', 'shirt_size', 'select', false, '{"options": ["S", "M", "L", "XL", "XXL"]}'::jsonb);

-- ============================================================================
-- AUTH USERS (in auth.users table)
-- ============================================================================
-- Password for all users: "password123"
-- Note: Supabase handles password hashing, these are test accounts

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  role,
  aud,
  email_change_token_current,
  email_change_confirm_status,
  phone_change,
  phone_change_token,
  reauthentication_token,
  is_sso_user,
  is_anonymous
) VALUES
  -- Acme Corp Admin
  (
    'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c',
    '00000000-0000-0000-0000-000000000000',
    'admin@acme-corp.com',
    '$2a$06$g7rf88GIPBoRCqYQYEjHuOkebmTVRCpEgUsx59PdfP3ZS16nn2Uz2',
    NOW(),
    '{"provider":"email","providers":["email"],"tenant_id":"d5cb6bd8-dfbf-40a1-83e2-84d308b617a9"}'::jsonb,
    '{"tenant_id":"d5cb6bd8-dfbf-40a1-83e2-84d308b617a9","role":"admin"}'::jsonb,
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    'authenticated',
    'authenticated',
    '',
    0,
    '',
    '',
    '',
    false,
    false
  ),
  -- Acme Corp Employee 1
  (
    'a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d',
    '00000000-0000-0000-0000-000000000000',
    'john.doe@acme-corp.com',
    '$2a$06$g7rf88GIPBoRCqYQYEjHuOkebmTVRCpEgUsx59PdfP3ZS16nn2Uz2',
    NOW(),
    '{"provider":"email","providers":["email"],"tenant_id":"d5cb6bd8-dfbf-40a1-83e2-84d308b617a9"}'::jsonb,
    '{"tenant_id":"d5cb6bd8-dfbf-40a1-83e2-84d308b617a9","role":"employee"}'::jsonb,
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    'authenticated',
    'authenticated',
    '',
    0,
    '',
    '',
    '',
    false,
    false
  ),
  -- Acme Corp Employee 2
  (
    'b8c9d0e1-f2a3-4b5c-5d6e-7f8a9b0c1d2e',
    '00000000-0000-0000-0000-000000000000',
    'jane.smith@acme-corp.com',
    '$2a$06$g7rf88GIPBoRCqYQYEjHuOkebmTVRCpEgUsx59PdfP3ZS16nn2Uz2',
    NOW(),
    '{"provider":"email","providers":["email"],"tenant_id":"d5cb6bd8-dfbf-40a1-83e2-84d308b617a9"}'::jsonb,
    '{"tenant_id":"d5cb6bd8-dfbf-40a1-83e2-84d308b617a9","role":"employee"}'::jsonb,
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    'authenticated',
    'authenticated',
    '',
    0,
    '',
    '',
    '',
    false,
    false
  ),
  -- TechStart Admin
  (
    'c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f',
    '00000000-0000-0000-0000-000000000000',
    'admin@techstart.com',
    '$2a$06$g7rf88GIPBoRCqYQYEjHuOkebmTVRCpEgUsx59PdfP3ZS16nn2Uz2',
    NOW(),
    '{"provider":"email","providers":["email"],"tenant_id":"e8f9a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b"}'::jsonb,
    '{"tenant_id":"e8f9a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b","role":"admin"}'::jsonb,
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    'authenticated',
    'authenticated',
    '',
    0,
    '',
    '',
    '',
    false,
    false
  ),
  -- TechStart Employee 1
  (
    'd0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4a',
    '00000000-0000-0000-0000-000000000000',
    'alice.wonder@techstart.com',
    '$2a$06$g7rf88GIPBoRCqYQYEjHuOkebmTVRCpEgUsx59PdfP3ZS16nn2Uz2',
    NOW(),
    '{"provider":"email","providers":["email"],"tenant_id":"e8f9a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b"}'::jsonb,
    '{"tenant_id":"e8f9a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b","role":"employee"}'::jsonb,
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    'authenticated',
    'authenticated',
    '',
    0,
    '',
    '',
    '',
    false,
    false
  );

-- ============================================================================
-- USERS (public.users table)
-- ============================================================================

INSERT INTO public.users (id, email, role, tenant_id) VALUES
  -- Acme Corp
  ('f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', 'admin@acme-corp.com', 'admin', 'd5cb6bd8-dfbf-40a1-83e2-84d308b617a9'),
  ('a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d', 'john.doe@acme-corp.com', 'employee', 'd5cb6bd8-dfbf-40a1-83e2-84d308b617a9'),
  ('b8c9d0e1-f2a3-4b5c-5d6e-7f8a9b0c1d2e', 'jane.smith@acme-corp.com', 'employee', 'd5cb6bd8-dfbf-40a1-83e2-84d308b617a9'),

  -- TechStart
  ('c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f', 'admin@techstart.com', 'admin', 'e8f9a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b'),
  ('d0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4a', 'alice.wonder@techstart.com', 'employee', 'e8f9a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b');

-- ============================================================================
-- PROFILES
-- ============================================================================

INSERT INTO public.profiles (id, user_id, tenant_id, email, first_name, last_name, employee_number, hire_date, employment_status, department_id, custom_fields) VALUES
  -- Acme Corp
  (
    'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b',
    'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c',
    'd5cb6bd8-dfbf-40a1-83e2-84d308b617a9',
    'admin@acme-corp.com',
    'Admin',
    'User',
    'ACME-001',
    '2020-01-15',
    'active',
    'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e',
    '{"employee_id": "ACME-001", "office_location": "New York"}'::jsonb
  ),
  (
    'f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c',
    'a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d',
    'd5cb6bd8-dfbf-40a1-83e2-84d308b617a9',
    'john.doe@acme-corp.com',
    'John',
    'Doe',
    'ACME-100',
    '2021-03-20',
    'active',
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    '{"employee_id": "ACME-100", "office_location": "San Francisco"}'::jsonb
  ),
  (
    'a3b4c5d6-e7f8-4a9b-0c1d-2e3f4a5b6c7d',
    'b8c9d0e1-f2a3-4b5c-5d6e-7f8a9b0c1d2e',
    'd5cb6bd8-dfbf-40a1-83e2-84d308b617a9',
    'jane.smith@acme-corp.com',
    'Jane',
    'Smith',
    'ACME-101',
    '2021-06-10',
    'active',
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    '{"employee_id": "ACME-101", "office_location": "Remote"}'::jsonb
  ),

  -- TechStart
  (
    'b4c5d6e7-f8a9-4b0c-1d2e-3f4a5b6c7d8e',
    'c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f',
    'e8f9a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b',
    'admin@techstart.com',
    'Tech',
    'Admin',
    'TS-001',
    '2019-05-01',
    'active',
    'd4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a',
    '{"github_username": "techadmin", "shirt_size": "L"}'::jsonb
  ),
  (
    'c5d6e7f8-a9b0-4c1d-2e3f-4a5b6c7d8e9f',
    'd0e1f2a3-b4c5-4d6e-7f8a-9b0c1d2e3f4a',
    'e8f9a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b',
    'alice.wonder@techstart.com',
    'Alice',
    'Wonder',
    'TS-100',
    '2022-01-15',
    'active',
    'd4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a',
    '{"github_username": "alicewonder", "shirt_size": "M"}'::jsonb
  );

-- ============================================================================
-- TENANT CONFIG
-- ============================================================================

INSERT INTO public.tenant_config (tenant_id, hr_import_config, field_visibility_config) VALUES
  -- Acme Corp config
  (
    'd5cb6bd8-dfbf-40a1-83e2-84d308b617a9',
    '{
      "systemName": "BambooHR",
      "sourceFields": ["emp_id", "fname", "lname", "email", "hire_dt", "dept"],
      "fieldMapping": {
        "emp_id": "employee_number",
        "fname": "first_name",
        "lname": "last_name",
        "email": "email",
        "hire_dt": "hire_date",
        "dept": "department_id"
      },
      "requiredFields": ["email", "first_name", "last_name"]
    }'::jsonb,
    '{
      "employee-personal-info": {
        "visibleFields": ["first_name", "last_name", "email", "employee_number", "hire_date", "department_id", "employment_status"],
        "fieldGroups": [
          {
            "groupName": "Basic Information",
            "fields": ["first_name", "last_name", "email"]
          },
          {
            "groupName": "Employment Details",
            "fields": ["employee_number", "hire_date", "department_id", "employment_status"]
          }
        ]
      }
    }'::jsonb
  ),
  -- TechStart config
  (
    'e8f9a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b',
    '{
      "systemName": "Workday",
      "sourceFields": ["employee_id", "first_name", "last_name", "email", "start_date"],
      "fieldMapping": {
        "employee_id": "employee_number",
        "first_name": "first_name",
        "last_name": "last_name",
        "email": "email",
        "start_date": "hire_date"
      },
      "requiredFields": ["email", "first_name", "last_name", "start_date"]
    }'::jsonb,
    '{
      "employee-personal-info": {
        "visibleFields": ["first_name", "last_name", "email", "employee_number", "hire_date"],
        "fieldGroups": [
          {
            "groupName": "Personal Info",
            "fields": ["first_name", "last_name", "email"]
          },
          {
            "groupName": "Work Info",
            "fields": ["employee_number", "hire_date"]
          }
        ]
      }
    }'::jsonb
  );

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Seed data created successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'TEST CREDENTIALS (password: password123)';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Acme Corporation:';
  RAISE NOTICE '  Admin: admin@acme-corp.com';
  RAISE NOTICE '  Employee: john.doe@acme-corp.com';
  RAISE NOTICE '  Employee: jane.smith@acme-corp.com';
  RAISE NOTICE '';
  RAISE NOTICE 'TechStart Inc:';
  RAISE NOTICE '  Admin: admin@techstart.com';
  RAISE NOTICE '  Employee: alice.wonder@techstart.com';
  RAISE NOTICE '========================================';
END $$;
