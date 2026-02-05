-- Add configurable day periods for Work Schedule columns (e.g. Night 0:00-6:00, Morning 6:00-12:00)
ALTER TABLE public.tenant_config
ADD COLUMN IF NOT EXISTS day_periods JSONB DEFAULT NULL;

COMMENT ON COLUMN public.tenant_config.day_periods IS 'Array of { id, label, startMinutes, endMinutes } for Work Schedule time columns. Must cover 0-1440, no overlaps, max 10.';
