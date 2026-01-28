-- Phase 1: Database Schema Updates for Overnight Shift Support
-- This migration adds support for shifts that span across midnight boundaries

-- Add spans_midnight flag to work_schedules table
ALTER TABLE public.work_schedules
ADD COLUMN IF NOT EXISTS spans_midnight BOOLEAN DEFAULT FALSE;

-- Add comment explaining this is a derived column
COMMENT ON COLUMN public.work_schedules.spans_midnight IS 
'Automatically set to TRUE when any timeframe has end_time < start_time (indicates midnight crossing). Used for indexing and quick filtering.';

-- Create index for faster queries on midnight-spanning shifts
CREATE INDEX IF NOT EXISTS idx_work_schedules_spans_midnight 
ON public.work_schedules(tenant_id, spans_midnight);
