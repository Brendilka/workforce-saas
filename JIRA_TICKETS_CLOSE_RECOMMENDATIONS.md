# Jira Tickets – Recommendations for Closing (Already Implemented)

This document cross-references the codebase with open BDK tickets and recommends which can be **closed as Done** (already implemented), which are **partially done**, and which should **remain open**.

---

## Summary Table

| Ticket | Summary | Recommendation | Notes |
|--------|---------|----------------|-------|
| **BDK-351** | Night shift date allocation rules | **Can close** | Full implementation in code + UI |
| **BDK-353** | Configurable shift type column time parameters (Day/Afternoon/Night) | **Can close** | Day periods configurable in Settings |
| **BDK-354** | Unpaid meal break validation error when no break configured | **Can close** | Meals optional; validation relaxed |
| **BDK-356** | Remove 'early morning shift' option from shift columns | **Can close** | No "early morning" in defaults or UI |
| **BDK-336** | CRUD for HR import (fields mapping) configurations | **Can close** | HR Import Config page + API |
| **BDK-335** | User friendly field mapping for csv import | **Partially close** | Config exists; UX could be improved |
| **BDK-285** | Create HR file import mechanism | **Partially close** | CSV import + jobs + config |
| **BDK-340** | Create Roster Manager | **Partially close** | Roster Manager UI exists |
| **BDK-342** | Add Manage Patterns UI for apply/delete | **Partially close** | Apply/delete in Roster Manager |
| **BDK-290** | Business Structure | **Partially close** | Business structure page exists |
| **BDK-349** | Roster Patterns Excel-like interface | **Keep open** | Grid exists but "Excel-like" is vague |
| **BDK-355** | Night shift auto-classification wrong column | **Keep open** | Needs product clarification |
| **BDK-357** | Cannot create night shift in overflowed days | **Keep open** | May need verification |
| **BDK-341** | Fix Roster Manager DB constraints | **Keep open** | Depends on current DB errors |
| **BDK-358** | Daylight saving time handling | **Keep open** | Not implemented |
| **Others** | Various | **Keep open** | Not implemented or out of scope |

---

## Recommended to CLOSE (Already Implemented)

### BDK-351 – Night shift date allocation rules

**Scope:** Configurable overnight shift assignment (modes: START_DAY, MAJORITY_HOURS, SPLIT_BY_DAY, FIXED_ROSTER_DAY, WEEKLY_BALANCING).

**Evidence:**
- `src/lib/shift-allocation.ts` – full allocation logic, all 5 modes
- `src/components/night-shift-allocation-settings.tsx` – mode selection and params UI
- `src/components/shift-details-panel.tsx` – allocation display per shift
- Roster pattern form saves `night_shift_allocation_mode` and `night_shift_allocation_params`
- Migration `20260223000000_night_shift_allocation.sql` adds columns to `roster_patterns`
- Week-start (e.g. Wednesday) respected for overflow and ordering

**Action:** Close as Done. Optional: add a short Jira comment referencing `BDK_351_IMPLEMENTATION_FOUNDATION.md` and roster pattern allocation UI.

---

### BDK-353 – Configurable shift type column time parameters (Day/Afternoon/Night)

**Scope:** Column time parameters for shift columns (Day/Afternoon/Night, etc.) should be configurable.

**Evidence:**
- Settings → “Day periods (Work Schedule Templates columns)” with drag handles, labels, add/remove
- `tenant_config.day_periods` (JSONB) stores `{ id, label, startMinutes, endMinutes }`
- Work Schedule and Roster Patterns use `dayPeriods` from tenant config (or default Night/Morning/Day/Evening)
- Migration `20260205100000_add_day_periods_to_tenant_config.sql`

**Action:** Close as Done.

---

### BDK-354 – Unpaid meal break validation error when no break configured

**Scope:** Validation should not require meal times when no break is configured; unpaid meal should not error when break is empty.

**Evidence:**
- `work-schedule-form.tsx`: `validateMeals()` always returns true; meals are optional
- API POST/PUT work-schedules: meal validation only when both meal start/end are provided; midnight-spanning meals allowed
- No “unpaid meal required” validation when meal times are blank

**Action:** Close as Done.

---

### BDK-356 – Remove 'early morning shift' option from shift columns

**Scope:** Remove the “early morning shift” option from shift columns.

**Evidence:**
- Default day periods in Settings and Work Schedule are: **Night** (0–6), **Morning** (6–12), **Day** (12–18), **Evening** (18–24)
- No “early morning” id or label in codebase (only “early morning” in TECHNICAL_ANALYSIS.md as prose)
- Columns are driven by configurable `day_periods`; tenant can rename/change ranges

**Action:** Close as Done (no “early morning” option exists).

---

### BDK-336 – CRUD mechanism for HR import (fields mapping) configurations

**Scope:** CRUD for HR import field mapping configurations.

**Evidence:**
- `/admin/hr-import-config` – page with `HRImportConfigEditor`
- `POST /api/admin/hr-import-config` – save config
- Config includes `sourceFields`, `fieldMapping`, `requiredFields`; stored in `tenant_config.hr_import_config`

**Action:** Close as Done.

---

## Partially Implemented (Close or Leave In Progress)

### BDK-335 – Add user friendly field mapping for csv import from HR system

**Evidence:** Field mapping is configured in HR Import Config (JSON editor and structure). CSV import uses this mapping. “User friendly” is subjective – no drag-and-drop column mapper UI.

**Recommendation:** Close if “configurable mapping” is enough; otherwise keep open for a friendlier mapping UI.

---

### BDK-285 – Create HR file import mechanism

**Evidence:** CSV import page, execute/process/jobs/status API routes, import jobs table, config from tenant_config. Full flow: upload CSV → map/config → process → jobs.

**Recommendation:** Can be closed as Done if “CSV import with config and jobs” meets the ticket; otherwise keep for extensions (e.g. more file types).

---

### BDK-340 – Create Roster Manager for workload planning and staffing patterns

**Evidence:** Roster Manager UI (`/admin/roster-manager`), SchedulePlanner, workload requirements, pattern create/apply/delete, API for patterns and requirements.

**Recommendation:** Close if the current Roster Manager scope is accepted; keep open if more “workload planning” features are required.

---

### BDK-342 – Add Manage Patterns UI for apply/delete

**Evidence:** Roster Manager has “Manage Patterns” (list, create, apply to date range, delete). `apply_workload_pattern` RPC and pattern delete in API.

**Recommendation:** Close if apply/delete in Roster Manager is sufficient; otherwise keep open.

---

### BDK-290 – Business Structure

**Evidence:** `/admin/business-structure` with `BusinessStructurePageClient` and business structure editor (org units, hierarchy).

**Recommendation:** Close if the current business structure page matches the epic; otherwise keep for missing sub-features.

---

## Keep OPEN (Not Done or Needs Verification)

### BDK-349 – Roster Patterns Excel-like interface

**Reason:** Roster Patterns has a grid and drag-drop, but “Excel-like” (e.g. formulas, cell edit, copy/paste) is not clearly met. Recommend keeping open until product confirms scope.

---

### BDK-355 – Night shift auto-classification moving shifts to wrong column

**Reason:** Depends on how “auto-classification” and “wrong column” are defined (e.g. day period buckets, overflow display). Code uses first timeframe start for column; no explicit “night shift” auto-classification. Needs product/QA confirmation.

---

### BDK-357 – Cannot create night shift in overflowed days of schedule pattern

**Reason:** Overflow and week-start logic were fixed; need to confirm whether “cannot create” is still reproducible (e.g. drag onto overflow cell, validation blocking). Recommend a quick manual test, then close if fixed.

---

### BDK-341 – Fix Roster Manager DB constraints and pattern creation errors

**Reason:** Depends on current DB errors and constraints. Keep open until constraints and creation flow are verified.

---

### BDK-358 – Implement daylight saving time handling – 'by the clock' payment rules

**Reason:** No DST or “by the clock” payment logic found in codebase. Keep open.

---

### Other open tickets (e.g. BDK-331, 328, 327, 339, 337, 338, 334, 345, 332, 333, etc.)

**Reason:** Either not implemented or large (epics, infra). Leave open unless you explicitly confirm done.

---

## Test Notes

- **shift-allocation.test.ts:** Fails in Jest due to module resolution (`./shift-allocation` not found from `__tests__`). Logic is used in app; fix Jest path/alias or import path.
- **allocation-enterprise.test.ts:** Fails because tests pass `NightShiftAllocationSettings` (e.g. `mode`, `params`) while `explainAllocation` expects `RosterPatternSettings` (`nightShiftAllocationMode`, `nightShiftAllocationParams`). Align test fixtures with `RosterPatternSettings` or add a thin adapter so tests pass; implementation itself is consistent with roster patterns UI.

---

## Suggested Jira Workflow

1. **Close as Done** (with optional comment): BDK-351, BDK-353, BDK-354, BDK-356, BDK-336.
2. **Close or leave In Progress** (after product confirmation): BDK-335, BDK-285, BDK-340, BDK-342, BDK-290.
3. **Keep open:** BDK-349, BDK-355, BDK-357, BDK-341, BDK-358, and remaining backlog.
4. **Verify in app then close if fixed:** BDK-357 (create night shift in overflowed day).

If you want, I can suggest exact Jira comment text for the tickets you decide to close.
