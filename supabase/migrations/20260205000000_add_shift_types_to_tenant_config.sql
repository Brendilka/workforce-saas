-- Add configurable shift types to tenant_config (e.g. "Morning", "12-8", "Split shift")
ALTER TABLE public.tenant_config
ADD COLUMN IF NOT EXISTS shift_types JSONB DEFAULT NULL;

COMMENT ON COLUMN public.tenant_config.shift_types IS 'Array of { id: string, label: string } for shift type dropdown (work schedule form). Defaults to Continuous shift / Split shift if null.';
