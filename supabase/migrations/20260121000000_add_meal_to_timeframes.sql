-- Add meal fields to work_schedule_timeframes table
-- This allows each timeframe to have its own meal configuration

ALTER TABLE work_schedule_timeframes
ADD COLUMN meal_type TEXT DEFAULT 'paid' CHECK (meal_type IN ('paid', 'unpaid')),
ADD COLUMN meal_start TIME,
ADD COLUMN meal_end TIME;

-- Migrate existing meal data from work_schedules to the first timeframe
UPDATE work_schedule_timeframes wstf
SET 
  meal_type = ws.meal_type,
  meal_start = ws.meal_start,
  meal_end = ws.meal_end
FROM work_schedules ws
WHERE wstf.work_schedule_id = ws.id
  AND wstf.frame_order = 0
  AND ws.meal_start IS NOT NULL
  AND ws.meal_end IS NOT NULL;

-- Drop meal columns from work_schedules table (now stored per timeframe)
ALTER TABLE work_schedules
DROP COLUMN meal_type,
DROP COLUMN meal_start,
DROP COLUMN meal_end;
