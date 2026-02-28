-- Migration: Add night shift allocation fields to roster_patterns table
-- Date: 2026-02-23
-- Description: Adds configuration for night shift date allocation rules

ALTER TABLE roster_patterns
ADD COLUMN IF NOT EXISTS night_shift_allocation_mode VARCHAR(50) DEFAULT 'START_DAY',
ADD COLUMN IF NOT EXISTS night_shift_allocation_params JSONB DEFAULT '{}';

-- Create index for efficient queries on mode
CREATE INDEX IF NOT EXISTS idx_roster_patterns_night_shift_mode 
ON roster_patterns(night_shift_allocation_mode);

-- Add comment for documentation
COMMENT ON COLUMN roster_patterns.night_shift_allocation_mode IS 
'Enum: START_DAY, MAJORITY_HOURS, SPLIT_BY_DAY, FIXED_ROSTER_DAY, WEEKLY_BALANCING';

COMMENT ON COLUMN roster_patterns.night_shift_allocation_params IS 
'JSON object containing mode-specific parameters for night shift allocation';
