-- Create table for roster patterns
create table if not exists public.roster_patterns (
  id uuid primary key default gen_random_uuid(),
  shift_id text not null,
  start_date date,
  end_date_type text not null default 'continuous',
  end_date date,
  weeks_pattern text not null default '1',
  start_pattern_week text not null default '1',
  start_day text not null default 'Monday',
  pattern_rows jsonb not null,
  created_at timestamptz not null default now()
);

-- Index for listing newest first
create index if not exists roster_patterns_created_at_idx on public.roster_patterns (created_at desc);
