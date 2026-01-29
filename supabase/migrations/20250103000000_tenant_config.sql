-- Tenant configuration table for HR import and page visibility settings

CREATE TABLE IF NOT EXISTS public.tenant_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,

    -- HR Import configuration
    hr_import_config JSONB DEFAULT NULL,
    -- Example structure:
    -- {
    --   "systemName": "BambooHR",
    --   "sourceFields": ["emp_id", "fname", "lname", ...],
    --   "fieldMapping": {
    --     "emp_id": "employee_number",
    --     "fname": "first_name",
    --     "lname": "last_name"
    --   },
    --   "requiredFields": ["email", "first_name", "last_name"]
    -- }

    -- Page field visibility and grouping configuration
    field_visibility_config JSONB DEFAULT NULL,
    -- Example structure:
    -- {
    --   "employee-personal-info": {
    --     "visibleFields": ["first_name", "last_name", "email", ...],
    --     "fieldGroups": [
    --       {
    --         "groupName": "Basic Information",
    --         "fields": ["first_name", "last_name", "email"]
    --       },
    --       {
    --         "groupName": "Employment Details",
    --         "fields": ["hire_date", "department", "employee_number"]
    --       }
    --     ]
    --   }
    -- }

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index
CREATE INDEX idx_tenant_config_tenant_id ON public.tenant_config(tenant_id);

-- Enable Row Level Security
ALTER TABLE public.tenant_config ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger
CREATE TRIGGER tenant_config_updated_at
    BEFORE UPDATE ON public.tenant_config
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies
CREATE POLICY "Service role can manage all tenant configs"
    ON public.tenant_config
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can view config for their tenant"
    ON public.tenant_config
    FOR SELECT
    TO authenticated
    USING (tenant_id::text = auth.jwt() -> 'user_metadata' ->> 'tenant_id');

CREATE POLICY "Admins can manage config for their tenant"
    ON public.tenant_config
    FOR ALL
    TO authenticated
    USING (
        tenant_id::text = auth.jwt() -> 'user_metadata' ->> 'tenant_id'
        AND EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    )
    WITH CHECK (
        tenant_id::text = auth.jwt() -> 'user_metadata' ->> 'tenant_id'
        AND EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );
