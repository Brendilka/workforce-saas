-- Fix tenant_config RLS policies to use correct JWT path
-- The JWT hook stores tenant_id inside user_metadata, not at the top level

DROP POLICY IF EXISTS "Users can view config for their tenant" ON public.tenant_config;
DROP POLICY IF EXISTS "Admins can manage config for their tenant" ON public.tenant_config;

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
