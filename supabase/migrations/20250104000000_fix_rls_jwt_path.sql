-- Fix RLS policies to use correct JWT path for tenant_id
-- The tenant_id is in user_metadata, not at the root level of the JWT

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view users in their tenant" ON public.users;
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Users can update profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Users can select tenant config" ON public.tenant_config;
DROP POLICY IF EXISTS "Admins can insert tenant config" ON public.tenant_config;
DROP POLICY IF EXISTS "Admins can update tenant config" ON public.tenant_config;
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
DROP POLICY IF EXISTS "Users can view departments in their tenant" ON public.departments;
DROP POLICY IF EXISTS "Admins can manage departments in their tenant" ON public.departments;
DROP POLICY IF EXISTS "Users can view custom field definitions in their tenant" ON public.custom_field_definitions;
DROP POLICY IF EXISTS "Admins can manage custom field definitions in their tenant" ON public.custom_field_definitions;

-- Recreate policies with correct JWT path

-- Users table
CREATE POLICY "Users can view users in their tenant"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

-- Profiles table
CREATE POLICY "Users can view profiles in their tenant"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

CREATE POLICY "Users can insert profiles in their tenant"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
    );

CREATE POLICY "Users can update profiles in their tenant"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
    );

-- Tenant config table
CREATE POLICY "Users can select tenant config"
    ON public.tenant_config
    FOR SELECT
    TO authenticated
    USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

CREATE POLICY "Admins can insert tenant config"
    ON public.tenant_config
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
    );

CREATE POLICY "Admins can update tenant config"
    ON public.tenant_config
    FOR UPDATE
    TO authenticated
    USING (
        tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
    );

-- Tenants table
CREATE POLICY "Users can view their own tenant"
    ON public.tenants
    FOR SELECT
    TO authenticated
    USING (id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

-- Departments table
CREATE POLICY "Users can view departments in their tenant"
    ON public.departments
    FOR SELECT
    TO authenticated
    USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

CREATE POLICY "Admins can manage departments in their tenant"
    ON public.departments
    FOR ALL
    TO authenticated
    USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'))
    WITH CHECK (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

-- Custom field definitions table
CREATE POLICY "Users can view custom field definitions in their tenant"
    ON public.custom_field_definitions
    FOR SELECT
    TO authenticated
    USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

CREATE POLICY "Admins can manage custom field definitions in their tenant"
    ON public.custom_field_definitions
    FOR ALL
    TO authenticated
    USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'))
    WITH CHECK (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));
