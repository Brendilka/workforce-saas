/**
 * Explainability API for Night Shift Allocation
 *
 * Provides human-readable explanations for allocation decisions without modifying core logic.
 * Pure function - no side effects, deterministic output based on input.
 */

import {
  computeAllocationDate,
  isCrossMidnightShift,
  computeMinutesPerDay,
  getWeekStartDate,
  getWeekBucket,
  RosterPatternSettings,
  Shift,
  AllocationResult,
  type WeekStartDay,
} from '@/lib/shift-allocation';

/**
 * Metrics for different allocation modes.
 */
export interface AllocationMetrics {
  minutesPerDay?: Record<string, number>;
  majorityWinner?: string;
  majorityWinnerMinutes?: number;
  runnerUpMinutes?: number;
  weeklyBalancing?: {
    currentWeekStartDate: string;
    currentWeekRemainingMinutes: number;
    nextWeekRemainingMinutes: number;
    strategy: string;
    tieBreaker?: string;
    weeksInAnalysis: number;
  };
  payPeriod?: {
    definitionType: string;
    startDay?: number;
    startDate?: string;
  };
}

/**
 * Complete explanation for an allocation decision.
 */
export interface ExplanationResult {
  allocationDate: string | string[]; // ISO dates
  mode: string;
  ruleVersion: string;
  reasoningSteps: string[];
  metrics?: AllocationMetrics;
  systemContext?: {
    shiftIsOvernight: boolean;
    shiftDurationMinutes: number;
    shiftStartDate: string;
    shiftEndDate: string;
  };
}

/**
 * Generates human-readable explanation for allocation decision.
 *
 * @param shift - The shift being allocated
 * @param settings - Allocation settings for the roster pattern
 * @param context - Optional context for weekly balancing calculations
 * @returns Complete explanation with reasoning steps and metrics
 *
 * @example
 * const explanation = explainAllocation(
 *   { startDateTime: new Date('2025-02-14T22:00'), endDateTime: new Date('2025-02-15T07:00') },
 *   { mode: 'MAJORITY_HOURS' }
 * );
 * // {
 * //   allocationDate: '2025-02-15',
 * //   mode: 'MAJORITY_HOURS',
 * //   reasoningSteps: [
 * //     'Cross-midnight shift detected: Friday 22:00 to Saturday 07:00',
 * //     'Shift spans 2 calendar days',
 * //     'Computing minutes per day',
 * //     '120 minutes on Friday 2025-02-14',
 * //     '420 minutes on Saturday 2025-02-15 (MAJORITY)',
 * //     'Allocated to Saturday (majority winner)'
 * //   ],
 * //   metrics: {
 * //     minutesPerDay: { '2025-02-14': 120, '2025-02-15': 420 },
 * //     majorityWinner: '2025-02-15',
 * //     majorityWinnerMinutes: 420
 * //   }
 * // }
 */
export function explainAllocation(
  shift: Shift,
  settings: RosterPatternSettings,
  context?: any
): ExplanationResult {
  const steps: string[] = [];
  const metrics: AllocationMetrics = {};

  // Compute system context
  const startDate = shift.startDateTime instanceof Date
    ? shift.startDateTime
    : new Date(shift.startDateTime);
  const endDate = shift.endDateTime instanceof Date
    ? shift.endDateTime
    : new Date(shift.endDateTime);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  const shiftDurationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
  const isOvernight = isCrossMidnightShift(shift);

  // Step 1: Identify shift type
  steps.push(
    `Processing shift: ${startDateStr} ${formatTime(shift.startDateTime)} to ${endDateStr} ${formatTime(shift.endDateTime)}`
  );

  if (isOvernight) {
    steps.push('Cross-midnight shift detected');
  } else if (startDateStr === endDateStr) {
    steps.push('Single-day shift');
  } else {
    steps.push(`Multi-day shift spanning from ${startDateStr} to ${endDateStr}`);
  }

  steps.push(`Shift duration: ${formatDurationMinutes(shiftDurationMinutes)}`);

  // Step 2: Apply allocation mode logic
  let result: AllocationResult;

  try {
    result = computeAllocationDate(shift, settings, context);
  } catch (error) {
    throw new Error(`Allocation computation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Step 3: Generate mode-specific explanation and metrics
  switch (settings.nightShiftAllocationMode) {
    case 'START_DAY':
      explainStartDay(shift, steps, metrics, startDateStr);
      break;

    case 'MAJORITY_HOURS':
      explainMajorityHours(shift, steps, metrics, startDateStr);
      break;

    case 'FIXED_ROSTER_DAY':
      explainFixedRosterDay(shift, settings, steps, metrics);
      break;

    case 'SPLIT_BY_DAY':
      explainSplitByDay(shift, result, steps, metrics);
      break;

    case 'WEEKLY_BALANCING':
      explainWeeklyBalancing(shift, settings, context, steps, metrics, startDateStr);
      break;
  }

  // Step 4: Final allocation decision
  if (Array.isArray(result.allocationDate)) {
    steps.push(`Allocated to multiple days: ${result.allocationDate.join(', ')}`);
  } else if (result.allocationDate) {
    const allocDateStr = result.allocationDate.toISOString().split('T')[0];
    steps.push(`Final allocation: ${allocDateStr}`);
  }

  if (result.error) {
    steps.push(`⚠️ Allocation warning: ${result.error}`);
  }

  const allocationDateOutput = Array.isArray(result.allocationDate)
    ? (result.allocationDate as Date[]).map((d: Date) => d.toISOString().split('T')[0])
    : result.allocationDate
    ? (result.allocationDate as Date).toISOString().split('T')[0]
    : result.daySegments && result.daySegments.length > 0
    ? result.daySegments.map((seg: { date: Date }) =>
        seg.date instanceof Date ? seg.date.toISOString().split('T')[0] : String(seg.date).split('T')[0]
      )
    : 'UNALLOCATED';

  return {
    allocationDate: allocationDateOutput,
    mode: settings.nightShiftAllocationMode,
    ruleVersion: 'v1',
    reasoningSteps: steps,
    metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
    systemContext: {
      shiftIsOvernight: isOvernight,
      shiftDurationMinutes,
      shiftStartDate: startDateStr,
      shiftEndDate: endDateStr,
    },
  };
}

function explainStartDay(shift: Shift, steps: string[], metrics: AllocationMetrics, startDateStr: string) {
  steps.push('Allocation mode: START_DAY');
  steps.push(`Shifts allocated to their start date: ${startDateStr}`);
}

/**
 * Explains MAJORITY_HOURS allocation mode.
 */
function explainMajorityHours(shift: Shift, steps: string[], metrics: AllocationMetrics, startDateStr: string) {
  steps.push('Allocation mode: MAJORITY_HOURS');
  steps.push('Calculating minutes on each calendar day...');

  const minutesPerDay = computeMinutesPerDay(shift);
  const sortedDays = Object.entries(minutesPerDay).sort((a, b) => b[1] - a[1]);

  if (sortedDays.length === 1) {
    steps.push(`Single day allocation: ${Object.keys(minutesPerDay)[0]}`);
  } else {
    const [majorityDate, majorityMinutes] = sortedDays[0];
    const [runnerUpDate, runnerUpMinutes] = sortedDays.length > 1 ? sortedDays[1] : ['N/A', 0];

    Object.entries(minutesPerDay).forEach(([date, minutes]) => {
      steps.push(`${date}: ${formatDurationMinutes(minutes)}`);
    });

    if (majorityMinutes === runnerUpMinutes && sortedDays.length > 1) {
      steps.push(`Tie detected: ${majorityMinutes} minutes on both ${majorityDate} and ${runnerUpDate}`);
      steps.push(`Tie-breaker: Preferring start date (${startDateStr})`);
    } else {
      steps.push(`Majority winner: ${majorityDate} with ${formatDurationMinutes(majorityMinutes)}`);
    }
  }

  metrics.minutesPerDay = minutesPerDay;
  metrics.majorityWinner = sortedDays[0][0];
  metrics.majorityWinnerMinutes = sortedDays[0][1];
  if (sortedDays.length > 1) {
    metrics.runnerUpMinutes = sortedDays[1][1];
  }
}

function explainFixedRosterDay(
  shift: Shift,
  settings: RosterPatternSettings,
  steps: string[],
  metrics: AllocationMetrics
) {
  steps.push('Allocation mode: FIXED_ROSTER_DAY');

  const params = settings.nightShiftAllocationParams as any;
  const anchor = params?.fixedAllocationAnchor || 'START_DAY';

  const startDate = shift.startDateTime instanceof Date
    ? shift.startDateTime
    : new Date(shift.startDateTime);
  const endDate = shift.endDateTime instanceof Date
    ? shift.endDateTime
    : new Date(shift.endDateTime);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  steps.push(`Using fixed anchor: ${anchor}`);

  let allocDate: string;
  switch (anchor) {
    case 'START_DAY':
      allocDate = startDateStr;
      steps.push(`Allocating to shift start date: ${startDateStr}`);
      break;
    case 'END_DAY':
      allocDate = endDateStr;
      steps.push(`Allocating to shift end date: ${endDateStr}`);
      break;
    case 'PREVIOUS_DAY':
      const prevDay = new Date(startDate);
      prevDay.setDate(prevDay.getDate() - 1);
      allocDate = prevDay.toISOString().split('T')[0];
      steps.push(`Allocating to day before shift: ${allocDate}`);
      break;
    case 'NEXT_DAY':
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      allocDate = nextDay.toISOString().split('T')[0];
      steps.push(`Allocating to day after shift: ${allocDate}`);
      break;
    default:
      allocDate = startDateStr;
      steps.push(`Unknown anchor. Defaulting to start date: ${startDateStr}`);
  }
}

/**
 * Explains SPLIT_BY_DAY allocation mode.
 */
function explainSplitByDay(
  shift: Shift,
  result: AllocationResult,
  steps: string[],
  metrics: AllocationMetrics
) {
  steps.push('Allocation mode: SPLIT_BY_DAY');
  steps.push('Shift is split into segments per calendar day');

  if (result.daySegments && result.daySegments.length > 0) {
    result.daySegments.forEach((segment: any) => {
      const dateStr = segment.date instanceof Date
        ? segment.date.toISOString().split('T')[0]
        : segment.date;
      steps.push(`  ${dateStr}: ${formatDurationMinutes(segment.minutes)} (${segment.startDateTime} to ${segment.endDateTime})`);
    });
  }
}

function explainWeeklyBalancing(
  shift: Shift,
  settings: RosterPatternSettings,
  context: any,
  steps: string[],
  metrics: AllocationMetrics,
  startDateStr: string
) {
  steps.push('Allocation mode: WEEKLY_BALANCING');

  const params = settings.nightShiftAllocationParams as any;
  // weekStartDay may come from API as number (0=MON .. 6=SUN) or as WeekStartDay string
  const rawWeekStart = params?.weekStartDay ?? 0;
  const weekStartDay: WeekStartDay =
    typeof rawWeekStart === 'number'
      ? (['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const)[Math.max(0, Math.min(6, rawWeekStart))] ?? 'MON'
      : (rawWeekStart as WeekStartDay);
  const weeklyThresholdMinutes = params?.weeklyOrdinaryHoursThresholdMinutes || 2280;
  const balancingStrategy = params?.balancingStrategy || 'FILL_CURRENT_WEEK_FIRST';
  const eligibilityRule = params?.eligibilityRule || 'CROSS_MIDNIGHT_ONLY';
  const tieBreaker = params?.tieBreakerRule || 'PREFER_START_DAY';

  steps.push(`Week start day: ${formatWeekDayFromWeekStartDay(weekStartDay)}`);
  steps.push(`Weekly threshold: ${formatDurationMinutes(weeklyThresholdMinutes)}`);
  steps.push(`Balancing strategy: ${balancingStrategy}`);
  steps.push(`Eligibility rule: ${eligibilityRule}`);
  steps.push(`Tie-breaker: ${tieBreaker}`);

  const startDate = shift.startDateTime instanceof Date
    ? shift.startDateTime
    : new Date(shift.startDateTime);

  const weekStart = getWeekStartDate(startDate, weekStartDay);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  steps.push(`Current week starts: ${weekStartStr}`);

  // Context would have week analysis data if provided
  if (context?.weeklyBalancingContext) {
    const ctx = context.weeklyBalancingContext;
    steps.push(`Current week allocated: ${formatDurationMinutes(ctx.currentWeekMinutes || 0)}`);
    steps.push(`Current week remaining: ${formatDurationMinutes((weeklyThresholdMinutes - (ctx.currentWeekMinutes || 0)))}`);
    steps.push(`Next week allocated: ${formatDurationMinutes(ctx.nextWeekMinutes || 0)}`);

    metrics.weeklyBalancing = {
      currentWeekStartDate: weekStartStr,
      currentWeekRemainingMinutes: weeklyThresholdMinutes - (ctx.currentWeekMinutes || 0),
      nextWeekRemainingMinutes: weeklyThresholdMinutes - (ctx.nextWeekMinutes || 0),
      strategy: balancingStrategy,
      tieBreaker: tieBreaker,
      weeksInAnalysis: 2,
    };
  }

  if (params?.payPeriodDefinitionType) {
    steps.push(`Pay period definition: ${params.payPeriodDefinitionType}`);
    if (params.payPeriodStartDay) {
      steps.push(`  Start day of month: day ${params.payPeriodStartDay}`);
    }
    if (params.payPeriodStartDate) {
      steps.push(`  Fixed start date: ${params.payPeriodStartDate}`);
    }
    metrics.payPeriod = {
      definitionType: params.payPeriodDefinitionType,
      startDay: params.payPeriodStartDay,
      startDate: params.payPeriodStartDate,
    };
  }
}

/**
 * Utility: Format minutes as human-readable duration.
 */
function formatDurationMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Utility: Format time string as HH:mm.
 */
function formatTime(dateOrTime: Date | string | number): string {
  if (typeof dateOrTime === 'string') {
    return dateOrTime; // Already formatted
  }
  if (typeof dateOrTime === 'number') {
    return new Date(dateOrTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return dateOrTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Utility: Format week day number to name.
 */
function formatWeekDay(dayNum: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNum] ?? `Day ${dayNum}`;
}

/** WeekStartDay (MON..SUN) maps to 0=Monday .. 6=Sunday in shift-allocation. */
const WEEK_START_DAY_TO_NUM: Record<WeekStartDay, number> = {
  MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6,
};

const WEEK_DAY_NAMES_MON_FIRST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatWeekDayFromWeekStartDay(day: WeekStartDay): string {
  const n = WEEK_START_DAY_TO_NUM[day] ?? 0;
  return WEEK_DAY_NAMES_MON_FIRST[n] ?? `Day ${n}`;
}
