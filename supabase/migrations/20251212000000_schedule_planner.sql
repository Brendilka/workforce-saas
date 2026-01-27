-- Schedule Planner schema (Kronos-like schedules)

-- Shift templates (predefined shift times/labels)
CREATE TABLE IF NOT EXISTS public.shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  spans_midnight BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_shift_templates_tenant_id ON public.shift_templates(tenant_id);

CREATE TRIGGER shift_templates_updated_at
  BEFORE UPDATE ON public.shift_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all shift_templates"
  ON public.shift_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view shift_templates in their tenant"
  ON public.shift_templates
  FOR SELECT
  TO authenticated
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Admins can manage shift_templates in their tenant"
  ON public.shift_templates
  FOR ALL
  TO authenticated
  USING (
    tenant_id::text = auth.jwt() ->> 'tenant_id'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    tenant_id::text = auth.jwt() ->> 'tenant_id'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );


-- Pattern templates (multi-day template of shift templates)
CREATE TABLE IF NOT EXISTS public.pattern_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_pattern_templates_tenant_id ON public.pattern_templates(tenant_id);

CREATE TRIGGER pattern_templates_updated_at
  BEFORE UPDATE ON public.pattern_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.pattern_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all pattern_templates"
  ON public.pattern_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view pattern_templates in their tenant"
  ON public.pattern_templates
  FOR SELECT
  TO authenticated
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Admins can manage pattern_templates in their tenant"
  ON public.pattern_templates
  FOR ALL
  TO authenticated
  USING (
    tenant_id::text = auth.jwt() ->> 'tenant_id'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    tenant_id::text = auth.jwt() ->> 'tenant_id'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );


CREATE TABLE IF NOT EXISTS public.pattern_template_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_template_id UUID NOT NULL REFERENCES public.pattern_templates(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  shift_template_id UUID REFERENCES public.shift_templates(id) ON DELETE SET NULL,
  start_time TIME,
  end_time TIME,
  spans_midnight BOOLEAN NOT NULL DEFAULT false,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(pattern_template_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_pattern_template_details_template_id ON public.pattern_template_details(pattern_template_id);

ALTER TABLE public.pattern_template_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all pattern_template_details"
  ON public.pattern_template_details
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view pattern_template_details in their tenant"
  ON public.pattern_template_details
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pattern_templates pt
      WHERE pt.id = pattern_template_details.pattern_template_id
      AND pt.tenant_id::text = auth.jwt() ->> 'tenant_id'
    )
  );

CREATE POLICY "Admins can manage pattern_template_details in their tenant"
  ON public.pattern_template_details
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pattern_templates pt
      WHERE pt.id = pattern_template_details.pattern_template_id
      AND pt.tenant_id::text = auth.jwt() ->> 'tenant_id'
    )
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pattern_templates pt
      WHERE pt.id = pattern_template_details.pattern_template_id
      AND pt.tenant_id::text = auth.jwt() ->> 'tenant_id'
    )
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );


-- Scheduled shifts (per employee per day; single segment per day for MVP)
CREATE TABLE IF NOT EXISTS public.schedule_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  spans_midnight BOOLEAN NOT NULL DEFAULT false,
  shift_template_id UUID REFERENCES public.shift_templates(id) ON DELETE SET NULL,
  source_pattern_template_id UUID REFERENCES public.pattern_templates(id) ON DELETE SET NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(profile_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_schedule_shifts_tenant_date ON public.schedule_shifts(tenant_id, work_date);
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_profile_date ON public.schedule_shifts(profile_id, work_date);
CREATE INDEX IF NOT EXISTS idx_schedule_shifts_department_date ON public.schedule_shifts(department_id, work_date);

CREATE TRIGGER schedule_shifts_updated_at
  BEFORE UPDATE ON public.schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.schedule_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all schedule_shifts"
  ON public.schedule_shifts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view schedule_shifts in their tenant"
  ON public.schedule_shifts
  FOR SELECT
  TO authenticated
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Admins can manage schedule_shifts in their tenant"
  ON public.schedule_shifts
  FOR ALL
  TO authenticated
  USING (
    tenant_id::text = auth.jwt() ->> 'tenant_id'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    tenant_id::text = auth.jwt() ->> 'tenant_id'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );
