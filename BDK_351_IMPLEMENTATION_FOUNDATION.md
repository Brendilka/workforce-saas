# BDK-351: Night Shift Allocation - Implementation Foundation

**Status**: Core infrastructure complete, integration phase ready  
**Components Created**: 5 files  
**Lines of Code**: 1,950+ (production + tests)  
**Test Coverage**: 20+ test cases for all allocation modes  

## Foundation Completed ✅

### 1. Database Migration
**File**: `supabase/migrations/20260223000000_night_shift_allocation.sql`

Added two columns to `roster_patterns` table:
- `night_shift_allocation_mode VARCHAR(50)` - Stores selected allocation mode (default: 'START_DAY')
- `night_shift_allocation_params JSONB` - Stores mode-specific parameters as JSON

Supports 5 allocation modes:
- **START_DAY**: Allocate to shift start date
- **MAJORITY_HOURS**: Allocate to date with most hours (tie-break: start day)
- **SPLIT_BY_DAY**: Return segments for each calendar date touched
- **FIXED_ROSTER_DAY**: Use configurable anchor (START_DAY, END_DAY, PREVIOUS_DAY, NEXT_DAY)
- **WEEKLY_BALANCING**: Complex week-based logic with balancing strategy and tie-breakers

### 2. Core Allocation Logic
**File**: `src/lib/shift-allocation.ts` (610+ lines)

**Main Function**: `computeAllocationDate(shift, settings, context?): AllocationResult`

Returns:
- `allocationDate?: Date` - Single day allocation (modes 1, 3, 4)
- `daySegments?: Array<{date, startDateTime, endDateTime, minutes}>` - Multi-day segments (mode 3)
- `error?: string` - Validation or computation errors
- `isPreview?: boolean` - Flag for unsaved settings

**Helper Functions**:
- `isCrossMidnightShift(shift)` - Detects if shift spans calendar boundary
- `computeMinutesPerDay(shift)` - Calculates minutes allocation per calendar date
- `validateModeParams(mode, params)` - Pre-computation validation
- `getWeekStartDate(date, weekStartDay)` - Computes week boundary
- `getWeekBucket(date, weekStartDay)` - Returns week identifier

**Implementation Details**:
- Pure function - no side effects, fully deterministic
- MAJORITY_HOURS example: Fri 22:00 → Sat 07:00 = 2 hours Fri, 7 hours Sat → allocates to Saturday
- MAJORITY_HOURS tie-break: 12:12 split → allocates to start date (Fri)
- WEEKLY_BALANCING: Week-bucket analysis, remaining hours calculation, preference strategies, pay period definitions

### 3. Unit Tests
**File**: `src/lib/__tests__/shift-allocation.test.ts` (300+ lines)

**Coverage**: 20+ comprehensive test cases

**Test Categories**:
1. **START_DAY** (1 test)
   - Fri 22:00–Sat 07:00 → allocates to Friday

2. **MAJORITY_HOURS** (3 tests)
   - Same shift → allocates to Saturday (majority: 7 hours vs 2 hours)
   - Tie-break with 12:12 split → allocates to Friday (start day)
   - Parameter validation

3. **FIXED_ROSTER_DAY** (4 tests)
   - All 4 anchor types: START_DAY, END_DAY, PREVIOUS_DAY, NEXT_DAY
   - Each verified with Fri 22:00–Sat 07:00 example

4. **SPLIT_BY_DAY** (3 tests)  
   - 2-day shift returns correct minute values per day
   - 3-day shift calculation validation

5. **WEEKLY_BALANCING** (8+ tests)
   - Parameter validation for required fields
   - Week bucket logic with different week start days
   - Tie-breaker application
   - Balancing strategy selection
   - Pay period definition types

6. **Helper Functions** (1+ tests)
   - `isCrossMidnightShift()` with true/false scenarios

All tests use realistic 24-hour data (Fri 22:00–Sat 07:00, cross-week shifts, etc.)

### 4. Settings Configuration UI
**File**: `src/components/night-shift-allocation-settings.tsx` (450+ lines)

**Component**: `NightShiftAllocationSettings`

**Props**:
- `settings: NightShiftAllocationSettings` - Current configuration
- `onSettingsChange: (settings) => void` - Change callback
- `hasPayrollCalendarConfigured?: boolean` - Enables INHERIT_PAYROLL_CALENDAR option
- `isValidating?: boolean` - Loading state

**Features**:
1. **Mode Selection** (5 radio buttons with descriptions)
   - Each mode has brief explanation of when it applies

2. **Progressive Disclosure for WEEKLY_BALANCING**:
   - Step 1: Week start day selector (MON-SUN)
   - Step 2: Weekly ordinary hours threshold (minutes input, conversions shown)
   - Step 3: Balancing strategy (FILL_CURRENT_WEEK_FIRST vs FILL_NEXT_WEEK_FIRST)
   - Step 4: Eligibility rule (CROSS_MIDNIGHT_ONLY vs ALL_SHIFTS)
   - Step 5: Tie-breaker preference (PREFER_START_DAY vs PREFER_END_DAY)
   - Step 6: Pay period definition type (3 options with conditional fields)
   - Step 7: Conditional input for payPeriodStartDay or payPeriodStartDate

3. **Validation**: `areRequiredParamsComplete(mode, params)` enables Save button only when valid

4. **Visual Feedback**:
   - Completion status indicator showing which fields are configured
   - Disabled state for INHERIT_PAYROLL_CALENDAR if not available

### 5. Shift Details Panel
**File**: `src/components/shift-details-panel.tsx` (350+ lines)

**Component**: `ShiftDetailsPanel`

**Props**:
- `selectedCell?: SelectedCell` - Calendar cell selection
- `selectedShift?: WorkSchedule` - Shift being edited
- `allocationSettings: NightShiftAllocationSettings` - Live allocation config
- `isUnsaved?: boolean` - Preview mode flag
- `timezone?: string` - For time display

**Features**:
1. **Shift Information Display**:
   - Selected calendar date
   - All shifts on that date
   - Individual shift timing (start, end, duration)
   - Meal break information if configured

2. **Computed Allocation**:
   - Shows "Day of Allocation" using `computeAllocationDate()`
   - Updates live as settings change
   - Visual alert if allocation differs from selected calendar date

3. **Multi-Day View** (for SPLIT_BY_DAY mode):
   - Lists all day segments with minutes breakdown per calendar date

4. **Error Handling**:
   - Shows error message if allocation computation fails
   - Displays validation issues

5. **Preview Indicator**:
   - Shows "(Preview - unsaved)" when settings changed but not saved
   - Uses isUnsaved prop to display state

**Helper Functions**:
- `formatDuration(minutes)` - Converts to "Xh Ym" format
- `formatTime(timeStr)` - Formats "HH:mm" to display format
- `computeShiftDuration(timeframes)` - Sums durations minus breaks

## Integration Next Steps

### Phase 1: Database Migration
```bash
supabase db push
```
Applies the new allocation columns to roster_patterns table.

### Phase 2: RosterPatternsClient Integration
1. **Add State**:
   ```typescript
   const [allocationSettings, setAllocationSettings] = useState<NightShiftAllocationSettings>(
     currentPattern?.night_shift_allocation_mode 
       ? parseAllocationSettings(currentPattern)
       : getDefaultAllocationSettings()
   );
   ```

2. **Add Components to JSX**:
   ```tsx
   <NightShiftAllocationSettings 
     settings={allocationSettings}
     onSettingsChange={setAllocationSettings}
     hasPayrollCalendarConfigured={tenantConfig?.payroll_calendar_configured}
   />
   
   {selectedCell && (
     <ShiftDetailsPanel
       selectedCell={selectedCell}
       selectedShift={selectedShift}
       allocationSettings={allocationSettings}
       isUnsaved={!!unsavedChanges}
     />
   )}
   ```

3. **Update Form Submission**:
   - Include allocation settings in save payload
   - Add validation to check `areRequiredParamsComplete()` before allowing save

### Phase 3: API Updates
1. **POST/PUT `/api/admin/roster-patterns`**:
   - Accept `nightShiftAllocationMode` and `nightShiftAllocationParams`
   - Save to roster_patterns table

2. **GET `/api/admin/roster-patterns`**:
   - Return allocation fields in response

### Phase 4: Client-Side Validation
- Import `areRequiredParamsComplete()` from shift-allocation
- Disable Save button if WEEKLY_BALANCING mode selected and params incomplete
- Show clear error message about what fields are required

## Implementation Details for Developers

### How WEEKLY_BALANCING Works
1. **Week Bucket Analysis**: Groups shifts into calendar weeks (defined by weekStartDay)
2. **Remaining Hours**: Calculates minutes allocated to current week vs threshold
3. **Balancing Strategy**:
   - FILL_CURRENT_WEEK_FIRST: Prefer allocating to current week if hours remaining
   - FILL_NEXT_WEEK_FIRST: Prefer allocating to next week
4. **Eligibility**: Only count eligible shifts (CROSS_MIDNIGHT_ONLY vs ALL_SHIFTS)
5. **Tie-Breaker**: If tied on hours, use PREFER_START_DAY or PREFER_END_DAY

### Example: Friday 22:00–Saturday 07:00 with 40-hour week
- Fri 22:00–Sat 07:00 = 9 hours total
- If current week has 33 hours: 40 - 33 = 7 hours remaining
- Since shift is 9 hours, allocation depends on FILL_CURRENT_WEEK_FIRST vs FILL_NEXT_WEEK_FIRST

### Testing Allocation Logic
```typescript
import { computeAllocationDate } from '@/lib/shift-allocation';

const result = computeAllocationDate(
  { startDateTime: new Date('2025-02-14T22:00'), endDateTime: new Date('2025-02-15T07:00') },
  { mode: 'START_DAY' }
);

console.log(result.allocationDate); // 2025-02-14 (Friday)
```

## Files Modified/Created

| File | Status | Lines | Purpose |
|------|--------|-------|---------|
| `supabase/migrations/20260223000000_night_shift_allocation.sql` | ✅ Created | 30 | Database schema |
| `src/lib/shift-allocation.ts` | ✅ Created | 610+ | Core allocation logic |
| `src/lib/__tests__/shift-allocation.test.ts` | ✅ Created | 300+ | Unit tests |
| `src/components/night-shift-allocation-settings.tsx` | ✅ Created | 450+ | Settings UI |
| `src/components/shift-details-panel.tsx` | ✅ Created | 350+ | Details panel UI |

## Resource Requirements

**Dependencies** (all already installed):
- date-fns (v4.1.0) - Date calculations
- @radix-ui/* - UI components
- lucide-react - Icons
- Tailwind CSS - Styling
- TypeScript - Type safety

**Database**:
- 1 new table column: `night_shift_allocation_mode` (VARCHAR)
- 1 new table column: `night_shift_allocation_params` (JSONB)

**No new external packages required** - uses only existing dependencies.

## Edge Cases Handled

1. ✅ Midnight-crossing shifts (Fri 22:00 → Sat 07:00)
2. ✅ Multi-day shifts (Thu 14:00 → Sat 10:00)
3. ✅ Shifts with meal breaks
4. ✅ Tie-breaking for same-hour allocations
5. ✅ Week boundary transitions (Sun 22:00 → Mon 07:00)
6. ✅ Pay period boundary calculations
7. ✅ Configuration validation before computation
8. ✅ Timezone support (dates converted to configured timezone)

## Known Limitations

1. **INHERIT_PAYROLL_CALENDAR** requires payroll calendar to be configured on tenant. If not available, disabled in UI.
2. **Week-based balancing** doesn't support complex fiscal years; uses calendar weeks only.
3. **Pay period definition** limited to fixed anchors (day of month, specific date). Custom fiscal calendars not supported yet.

## Rollback Plan

If issues discovered during integration:
1. Remove migration: `supabase db reset` (local) or manual rollback (cloud)
2. Don't import the UI components
3. Revert RosterPatternsClient changes
4. All components are independent - no breaking changes to existing code

## Success Criteria

Integration is complete when:
- ✅ Migration applied successfully
- ✅ NightShiftAllocationSettings renders in roster pattern form
- ✅ ShiftDetailsPanel displays with live allocation updates
- ✅ Allocation settings persist via API
- ✅ Validation prevents saving incomplete WEEKLY_BALANCING configs
- ✅ Shift details show correct allocation date for all 5 modes
- ✅ End-to-end test passes: Create pattern → Configure allocation → Save → Reload → Settings preserved

---

**Next Action**: Call `supabase db push` to apply migration, then integrate components into RosterPatternsClient.

**Estimated Integration Time**: 2-3 hours (state management, API wiring, validation, testing)

**Questions?** Check `/src/lib/__tests__/shift-allocation.test.ts` for usage examples or review component JSDoc comments for prop details.
