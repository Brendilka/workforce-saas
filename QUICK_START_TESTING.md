# Quick Start Testing - Overnight Shifts Implementation

## Prerequisites

✅ Database migration applied: `20260128000000_overnight_shifts_support.sql`
✅ Dev server running: `npm run dev`
✅ Browser cache cleared
✅ Latest code pulled

---

## QUICK TEST SEQUENCE (30 minutes)

### TEST 1: "+1 day" Label Appears Correctly (5 minutes)

**Steps**:
1. Navigate to: Admin Dashboard → Work Schedule → Add Schedule
2. Enter these values:
   - Shift ID: `test_overnight_01`
   - Description: `Testing overnight shift label`
   - Shift Type: Keep as "Continuous shift"
   - Start Time: Enter `22` (will auto-format to `22:00`)
   - Minutes: Keep as `00`
3. **OBSERVE**: "+1 day" label should NOT appear yet (start time only entered)
4. Now enter End Time:
   - Hours: Enter `06`
   - Minutes: Keep as `00`
5. **OBSERVE**: "+1 day" label should INSTANTLY appear next to "Shift End" label in blue

**Expected Result**:
```
Shift End  +1 day        ← Blue pill-shaped badge
[06] : [00]
```

✅ **PASS** if: Label appears/disappears dynamically as you type
❌ **FAIL** if: Label doesn't appear, or page needs refresh

---

### TEST 2: Create Standard Daytime Shift (Backwards Compatibility) (5 minutes)

**Steps**:
1. Go to Admin Dashboard → Work Schedule → Add Schedule
2. Enter:
   - Shift ID: `test_day_01`
   - Start: `09:00`
   - End: `17:00`
3. Save

**Expected Result**:
- ✅ "+1 day" label does NOT appear (because 17:00 > 09:00)
- ✅ Shift saves successfully
- ✅ In Work Schedules list, it shows: `09:00 - 17:00` (no "+1" notation)
- ✅ No errors in console

✅ **PASS** if: Everything works as before
❌ **FAIL** if: Changes broke existing behavior

---

### TEST 3: Database - Verify `spans_midnight` Flag (5 minutes)

**Steps**:
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Run this query:
```sql
SELECT shift_id, spans_midnight 
FROM work_schedules 
WHERE shift_id IN ('test_overnight_01', 'test_day_01')
ORDER BY created_at DESC
LIMIT 2;
```

**Expected Result**:
```
shift_id           | spans_midnight
test_overnight_01  | true
test_day_01        | false
```

✅ **PASS** if: Query returns exactly these results
❌ **FAIL** if: Column doesn't exist, or values are wrong

---

### TEST 4: Roster Patterns Table Exists (3 minutes)

**Steps**:
1. In Supabase SQL Editor, run:
```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('roster_patterns', 'roster_pattern_assignments');
```

**Expected Result**:
```
tablename
roster_patterns
roster_pattern_assignments
```

✅ **PASS** if: Both tables listed
❌ **FAIL** if: Tables don't exist

---

### TEST 5: Create Split Shift with Overnight Timeframe (5 minutes)

**Steps**:
1. Go to Admin Dashboard → Work Schedule → Add Schedule
2. Enter:
   - Shift ID: `test_split_mixed`
   - Shift Type: `Split shift`
3. For Timeframe 1:
   - Start: `08:00`
   - End: `12:00`
   - NO "+1 day" label should appear
4. Click "Add Timeframe" button
5. For Timeframe 2:
   - Start: `20:00`
   - End: `02:00`
   - "+1 day" label SHOULD appear
6. Save

**Expected Result**:
- ✅ Timeframe 1: No "+1 day" label
- ✅ Timeframe 2: "+1 day" label appears
- ✅ Shift saves with both timeframes
- ✅ In list, shows: 
  - "Time Frame 1: 08:00 - 12:00"
  - "Time Frame 2: 20:00 - 02:00"
- ✅ Database shows `spans_midnight = true` (because one timeframe crosses midnight)

✅ **PASS** if: All above work
❌ **FAIL** if: Label behavior incorrect or shift doesn't save

---

### TEST 6: Add Meal Break to Overnight Shift (5 minutes)

**Steps**:
1. Go to Admin Dashboard → Work Schedule → Add Schedule
2. Enter:
   - Shift ID: `test_night_with_meal`
   - Start: `22:00`
   - End: `06:00`
3. Verify "+1 day" appears ✓
4. Meal Type: Select `Unpaid`
5. Meal Start: `01:00`
6. Meal End: `01:30`
7. Save

**Expected Result**:
- ✅ Meal time validation passes (01:00-01:30 is within 22:00-06:00 next day)
- ✅ Shift saves successfully
- ✅ In list, shows:
  ```
  Time Frame 1: 22:00 - 06:00
    Meal (unpaid): 01:00 - 01:30
  Total Hours: 8h 30m
  ```

✅ **PASS** if: Meal within shift validated correctly
❌ **FAIL** if: Meal validation fails or calculation wrong

---

### TEST 7: Validation - Meal Outside Overnight Shift (3 minutes)

**Steps**:
1. Go to Add Schedule
2. Enter:
   - Shift ID: `test_invalid_meal`
   - Start: `22:00`
   - End: `06:00`
3. Meal Start: `07:00` (OUTSIDE shift - after it ends)
4. Meal End: `07:30`
5. Try to Save

**Expected Result**:
- ❌ Save fails with error: "Meal timeframe must be inside its shift timeframe"
- ✅ Error message is visible
- ✅ Form doesn't submit
- ✅ User can go back and fix it

❌ **FAIL** if: Validation doesn't catch this error

---

### TEST 8: Verify RLS Policies (Admin-level, if applicable)

**Steps** (Optional - requires DB access):
1. In Supabase SQL Editor, run:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('roster_patterns', 'roster_pattern_assignments');
```

**Expected Result**:
```
tablename                        | rowsecurity
roster_patterns                  | true
roster_pattern_assignments       | true
```

✅ **PASS** if: Both have `rowsecurity = true`
❌ **FAIL** if: RLS not enabled

---

### TEST 9: Create Roster Pattern (Basic) (5 minutes)

**Steps**:
1. Go to Admin Dashboard → Roster Patterns
2. Click "Add Roster Pattern"
3. Enter:
   - Shift ID: `pattern_test_01`
   - Pattern for Week(s): `1`
   - Start Pattern on week: `1`
4. In table, leave all days empty for now
5. Click "Save Pattern"

**Expected Result**:
- ✅ Pattern saves without errors
- ✅ Can navigate away and return
- ✅ Database shows `roster_patterns` entry

**Verification**:
Run in Supabase SQL Editor:
```sql
SELECT id, name, cycle_length_weeks 
FROM roster_patterns 
LIMIT 1;
```

✅ **PASS** if: Entry appears in database
❌ **FAIL** if: Save fails or data not persisted

---

### TEST 10: Save and Reload Patterns (5 minutes)

**Steps**:
1. Create a roster pattern (from Test 9)
2. Refresh the page (Cmd+R or F5)
3. Go back to Roster Patterns
4. Verify pattern is still there

**Expected Result**:
- ✅ Pattern loads after refresh
- ✅ No data loss
- ✅ Can edit/view pattern again

✅ **PASS** if: Persistence works
❌ **FAIL** if: Pattern lost after refresh

---

## TEST RESULTS SUMMARY

| Test | Scenario | Expected | Status |
|------|----------|----------|--------|
| 1 | "+1 day" label appears | Label shows dynamically | ☐ PASS ☐ FAIL |
| 2 | Daytime shift (backwards compat) | No "+1 day" label | ☐ PASS ☐ FAIL |
| 3 | DB flag verification | spans_midnight column exists | ☐ PASS ☐ FAIL |
| 4 | New tables exist | Both roster tables created | ☐ PASS ☐ FAIL |
| 5 | Split shift with overnight | Label on overnight frame only | ☐ PASS ☐ FAIL |
| 6 | Meal in overnight shift | Validation passes | ☐ PASS ☐ FAIL |
| 7 | Invalid meal validation | Save fails with error | ☐ PASS ☐ FAIL |
| 8 | RLS policies enabled | RLS = true for both tables | ☐ PASS ☐ FAIL |
| 9 | Create pattern | Pattern saves to DB | ☐ PASS ☐ FAIL |
| 10 | Pattern persistence | Data survives page refresh | ☐ PASS ☐ FAIL |

**Overall**: ☐ ALL PASS ☐ SOME FAILURES

---

## Troubleshooting

### "+1 day" Label Not Appearing
**Check**:
1. Did you apply the migration? (Check Supabase → Migrations)
2. Did you restart dev server after applying migration?
3. Clear browser cache: DevTools → Application → Clear site data
4. Try in incognito window

### Shift Won't Save
**Check**:
1. Are all required fields filled? (Shift ID, Start, End)
2. Is end time > start time OR < start time? (both valid)
3. Are there validation errors in the form?
4. Check browser console for errors (F12 → Console)
5. Check Supabase for RLS policy errors

### Can't Find Roster Patterns
**Check**:
1. Is Admin Dashboard button visible?
2. Did you click "Add Roster Pattern" button?
3. Check if page is loading (network requests in DevTools)
4. Check browser console for JavaScript errors

### Database Migration Failed
**Check**:
1. In Supabase Dashboard, go to SQL Editor
2. Manually run the migration SQL
3. Check for syntax errors (missing semicolons, column names, etc.)
4. Verify tenant/organization tables exist first

---

## Quick Reference - URLs and Navigation

| Feature | URL | Path |
|---------|-----|------|
| Work Schedule | `/admin/work-schedule` | Admin Dashboard → Work Schedule |
| Roster Patterns | `/admin/roster-patterns` | Admin Dashboard → Roster Patterns |
| Supabase Dashboard | supabase.co | [linked in .env] |
| SQL Editor | Dashboard → SQL Editor | Direct query testing |

---

## Success Criteria

✅ **Implementation is SUCCESSFUL if:**
1. All 10 tests PASS
2. No data loss on page refresh
3. "+1 day" label displays correctly
4. Database contains new tables with proper RLS
5. Backwards compatibility maintained (old shifts still work)
6. No JavaScript errors in console
7. Forms submit and save data

❌ **Implementation has ISSUES if:**
1. Any test FAILs
2. "+1 day" label missing or incorrect styling
3. Database tables not created
4. Data lost after refresh
5. Existing shift creation broken
6. Errors in browser console

---

## Next Steps If All Tests Pass

1. ✅ Implement Advanced Roster Pattern UI (assign shifts to days)
2. ✅ Add visual overflow indicators for multi-day shifts
3. ✅ Implement conflict detection for overlapping shifts
4. ✅ Create payroll integration for shift attribution rules
5. ✅ Build employee schedule assignment feature

---

## Documentation Files

- **TECHNICAL_ANALYSIS.md** - Full problem analysis
- **TESTING_GUIDE.md** - Comprehensive 7-phase testing (40+ scenarios)
- **SOLUTION_IMPLEMENTATION.md** - Implementation details and design decisions

Start with these quick tests, then refer to full guides for detailed scenarios.
