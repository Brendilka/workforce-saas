-- Users and Profiles tables for authentication and HR data

-- Create user roles enum
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'employee');

-- Create users table (links to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role user_role DEFAULT 'employee' NOT NULL,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create employment status enum
CREATE TYPE employment_status AS ENUM ('active', 'on_leave', 'terminated');

-- Create profiles table (HR data from imports)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    employee_number TEXT,
    hire_date DATE,
    employment_status employment_status DEFAULT 'active' NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Ensure email is unique within a tenant
    UNIQUE(tenant_id, email)
);

-- Create indexes for better query performance
CREATE INDEX idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_employment_status ON public.profiles(employment_status);
CREATE INDEX idx_profiles_department_id ON public.profiles(department_id);
CREATE INDEX idx_profiles_custom_fields ON public.profiles USING GIN (custom_fields);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add updated_at triggers
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies for users
CREATE POLICY "Service role can manage all users"
    ON public.users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can view users in their tenant"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Users can update their own record"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- RLS Policies for profiles
CREATE POLICY "Service role can manage all profiles"
    ON public.profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can view profiles in their tenant"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage profiles in their tenant"
    ON public.profiles
    FOR ALL
    TO authenticated
    USING (
        tenant_id::text = auth.jwt() ->> 'tenant_id'
        AND EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    )
    WITH CHECK (
        tenant_id::text = auth.jwt() ->> 'tenant_id'
        AND EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );
