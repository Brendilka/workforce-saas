-- Add meal and description fields to work_schedules
ALTER TABLE public.work_schedules
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS meal_type TEXT NOT NULL DEFAULT 'paid' CHECK (meal_type IN ('paid', 'unpaid')),
  ADD COLUMN IF NOT EXISTS meal_start TIME,
  ADD COLUMN IF NOT EXISTS meal_end TIME;
