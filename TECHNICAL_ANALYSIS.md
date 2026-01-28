# Technical Analysis: Work Schedule and Roster Pattern System

## Executive Summary
This document provides a comprehensive technical analysis of how the workforce management application currently handles work schedules and roster patterns, particularly regarding shifts that span across midnight boundaries. It identifies the current implementation limitations and challenges that prevent proper support for complex scheduling scenarios.

---

## System Architecture Overview

### Core Components

#### 1. **Data Model (Database Schema)**

**Work Schedules Table** (`work_schedules`)
- `id`: UUID primary key
- `tenant_id`: UUID (organization/tenant ownership)
- `shift_id`: TEXT (unique identifier like "Day9-5 Perm", "shift_morning_01")
- `shift_type`: TEXT enum (either "Continuous shift" or "Split shift")
- `description`: TEXT (optional human-readable description)
- `created_at`, `updated_at`: TIMESTAMPTZ

**Work Schedule Timeframes Table** (`work_schedule_timeframes`)
- `id`: UUID primary key
- `work_schedule_id`: UUID (foreign key to work_schedules)
- `start_time`: TIME (24-hour format, e.g., "21:00:00")
- `end_time`: TIME (24-hour format, e.g., "02:00:00")
- `frame_order`: INTEGER (position in sequence, 0-indexed)
- `meal_type`: TEXT enum ("paid" or "unpaid")
- `meal_start`: TIME (optional meal break start)
- `meal_end`: TIME (optional meal break end)
- `created_at`, `updated_at`: TIMESTAMPTZ

**Key Design Decision**: 
- Times are stored as simple TIME values (just hours and minutes)
- No date information is attached to individual timeframes
- Midnight-spanning logic is handled in application code, not in the database

---

## Current Implementation Details

### Work Schedule Creation Flow

#### 1. **Frontend: Work Schedule Form Component** (`src/components/work-schedule-form.tsx`)

**Input Parsing**
- Accepts multiple time input formats:
  - 24-hour format: "9", "21", "21:00"
  - 12-hour format: "9p", "9pm", "8a", "8am"
- Converts all input to 24-hour "HH:MM" format for storage

**Timeframe Management**
- Users can add multiple timeframes per shift (supports "Continuous shift" or "Split shift")
- Each timeframe has:
  - Start time and end time
  - Optional meal break (with paid/unpaid flag)

**Validation Logic** (Pre-submission checks)

1. **Overlap Detection**:
   ```
   - Compares each pair of timeframes
   - When end_time < start_time, adds 24*60 minutes to end_time
   - Interprets this as a midnight-spanning shift
   - Checks if intervals overlap using: start1 < end2 && start2 < end1
   ```

2. **Meal Validation**:
   - Meal times must fall within their parent timeframe
   - Uses same midnight-normalization logic
   - Both meal_start AND meal_end must be provided (can't have one without the other)

3. **End Time After Start Time**:
   - Validates end_time > start_time (with midnight logic)

**Backend Submission** (`src/app/api/admin/work-schedules/route.ts`)

The POST endpoint receives:
```json
{
  "shiftId": "shift_name",
  "shiftType": "Continuous shift" or "Split shift",
  "description": "optional",
  "timeframes": [
    {
      "startTime": "21:00",
      "endTime": "02:00",
      "mealType": "unpaid",
      "mealStart": "22:00",
      "mealEnd": "22:30"
    }
  ]
}
```

The backend:
1. Extracts tenant_id from authenticated user
2. Validates meal boundaries (same midnight logic)
3. Creates `work_schedules` record
4. Creates `work_schedule_timeframes` records with frame_order
5. Returns complete schedule with nested timeframes

**Key Function: `normalizeInterval`**
```typescript
const normalizeInterval = (start: string, end: string) => {
  const [sH, sM] = start.split(":").map(Number);
  const [eH, eM] = end.split(":").map(Number);
  const s = sH * 60 + sM;
  let e = eH * 60 + eM;
  if (e < s) e += 24 * 60;  // If end < start, add 24 hours
  return { start: s, end: e };
};
```

---

## Current Roster Pattern Feature

### Overview
The Roster Pattern feature (`src/app/admin/roster-patterns/`) allows managers to:
1. Create named patterns (e.g., "2-week rotation")
2. Define a repeating cycle of weeks
3. Assign shifts to specific days of the week
4. Specify which week of the cycle each row represents

### Current UI Structure
```
┌─ Shift ID Input
├─ Start Date (with calendar picker)
├─ End Date (either "Specify date" or "Continuously")
├─ Define Pattern for Week(s): [number]
├─ Start Pattern on week: [number]
│
└─ Shift Assignment Table
   ┌─ Row No. (1, 2, 3, ...)
   ├─ Monday [dropdown to select shift]
   ├─ Tuesday [dropdown to select shift]
   ├─ Wednesday [dropdown to select shift]
   ├─ Thursday [dropdown to select shift]
   ├─ Friday [dropdown to select shift]
   ├─ Saturday [dropdown to select shift]
   └─ Sunday [dropdown to select shift]
```

**Table rows** represent different weeks in the pattern
- Row 1 = Week 1
- Row 2 = Week 2
- etc.

When pattern repeats (e.g., 2-week cycle), it cycles back to Row 1.

---

## CURRENT CHALLENGES AND LIMITATIONS

### Challenge 1: Midnight-Spanning Shifts Cannot Be Applied to Pattern Days

**Problem**:
When a shift spans midnight (e.g., 21:00 → 02:00), the system stores it as a single timeframe with:
- `start_time`: "21:00"
- `end_time`: "02:00"

However, in a roster pattern context, this shift logically affects **two calendar days**:
- It starts on one day (e.g., Monday) at 21:00
- It ends on the next day (e.g., Tuesday) at 02:00

**Current System Behavior**:
- The roster pattern table only has one cell per day per week
- When assigning a midnight-spanning shift to "Monday", it's unclear:
  - Does it represent the shift starting Monday 21:00?
  - Or the shift ending Tuesday 02:00?
  - What happens visually when you try to see which days this shift covers?

**Data Storage Issue**:
- Roster patterns need to record which shift is assigned to which day
- But a single row+column intersection can only hold one shift reference
- A midnight-spanning shift logically spans two rows

**Example Scenario**:
```
Pattern Week 1:
│ Monday    │ shift_night (21:00-02:00)
│ Tuesday   │ shift_day (09:00-17:00)

Question: Does the night shift occupy Monday only or Monday+Tuesday?
If Monday only, when does employee work 00:00-02:00 on Tuesday?
If Monday+Tuesday, how does one cell represent that?
```

---

### Challenge 2: Same-Day Multiple Shifts (Split Shifts on Different Days)

**Problem**:
Managers want to assign shifts in a way where an employee can have:
- A night shift ending at 2 AM (Monday 21:00 → Tuesday 02:00)
- PLUS a day shift starting at 9 AM the same "logical day" (Tuesday 09:00 → Tuesday 17:00)

**Current Limitation**:
- The "Split shift" type in work schedules allows multiple timeframes, but they're all defined within a single shift definition
- Example: A split shift could be "08:00-12:00" + "13:00-17:00" (morning + afternoon on same day)

**Roster Pattern Problem**:
- The pattern table has one cell per day per shift assignment
- A manager can't say "assign Monday night + Tuesday day" to the same logical roster position
- Can't express: "Monday gets night shift; Tuesday gets day shift; they're part of the same schedule rotation"

**Why This Matters**:
Many modern work schedules use this pattern:
- Night shift 21:00-06:00 (Monday night → Tuesday early morning)
- Day shift 09:00-17:00 (Tuesday day)
- Off Wednesday
- Off Thursday
- Off Friday
- Off Saturday
- Off Sunday
- Night shift 21:00-06:00 (Sunday night → Monday early morning)

The system needs to express that the night shift spans two rows in the pattern.

---

### Challenge 3: Last Day of Pattern Boundary Handling

**Problem**:
When a roster pattern ends on the last day of a cycle and that day has a midnight-spanning shift, the system doesn't know:
- Should the shift continue to the first day of the next cycle?
- Or should it be truncated?
- Or should it be an error?

**Scenario**:
```
2-week pattern
Week 2, Sunday: Assign shift_night (21:00-02:00)

Pattern repeats on Monday of Week 1.
But the night shift from Week 2 Sunday should logically continue to Week 1 Monday 02:00.

Question: Is this shift automatically applied to the next cycle's Week 1 Monday?
```

---

### Challenge 4: Data Storage for Roster Patterns

**Current Issue**:
- Roster patterns appear to be a UI concept, but there's no database schema for storing them
- The screenshot shows a form to create patterns, but where are they saved?
- How are completed patterns persisted?

**Missing Schema Questions**:
- Do we need a `roster_patterns` table?
- How do we store the assignment of shifts to days?
- How do we handle the repeating week cycles?
- How do we know which pattern applies to which date range?

---

### Challenge 5: Visualization and UX

**Problem**:
When a user assigns a midnight-spanning shift to a day in the pattern, how should the UI show this?

**Current UI**:
- Pattern table shows days of the week
- Each cell contains a shift name
- User selects from available shifts dropdown

**Missing Information**:
- No visual indication that shift "X" spans multiple days
- No warning that assigning a Monday midnight shift affects Tuesday too
- No way to see the actual time ranges when scheduling

**Example of Ambiguity**:
```
Monday: shift_night (21:00-02:00)
Tuesday: shift_day (09:00-17:00)

Visual question:
- Is the Tuesday 00:00-02:00 covered by Monday's night shift?
- Or is there a conflict/gap?
- How does a manager know what the actual schedule looks like?
```

---

## Technical Deep Dive: Midnight Handling

### Current Implementation Pattern

**In Work Schedule Form**:
```typescript
const normalizeInterval = (start: string, end: string) => {
  const [sH, sM] = start.split(":").map(Number);
  const [eH, eM] = end.split(":").map(Number);
  const s = sH * 60 + sM;
  let e = eH * 60 + eM;
  if (e < s) e += 24 * 60;  // Add 24 hours in minutes
  return { start: s, end: e };
};
```

This converts times to "minutes since midnight" and adds 24 hours (1440 minutes) if the end is earlier than the start.

**Example**:
- Input: start="21:00", end="02:00"
- start_minutes = 21*60 + 0 = 1260
- end_minutes = 2*60 + 0 = 120
- Since 120 < 1260, add 1440: end_minutes = 120 + 1440 = 1560
- Result: shift spans from minute 1260 to minute 1560 (24-hour period)

**Problem**:
This works fine for validation within a single shift definition. But when applying to calendar days, there's no day information.

---

## Database Schema Gaps

The system is missing explicit data structures for:

1. **Roster Pattern Definition**
   ```sql
   CREATE TABLE roster_patterns (
     id UUID,
     tenant_id UUID,
     name TEXT,
     pattern_week_count INT, -- 1, 2, 3, etc.
     start_date DATE,
     end_date DATE,
     is_continuous BOOLEAN,
     created_at TIMESTAMPTZ
   );
   ```

2. **Roster Pattern Assignments**
   ```sql
   CREATE TABLE roster_pattern_assignments (
     id UUID,
     roster_pattern_id UUID,
     pattern_week INT,      -- Which week of the pattern (1, 2, ...)
     day_of_week INT,       -- 0=Sunday, 1=Monday, ..., 6=Saturday
     work_schedule_id UUID, -- Which shift to assign
     created_at TIMESTAMPTZ
   );
   ```

3. **Roster Pattern Application** (per employee)
   ```sql
   CREATE TABLE roster_patterns_application (
     id UUID,
     employee_id UUID,
     roster_pattern_id UUID,
     start_date DATE,
     end_date DATE,
     created_at TIMESTAMPTZ
   );
   ```

Without these, the pattern creation UI has nowhere to save data.

---

## Summary: Why This Is Hard

### Root Causes

1. **Time-Only Storage**: Shifts are stored as just times, not dates+times
   - System doesn't know which calendar day a shift occupies
   - Midnight-spanning shifts are ambiguous in a pattern context

2. **Single Cell Per Day**: Pattern grid has one cell per day per shift
   - Can't express "shift occupies Monday night AND Tuesday morning"
   - No way to chain shifts across day boundaries

3. **No Persistent Pattern Storage**: Pattern feature has no database schema
   - Can't save patterns
   - Can't apply patterns to employee schedules
   - Can't validate pattern assignments against timeframe data

4. **Conflicting Requirements**:
   - Shift definitions are "abstract" (don't care about calendar)
   - Pattern application is "concrete" (cares about specific dates)
   - No bridge between the two concepts

---

## Recommended Redesign Approach

To solve these challenges, consider:

1. **Date-Aware Shift Assignments in Patterns**
   - Each pattern assignment should explicitly mark which calendar date(s) it spans
   - Midnight-spanning shifts automatically mark both days

2. **Explicit Multi-Day Shift Support**
   - Allow assigning a shift to "Monday+Tuesday" as a linked pair
   - Provide clear UI showing multi-day spans

3. **Pattern Storage**
   - Persist roster patterns to database
   - Create audit trail of pattern changes
   - Enable pattern reuse across employees

4. **Visualization Improvements**
   - Show actual time ranges when hovering/selecting shifts
   - Highlight multi-day shifts differently
   - Warn when assigning conflicting shifts

5. **Validation Rules**
   - Prevent assigning overlapping shifts on the same day
   - Warn about midnight-spanning shifts at pattern boundaries
   - Validate total hours per day/week

---

## Files Involved

- **Database**: `supabase/migrations/20260119000000_work_schedules.sql`
- **Form Component**: `src/components/work-schedule-form.tsx` (908 lines)
- **API Endpoint**: `src/app/api/admin/work-schedules/route.ts` (204 lines)
- **Pattern Feature**: `src/app/admin/roster-patterns/roster-patterns-client.tsx` (1437 lines)
- **Pattern Page**: `src/app/admin/roster-patterns/page.tsx`
- **Work Schedule UI**: `src/app/admin/work-schedule/WorkScheduleClient.tsx` (279 lines)

---

## Conclusion

The current system successfully handles creating work schedules with support for midnight-spanning shifts at the definition level. However, it lacks the infrastructure to properly apply these shifts to roster patterns because:

1. Roster patterns have no persistent data model
2. Pattern grid structure doesn't accommodate multi-day shifts
3. No mechanism to express that a shift affects multiple calendar days
4. UI/UX doesn't help managers visualize complex scheduling scenarios

A successful solution must bridge the gap between abstract shift definitions (time-only) and concrete schedule assignments (date+time), with clear data models and user-friendly interfaces for managing multi-day shifts.
