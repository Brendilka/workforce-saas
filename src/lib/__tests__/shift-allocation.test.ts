/**
 * Unit tests for Night Shift Allocation Logic
 */

import { describe, it, expect } from '@jest/globals';
import {
  computeAllocationDate,
  isCrossMidnightShift,
  AllocationResult,
  Shift,
  RosterPatternSettings,
} from './shift-allocation';
import { parse, addHours } from 'date-fns';

describe('Night Shift Allocation - computeAllocationDate', () => {
  
  // Helper to create test shift
  function createShift(
    startStr: string, // 'YYYY-MM-DD HH:mm'
    endStr: string,
    id: string = 'shift-1'
  ): Shift {
    return {
      id,
      startDateTime: parse(startStr, 'yyyy-MM-dd HH:mm', new Date()),
      endDateTime: parse(endStr, 'yyyy-MM-dd HH:mm', new Date()),
    };
  }
  
  describe('START_DAY mode', () => {
    it('should allocate Fri 22:00–Sat 07:00 to Friday', () => {
      const shift = createShift('2026-02-20 22:00', '2026-02-21 07:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'START_DAY',
        nightShiftAllocationParams: {},
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.allocationDate?.toISOString()).toContain('2026-02-20');
    });
    
    it('should allocate non-midnight shift to start day', () => {
      const shift = createShift('2026-02-20 08:00', '2026-02-20 16:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'START_DAY',
        nightShiftAllocationParams: {},
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.allocationDate?.toISOString()).toContain('2026-02-20');
    });
  });
  
  describe('MAJORITY_HOURS mode', () => {
    it('should allocate Fri 22:00–Sat 07:00 to Saturday (7 hours)', () => {
      const shift = createShift('2026-02-20 22:00', '2026-02-21 07:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'MAJORITY_HOURS',
        nightShiftAllocationParams: {},
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.allocationDate?.toISOString()).toContain('2026-02-21');
    });
    
    it('should handle tie-breaker (equal hours) with START_DAY preference', () => {
      // Shift from Fri 18:00–Sat 18:00 (12:00 each day - tie)
      const shift = createShift('2026-02-20 18:00', '2026-02-21 18:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'MAJORITY_HOURS',
        nightShiftAllocationParams: {},
      };
      
      const result = computeAllocationDate(shift, settings);
      // Should pick start day on tie
      expect(result.allocationDate?.toISOString()).toContain('2026-02-20');
    });
    
    it('should handle multi-day shifts correctly', () => {
      // Fri 22:00–Mon 06:00 (26 hours Fri, 24 hours Sat, 6 hours Mon = max Saturday)
      const shift = createShift('2026-02-20 22:00', '2026-02-23 06:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'MAJORITY_HOURS',
        nightShiftAllocationParams: {},
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.allocationDate?.toISOString()).toContain('2026-02-21'); // Saturday
    });
  });
  
  describe('FIXED_ROSTER_DAY mode', () => {
    it('should allocate to START_DAY anchor', () => {
      const shift = createShift('2026-02-20 22:00', '2026-02-21 07:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'FIXED_ROSTER_DAY',
        nightShiftAllocationParams: {
          fixedAllocationAnchor: 'START_DAY',
        },
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.allocationDate?.toISOString()).toContain('2026-02-20');
    });
    
    it('should allocate to END_DAY anchor', () => {
      const shift = createShift('2026-02-20 22:00', '2026-02-21 07:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'FIXED_ROSTER_DAY',
        nightShiftAllocationParams: {
          fixedAllocationAnchor: 'END_DAY',
        },
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.allocationDate?.toISOString()).toContain('2026-02-21');
    });
    
    it('should allocate to PREVIOUS_DAY anchor', () => {
      const shift = createShift('2026-02-20 22:00', '2026-02-21 07:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'FIXED_ROSTER_DAY',
        nightShiftAllocationParams: {
          fixedAllocationAnchor: 'PREVIOUS_DAY',
        },
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.allocationDate?.toISOString()).toContain('2026-02-19');
    });
    
    it('should allocate to NEXT_DAY anchor', () => {
      const shift = createShift('2026-02-20 22:00', '2026-02-21 07:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'FIXED_ROSTER_DAY',
        nightShiftAllocationParams: {
          fixedAllocationAnchor: 'NEXT_DAY',
        },
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.allocationDate?.toISOString()).toContain('2026-02-21');
    });
    
    it('should return error if fixedAllocationAnchor is missing', () => {
      const shift = createShift('2026-02-20 22:00', '2026-02-21 07:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'FIXED_ROSTER_DAY',
        nightShiftAllocationParams: {},
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Missing required parameters');
    });
  });
  
  describe('SPLIT_BY_DAY mode', () => {
    it('should create 2 day segments for Fri 22:00–Sat 07:00', () => {
      const shift = createShift('2026-02-20 22:00', '2026-02-21 07:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'SPLIT_BY_DAY',
        nightShiftAllocationParams: {},
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.daySegments).toBeDefined();
      expect(result.daySegments?.length).toBe(2);
      expect(result.daySegments?.[0].minutes).toBe(120); // 22:00-24:00 = 2 hours
      expect(result.daySegments?.[1].minutes).toBe(420); // 00:00-07:00 = 7 hours
    });
    
    it('should create 3 day segments for multi-day shift', () => {
      const shift = createShift('2026-02-20 22:00', '2026-02-23 06:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'SPLIT_BY_DAY',
        nightShiftAllocationParams: {},
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.daySegments).toBeDefined();
      expect(result.daySegments?.length).toBe(4);
      expect(result.daySegments?.[0].minutes).toBe(120); // Fri
      expect(result.daySegments?.[1].minutes).toBe(1440); // Sat (full day)
      expect(result.daySegments?.[2].minutes).toBe(1440); // Sun (full day)
      expect(result.daySegments?.[3].minutes).toBe(360); // Mon (6 hours)
    });
  });
  
  describe('WEEKLY_BALANCING mode', () => {
    it('should return error if required params are missing', () => {
      const shift = createShift('2026-02-20 22:00', '2026-02-21 07:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'WEEKLY_BALANCING',
        nightShiftAllocationParams: {},
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Missing required parameters');
    });
    
    it('should use tieBreakerRule when both dates in same week', () => {
      const shift = createShift('2026-02-20 22:00', '2026-02-21 07:00'); // Fri–Sat
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'WEEKLY_BALANCING',
        nightShiftAllocationParams: {
          weekStartDay: 'MON',
          weeklyOrdinaryHoursThresholdMinutes: 2280, // 38 hours
          balancingStrategy: 'FILL_CURRENT_WEEK_FIRST',
          tieBreakerRule: 'PREFER_START_DAY',
          payPeriodDefinitionType: 'PAY_PERIOD_START_DAY',
          payPeriodStartDay: 'MON',
        },
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.allocationDate?.toISOString()).toContain('2026-02-20'); // Start day
    });
    
    it('should respect tieBreakerRule PREFER_END_DAY', () => {
      const shift = createShift('2026-02-20 22:00', '2026-02-21 07:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'WEEKLY_BALANCING',
        nightShiftAllocationParams: {
          weekStartDay: 'MON',
          weeklyOrdinaryHoursThresholdMinutes: 2280,
          balancingStrategy: 'FILL_CURRENT_WEEK_FIRST',
          tieBreakerRule: 'PREFER_END_DAY',
          payPeriodDefinitionType: 'PAY_PERIOD_START_DAY',
          payPeriodStartDay: 'MON',
        },
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.allocationDate?.toISOString()).toContain('2026-02-21'); // End day
    });
    
    it('should validate payPeriodStartDay requirement', () => {
      const shift = createShift('2026-02-20 22:00', '2026-02-21 07:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'WEEKLY_BALANCING',
        nightShiftAllocationParams: {
          weekStartDay: 'MON',
          weeklyOrdinaryHoursThresholdMinutes: 2280,
          balancingStrategy: 'FILL_CURRENT_WEEK_FIRST',
          tieBreakerRule: 'PREFER_START_DAY',
          payPeriodDefinitionType: 'PAY_PERIOD_START_DAY',
          // Missing payPeriodStartDay
        },
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('payPeriodStartDay is required');
    });
    
    it('should validate payPeriodStartDate requirement', () => {
      const shift = createShift('2026-02-20 22:00', '2026-02-21 07:00');
      const settings: RosterPatternSettings = {
        nightShiftAllocationMode: 'WEEKLY_BALANCING',
        nightShiftAllocationParams: {
          weekStartDay: 'MON',
          weeklyOrdinaryHoursThresholdMinutes: 2280,
          balancingStrategy: 'FILL_CURRENT_WEEK_FIRST',
          tieBreakerRule: 'PREFER_START_DAY',
          payPeriodDefinitionType: 'PAY_PERIOD_START_DATE',
          // Missing payPeriodStartDate
        },
      };
      
      const result = computeAllocationDate(shift, settings);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('payPeriodStartDate is required');
    });
  });
  
  describe('isCrossMidnightShift', () => {
    it('should return true for cross-midnight shift', () => {
      const shift = createShift('2026-02-20 22:00', '2026-02-21 07:00');
      expect(isCrossMidnightShift(shift)).toBe(true);
    });
    
    it('should return false for same-day shift', () => {
      const shift = createShift('2026-02-20 08:00', '2026-02-20 16:00');
      expect(isCrossMidnightShift(shift)).toBe(false);
    });
  });
});
