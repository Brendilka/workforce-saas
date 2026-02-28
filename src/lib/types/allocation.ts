/**
 * Type definitions for Night Shift Allocation system
 * Re-exports types from shift-allocation for centralized access
 */

export type {
  Shift,
  FixedRosterDayParams,
  WeeklyBalancingParams,
  AllocationParams,
  DaySegment,
  AllocationResult,
  AllocationMode,
  ValidationError,
  WeekStartDay,
  BalancingStrategy,
  EligibilityRule,
  TieBreakerRule,
  FixedAnchor,
  PayPeriodDefinitionType,
  RosterPatternSettings,
} from '@/lib/shift-allocation';

/**
 * Allocation settings for a roster pattern.
 */
export interface NightShiftAllocationSettings {
  mode: 'START_DAY' | 'MAJORITY_HOURS' | 'FIXED_ROSTER_DAY' | 'SPLIT_BY_DAY' | 'WEEKLY_BALANCING';
  params?: Record<string, any>;
}

/**
 * Context information for weekly balancing calculations.
 */
export interface WeeklyBalancingContext {
  currentWeekMinutes?: number;
  nextWeekMinutes?: number;
  payrollPeriodStartDate?: string;
  payrollPeriodEndDate?: string;
}
