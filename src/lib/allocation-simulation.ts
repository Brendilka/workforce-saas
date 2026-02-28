/**
 * Simulation Mode for Night Shift Allocation
 *
 * Allows users to preview the impact of new allocation settings on existing shifts
 * without persisting changes. Read-only, deterministic, safe for previewing.
 */

import { computeAllocationDate, RosterPatternSettings, Shift, AllocationResult } from '@/lib/shift-allocation';
import { explainAllocation } from '@/lib/allocation-explainability';

/**
 * Represents a single shift change in simulation.
 */
export interface ShiftAllocationChange {
  shiftId: string;
  shiftDescription: string;
  oldAllocationDate: string | string[];
  newAllocationDate: string | string[];
  reason: string;
  durationMinutes: number;
  crossesMidnight: boolean;
}

/**
 * Summary of allocation changes across all shifts.
 */
export interface SimulationSummary {
  affectedShifts: number;
  allocationChanges: number;
  allocationUnchanged: number;
  overtimeImpactMinutes: number;
  warningsCount: number;
  processedAt: string;
}

/**
 * Complete simulation result showing impact without persisting changes.
 */
export interface SimulationResult {
  summary: SimulationSummary;
  perShiftChanges: ShiftAllocationChange[];
  warnings: string[];
  ruleVersion: string;
}

/**
 * Simulates the impact of new allocation settings on a set of shifts.
 *
 * This is a read-only operation that computes allocations using new settings
 * and compares them to current allocations without persisting anything.
 *
 * @param shifts - Array of shifts to simulate on
 * @param currentSettings - Current allocation settings
 * @param newSettings - Proposed new allocation settings
 * @param currentAllocations - Current allocation dates (for comparison)
 * @returns Simulation result showing all changes and impact
 *
 * @example
 * const result = simulateAllocationImpact(
 *   [shift1, shift2, shift3],
 *   { mode: 'START_DAY' },
 *   { mode: 'MAJORITY_HOURS' },
 *   { shift1Id: new Date('2025-02-14'), shift2Id: new Date('2025-02-15') }
 * );
 * // Shows which shifts would be reallocated, frequency of changes, etc.
 */
export function simulateAllocationImpact(
  shifts: Shift[],
  currentSettings: RosterPatternSettings,
  newSettings: RosterPatternSettings,
  currentAllocations: Record<string, string | string[]>
): SimulationResult {
  const changes: ShiftAllocationChange[] = [];
  let allocationChanges = 0;
  let overtimeImpactMinutes = 0;
  const warnings: string[] = [];

  // Validate inputs
  if (!shifts || shifts.length === 0) {
    return {
      summary: {
        affectedShifts: 0,
        allocationChanges: 0,
        allocationUnchanged: 0,
        overtimeImpactMinutes: 0,
        warningsCount: 0,
        processedAt: new Date().toISOString(),
      },
      perShiftChanges: [],
      warnings: ['No shifts provided for simulation'],
      ruleVersion: 'v1',
    };
  }

  // Process each shift
  shifts.forEach((shift) => {
    if (!shift.id) {
      warnings.push('Shift missing ID - cannot simulate');
      return;
    }

    try {
      // Compute allocation with new settings
      let newResult: AllocationResult;

      try {
        newResult = computeAllocationDate(shift, newSettings);
      } catch (error) {
        warnings.push(`Shift ${shift.id}: Failed to compute new allocation - ${error instanceof Error ? error.message : String(error)}`);
        return;
      }

      // Get current allocation (as string for comparison)
      const currentAlloc = currentAllocations[shift.id];
      const oldAllocationDateStr = Array.isArray(currentAlloc)
        ? currentAlloc
        : currentAlloc
        ? [currentAlloc as string]
        : ['UNALLOCATED'];

      // Get new allocation (as string for comparison)
      // SPLIT_BY_DAY returns daySegments, not allocationDate
      let newAllocationDateStr: string[];
      if (newResult.daySegments && newResult.daySegments.length > 0) {
        newAllocationDateStr = newResult.daySegments.map((seg) =>
          seg.date instanceof Date ? seg.date.toISOString().split('T')[0] : String(seg.date).split('T')[0]
        );
      } else if (Array.isArray(newResult.allocationDate)) {
        newAllocationDateStr = (newResult.allocationDate as Date[]).map((d) => d.toISOString().split('T')[0]);
      } else if (newResult.allocationDate) {
        newAllocationDateStr = [(newResult.allocationDate as Date).toISOString().split('T')[0]];
      } else {
        newAllocationDateStr = ['UNALLOCATED'];
      }

      // Check if allocation changed
      const changed = !arrayEquals(oldAllocationDateStr, newAllocationDateStr);

      if (changed) {
        allocationChanges++;

        const explanation = explainAllocation(shift, newSettings);
        const reason = explanation.reasoningSteps[explanation.reasoningSteps.length - 1] || 'Allocation changed';

        // Compute shift duration
        const startDate = shift.startDateTime instanceof Date ? shift.startDateTime : new Date(shift.startDateTime);
        const endDate = shift.endDateTime instanceof Date ? shift.endDateTime : new Date(shift.endDateTime);
        const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

        // Estimate overtime impact if new mode is weekly-based
        if (newSettings.nightShiftAllocationMode === 'WEEKLY_BALANCING') {
          overtimeImpactMinutes += durationMinutes;
        }

        changes.push({
          shiftId: shift.id,
          shiftDescription: `${startDate.toISOString().split('T')[0]} ${formatTime(startDate)} - ${formatTime(endDate)}`,
          oldAllocationDate: oldAllocationDateStr,
          newAllocationDate: newAllocationDateStr,
          reason,
          durationMinutes,
          crossesMidnight: Array.isArray(newResult.daySegments) && newResult.daySegments.length > 1,
        });
      }
    } catch (error) {
      warnings.push(`Shift ${shift.id}: Unexpected error during simulation - ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Generate warnings based on simulation results
  const warningsList = generateSimulationWarnings(newSettings, changes, shifts.length, warnings);

  return {
    summary: {
      affectedShifts: shifts.length,
      allocationChanges,
      allocationUnchanged: shifts.length - allocationChanges,
      overtimeImpactMinutes,
      warningsCount: warningsList.length,
      processedAt: new Date().toISOString(),
    },
    perShiftChanges: changes,
    warnings: warningsList,
    ruleVersion: 'v1',
  };
}

/**
 * Generates warnings based on simulation results.
 */
function generateSimulationWarnings(
  newSettings: RosterPatternSettings,
  changes: ShiftAllocationChange[],
  totalShifts: number,
  existingWarnings: string[]
): string[] {
  const warnings = [...existingWarnings];

  // Mode-specific warnings
  if (newSettings.nightShiftAllocationMode === 'SPLIT_BY_DAY') {
    if (changes.some(c => c.crossesMidnight)) {
      warnings.push(
        '⚠️ Split allocation mode detected: Payroll calculations may need to account for split day allocations'
      );
    }
  }

  if (newSettings.nightShiftAllocationMode === 'WEEKLY_BALANCING') {
    warnings.push(
      '⚠️ Weekly balancing enabled: Allocations will depend on current week capacity, which may change over time'
    );
    warnings.push(
      '💡 Tip: Weekly balancing impact will vary based on existing shifts booked in each week'
    );

    const params = newSettings.nightShiftAllocationParams as any;
    if (params?.tieBreakerRule === 'PREFER_END_DAY') {
      warnings.push(
        '✓ Tie-breaker set to END_DAY: Cross-midnight shifts will prefer end date when balanced'
      );
    }
  }

  if (newSettings.nightShiftAllocationMode === 'FIXED_ROSTER_DAY') {
    const params = newSettings.nightShiftAllocationParams as any;
    if (params?.fixedAllocationAnchor === 'PREVIOUS_DAY' || params?.fixedAllocationAnchor === 'NEXT_DAY') {
      warnings.push(
        `⚠️ Fixed anchor set to ${params.fixedAllocationAnchor}: Allocations may shift significantly`
      );
    }
  }

  if (newSettings.nightShiftAllocationMode === 'MAJORITY_HOURS') {
    if (changes.some(c => c.durationMinutes > 480)) {
      // More than 8 hours
      warnings.push(
        '⚠️ Long shifts detected: Majority Hours rule may have unexpected behavior on 12+ hour shifts'
      );
    }
  }

  // Coverage warnings
  const changePercentage = totalShifts > 0 ? (changes.length / totalShifts) * 100 : 0;

  if (changePercentage > 50) {
    warnings.push(
      `⚠️ High change volume: ${Math.round(changePercentage)}% of shifts would be reallocated. Review carefully.`
    );
  } else if (changePercentage > 25) {
    warnings.push(
      `ℹ️ Moderate changes: ${Math.round(changePercentage)}% of shifts would be reallocated`
    );
  }

  // Audit trail warning
  warnings.push(
    '📊 Tip: Changes will be audited when saved. Enable Audit Mode to review allocation decisions'
  );

  return warnings;
}

/**
 * Compares two allocation date arrays for equality.
 */
function arrayEquals(a: (string | Date)[], b: (string | Date)[]): boolean {
  if (a.length !== b.length) return false;

  const aStr = a.map(x => (typeof x === 'string' ? x : x.toISOString().split('T')[0])).sort();
  const bStr = b.map(x => (typeof x === 'string' ? x : x.toISOString().split('T')[0])).sort();

  return aStr.every((val, idx) => val === bStr[idx]);
}

/**
 * Utility: Format time for display.
 */
function formatTime(date: Date | string | number): string {
  let dateObj: Date;

  if (typeof date === 'string') {
    return date; // Already formatted (HH:mm)
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  return dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Helper: ComputeChangeDifference - detailed comparison between old and new settings impact.
 */
export function computeChangeDifference(
  change: ShiftAllocationChange
): {
  isMovedForward: boolean;
  isMovedBackward: boolean;
  daysDifference: number;
} {
  const oldDates = Array.isArray(change.oldAllocationDate)
    ? (change.oldAllocationDate as string[])
    : (change.oldAllocationDate as string).split(',');

  const newDates = Array.isArray(change.newAllocationDate)
    ? (change.newAllocationDate as string[])
    : (change.newAllocationDate as string).split(',');

  if (oldDates.length === 0 || newDates.length === 0) {
    return { isMovedForward: false, isMovedBackward: false, daysDifference: 0 };
  }

  const oldDate = new Date(oldDates[0]);
  const newDate = new Date(newDates[0]);

  const daysDiff = Math.floor((newDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));

  return {
    isMovedForward: daysDiff > 0,
    isMovedBackward: daysDiff < 0,
    daysDifference: Math.abs(daysDiff),
  };
}
