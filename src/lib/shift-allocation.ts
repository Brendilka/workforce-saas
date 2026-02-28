/**
 * Night Shift Allocation Logic
 * 
 * Pure function to compute which calendar date a cross-midnight shift should be allocated to
 * based on configurable allocation rules per roster pattern.
 */

import { parse, format, addDays, startOfDay, isAfter, isBefore, isSameDay, differenceInMinutes } from 'date-fns';

export type AllocationMode = 
  | 'START_DAY'
  | 'MAJORITY_HOURS'
  | 'SPLIT_BY_DAY'
  | 'FIXED_ROSTER_DAY'
  | 'WEEKLY_BALANCING';

export type WeekStartDay = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type BalancingStrategy = 'FILL_CURRENT_WEEK_FIRST' | 'FILL_NEXT_WEEK_FIRST';
export type EligibilityRule = 'CROSS_MIDNIGHT_ONLY' | 'ALL_SHIFTS';
export type TieBreakerRule = 'PREFER_START_DAY' | 'PREFER_END_DAY';
export type FixedAnchor = 'START_DAY' | 'END_DAY' | 'PREVIOUS_DAY' | 'NEXT_DAY';
export type PayPeriodDefinitionType = 'INHERIT_PAYROLL_CALENDAR' | 'PAY_PERIOD_START_DAY' | 'PAY_PERIOD_START_DATE';

export interface Shift {
  id: string;
  startDateTime: Date;
  endDateTime: Date;
  timezone?: string;
  breaks?: Array<{ startTime: string; endTime: string; type?: string }>;
}

export interface FixedRosterDayParams {
  fixedAllocationAnchor: FixedAnchor;
}

export interface WeeklyBalancingParams {
  weekStartDay: WeekStartDay;
  weeklyOrdinaryHoursThresholdMinutes: number;
  balancingStrategy: BalancingStrategy;
  eligibilityRule?: EligibilityRule;
  tieBreakerRule: TieBreakerRule;
  payPeriodDefinitionType: PayPeriodDefinitionType;
  payPeriodStartDay?: WeekStartDay;
  payPeriodStartDate?: string; // ISO date
}

export interface AllocationParams {
  [key: string]: any;
}

export interface RosterPatternSettings {
  nightShiftAllocationMode: AllocationMode;
  nightShiftAllocationParams: AllocationParams;
}

export interface RosterPatternContext {
  // All shifts in the roster pattern, keyed by date or comparable identifier
  allShifts: Shift[];
  // Timezone context for the roster pattern
  timezone?: string;
}

export interface DaySegment {
  date: Date;
  startDateTime: Date;
  endDateTime: Date;
  minutes: number;
}

export interface AllocationResult {
  allocationDate?: Date; // Single allocation date
  daySegments?: DaySegment[]; // Multiple allocations (SPLIT_BY_DAY)
  error?: string; // Error message if validation failed
  isPreview?: boolean; // True if values are unsaved (for UI)
}

export interface ValidationError {
  error: string;
  missingKeys?: string[];
}

/**
 * Determine if a shift spans midnight (crosses calendar date boundary)
 */
export function isCrossMidnightShift(shift: Shift): boolean {
  const startDate = startOfDay(shift.startDateTime);
  const endDate = startOfDay(shift.endDateTime);
  return !isSameDay(startDate, endDate);
}

/**
 * Get the day-of-week number (0 = Monday, 6 = Sunday)
 */
function getWeekDayNumber(date: Date): number {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to 0 = Monday, 6 = Sunday
}

/**
 * Convert WeekStartDay enum to numeric day (0 = Monday)
 */
function weekStartDayToNumber(day: WeekStartDay): number {
  const dayMap = {
    'MON': 0,
    'TUE': 1,
    'WED': 2,
    'THU': 3,
    'FRI': 4,
    'SAT': 5,
    'SUN': 6,
  };
  return dayMap[day];
}

/**
 * Get the Monday of the week containing the given date, based on weekStartDay configuration
 */
export function getWeekStartDate(date: Date, weekStartDay: WeekStartDay): Date {
  const weekStartNum = weekStartDayToNumber(weekStartDay);
  const currentDayNum = getWeekDayNumber(date);
  const daysBack = (currentDayNum - weekStartNum + 7) % 7;
  return addDays(startOfDay(date), -daysBack);
}

/**
 * Get numeric week bucket identifier for a date
 */
export function getWeekBucket(date: Date, weekStartDay: WeekStartDay): string {
  const weekStart = getWeekStartDate(date, weekStartDay);
  return format(weekStart, 'yyyy-MM-dd');
}

/**
 * Compute allocated minutes per calendar date for a shift
 * Returns an object: { YYYY-MM-DD: minutes, ... }
 */
export function computeMinutesPerDay(shift: Shift): Record<string, number> {
  const result: Record<string, number> = {};
  
  let current = startOfDay(shift.startDateTime);
  const endDay = startOfDay(shift.endDateTime);
  
  while (!isAfter(current, endDay)) {
    const dateKey = format(current, 'yyyy-MM-dd');
    
    // Compute start and end times for this day
    const dayStart = current;
    const dayEnd = addDays(current, 1);
    
    const shiftStart = isBefore(shift.startDateTime, dayStart) ? dayStart : shift.startDateTime;
    const shiftEnd = isAfter(shift.endDateTime, dayEnd) ? dayEnd : shift.endDateTime;
    
    const minutes = differenceInMinutes(shiftEnd, shiftStart);
    result[dateKey] = (result[dateKey] || 0) + minutes;
    
    current = dayEnd;
  }
  
  return result;
}

/**
 * Validates that required parameters exist for a given mode
 */
function validateModeParams(mode: AllocationMode, params: AllocationParams): ValidationError | null {
  const required: Record<AllocationMode, string[]> = {
    'START_DAY': [],
    'MAJORITY_HOURS': [],
    'SPLIT_BY_DAY': [],
    'FIXED_ROSTER_DAY': ['fixedAllocationAnchor'],
    'WEEKLY_BALANCING': [
      'weekStartDay',
      'weeklyOrdinaryHoursThresholdMinutes',
      'balancingStrategy',
      'tieBreakerRule',
      'payPeriodDefinitionType',
    ],
  };
  
  const requiredKeys = required[mode] || [];
  const missingKeys = requiredKeys.filter(key => !(key in params));
  
  if (missingKeys.length > 0) {
    return {
      error: `Missing required parameters for ${mode} mode`,
      missingKeys,
    };
  }
  
  // Additional validation for WEEKLY_BALANCING
  if (mode === 'WEEKLY_BALANCING') {
    const wb = params as WeeklyBalancingParams;
    const payType = wb.payPeriodDefinitionType;
    
    if (payType === 'PAY_PERIOD_START_DAY' && !wb.payPeriodStartDay) {
      return {
        error: 'payPeriodStartDay is required when payPeriodDefinitionType is PAY_PERIOD_START_DAY',
        missingKeys: ['payPeriodStartDay'],
      };
    }
    
    if (payType === 'PAY_PERIOD_START_DATE' && !wb.payPeriodStartDate) {
      return {
        error: 'payPeriodStartDate is required when payPeriodDefinitionType is PAY_PERIOD_START_DATE',
        missingKeys: ['payPeriodStartDate'],
      };
    }
  }
  
  return null;
}

/**
 * Main allocation computation function
 */
export function computeAllocationDate(
  shift: Shift,
  settings: RosterPatternSettings,
  context?: RosterPatternContext
): AllocationResult {
  // Non-cross-midnight shifts always allocate to start day
  if (!isCrossMidnightShift(shift)) {
    return {
      allocationDate: startOfDay(shift.startDateTime),
    };
  }
  
  const mode = settings.nightShiftAllocationMode;
  const params = settings.nightShiftAllocationParams;
  
  switch (mode) {
    case 'START_DAY':
      return {
        allocationDate: startOfDay(shift.startDateTime),
      };
    
    case 'MAJORITY_HOURS': {
      const minutesPerDay = computeMinutesPerDay(shift);
      const dates = Object.entries(minutesPerDay);
      
      if (dates.length === 0) {
        return {
          allocationDate: startOfDay(shift.startDateTime),
        };
      }
      
      // Find date with max minutes, tie-break to start day
      let maxDate = dates[0][0];
      let maxMinutes = dates[0][1];
      
      for (const [date, minutes] of dates) {
        if (minutes > maxMinutes) {
          maxDate = date;
          maxMinutes = minutes;
        }
      }
      
      return {
        allocationDate: parse(maxDate, 'yyyy-MM-dd', new Date()),
      };
    }
    
    case 'SPLIT_BY_DAY': {
      const daySegments: DaySegment[] = [];
      let current = startOfDay(shift.startDateTime);
      const endDay = startOfDay(shift.endDateTime);
      
      while (!isAfter(current, endDay)) {
        const dayStart = current;
        const dayEnd = addDays(current, 1);
        
        const segmentStart = isBefore(shift.startDateTime, dayStart) ? dayStart : shift.startDateTime;
        const segmentEnd = isAfter(shift.endDateTime, dayEnd) ? dayEnd : shift.endDateTime;
        
        const minutes = differenceInMinutes(segmentEnd, segmentStart);
        
        daySegments.push({
          date: current,
          startDateTime: segmentStart,
          endDateTime: segmentEnd,
          minutes,
        });
        
        current = dayEnd;
      }
      
      return {
        daySegments,
      };
    }
    
    case 'FIXED_ROSTER_DAY': {
      const validation = validateModeParams(mode, params);
      if (validation) {
        return { error: validation.error };
      }
      
      const anchor = (params as FixedRosterDayParams).fixedAllocationAnchor;
      let allocationDate: Date;
      
      switch (anchor) {
        case 'START_DAY':
          allocationDate = startOfDay(shift.startDateTime);
          break;
        case 'END_DAY':
          allocationDate = startOfDay(shift.endDateTime);
          break;
        case 'PREVIOUS_DAY':
          allocationDate = addDays(startOfDay(shift.startDateTime), -1);
          break;
        case 'NEXT_DAY':
          allocationDate = addDays(startOfDay(shift.startDateTime), 1);
          break;
        default:
          // Unknown anchor; default to start day for safety
          allocationDate = startOfDay(shift.startDateTime);
      }
      
      return { allocationDate };
    }
    
    case 'WEEKLY_BALANCING': {
      const validation = validateModeParams(mode, params);
      if (validation) {
        return { error: validation.error };
      }
      
      const wb = params as WeeklyBalancingParams;
      const eligibility = wb.eligibilityRule || 'CROSS_MIDNIGHT_ONLY';
      
      const startWeekBucket = getWeekBucket(shift.startDateTime, wb.weekStartDay);
      const endWeekBucket = getWeekBucket(shift.endDateTime, wb.weekStartDay);
      const sameWeek = startWeekBucket === endWeekBucket;
      
      if (sameWeek) {
        // Same week: use tie-breaker
        const allocationDate = wb.tieBreakerRule === 'PREFER_START_DAY'
          ? startOfDay(shift.startDateTime)
          : startOfDay(shift.endDateTime);
        return { allocationDate };
      }
      
      // Different weeks: apply balancing logic
      if (!context?.allShifts) {
        // Cannot compute without context; fall back to tie-breaker
        const allocationDate = wb.tieBreakerRule === 'PREFER_START_DAY'
          ? startOfDay(shift.startDateTime)
          : startOfDay(shift.endDateTime);
        return { allocationDate };
      }
      
      // Compute scheduled minutes per week bucket
      const minutesPerWeek: Record<string, number> = {};
      
      for (const otherShift of context.allShifts) {
        if (otherShift.id === shift.id) continue; // Skip current shift
        
        // Apply eligibility rule
        if (eligibility === 'CROSS_MIDNIGHT_ONLY' && !isCrossMidnightShift(otherShift)) {
          continue;
        }
        
        const weekBucket = getWeekBucket(otherShift.startDateTime, wb.weekStartDay);
        const minutesPerDay = computeMinutesPerDay(otherShift);
        
        for (const [, minutes] of Object.entries(minutesPerDay)) {
          minutesPerWeek[weekBucket] = (minutesPerWeek[weekBucket] || 0) + minutes;
        }
      }
      
      const startWeekScheduled = minutesPerWeek[startWeekBucket] || 0;
      const endWeekScheduled = minutesPerWeek[endWeekBucket] || 0;
      const threshold = wb.weeklyOrdinaryHoursThresholdMinutes;
      
      const startWeekRemaining = threshold - startWeekScheduled;
      const endWeekRemaining = threshold - endWeekScheduled;
      
      let allocationDate: Date;
      
      if (wb.balancingStrategy === 'FILL_CURRENT_WEEK_FIRST') {
        if (startWeekRemaining > 0) {
          allocationDate = startOfDay(shift.startDateTime);
        } else if (endWeekRemaining > 0) {
          allocationDate = startOfDay(shift.endDateTime);
        } else {
          // Neither has space; use tie-breaker
          allocationDate = wb.tieBreakerRule === 'PREFER_START_DAY'
            ? startOfDay(shift.startDateTime)
            : startOfDay(shift.endDateTime);
        }
      } else {
        // FILL_NEXT_WEEK_FIRST
        if (endWeekRemaining > 0) {
          allocationDate = startOfDay(shift.endDateTime);
        } else if (startWeekRemaining > 0) {
          allocationDate = startOfDay(shift.startDateTime);
        } else {
          // Neither has space; use tie-breaker
          allocationDate = wb.tieBreakerRule === 'PREFER_START_DAY'
            ? startOfDay(shift.startDateTime)
            : startOfDay(shift.endDateTime);
        }
      }
      
      return { allocationDate };
    }
    
    default:
      return {
        error: `Unknown allocation mode: ${mode}`,
      };
  }
}

/**
 * Format allocation result for display
 */
export function formatAllocationResult(result: AllocationResult): string {
  if (result.error) {
    return `Error: ${result.error}`;
  }
  
  if (result.daySegments) {
    return `Allocated across ${result.daySegments.length} days`;
  }
  
  if (result.allocationDate) {
    return format(result.allocationDate, 'yyyy-MM-dd (EEEE)');
  }
  
  return 'Unknown allocation';
}
