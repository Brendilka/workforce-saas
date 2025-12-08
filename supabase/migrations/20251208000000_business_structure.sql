-- Create cost centers table
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- Create business structures table
CREATE TABLE IF NOT EXISTS public.business_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  max_levels INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create business units table
CREATE TABLE IF NOT EXISTS public.business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_structure_id UUID NOT NULL REFERENCES public.business_structures(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  level INTEGER NOT NULL CHECK (level >= 0),
  position_x DECIMAL(10, 2) DEFAULT 0,
  position_y DECIMAL(10, 2) DEFAULT 0,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create business unit relationships table (for dependencies/connections)
CREATE TABLE IF NOT EXISTS public.business_unit_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_structure_id UUID NOT NULL REFERENCES public.business_structures(id) ON DELETE CASCADE,
  parent_unit_id UUID NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
  child_unit_id UUID NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_unit_id, child_unit_id),
  CHECK (parent_unit_id != child_unit_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cost_centers_tenant ON public.cost_centers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_structures_tenant ON public.business_structures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_structures_active ON public.business_structures(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_business_units_structure ON public.business_units(business_structure_id);
CREATE INDEX IF NOT EXISTS idx_business_units_cost_center ON public.business_units(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_business_unit_relationships_structure ON public.business_unit_relationships(business_structure_id);
CREATE INDEX IF NOT EXISTS idx_business_unit_relationships_parent ON public.business_unit_relationships(parent_unit_id);
CREATE INDEX IF NOT EXISTS idx_business_unit_relationships_child ON public.business_unit_relationships(child_unit_id);

-- Enable RLS
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_unit_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cost_centers
CREATE POLICY "Users can view cost centers in their tenant"
  ON public.cost_centers FOR SELECT
  USING (tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID);

CREATE POLICY "Admins can insert cost centers"
  ON public.cost_centers FOR INSERT
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can update cost centers"
  ON public.cost_centers FOR UPDATE
  USING (
    tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can delete cost centers"
  ON public.cost_centers FOR DELETE
  USING (
    tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- RLS Policies for business_structures
CREATE POLICY "Users can view business structures in their tenant"
  ON public.business_structures FOR SELECT
  USING (tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID);

CREATE POLICY "Admins can insert business structures"
  ON public.business_structures FOR INSERT
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can update business structures"
  ON public.business_structures FOR UPDATE
  USING (
    tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can delete business structures"
  ON public.business_structures FOR DELETE
  USING (
    tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- RLS Policies for business_units
CREATE POLICY "Users can view business units in their tenant"
  ON public.business_units FOR SELECT
  USING (
    business_structure_id IN (
      SELECT id FROM public.business_structures
      WHERE tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
    )
  );

CREATE POLICY "Admins can insert business units"
  ON public.business_units FOR INSERT
  WITH CHECK (
    business_structure_id IN (
      SELECT id FROM public.business_structures
      WHERE tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
      AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    )
  );

CREATE POLICY "Admins can update business units"
  ON public.business_units FOR UPDATE
  USING (
    business_structure_id IN (
      SELECT id FROM public.business_structures
      WHERE tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
      AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    )
  );

CREATE POLICY "Admins can delete business units"
  ON public.business_units FOR DELETE
  USING (
    business_structure_id IN (
      SELECT id FROM public.business_structures
      WHERE tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
      AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    )
  );

-- RLS Policies for business_unit_relationships
CREATE POLICY "Users can view relationships in their tenant"
  ON public.business_unit_relationships FOR SELECT
  USING (
    business_structure_id IN (
      SELECT id FROM public.business_structures
      WHERE tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
    )
  );

CREATE POLICY "Admins can insert relationships"
  ON public.business_unit_relationships FOR INSERT
  WITH CHECK (
    business_structure_id IN (
      SELECT id FROM public.business_structures
      WHERE tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
      AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    )
  );

CREATE POLICY "Admins can update relationships"
  ON public.business_unit_relationships FOR UPDATE
  USING (
    business_structure_id IN (
      SELECT id FROM public.business_structures
      WHERE tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
      AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    )
  );

CREATE POLICY "Admins can delete relationships"
  ON public.business_unit_relationships FOR DELETE
  USING (
    business_structure_id IN (
      SELECT id FROM public.business_structures
      WHERE tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID
      AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    )
  );

-- Function to ensure only one active business structure per tenant
CREATE OR REPLACE FUNCTION set_active_business_structure()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.business_structures
    SET is_active = false
    WHERE tenant_id = NEW.tenant_id
      AND id != NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_active_business_structure
  BEFORE INSERT OR UPDATE ON public.business_structures
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION set_active_business_structure();
