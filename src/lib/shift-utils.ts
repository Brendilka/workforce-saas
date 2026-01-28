// Helper to determine if a shift spans midnight
export function isOvernightShift(startTime: string, endTime: string): boolean {
  const [sH, sM] = startTime.split(":").map(Number);
  const [eH, eM] = endTime.split(":").map(Number);
  const startMins = sH * 60 + sM;
  const endMins = eH * 60 + eM;
  return endMins < startMins;
}

// Format time display for a shift in roster context
export function formatShiftDisplay(startTime: string, endTime: string): string {
  const isOvernight = isOvernightShift(startTime, endTime);
  if (isOvernight) {
    return `${startTime}→+1: ${endTime}`;
  }
  return `${startTime}–${endTime}`;
}

// Get the affected days for a shift assignment
// Returns object with flags for which logical days are affected
export function getAffectedDays(
  assignedDayOfWeek: number, // 0=Monday, 6=Sunday
  startTime: string,
  endTime: string,
  cycleLengthWeeks: number,
  patternWeekNumber: number
): {
  primaryDay: { week: number; dayOfWeek: number };
  overflowDay?: { week: number; dayOfWeek: number };
} {
  const isOvernight = isOvernightShift(startTime, endTime);

  const primaryDay = { week: patternWeekNumber, dayOfWeek: assignedDayOfWeek };

  if (!isOvernight) {
    return { primaryDay };
  }

  // Calculate overflow to next day
  let overflowWeek = patternWeekNumber;
  let overflowDay = assignedDayOfWeek + 1;

  // Handle week boundary
  if (overflowDay > 6) {
    overflowDay = 0; // Wrap to Monday
    overflowWeek += 1;
    if (overflowWeek > cycleLengthWeeks) {
      overflowWeek = 1; // Wrap to start of cycle
    }
  }

  return {
    primaryDay,
    overflowDay: { week: overflowWeek, dayOfWeek: overflowDay },
  };
}

// Constants
export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const DAY_ABBREVIATIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
