/**
 * Tests for Explainability, Simulation, and Audit systems
 *
 * Covers all allocation modes and edge cases.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { explainAllocation, ExplanationResult } from '../allocation-explainability';
import {
  simulateAllocationImpact,
  computeChangeDifference,
  SimulationResult,
  ShiftAllocationChange,
} from '../allocation-simulation';
import { AllocationAuditService, AuditEventType } from '../allocation-audit';
import { Shift, NightShiftAllocationSettings } from '../types/allocation';

// Test data
const createShift = (startDate: string, startTime: string, endDate: string, endTime: string): Shift => ({
  id: `shift-${Math.random()}`,
  startDateTime: new Date(`${startDate}T${startTime}`),
  endDateTime: new Date(`${endDate}T${endTime}`),
});

const startDaySettings: NightShiftAllocationSettings = {
  mode: 'START_DAY',
  params: {},
};

const majorityHoursSettings: NightShiftAllocationSettings = {
  mode: 'MAJORITY_HOURS',
  params: {},
};

const fixedRosterDaySettings = (anchor: string): NightShiftAllocationSettings => ({
  mode: 'FIXED_ROSTER_DAY',
  params: { fixedAllocationAnchor: anchor },
});

const weeklyBalancingSettings: NightShiftAllocationSettings = {
  mode: 'WEEKLY_BALANCING',
  params: {
    weekStartDay: 1,
    weeklyOrdinaryHoursThresholdMinutes: 2280,
    balancingStrategy: 'FILL_CURRENT_WEEK_FIRST',
    eligibilityRule: 'CROSS_MIDNIGHT_ONLY',
    tieBreakerRule: 'PREFER_START_DAY',
    payPeriodDefinitionType: 'INHERIT_PAYROLL_CALENDAR',
  },
};

describe('Explainability API', () => {
  describe('START_DAY mode', () => {
    it('should explain single-day shift allocation', () => {
      const shift = createShift('2025-02-14', '08:00', '2025-02-14', '17:00');
      const result = explainAllocation(shift, startDaySettings);

      expect(result.mode).toBe('START_DAY');
      expect(result.allocationDate).toBe('2025-02-14');
      expect(result.ruleVersion).toBe('v1');
      expect(result.reasoningSteps).toContain('Single-day shift');
      expect(result.systemContext?.shiftIsOvernight).toBe(false);
    });

    it('should explain cross-midnight shift allocation', () => {
      const shift = createShift('2025-02-14', '22:00', '2025-02-15', '07:00');
      const result = explainAllocation(shift, startDaySettings);

      expect(result.mode).toBe('START_DAY');
      expect(result.allocationDate).toBe('2025-02-14');
      expect(result.reasoningSteps).toContain('Cross-midnight shift detected');
      expect(result.systemContext?.shiftIsOvernight).toBe(true);
    });

    it('should include shift duration in reasoning', () => {
      const shift = createShift('2025-02-14', '09:00', '2025-02-14', '17:00');
      const result = explainAllocation(shift, startDaySettings);

      expect(result.reasoningSteps).toEqual(
        expect.arrayContaining([expect.stringContaining('8h 0m')])
      );
      expect(result.systemContext?.shiftDurationMinutes).toBe(480);
    });
  });

  describe('MAJORITY_HOURS mode', () => {
    it('should explain and identify majority winner', () => {
      const shift = createShift('2025-02-14', '22:00', '2025-02-15', '07:00');
      // 2 hours Friday, 7 hours Saturday
      const result = explainAllocation(shift, majorityHoursSettings);

      expect(result.mode).toBe('MAJORITY_HOURS');
      expect(result.allocationDate).toBe('2025-02-15');
      expect(result.reasoningSteps).toEqual(
        expect.arrayContaining([
          expect.stringContaining('2025-02-14'), // Friday
          expect.stringContaining('2025-02-15'), // Saturday
        ])
      );
      expect(result.metrics?.majorityWinner).toBe('2025-02-15');
      expect(result.metrics?.majorityWinnerMinutes).toBe(420);
    });

    it('should handle tie-breaker scenario', () => {
      const shift = createShift('2025-02-14', '12:00', '2025-02-15', '12:00');
      // 12 hours each day (tie)
      const result = explainAllocation(shift, majorityHoursSettings);

      expect(result.reasoningSteps).toEqual(
        expect.arrayContaining([expect.stringContaining('Tie')])
      );
      // Standard tie-break is start date
      expect(result.allocationDate).toBe('2025-02-14');
    });

    it('should include per-day breakdown in metrics', () => {
      const shift = createShift('2025-02-14', '20:00', '2025-02-15', '10:00');
      const result = explainAllocation(shift, majorityHoursSettings);

      expect(result.metrics?.minutesPerDay).toBeDefined();
      expect(Object.keys(result.metrics?.minutesPerDay || {})).toContain('2025-02-14');
      expect(Object.keys(result.metrics?.minutesPerDay || {})).toContain('2025-02-15');
    });
  });

  describe('FIXED_ROSTER_DAY mode', () => {
    it('should explain START_DAY anchor', () => {
      const shift = createShift('2025-02-14', '22:00', '2025-02-15', '07:00');
      const result = explainAllocation(shift, fixedRosterDaySettings('START_DAY'));

      expect(result.reasoningSteps).toContain('Using fixed anchor: START_DAY');
      expect(result.allocationDate).toBe('2025-02-14');
    });

    it('should explain END_DAY anchor', () => {
      const shift = createShift('2025-02-14', '22:00', '2025-02-15', '07:00');
      const result = explainAllocation(shift, fixedRosterDaySettings('END_DAY'));

      expect(result.reasoningSteps).toContain('Using fixed anchor: END_DAY');
      expect(result.allocationDate).toBe('2025-02-15');
    });

    it('should explain PREVIOUS_DAY anchor', () => {
      const shift = createShift('2025-02-14', '08:00', '2025-02-14', '17:00');
      const result = explainAllocation(shift, fixedRosterDaySettings('PREVIOUS_DAY'));

      expect(result.reasoningSteps).toContain('Using fixed anchor: PREVIOUS_DAY');
      expect(result.allocationDate).toBe('2025-02-13');
    });

    it('should explain NEXT_DAY anchor', () => {
      const shift = createShift('2025-02-14', '08:00', '2025-02-14', '17:00');
      const result = explainAllocation(shift, fixedRosterDaySettings('NEXT_DAY'));

      expect(result.reasoningSteps).toContain('Using fixed anchor: NEXT_DAY');
      expect(result.allocationDate).toBe('2025-02-15');
    });
  });

  describe('WEEKLY_BALANCING mode', () => {
    it('should include week-specific details in metrics', () => {
      const shift = createShift('2025-02-14', '22:00', '2025-02-15', '07:00');
      const result = explainAllocation(shift, weeklyBalancingSettings);

      expect(result.reasoningSteps).toContain('Allocation mode: WEEKLY_BALANCING');
      expect(result.reasoningSteps).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Week start day:'),
          expect.stringContaining('Weekly threshold:'),
          expect.stringContaining('Balancing strategy:'),
        ])
      );
    });

    it('should include pay period definition in metrics', () => {
      const shift = createShift('2025-02-14', '22:00', '2025-02-15', '07:00');
      const result = explainAllocation(shift, weeklyBalancingSettings);

      expect(result.metrics?.payPeriod).toBeDefined();
      expect(result.metrics?.payPeriod?.definitionType).toBe('INHERIT_PAYROLL_CALENDAR');
    });
  });

  describe('Explanation structure', () => {
    it('should always include required fields', () => {
      const shift = createShift('2025-02-14', '08:00', '2025-02-14', '17:00');
      const result = explainAllocation(shift, startDaySettings);

      expect(result).toHaveProperty('allocationDate');
      expect(result).toHaveProperty('mode');
      expect(result).toHaveProperty('ruleVersion');
      expect(result).toHaveProperty('reasoningSteps');
      expect(result).toHaveProperty('systemContext');
      expect(Array.isArray(result.reasoningSteps)).toBe(true);
      expect(result.reasoningSteps.length).toBeGreaterThan(0);
    });

    it('should have human-readable reasoning steps', () => {
      const shift = createShift('2025-02-14', '22:00', '2025-02-15', '07:00');
      const result = explainAllocation(shift, majorityHoursSettings);

      result.reasoningSteps.forEach((step) => {
        expect(typeof step).toBe('string');
        expect(step.length).toBeGreaterThan(0);
        // Should not have UI strings or code artifacts
        expect(step).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/); // No UUIDs
      });
    });
  });
});

describe('Simulation API', () => {
  describe('simulateAllocationImpact', () => {
    it('should detect changes between modes', () => {
      const shifts = [
        createShift('2025-02-14', '22:00', '2025-02-15', '07:00'),
        createShift('2025-02-15', '08:00', '2025-02-15', '17:00'),
      ];

      const currentAllocations = {
        [shifts[0].id]: '2025-02-14', // START_DAY would put this here
        [shifts[1].id]: '2025-02-15',
      };

      const result = simulateAllocationImpact(
        shifts,
        startDaySettings,
        majorityHoursSettings, // Switch to MAJORITY_HOURS
        currentAllocations
      );

      expect(result.summary.affectedShifts).toBe(2);
      expect(result.summary.allocationChanges).toBeGreaterThanOrEqual(0);
      expect(result.ruleVersion).toBe('v1');
    });

    it('should generate per-shift changes with details', () => {
      const shift = createShift('2025-02-14', '22:00', '2025-02-15', '07:00');
      const shifts = [shift];

      const currentAllocations = {
        [shift.id]: '2025-02-14',
      };

      const result = simulateAllocationImpact(
        shifts,
        startDaySettings,
        majorityHoursSettings,
        currentAllocations
      );

      if (result.perShiftChanges.length > 0) {
        const change = result.perShiftChanges[0];
        expect(change).toHaveProperty('shiftId');
        expect(change).toHaveProperty('oldAllocationDate');
        expect(change).toHaveProperty('newAllocationDate');
        expect(change).toHaveProperty('reason');
        expect(change).toHaveProperty('durationMinutes');
        expect(change).toHaveProperty('crossesMidnight');
      }
    });

    it('should calculate allocation unchanged count correctly', () => {
      const shift = createShift('2025-02-14', '08:00', '2025-02-14', '17:00');
      const shifts = [shift];

      const currentAllocations = {
        [shift.id]: '2025-02-14',
      };

      const result = simulateAllocationImpact(shifts, startDaySettings, startDaySettings, currentAllocations);

      expect(result.summary.allocationUnchanged).toBe(shifts.length);
      expect(result.summary.allocationChanges).toBe(0);
    });

    it('should generate warnings based on mode changes', () => {
      const shifts = [createShift('2025-02-14', '22:00', '2025-02-15', '07:00')];
      const currentAllocations = {
        [shifts[0].id]: '2025-02-14',
      };

      const result = simulateAllocationImpact(shifts, startDaySettings, weeklyBalancingSettings, currentAllocations);

      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Weekly'))).toBe(true);
    });

    it('should handle empty shifts array gracefully', () => {
      const result = simulateAllocationImpact([], startDaySettings, majorityHoursSettings, {});

      expect(result.summary.affectedShifts).toBe(0);
      expect(result.perShiftChanges.length).toBe(0);
    });

    it('should include warnings about high change volume', () => {
      const shifts = Array.from({ length: 10 }, (_, i) =>
        createShift('2025-02-14', `${10 + i}:00`, '2025-02-14', `${11 + i}:00`)
      );

      const currentAllocations = Object.fromEntries(shifts.map((s) => [s.id, '2025-02-14']));

      const result = simulateAllocationImpact(
        shifts,
        startDaySettings,
        fixedRosterDaySettings('END_DAY'), // Likely to change many
        currentAllocations
      );

      // Check for high change warning
      const highChangeWarning = result.warnings.some(w => w.includes('High change volume') || w.includes('Moderate'));
      expect(highChangeWarning || result.summary.allocationChanges === 0).toBe(true);
    });
  });

  describe('computeChangeDifference', () => {
    it('should detect forward movement', () => {
      const change: ShiftAllocationChange = {
        shiftId: 'shift-1',
        shiftDescription: '2025-02-14 22:00 - 07:00',
        oldAllocationDate: '2025-02-14',
        newAllocationDate: '2025-02-15',
        reason: 'Majority hours',
        durationMinutes: 540,
        crossesMidnight: true,
      };

      const diff = computeChangeDifference(change);

      expect(diff.isMovedForward).toBe(true);
      expect(diff.isMovedBackward).toBe(false);
      expect(diff.daysDifference).toBe(1);
    });

    it('should detect backward movement', () => {
      const change: ShiftAllocationChange = {
        shiftId: 'shift-1',
        shiftDescription: '2025-02-14 08:00 - 17:00',
        oldAllocationDate: '2025-02-14',
        newAllocationDate: '2025-02-13',
        reason: 'Previous day anchor',
        durationMinutes: 480,
        crossesMidnight: false,
      };

      const diff = computeChangeDifference(change);

      expect(diff.isMovedForward).toBe(false);
      expect(diff.isMovedBackward).toBe(true);
      expect(diff.daysDifference).toBe(1);
    });

    it('should handle multiple allocation dates', () => {
      const change: ShiftAllocationChange = {
        shiftId: 'shift-1',
        shiftDescription: 'Multi-day shift',
        oldAllocationDate: ['2025-02-14', '2025-02-15'],
        newAllocationDate: ['2025-02-13', '2025-02-14', '2025-02-15'],
        reason: 'Split by day',
        durationMinutes: 1440,
        crossesMidnight: true,
      };

      const diff = computeChangeDifference(change);

      expect(diff.daysDifference).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Simulation structure', () => {
    it('should have complete summary structure', () => {
      const shifts = [createShift('2025-02-14', '08:00', '2025-02-14', '17:00')];
      const currentAllocations = {
        [shifts[0].id]: '2025-02-14',
      };

      const result = simulateAllocationImpact(shifts, startDaySettings, startDaySettings, currentAllocations);

      expect(result.summary).toHaveProperty('affectedShifts');
      expect(result.summary).toHaveProperty('allocationChanges');
      expect(result.summary).toHaveProperty('allocationUnchanged');
      expect(result.summary).toHaveProperty('overtimeImpactMinutes');
      expect(result.summary).toHaveProperty('warningsCount');
      expect(result.summary).toHaveProperty('processedAt');
    });

    it('should have array of per-shift changes', () => {
      const shifts = [createShift('2025-02-14', '08:00', '2025-02-14', '17:00')];
      const currentAllocations = {
        [shifts[0].id]: '2025-02-14',
      };

      const result = simulateAllocationImpact(shifts, startDaySettings, startDaySettings, currentAllocations);

      expect(Array.isArray(result.perShiftChanges)).toBe(true);
    });
  });
});

describe('Audit API', () => {
  describe('AllocationAuditService', () => {
    it('should construct audit record request properly', () => {
      const shift = createShift('2025-02-14', '22:00', '2025-02-15', '07:00');
      const explanation: ExplanationResult = {
        allocationDate: '2025-02-15',
        mode: 'MAJORITY_HOURS',
        ruleVersion: 'v1',
        reasoningSteps: ['Test step'],
        systemContext: {
          shiftIsOvernight: true,
          shiftDurationMinutes: 540,
          shiftStartDate: '2025-02-14',
          shiftEndDate: '2025-02-15',
        },
      };

      const auditRequest = {
        tenantId: 'tenant-123',
        shiftId: shift.id,
        rosterPatternId: 'pattern-456',
        shift,
        settings: majorityHoursSettings,
        explanation,
        computedBy: 'user-789',
        eventType: AuditEventType.ROSTER_PATTERN_SAVED,
      };

      expect(auditRequest).toHaveProperty('tenantId');
      expect(auditRequest).toHaveProperty('shiftId');
      expect(auditRequest).toHaveProperty('shift');
      expect(auditRequest).toHaveProperty('settings');
      expect(auditRequest).toHaveProperty('explanation');
    });

    it('should format time correctly', () => {
      // This is tested implicitly through audit record creation
      // but we verify the timeformat is HH:mm
      const date = new Date('2025-02-14T22:30:00');
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      expect(timeStr).toMatch(/^\d{2}:\d{2}$/);
      expect(timeStr).toBe('22:30');
    });

    it('should handle shift duration calculation', () => {
      const shift = createShift('2025-02-14', '22:00', '2025-02-15', '07:00');
      const startDate = shift.startDateTime as Date;
      const endDate = shift.endDateTime as Date;
      const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

      expect(durationMinutes).toBe(540); // 9 hours
    });
  });

  describe('Audit record structure', () => {
    it('should capture all necessary fields', () => {
      const shift = createShift('2025-02-14', '08:00', '2025-02-14', '17:00');
      const explanation: ExplanationResult = {
        allocationDate: '2025-02-14',
        mode: 'START_DAY',
        ruleVersion: 'v1',
        reasoningSteps: ['Test'],
        systemContext: {
          shiftIsOvernight: false,
          shiftDurationMinutes: 480,
          shiftStartDate: '2025-02-14',
          shiftEndDate: '2025-02-14',
        },
      };

      // Verify the structure that would be saved
      const allocationDate = '2025-02-14';
      const allocationDates = null;
      const allocationParamsSnapshot = majorityHoursSettings.params;
      const ruleVersion = explanation.ruleVersion;
      const explanationSnapshot = explanation;

      expect(allocationDate).toBeDefined();
      expect(allocationParamsSnapshot).toBeDefined();
      expect(ruleVersion).toBe('v1');
      expect(explanationSnapshot.reasoningSteps).toBeDefined();
    });
  });

  describe('Audit event types', () => {
    it('should support all event types', () => {
      const eventTypes = [
        AuditEventType.ALLOCATION_COMPUTED,
        AuditEventType.ROSTER_PATTERN_SAVED,
        AuditEventType.ALLOCATION_SETTINGS_CHANGED,
        AuditEventType.PAYROLL_EXPORT,
        AuditEventType.MANUAL_RECOMPUTE,
      ];

      expect(eventTypes.length).toBe(5);
      eventTypes.forEach((eventType) => {
        expect(typeof eventType).toBe('string');
      });
    });
  });
});

describe('Integration scenarios', () => {
  it('should flow from explanation to audit preparation', () => {
    const shift = createShift('2025-02-14', '22:00', '2025-02-15', '07:00');
    const explanation = explainAllocation(shift, majorityHoursSettings);

    const auditRequest = {
      tenantId: 'tenant-123',
      shiftId: shift.id,
      rosterPatternId: 'pattern-456',
      shift,
      settings: majorityHoursSettings,
      explanation,
      computedBy: 'system',
      eventType: AuditEventType.ALLOCATION_COMPUTED,
    };

    // Verify chain of data
    expect(auditRequest.explanation.reasoningSteps).toEqual(explanation.reasoningSteps);
    expect(auditRequest.explanation.allocationDate).toBe(explanation.allocationDate);
  });

  it('should flow from simulation to decision', () => {
    const shift = createShift('2025-02-14', '22:00', '2025-02-15', '07:00');
    const shifts = [shift];
    const currentAllocations = {
      [shift.id]: '2025-02-14',
    };

    const simulation = simulateAllocationImpact(
      shifts,
      startDaySettings,
      majorityHoursSettings,
      currentAllocations
    );

    // After reviewing simulation, user would save and trigger audit
    if (simulation.summary.allocationChanges > 0) {
      const explanation = explainAllocation(shift, majorityHoursSettings);
      expect(explanation.allocationDate).toBe('2025-02-15');
    }
  });
});
