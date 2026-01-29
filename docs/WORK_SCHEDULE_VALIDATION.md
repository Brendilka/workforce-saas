# Work Schedule Validation & Auto-Update

## Overview
This document describes the validation system that prevents work schedule modifications from breaking existing roster patterns, and the auto-update functionality that keeps roster patterns in sync when shift names change.

## Features Implemented

### 1. Cross-Page Validation
When a work schedule is modified on the Work Schedule page, the system validates that the changes won't cause overlaps in existing roster patterns that use that schedule.

**Flow:**
1. User modifies timeframes or shift details in Work Schedule page
2. Backend checks all roster patterns that use this work schedule
3. For each pattern, simulates the change and checks for:
   - Overlaps with other schedules in the same day
   - Overlaps with overnight shifts from the previous day
4. If violations detected:
   - Returns 400 error with detailed information
   - Lists all affected patterns and specific violations
   - Update is blocked (not saved to database)
5. If no violations:
   - Update proceeds normally
   - Shift name references auto-update in roster patterns

**Files Modified:**
- `/src/app/api/admin/work-schedules/[id]/route.ts` - Backend validation logic
- `/src/app/admin/work-schedule/WorkScheduleClient.tsx` - UI error display

### 2. Auto-Update Shift Names
When a work schedule's `shift_id` (name) is changed, all references in roster patterns are automatically updated.

**Implementation:**
- After successful validation and update
- System loops through all roster patterns
- Updates `shift_id` field for all instances of the work schedule
- Updates are atomic (all patterns updated or none)

### 3. User-Friendly Error Display
When validation fails, users see:
- Clear error message explaining why the update was blocked
- List of affected roster patterns by name
- For each pattern:
  - Week number
  - Day of week
  - Specific violation (which shift it overlaps with)
- Dismiss button to clear error and try again

## Technical Details

### Backend Validation (`route.ts`)

**Helper Functions:**
```typescript
function shiftSpansMidnight(schedule: any): boolean
function getPreviousDay(day: string): string  
function checkShiftOverlap(schedule1: any, schedule2: any, isSchedule2Overflow: boolean): boolean
```

**Validation Process:**
1. Fetch current schedule from database
2. Fetch all roster patterns for the tenant
3. For each pattern that uses this schedule:
   - Create modified version with new timeframes
   - Check overlaps with same-day schedules
   - Check overlaps with previous-day overnight shifts
   - Collect violations
4. Return error if any violations found
5. Otherwise, proceed with update and auto-update shift names

**Error Response Format:**
```json
{
  "error": "Cannot update schedule: changes would cause overlaps in roster patterns",
  "affectedPatterns": [
    {
      "patternName": "Morning Shift Pattern",
      "violations": [
        "Week 1, Monday: overlaps with AFTERNOON",
        "Week 1, Tuesday: overlaps with overnight shift NIGHT from monday"
      ]
    }
  ]
}
```

### Frontend Display (`WorkScheduleClient.tsx`)

**State Management:**
```typescript
const [validationError, setValidationError] = useState<{
  message: string;
  affectedPatterns?: Array<{patternName: string; violations: string[]}>;
} | null>(null);
```

**Error Handling:**
- Clears validation error when form submitted
- Checks API response for `affectedPatterns`
- Sets validation error state if present
- Prevents dialog from closing on validation error
- Shows success toast and closes dialog on success

**UI Component:**
- Red error alert box
- Error icon and message
- "Affected Roster Patterns:" heading
- Pattern names with indented violation lists
- Dismiss button (X icon)

## Usage Examples

### Scenario 1: Overlapping Timeframe
1. User has roster pattern "Morning Crew" with MORNING shift (8:00-12:00)
2. Pattern also has AFTERNOON shift (13:00-17:00) on same day
3. User tries to extend MORNING to 8:00-14:00
4. System blocks update and shows:
   ```
   Cannot update schedule: changes would cause overlaps in roster patterns
   
   Affected Roster Patterns:
   • Morning Crew
     • Week 1, Monday: overlaps with AFTERNOON
   ```

### Scenario 2: Overnight Shift Conflict
1. User has pattern with NIGHT shift (22:00-06:00) on Monday
2. Pattern has MORNING shift (07:00-15:00) on Tuesday
3. User tries to extend MORNING to start at 05:00
4. System blocks update and shows:
   ```
   Cannot update schedule: changes would cause overlaps in roster patterns
   
   Affected Roster Patterns:
   • Night Workers
     • Week 1, Tuesday: overlaps with overnight shift NIGHT from monday
   ```

### Scenario 3: Shift Name Update
1. User has pattern using work schedule named "DAY"
2. User changes name from "DAY" to "DAY_SHIFT"
3. No validation errors
4. Update succeeds
5. All roster patterns automatically show "DAY_SHIFT" instead of "DAY"

## Edge Cases Handled

1. **Multiple Patterns Affected**: Shows all patterns with violations
2. **Multiple Violations per Pattern**: Lists all violations for each pattern
3. **Overnight Shifts**: Correctly detects overlaps with next day's morning portion
4. **Continuous Patterns**: Validates wraparound between last and first week
5. **Split Shifts**: Validates all timeframes, not just first one
6. **Same-Day Multiple Shifts**: Checks against all schedules in the day

## Future Enhancements

Potential improvements:
- Show visual preview of conflicts in roster pattern view
- Suggest alternative timeframes that would work
- Batch update multiple schedules with validation
- "Force update" option with confirmation
- Notification to affected users/managers
