-- Add min_hours_between_shifts column to tenant_config

ALTER TABLE public.tenant_config
ADD COLUMN IF NOT EXISTS min_hours_between_shifts NUMERIC(4, 2) DEFAULT 8.00 CHECK (min_hours_between_shifts >= 0 AND min_hours_between_shifts <= 23);

COMMENT ON COLUMN public.tenant_config.min_hours_between_shifts IS 'Minimum rest time required between consecutive shifts (in hours, 0-23)';
