-- Add tenant_id to roster_patterns for multi-tenant isolation

ALTER TABLE public.roster_patterns
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Backfill existing rows with first tenant (if any rows exist)
UPDATE public.roster_patterns
SET tenant_id = (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1)
WHERE tenant_id IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE public.roster_patterns
ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_roster_patterns_tenant_id ON public.roster_patterns(tenant_id);

COMMENT ON COLUMN public.roster_patterns.tenant_id IS 'Tenant that owns this roster pattern';

-- RLS for roster_patterns
ALTER TABLE public.roster_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roster_patterns_select_own_tenant" ON public.roster_patterns;
CREATE POLICY "roster_patterns_select_own_tenant" ON public.roster_patterns
  FOR SELECT
  USING (tenant_id::text = auth.jwt() -> 'user_metadata' ->> 'tenant_id');

DROP POLICY IF EXISTS "roster_patterns_insert_own_tenant" ON public.roster_patterns;
CREATE POLICY "roster_patterns_insert_own_tenant" ON public.roster_patterns
  FOR INSERT
  WITH CHECK (tenant_id::text = auth.jwt() -> 'user_metadata' ->> 'tenant_id');

DROP POLICY IF EXISTS "roster_patterns_update_own_tenant" ON public.roster_patterns;
CREATE POLICY "roster_patterns_update_own_tenant" ON public.roster_patterns
  FOR UPDATE
  USING (tenant_id::text = auth.jwt() -> 'user_metadata' ->> 'tenant_id')
  WITH CHECK (tenant_id::text = auth.jwt() -> 'user_metadata' ->> 'tenant_id');

DROP POLICY IF EXISTS "roster_patterns_delete_own_tenant" ON public.roster_patterns;
CREATE POLICY "roster_patterns_delete_own_tenant" ON public.roster_patterns
  FOR DELETE
  USING (tenant_id::text = auth.jwt() -> 'user_metadata' ->> 'tenant_id');
