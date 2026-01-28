# Overnight Shifts Implementation - Testing Guide

## Pre-Testing Setup

1. **Apply Database Migration**
   ```bash
   supabase migration up
   ```
   This will:
   - Add `spans_midnight` column to `work_schedules` table
   - Create `roster_patterns` and `roster_pattern_assignments` tables
   - Set up RLS policies for new tables

2. **Restart Dev Server**
   ```bash
   npm run dev
   ```

3. **Clear Browser Cache** (important for UI changes)
   - Clear localStorage/sessionStorage
   - Refresh page completely (Cmd+Shift+R on Mac)

---

## Test Scenarios

### PHASE 1: Work Schedule Creation with Overnight Shifts

#### Test 1.1: Create Standard Daytime Shift
**Objective**: Verify normal shifts still work (backwards compatibility)

**Steps**:
1. Navigate to Admin Dashboard → Work Schedule
2. Click "Add Schedule"
3. Enter:
   - Shift ID: `shift_day_standard`
   - Shift Type: `Continuous shift`
   - Start: `09:00`
   - End: `17:00`
4. Save

**Expected Results**:
- ✅ Shift saves successfully
- ✅ No "+1 day" label appears next to end time
- ✅ Shift appears in work schedules list
- ✅ `spans_midnight` field is `FALSE` in database

**Database Check**:
```sql
SELECT shift_id, spans_midnight FROM work_schedules 
WHERE shift_id = 'shift_day_standard';
```
Should return: `shift_day_standard | false`

---

#### Test 1.2: Create Overnight Shift (End > Start)
**Objective**: Verify overnight shifts are detected and flagged

**Steps**:
1. Navigate to Admin Dashboard → Work Schedule
2. Click "Add Schedule"
3. Enter:
   - Shift ID: `shift_night_01`
   - Shift Type: `Continuous shift`
   - Start: `22:00`
   - End: `07:00`
4. Observe form behavior while entering end time

**Expected Results**:
- ✅ As you type end time less than start time, "+1 day" label appears
- ✅ "+1 day" label is blue with white text, positioned next to "Shift End" label
- ✅ Label appears/disappears dynamically as user types
- ✅ Shift saves successfully
- ✅ `spans_midnight` field is `TRUE` in database

**Visual Verification**:
The form should show:
```
Shift End  +1 day
[22] : [00]
```

**Database Check**:
```sql
SELECT shift_id, spans_midnight FROM work_schedules 
WHERE shift_id = 'shift_night_01';
```
Should return: `shift_night_01 | true`

---

#### Test 1.3: Create Split Shift with One Overnight Timeframe
**Objective**: Verify split shifts handle overnight detection correctly

**Steps**:
1. Navigate to Admin Dashboard → Work Schedule
2. Click "Add Schedule"
3. Enter:
   - Shift ID: `shift_split_mixed`
   - Shift Type: `Split shift`
   - Timeframe 1:
     - Start: `08:00`
     - End: `12:00` (daytime)
   - Timeframe 2:
     - Start: `21:00`
     - End: `01:00` (overnight)
4. Click "Add Timeframe" to add the second one
5. Save

**Expected Results**:
- ✅ First timeframe has no "+1 day" label (08:00 to 12:00)
- ✅ Second timeframe has "+1 day" label (21:00 to 01:00)
- ✅ Shift saves successfully
- ✅ `spans_midnight` field is `TRUE` (because at least one timeframe crosses midnight)
- ✅ Shift type displays as "Split shift"

**Database Check**:
```sql
SELECT ws.shift_id, ws.spans_midnight, 
       wst.start_time, wst.end_time, wst.frame_order
FROM work_schedules ws
JOIN work_schedule_timeframes wst ON ws.id = wst.work_schedule_id
WHERE ws.shift_id = 'shift_split_mixed'
ORDER BY wst.frame_order;
```

Should return:
```
shift_split_mixed | true | 08:00:00 | 12:00:00 | 0
shift_split_mixed | true | 21:00:00 | 01:00:00 | 1
```

---

#### Test 1.4: Add Meal Break to Overnight Shift
**Objective**: Verify meal breaks work with overnight shifts

**Steps**:
1. Navigate to Admin Dashboard → Work Schedule
2. Click "Add Schedule"
3. Enter:
   - Shift ID: `shift_night_with_meal`
   - Shift Type: `Continuous shift`
   - Start: `21:00`
   - End: `06:00`
   - Meal: `Unpaid`
   - Meal Time: `01:00` to `01:30`
4. Save

**Expected Results**:
- ✅ "+1 day" label appears next to end time
- ✅ Meal time validation succeeds (01:30 is within 21:00 to 06:00 next day)
- ✅ Shift saves with meal data
- ✅ When viewing shift details, meal shows: "Meal (unpaid): 01:00 - 01:30"

**Database Check**:
```sql
SELECT ws.shift_id, wst.start_time, wst.end_time, 
       wst.meal_type, wst.meal_start, wst.meal_end
FROM work_schedules ws
JOIN work_schedule_timeframes wst ON ws.id = wst.work_schedule_id
WHERE ws.shift_id = 'shift_night_with_meal';
```

Should show meal data correctly populated.

---

#### Test 1.5: Validation - Meal Outside Timeframe (Overnight Shift)
**Objective**: Verify meal validation works with midnight-spanning shifts

**Steps**:
1. Navigate to Admin Dashboard → Work Schedule
2. Click "Add Schedule"
3. Enter:
   - Shift ID: `shift_invalid_meal`
   - Shift Type: `Continuous shift`
   - Start: `22:00`
   - End: `06:00`
   - Meal: `Unpaid`
   - Meal Time: `07:00` to `08:00` (AFTER shift ends - invalid)
4. Try to save

**Expected Results**:
- ❌ Save fails with error: "Meal timeframe must be inside its shift timeframe"
- ✅ Error message is clear and helpful

---

#### Test 1.6: Display Formatting for Overnight Shifts
**Objective**: Verify overnight shifts display correctly in the work schedule list

**Steps**:
1. Navigate to Work Schedule page
2. Look at the saved work schedules in the list

**Expected Results**:
- ✅ Daytime shift displays: "shift_day_standard | Type: Continuous shift | Time Frame 1: 09:00 - 17:00"
- ✅ Overnight shift displays: "shift_night_01 | Type: Continuous shift | Time Frame 1: 22:00 - 07:00"
- ✅ Total hours calculated correctly:
  - Daytime shift: 8h 0m
  - Overnight shift: 9h 0m (22:00 to 07:00 = 9 hours)
  - With meal: 8h 30m (subtract 30-min unpaid meal)

---

### PHASE 2: Roster Pattern Management

#### Test 2.1: Create Roster Pattern
**Objective**: Verify basic roster pattern creation

**Steps**:
1. Navigate to Admin Dashboard → Roster Patterns
2. Click "Add Roster Pattern"
3. Enter:
   - Pattern Name: `2-week_rotation`
   - Cycle Length: `2` weeks
   - Description: `2-week rotating shift pattern`
4. Save

**Expected Results**:
- ✅ Pattern saves successfully
- ✅ Pattern appears in list of patterns
- ✅ Pattern can be loaded/edited
- ✅ Database entry created in `roster_patterns` table

**Database Check**:
```sql
SELECT id, name, cycle_length_weeks FROM roster_patterns 
WHERE name = '2-week_rotation';
```

---

#### Test 2.2: Assign Daytime Shift to Pattern Day
**Objective**: Verify basic shift assignments work

**Steps**:
1. Create or open a roster pattern
2. In the pattern grid, click on Monday, Week 1
3. Select `shift_day_standard` (09:00-17:00)
4. Save

**Expected Results**:
- ✅ Shift assignment saves
- ✅ Monday cell displays the shift
- ✅ Database entry created in `roster_pattern_assignments` table
- ✅ `sequence_order` is 1 for first shift

---

#### Test 2.3: Assign Overnight Shift to Pattern Day
**Objective**: Verify overnight shift assignments display correctly

**Steps**:
1. Create or open a roster pattern
2. In the pattern grid, click on Sunday, Week 1
3. Select `shift_night_01` (22:00-07:00)
4. Save

**Expected Results**:
- ✅ Shift assignment saves
- ✅ Sunday cell displays: `shift_night_01 (22:00→+1: 07:00)` or similar notation
- ✅ Monday cell shows subtle overflow indicator (optional: light shading or corner marker)
- ✅ Tooltip/hover shows full details: "Shift starts: Sun 22:00, Ends: Mon 07:00"
- ✅ Database entry created with correct assignment

**Expected Display Format**:
```
Sunday column, Week 1:
┌─────────────────────────────────┐
│ shift_night_01                  │
│ 22:00 → +1: 07:00               │
├─────────────────────────────────┤ ← subtle overflow line
Monday column, Week 1:
┌─────────────────────────────────┐
│ (overflow from Sunday)            │
│ [other shifts, if any]           │
```

---

#### Test 2.4: Assign Multiple Shifts to Same Day
**Objective**: Verify multiple shift support (manager can add both night and day shift)

**Steps**:
1. Create/open a roster pattern
2. In the pattern grid, click on Monday, Week 1
3. Select `shift_night_01` (22:00-07:00) - this starts Sunday night
4. Add another shift to Monday: select `shift_day_standard` (09:00-17:00)
5. Both shifts should be assignable to Monday
6. Save

**Expected Results**:
- ✅ Both shifts are assigned to Monday (sequence_order 1 and 2)
- ✅ Monday cell displays both shifts stacked or listed:
  ```
  1. shift_night_01 (22:00→+1: 07:00)
  2. shift_day_standard (09:00–17:00)
  ```
- ✅ No overlap validation error (night shift 22:00-07:00 + day shift 09:00-17:00 = valid)
- ✅ Database shows two entries in `roster_pattern_assignments` for Monday

---

#### Test 2.5: Prevent Overlapping Shifts on Same Day
**Objective**: Verify system prevents conflicting shift assignments

**Steps**:
1. Create/open a roster pattern
2. In the pattern grid, click on Tuesday, Week 1
3. Select `shift_night_01` (22:00-07:00)
4. Try to add `shift_night_01` again (overlaps with itself)
5. Or try to add another night shift (19:00-06:00) that overlaps

**Expected Results**:
- ❌ Second assignment is rejected with error: "Shift overlaps with existing assignment on this day"
- ✅ Error message is clear

---

#### Test 2.6: Overnight Shift at Pattern Boundary (End of Cycle)
**Objective**: Verify handling of midnight shifts at week/cycle boundaries

**Scenario A: Last Day of Pattern Cycle**
**Steps**:
1. Create 1-week pattern (Mon-Sun)
2. Assign `shift_night_01` (22:00-07:00) to Sunday, Week 1
3. Save and view pattern

**Expected Results**:
- ✅ Sunday shows shift with overflow indicator
- ✅ Visual indication that shift continues to next cycle's Monday
- ✅ Optional info message: "This shift continues into the next week cycle"
- ✅ If manager applies this pattern repeatedly, next Monday (Week 1 of next cycle) will have the overflow continuation

**Scenario B: Multi-Week Cycle Boundary**
**Steps**:
1. Create 2-week pattern
2. Assign `shift_night_01` to Sunday of Week 2
3. Save

**Expected Results**:
- ✅ Sunday, Week 2 shows shift with overflow
- ✅ Visual indicates continuation to Monday of Week 1 (when pattern repeats)
- ✅ Overflow wraps back to Monday of first week in the cycle

---

#### Test 2.7: Save and Reload Pattern
**Objective**: Verify patterns persist correctly

**Steps**:
1. Create a pattern with multiple shifts including overnight shifts
2. Refresh the page
3. Load the pattern again

**Expected Results**:
- ✅ All assignments are preserved
- ✅ Overnight shifts display correctly after reload
- ✅ No data loss

---

### PHASE 3: Edge Cases and Stress Testing

#### Test 3.1: Complex Rotating Schedule
**Objective**: Test realistic 4-week rotating pattern with mix of day/night shifts

**Setup Pattern**:
```
Week 1:
  Mon: shift_day_standard (09:00–17:00)
  Tue: shift_day_standard (09:00–17:00)
  Wed: shift_day_standard (09:00–17:00)
  Thu: Off
  Fri: Off
  Sat: shift_night_01 (22:00→+1: 07:00)
  Sun: [shift_night_01 overflow from Sat]

Week 2:
  Mon: shift_night_01 (22:00→+1: 07:00)
  Tue: shift_split_mixed (08:00–12:00, 21:00→+1: 01:00)
  Wed: shift_day_standard (09:00–17:00)
  Thu–Sun: Off
```

**Steps**:
1. Create 4-week pattern
2. Fill in the above schedule
3. Include overnight shifts in various positions
4. Save
5. Verify all data persists
6. Calculate total hours for the pattern

**Expected Results**:
- ✅ Complex pattern saves without errors
- ✅ All assignments persist across reload
- ✅ Overnight shifts display with correct overflow indicators
- ✅ No data corruption
- ✅ Total hours calculation includes all timeframes correctly

---

#### Test 3.2: Boundary Transitions
**Objective**: Verify shifts handle week/day transitions correctly

**Steps**:
1. Create pattern where many days have overnight shifts
2. Verify overflow indicators at every day boundary

**Expected Results**:
- ✅ Every transition displays correctly
- ✅ No visual glitches
- ✅ Data integrity maintained

---

#### Test 3.3: Meal Breaks in Overnight Shifts in Pattern
**Objective**: Verify meal information displays in roster context

**Steps**:
1. Create pattern using `shift_night_with_meal` (22:00-06:00 with meal 01:00-01:30 unpaid)
2. Assign to Monday
3. Hover over shift or click for details

**Expected Results**:
- ✅ Meal information is displayed: "Meal (unpaid): 01:00 - 01:30"
- ✅ Total hours in pattern correctly excludes unpaid meal: 8h 30m instead of 9h

---

### PHASE 4: Data Integrity Tests

#### Test 4.1: Database Consistency
**Objective**: Verify database has correct structure

**Steps**:
Run these queries in Supabase SQL editor:

```sql
-- Check work_schedules table has spans_midnight column
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'work_schedules' AND column_name = 'spans_midnight';

-- Should return: spans_midnight | boolean | YES

-- Check new tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('roster_patterns', 'roster_pattern_assignments');

-- Should return: roster_patterns, roster_pattern_assignments

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('roster_patterns', 'roster_pattern_assignments');

-- Should return: tablename | rowsecurity = true for both
```

**Expected Results**:
- ✅ All columns exist with correct types
- ✅ All tables exist and are in 'public' schema
- ✅ RLS is enabled on both new tables
- ✅ Indexes are created (check with `\d roster_patterns` in psql)

---

#### Test 4.2: RLS Policies Work Correctly
**Objective**: Verify only authorized users can access patterns

**Steps**:
1. Create pattern as Admin User A
2. Log out, log in as Regular Employee User B
3. Try to access Admin Dashboard → Roster Patterns

**Expected Results**:
- ✅ User B cannot see patterns (or only their own tenant's patterns)
- ✅ User B cannot edit/delete patterns created by Admin User A
- ✅ Proper 401/403 errors are returned

**Note**: Actual testing depends on your multi-tenant setup and RLS policies.

---

#### Test 4.3: Cascade Delete Works
**Objective**: Verify deleting pattern also deletes assignments

**Steps**:
1. Create pattern with multiple assignments
2. Note the pattern ID
3. Delete the pattern
4. Check database

**Query**:
```sql
SELECT COUNT(*) FROM roster_pattern_assignments 
WHERE roster_pattern_id = '[pattern_id_you_deleted]';
```

**Expected Results**:
- ✅ Pattern is deleted
- ✅ All assignments for that pattern are automatically deleted (due to CASCADE)
- ✅ Query returns: 0 rows

---

### PHASE 5: UI/UX Tests

#### Test 5.1: "+1 day" Label Visual Feedback
**Objective**: Verify label appears/disappears smoothly

**Steps**:
1. Open work schedule creation form
2. Enter start time: `22:00`
3. Leave end time empty, observe form
4. Type end time: `02`

**Expected Results**:
- ✅ As soon as end time becomes less than start time, "+1 day" label appears
- ✅ Label is clearly visible (blue background, white text)
- ✅ Label disappears if user changes end time to be greater than start time
- ✅ No lag or visual jitter

---

#### Test 5.2: Overnight Shift Display in Roster Grid
**Objective**: Verify overnight shifts display clearly in pattern table

**Visual Checks**:
- ✅ Overnight shifts show time range with arrow or special notation: `22:00→+1: 07:00`
- ✅ Day-of-week boundaries are clear (no confusion about which day shift affects)
- ✅ Overflow indicator in next-day cell is subtle but visible
- ✅ Shift name is readable even with special formatting

**Example Display**:
```
┌─────────────────────────────────────┐
│ Sunday                              │
├─────────────────────────────────────┤
│ shift_night_01                      │
│ 22:00 → +1: 07:00                   │
└─────────────────────────────────────┘
         ↓ (overflow indicator)
┌─────────────────────────────────────┐
│ Monday                              │
├──⟋ (corner mark showing overflow)   │
│ Other shifts (if any)               │
└─────────────────────────────────────┘
```

---

#### Test 5.3: Hover/Tooltip Information
**Objective**: Verify detailed shift information is accessible

**Steps**:
1. Hover over an overnight shift in the pattern grid
2. Read tooltip

**Expected Tooltip Should Show**:
```
Shift: shift_night_01 (Type: Continuous shift)
Start: Sunday 22:00
End: Monday 07:00
Total Duration: 9h 0m
```

---

### PHASE 6: Regression Testing

#### Test 6.1: Existing Features Still Work
**Objective**: Ensure new changes don't break existing functionality

**Checklist**:
- [ ] Create standard daytime shift (no overnight) - still works
- [ ] Create split shift with both timeframes daytime - still works
- [ ] Edit existing work schedule - still works
- [ ] Delete work schedule - still works
- [ ] View work schedules list - still works
- [ ] Filter/sort work schedules - still works (if implemented)
- [ ] Assign shifts to employees - still works (or prepare for future feature)
- [ ] Generate payroll reports with shifts - still works

---

### PHASE 7: Documentation & Examples

#### Test 7.1: Create Example Overnight Schedule
**Real-World Scenario**:

Create a 24/7 hospital staffing pattern (3-week cycle):

**Week 1**:
- Mon-Fri: Day shift (07:00-15:00) - nursing staff
- Mon-Fri: Afternoon shift (15:00-23:00) - nursing staff
- Sat-Sun: Night shift (23:00-07:00) - minimal staff

**Week 2**:
- Mon-Fri: Night shift (23:00-07:00) - overnight team
- Sat-Sun: Day shift (07:00-15:00) - reduced weekend staff

**Week 3**:
- Mon-Fri: Mix of shifts (rotating)
- Sat-Sun: Off

**Steps**:
1. Create all shifts in Work Schedule
2. Create 3-week pattern
3. Assign shifts according to scenario
4. Verify complete pattern saves

**Expected Results**:
- ✅ Complex real-world pattern works
- ✅ All overnight shifts display correctly
- ✅ Pattern can be saved and reloaded
- ✅ Pattern is usable for actual scheduling

---

## Verification Checklist

Before marking implementation as complete, verify:

- [ ] Database migration applied successfully
- [ ] `spans_midnight` column exists on `work_schedules`
- [ ] `roster_patterns` and `roster_pattern_assignments` tables created
- [ ] RLS policies are in place and working
- [ ] "+1 day" label appears in work schedule form for overnight shifts
- [ ] Overnight shifts are correctly flagged in database (`spans_midnight = TRUE`)
- [ ] Roster patterns can be created and saved
- [ ] Shift assignments persist across page reloads
- [ ] Overnight shifts display with proper notation in roster grid
- [ ] Multiple shifts per day can be assigned
- [ ] Overflow indicators appear for next-day boundaries
- [ ] All validation rules work correctly
- [ ] No regression in existing features
- [ ] Real-world scheduling scenarios work

---

## Known Limitations (Document These)

If any of the following are not fully implemented in this phase, document them:

1. **Visual Overflow Indicators** - If not yet fully designed, specify what will be done
2. **Conflict Detection** - If shift conflict detection not fully implemented, note this
3. **Pay Period Attribution** - If pay period rules not implemented, note for Phase 4
4. **Mobile Responsive** - If pattern grid doesn't work well on mobile, document for future
5. **Bulk Assignment** - If users can't assign multiple shifts at once, note for optimization

---

## Performance Benchmarks

Test with larger datasets to ensure performance is acceptable:

- [ ] Pattern with 10 weeks × 7 days = 70 assignments - loads in < 1 second
- [ ] List of 100 work schedules with overnight flags - loads in < 2 seconds
- [ ] Adding/removing assignment - updates UI within 500ms

---

## Sign-Off

- **Tester**: ________________
- **Date**: ________________
- **Version**: 1.0
- **Status**: ☐ PASS ☐ FAIL ☐ PASS WITH NOTES

**Notes/Issues Found**:
```
[Document any issues here]
```
