-- Work Schedules (custom shift definitions)

CREATE TABLE IF NOT EXISTS public.work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shift_id TEXT NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('Continuous shift', 'Split shift')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(tenant_id, shift_id)
);

CREATE INDEX IF NOT EXISTS idx_work_schedules_tenant_id ON public.work_schedules(tenant_id);

DROP TRIGGER IF EXISTS work_schedules_updated_at ON public.work_schedules;
CREATE TRIGGER work_schedules_updated_at
  BEFORE UPDATE ON public.work_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies if they exist
DROP POLICY IF EXISTS "Service role can manage all work_schedules" ON public.work_schedules;
DROP POLICY IF EXISTS "Users can view work_schedules in their tenant" ON public.work_schedules;
DROP POLICY IF EXISTS "Admins can manage work_schedules in their tenant" ON public.work_schedules;
DROP POLICY IF EXISTS "Admins can insert work_schedules in their tenant" ON public.work_schedules;
DROP POLICY IF EXISTS "Admins can update work_schedules in their tenant" ON public.work_schedules;
DROP POLICY IF EXISTS "Admins can delete work_schedules in their tenant" ON public.work_schedules;

CREATE POLICY "Service role can manage all work_schedules"
  ON public.work_schedules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view work_schedules in their tenant"
  ON public.work_schedules
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can insert work_schedules in their tenant"
  ON public.work_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can update work_schedules in their tenant"
  ON public.work_schedules
  FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can delete work_schedules in their tenant"
  ON public.work_schedules
  FOR DELETE
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.users WHERE id = auth.uid()
  ));

-- Work Schedule Timeframes (for Continuous and Split shifts)

CREATE TABLE IF NOT EXISTS public.work_schedule_timeframes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_schedule_id UUID NOT NULL REFERENCES public.work_schedules(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  frame_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_schedule_timeframes_schedule_id ON public.work_schedule_timeframes(work_schedule_id);
CREATE INDEX IF NOT EXISTS idx_work_schedule_timeframes_order ON public.work_schedule_timeframes(work_schedule_id, frame_order);

DROP TRIGGER IF EXISTS work_schedule_timeframes_updated_at ON public.work_schedule_timeframes;
CREATE TRIGGER work_schedule_timeframes_updated_at
  BEFORE UPDATE ON public.work_schedule_timeframes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.work_schedule_timeframes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage all work_schedule_timeframes" ON public.work_schedule_timeframes;
DROP POLICY IF EXISTS "Users can view work_schedule_timeframes in their tenant" ON public.work_schedule_timeframes;
DROP POLICY IF EXISTS "Admins can manage work_schedule_timeframes in their tenant" ON public.work_schedule_timeframes;
DROP POLICY IF EXISTS "Admins can insert work_schedule_timeframes in their tenant" ON public.work_schedule_timeframes;
DROP POLICY IF EXISTS "Admins can update work_schedule_timeframes in their tenant" ON public.work_schedule_timeframes;
DROP POLICY IF EXISTS "Admins can delete work_schedule_timeframes in their tenant" ON public.work_schedule_timeframes;

CREATE POLICY "Service role can manage all work_schedule_timeframes"
  ON public.work_schedule_timeframes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view work_schedule_timeframes in their tenant"
  ON public.work_schedule_timeframes
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.work_schedules ws
    WHERE ws.id = work_schedule_timeframes.work_schedule_id
    AND ws.tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Admins can insert work_schedule_timeframes in their tenant"
  ON public.work_schedule_timeframes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.work_schedules ws
      WHERE ws.id = work_schedule_timeframes.work_schedule_id
      AND ws.tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can update work_schedule_timeframes in their tenant"
  ON public.work_schedule_timeframes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.work_schedules ws
      WHERE ws.id = work_schedule_timeframes.work_schedule_id
      AND ws.tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.work_schedules ws
      WHERE ws.id = work_schedule_timeframes.work_schedule_id
      AND ws.tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can delete work_schedule_timeframes in their tenant"
  ON public.work_schedule_timeframes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.work_schedules ws
      WHERE ws.id = work_schedule_timeframes.work_schedule_id
      AND ws.tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
      )
    )
  );
