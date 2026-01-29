-- Explicitly add min_hours_between_shifts column to tenant_config
-- Using direct ALTER TABLE instead of going through schema cache issues

DO $$
BEGIN
  -- Check if column exists before adding
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_config' 
    AND column_name = 'min_hours_between_shifts'
  ) THEN
    ALTER TABLE public.tenant_config
    ADD COLUMN min_hours_between_shifts NUMERIC(4, 2) DEFAULT 8.00 
    CHECK (min_hours_between_shifts >= 0 AND min_hours_between_shifts <= 23);
    
    COMMENT ON COLUMN public.tenant_config.min_hours_between_shifts IS 'Minimum rest time required between consecutive shifts (in hours, 0-23)';
  END IF;
END $$;
