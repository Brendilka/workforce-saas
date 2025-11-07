-- Initial schema for workforce SaaS platform
-- Multi-tenant architecture with RLS (Row Level Security)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, name)
);

-- Create custom field definitions table
CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select')),
    field_options JSONB DEFAULT NULL, -- For select type
    required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, field_name)
);

-- Create indexes
CREATE INDEX idx_departments_tenant_id ON public.departments(tenant_id);
CREATE INDEX idx_custom_field_definitions_tenant_id ON public.custom_field_definitions(tenant_id);

-- Enable Row Level Security
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER departments_updated_at
    BEFORE UPDATE ON public.departments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER custom_field_definitions_updated_at
    BEFORE UPDATE ON public.custom_field_definitions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies for tenants
CREATE POLICY "Service role can manage all tenants"
    ON public.tenants
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can view their tenant"
    ON public.tenants
    FOR SELECT
    TO authenticated
    USING (id::text = auth.jwt() ->> 'tenant_id');

-- RLS Policies for departments
CREATE POLICY "Service role can manage all departments"
    ON public.departments
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can view departments in their tenant"
    ON public.departments
    FOR SELECT
    TO authenticated
    USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Users can manage departments in their tenant"
    ON public.departments
    FOR ALL
    TO authenticated
    USING (tenant_id::text = auth.jwt() ->> 'tenant_id')
    WITH CHECK (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- RLS Policies for custom_field_definitions
CREATE POLICY "Service role can manage all custom fields"
    ON public.custom_field_definitions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can view custom fields in their tenant"
    ON public.custom_field_definitions
    FOR SELECT
    TO authenticated
    USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Users can manage custom fields in their tenant"
    ON public.custom_field_definitions
    FOR ALL
    TO authenticated
    USING (tenant_id::text = auth.jwt() ->> 'tenant_id')
    WITH CHECK (tenant_id::text = auth.jwt() ->> 'tenant_id');
