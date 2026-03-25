import type { Json } from "@/types/supabase";

export type TimecardStatus = "approved" | "pending" | "exception";

export interface TimecardEntry {
  date: string;
  clockIn: string;
  clockOut: string;
  hoursWorked: number;
  status: TimecardStatus;
  notes: string;
}

export interface PunchRecord {
  id: string;
  punchedAt: string;
}

export interface DerivedPunchRecord extends PunchRecord {
  type: "in" | "out";
}

export interface TimecardEmployeeSummary {
  userId: string;
  profileId: string;
  fullName: string;
  email: string;
  employeeNumber: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  role: "employee" | "manager" | "admin";
}

export interface GracePeriodValue {
  startBefore: number;
  startAfter: number;
  endBefore: number;
  endAfter: number;
}

export interface DepartmentGracePeriod extends GracePeriodValue {
  departmentId: string;
  departmentName: string;
}

export interface UserGracePeriod extends GracePeriodValue {
  userId: string;
  userName: string;
}

export interface GracePeriodsConfig {
  company: GracePeriodValue;
  departments: DepartmentGracePeriod[];
  users: UserGracePeriod[];
}

export interface ResolvedGracePeriod extends GracePeriodValue {
  source: "user" | "department" | "company";
  label: string;
}

export const ALL_DEPARTMENTS_GRACE_ID = "__all__";
export const GRACE_PERIODS_CONFIG_KEY = "__grace_periods";

export interface PatternTimeFrame {
  start_time: string;
  end_time: string;
  frame_order: number;
  meal_start?: string | null;
  meal_end?: string | null;
}

export interface PatternWorkSchedule {
  id: string;
  shift_id: string;
  shift_type: string;
  work_schedule_timeframes: PatternTimeFrame[];
}

export interface PatternRow {
  id: string;
  number: number;
  monday: PatternWorkSchedule[];
  tuesday: PatternWorkSchedule[];
  wednesday: PatternWorkSchedule[];
  thursday: PatternWorkSchedule[];
  friday: PatternWorkSchedule[];
  saturday: PatternWorkSchedule[];
  sunday: PatternWorkSchedule[];
}

export interface AssignedRosterPattern {
  id: string;
  shift_id: string;
  start_date: string | null;
  end_date_type: string;
  end_date: string | null;
  weeks_pattern: string;
  start_pattern_week: string;
  start_day: string;
  pattern_rows: PatternRow[];
}

export interface PatternScheduleForDate {
  schedule: string;
  shiftHours: string;
  startMinutes: number | null;
  endMinutes: number | null;
}

export function getDefaultGracePeriodsConfig(): GracePeriodsConfig {
  return {
    company: { startBefore: 0, startAfter: 0, endBefore: 0, endAfter: 0 },
    departments: [
      {
        departmentId: ALL_DEPARTMENTS_GRACE_ID,
        departmentName: "All Departments",
        startBefore: 0,
        startAfter: 0,
        endBefore: 0,
        endAfter: 0,
      },
    ],
    users: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toGraceMinutes(value: unknown): number {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : 0;

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.floor(numericValue));
}

function toTimecardStatus(value: unknown): TimecardStatus {
  return value === "approved" || value === "exception" ? value : "pending";
}

function toGraceValue(
  value: unknown,
  fallbackBefore: unknown,
  fallbackAfter: unknown
): GracePeriodValue {
  const record = isRecord(value) ? value : {};

  return {
    startBefore: toGraceMinutes(record.startBefore ?? fallbackBefore),
    startAfter: toGraceMinutes(record.startAfter ?? fallbackAfter),
    endBefore: toGraceMinutes(record.endBefore ?? fallbackBefore),
    endAfter: toGraceMinutes(record.endAfter ?? fallbackAfter),
  };
}

function normalizeEntry(value: unknown): TimecardEntry | null {
  if (!isRecord(value) || typeof value.date !== "string") {
    return null;
  }

  const hoursWorked =
    typeof value.hoursWorked === "number"
      ? value.hoursWorked
      : typeof value.hoursWorked === "string"
        ? Number(value.hoursWorked)
        : 0;

  return {
    date: value.date,
    clockIn: typeof value.clockIn === "string" ? value.clockIn : "",
    clockOut: typeof value.clockOut === "string" ? value.clockOut : "",
    hoursWorked: Number.isFinite(hoursWorked) ? Number(hoursWorked.toFixed(2)) : 0,
    status: toTimecardStatus(value.status),
    notes: typeof value.notes === "string" ? value.notes : "",
  };
}

export function extractTimecardEntries(customFields: Json | null | undefined): TimecardEntry[] {
  if (!isRecord(customFields) || !Array.isArray(customFields.timecardEntries)) {
    return [];
  }

  return customFields.timecardEntries
    .map(normalizeEntry)
    .filter((entry): entry is TimecardEntry => entry !== null)
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function mergeTimecardEntries(
  customFields: Json | null | undefined,
  entries: TimecardEntry[]
): Json {
  const base = isRecord(customFields) ? { ...customFields } : {};

  return {
    ...base,
    timecardEntries: entries.map((entry) => ({
      ...entry,
      hoursWorked: Number(entry.hoursWorked.toFixed(2)),
    })),
  } as Json;
}

export function extractPunchRecords(customFields: Json | null | undefined): PunchRecord[] {
  if (!isRecord(customFields) || !Array.isArray(customFields.punch_records)) {
    return [];
  }

  return customFields.punch_records
    .map((record) => {
      if (!isRecord(record) || typeof record.id !== "string" || typeof record.punchedAt !== "string") {
        return null;
      }

      return {
        id: record.id,
        punchedAt: record.punchedAt,
      } satisfies PunchRecord;
    })
    .filter((record): record is PunchRecord => record !== null)
    .sort((left, right) => left.punchedAt.localeCompare(right.punchedAt));
}

export function mergePunchRecords(
  customFields: Json | null | undefined,
  punchRecords: PunchRecord[]
): Json {
  const base = isRecord(customFields) ? { ...customFields } : {};

  return {
    ...base,
    punch_records: punchRecords,
  } as unknown as Json;
}

export function extractGracePeriodsConfig(
  fieldVisibilityConfig: Json | null | undefined
): GracePeriodsConfig {
  const defaults = getDefaultGracePeriodsConfig();
  const configContainer = isRecord(fieldVisibilityConfig) ? fieldVisibilityConfig : {};
  const rawConfig = isRecord(configContainer[GRACE_PERIODS_CONFIG_KEY])
    ? configContainer[GRACE_PERIODS_CONFIG_KEY]
    : {};

  const company = isRecord(rawConfig.company) ? rawConfig.company : {};
  const departments = Array.isArray(rawConfig.departments) ? rawConfig.departments : [];
  const users = Array.isArray(rawConfig.users) ? rawConfig.users : [];

  return {
    company: toGraceValue(company, company.before, company.after),
    departments:
      departments.length > 0
        ? departments
            .map((department) => {
              if (!isRecord(department)) {
                return null;
              }

              return {
                departmentId:
                  typeof department.departmentId === "string" && department.departmentId.trim()
                    ? department.departmentId
                    : ALL_DEPARTMENTS_GRACE_ID,
                departmentName:
                  typeof department.departmentName === "string" && department.departmentName.trim()
                    ? department.departmentName
                    : "All Departments",
                ...toGraceValue(department, department.before, department.after),
              } satisfies DepartmentGracePeriod;
            })
            .filter((department): department is DepartmentGracePeriod => department !== null)
        : defaults.departments,
    users: users
      .map((user) => {
        if (!isRecord(user) || typeof user.userId !== "string" || !user.userId.trim()) {
          return null;
        }

        return {
          userId: user.userId,
          userName: typeof user.userName === "string" ? user.userName : "",
          ...toGraceValue(user, user.before, user.after),
        } satisfies UserGracePeriod;
      })
      .filter((user): user is UserGracePeriod => user !== null),
  };
}

export function mergeGracePeriodsConfig(
  fieldVisibilityConfig: Json | null | undefined,
  gracePeriodsConfig: GracePeriodsConfig
): Json {
  const base = isRecord(fieldVisibilityConfig) ? { ...fieldVisibilityConfig } : {};

  return {
    ...base,
    [GRACE_PERIODS_CONFIG_KEY]: {
      company: {
        startBefore: toGraceMinutes(gracePeriodsConfig.company.startBefore),
        startAfter: toGraceMinutes(gracePeriodsConfig.company.startAfter),
        endBefore: toGraceMinutes(gracePeriodsConfig.company.endBefore),
        endAfter: toGraceMinutes(gracePeriodsConfig.company.endAfter),
      },
      departments: gracePeriodsConfig.departments.map((department) => ({
        departmentId: department.departmentId,
        departmentName: department.departmentName,
        startBefore: toGraceMinutes(department.startBefore),
        startAfter: toGraceMinutes(department.startAfter),
        endBefore: toGraceMinutes(department.endBefore),
        endAfter: toGraceMinutes(department.endAfter),
      })),
      users: gracePeriodsConfig.users.map((user) => ({
        userId: user.userId,
        userName: user.userName,
        startBefore: toGraceMinutes(user.startBefore),
        startAfter: toGraceMinutes(user.startAfter),
        endBefore: toGraceMinutes(user.endBefore),
        endAfter: toGraceMinutes(user.endAfter),
      })),
    },
  } as Json;
}

export function resolveGracePeriodForUser(
  config: GracePeriodsConfig | null | undefined,
  userId: string,
  departmentId: string | null | undefined
): ResolvedGracePeriod {
  const normalizedConfig = config || getDefaultGracePeriodsConfig();
  const userOverride = normalizedConfig.users.find((user) => user.userId === userId);

  if (userOverride) {
    return {
      source: "user",
      label: "User",
      startBefore: userOverride.startBefore,
      startAfter: userOverride.startAfter,
      endBefore: userOverride.endBefore,
      endAfter: userOverride.endAfter,
    };
  }

  const departmentOverride =
    normalizedConfig.departments.find((department) => departmentId && department.departmentId === departmentId) ||
    normalizedConfig.departments.find(
      (department) => department.departmentId === ALL_DEPARTMENTS_GRACE_ID
    );

  if (departmentOverride) {
    return {
      source: "department",
      label: departmentOverride.departmentName || "Department",
      startBefore: departmentOverride.startBefore,
      startAfter: departmentOverride.startAfter,
      endBefore: departmentOverride.endBefore,
      endAfter: departmentOverride.endAfter,
    };
  }

  return {
    source: "company",
    label: "Company",
    startBefore: normalizedConfig.company.startBefore,
    startAfter: normalizedConfig.company.startAfter,
    endBefore: normalizedConfig.company.endBefore,
    endAfter: normalizedConfig.company.endAfter,
  };
}

export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + diff);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatDateIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeekDates(anchorDate: Date): Date[] {
  const weekStart = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function formatWeekRange(anchorDate: Date): string {
  const days = getWeekDates(anchorDate);
  const first = days[0];
  const last = days[days.length - 1];

  return `${first.toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
  })} - ${last.toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function formatTimecardDate(date: Date): string {
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function calculateHoursWorked(clockIn: string, clockOut: string): number {
  if (!clockIn || !clockOut) {
    return 0;
  }

  const [startHour, startMinute] = clockIn.split(":").map(Number);
  const [endHour, endMinute] = clockOut.split(":").map(Number);

  if (
    [startHour, startMinute, endHour, endMinute].some(
      (value) => !Number.isFinite(value)
    )
  ) {
    return 0;
  }

  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;

  if (end < start) {
    end += 24 * 60;
  }

  return Number(((end - start) / 60).toFixed(2));
}

export function getDerivedPunchRecords(records: PunchRecord[]): DerivedPunchRecord[] {
  return [...records]
    .sort((left, right) => left.punchedAt.localeCompare(right.punchedAt))
    .map((record, index) => ({
      ...record,
      type: index % 2 === 0 ? "in" : "out",
    }));
}

export function getActualShiftPunchesDisplay(records: PunchRecord[]): string {
  const derivedRecords = getDerivedPunchRecords(records);

  if (derivedRecords.length === 0) {
    return "";
  }

  const segments: string[] = [];

  for (let index = 0; index < derivedRecords.length; index += 2) {
    const punchIn = derivedRecords[index];
    const punchOut = derivedRecords[index + 1];

    if (!punchIn) {
      continue;
    }

    if (punchOut) {
      segments.push(`${punchIn.punchedAt.slice(11, 16)} - ${punchOut.punchedAt.slice(11, 16)}`);
    } else {
      segments.push(punchIn.punchedAt.slice(11, 16));
    }
  }

  return segments.join("\n");
}

export function getWorkedHoursFromPunchRecords(records: PunchRecord[]): number {
  const derivedRecords = getDerivedPunchRecords(records);
  let totalMinutes = 0;

  for (let index = 0; index < derivedRecords.length; index += 2) {
    const punchIn = derivedRecords[index];
    const punchOut = derivedRecords[index + 1];

    if (!punchIn || !punchOut) {
      continue;
    }

    const start = new Date(punchIn.punchedAt);
    const end = new Date(punchOut.punchedAt);
    const diffMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    totalMinutes += Math.max(0, diffMinutes);
  }

  return Number((totalMinutes / 60).toFixed(2));
}

export function formatWorkedHoursAsMinutes(hours: number): string {
  return formatDurationMinutes(Math.round(hours * 60));
}

export function syncTimecardEntriesFromPunchRecords(
  existingEntries: TimecardEntry[],
  punchRecords: PunchRecord[]
): TimecardEntry[] {
  const entryByDate = new Map(existingEntries.map((entry) => [entry.date, entry]));
  const recordsByDate = new Map<string, PunchRecord[]>();
  const allDates = new Set(existingEntries.map((entry) => entry.date));

  punchRecords.forEach((record) => {
    const date = record.punchedAt.slice(0, 10);
    const current = recordsByDate.get(date) || [];
    current.push(record);
    recordsByDate.set(date, current);
    allDates.add(date);
  });

  allDates.forEach((date) => {
    const currentEntry = entryByDate.get(date) || {
      date,
      clockIn: "",
      clockOut: "",
      hoursWorked: 0,
      status: "pending" as TimecardStatus,
      notes: "",
    };

    const records = recordsByDate.get(date) || [];
    const derivedRecords = getDerivedPunchRecords(records);
    const firstPunch = derivedRecords[0];
    const lastOut = [...derivedRecords].reverse().find((record) => record.type === "out");
    const clockIn = firstPunch ? firstPunch.punchedAt.slice(11, 16) : "";
    const clockOut = lastOut ? lastOut.punchedAt.slice(11, 16) : "";

    entryByDate.set(date, {
      ...currentEntry,
      clockIn,
      clockOut,
      hoursWorked: getWorkedHoursFromPunchRecords(records),
    });
  });

  return [...entryByDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getTimeMinutesFromIso(value: string): number {
  return timeToMinutes(value.slice(11, 16));
}

function formatDurationMinutes(totalMinutes: number): string {
  if (!totalMinutes) {
    return "";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function getOrderedDays(startDay: string): Array<keyof PatternRow> {
  const days: Array<keyof PatternRow> = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  const normalizedStartDay = startDay.toLowerCase() as keyof PatternRow;
  const startIndex = days.indexOf(normalizedStartDay);

  if (startIndex === -1) {
    return days;
  }

  return [...days.slice(startIndex), ...days.slice(0, startIndex)];
}

function isPatternWorkSchedule(value: unknown): value is PatternWorkSchedule {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.shift_id === "string" &&
    typeof value.shift_type === "string" &&
    Array.isArray(value.work_schedule_timeframes)
  );
}

function normalizePatternSchedules(value: unknown): PatternWorkSchedule[] {
  if (Array.isArray(value)) {
    return value.filter(isPatternWorkSchedule);
  }

  if (isPatternWorkSchedule(value)) {
    return [value];
  }

  return [];
}

function computeScheduleDurationMinutes(schedule: PatternWorkSchedule): number {
  return (schedule.work_schedule_timeframes || []).reduce((total, timeframe) => {
    const startMinutes = timeToMinutes(timeframe.start_time);
    let endMinutes = timeToMinutes(timeframe.end_time);

    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }

    let duration = endMinutes - startMinutes;

    if (timeframe.meal_start && timeframe.meal_end) {
      const mealStart = timeToMinutes(timeframe.meal_start);
      const mealEnd = timeToMinutes(timeframe.meal_end);
      duration -= Math.max(0, mealEnd - mealStart);
    }

    return total + Math.max(0, duration);
  }, 0);
}

function getScheduleBoundsMinutes(
  schedule: PatternWorkSchedule
): { startMinutes: number | null; endMinutes: number | null } {
  const timeframes = [...(schedule.work_schedule_timeframes || [])].sort(
    (left, right) => left.frame_order - right.frame_order
  );

  if (timeframes.length === 0) {
    return { startMinutes: null, endMinutes: null };
  }

  let earliestStart = Number.POSITIVE_INFINITY;
  let latestEnd = Number.NEGATIVE_INFINITY;

  timeframes.forEach((timeframe) => {
    const startMinutes = timeToMinutes(timeframe.start_time);
    let endMinutes = timeToMinutes(timeframe.end_time);

    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }

    earliestStart = Math.min(earliestStart, startMinutes);
    latestEnd = Math.max(latestEnd, endMinutes);
  });

  return {
    startMinutes: Number.isFinite(earliestStart) ? earliestStart : null,
    endMinutes: Number.isFinite(latestEnd) ? latestEnd : null,
  };
}

function formatScheduleEntry(schedule: PatternWorkSchedule): string {
  const timeframes = [...(schedule.work_schedule_timeframes || [])].sort(
    (left, right) => left.frame_order - right.frame_order
  );

  if (timeframes.length === 0) {
    return schedule.shift_id;
  }

  return timeframes
    .map((timeframe) => `${timeframe.start_time} - ${timeframe.end_time}`)
    .join(" | ");
}

export function getAssignedPatternScheduleForDate(
  pattern: AssignedRosterPattern | null | undefined,
  date: Date
): PatternScheduleForDate | null {
  if (!pattern?.start_date || !Array.isArray(pattern.pattern_rows) || pattern.pattern_rows.length === 0) {
    return null;
  }

  const startDate = new Date(`${pattern.start_date}T00:00:00`);
  const targetDate = new Date(`${formatDateIso(date)}T00:00:00`);
  const diffDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return null;
  }

  if (pattern.end_date_type === "specify" && pattern.end_date) {
    const endDate = new Date(`${pattern.end_date}T00:00:00`);
    if (targetDate >= endDate) {
      return null;
    }
  }

  const orderedRows = [...pattern.pattern_rows].sort((left, right) => left.number - right.number);
  const orderedDays = getOrderedDays(pattern.start_day || "monday");
  const weekOffset = Math.floor(diffDays / 7);
  const dayOffset = diffDays % 7;
  const startPatternWeek = Math.max(1, Number.parseInt(pattern.start_pattern_week || "1", 10) || 1);

  let rowIndex = startPatternWeek - 1 + weekOffset;
  if (pattern.end_date_type === "continuous") {
    rowIndex %= orderedRows.length;
  } else if (rowIndex >= orderedRows.length) {
    return null;
  }

  const row = orderedRows[rowIndex];
  const dayKey = orderedDays[dayOffset];
  const schedules = normalizePatternSchedules(row[dayKey]);

  if (schedules.length === 0) {
    return {
      schedule: "Not Rostered",
      shiftHours: "",
      startMinutes: null,
      endMinutes: null,
    };
  }

  const scheduleDisplay = schedules.map(formatScheduleEntry).join(" + ");
  const totalMinutes = schedules.reduce(
    (sum, schedule) => sum + computeScheduleDurationMinutes(schedule),
    0
  );
  const scheduleBounds = schedules
    .map(getScheduleBoundsMinutes)
    .filter(
      (
        bounds
      ): bounds is { startMinutes: number; endMinutes: number } =>
        bounds.startMinutes !== null && bounds.endMinutes !== null
    );

  const startMinutes =
    scheduleBounds.length > 0
      ? Math.min(...scheduleBounds.map((bounds) => bounds.startMinutes))
      : null;
  const endMinutes =
    scheduleBounds.length > 0
      ? Math.max(...scheduleBounds.map((bounds) => bounds.endMinutes))
      : null;

  return {
    schedule: scheduleDisplay,
    shiftHours: formatDurationMinutes(totalMinutes),
    startMinutes,
    endMinutes,
  };
}

function describeMinutesDifference(minutes: number): string {
  const absoluteMinutes = Math.abs(minutes);

  if (absoluteMinutes === 0) {
    return "on time";
  }

  return `${absoluteMinutes} min ${minutes < 0 ? "early" : "late"}`;
}

export function getTimecardExceptionMessages(
  records: PunchRecord[],
  schedule: PatternScheduleForDate | null | undefined,
  gracePeriod: GracePeriodValue
): string[] {
  if (records.length === 0) {
    return [];
  }

  const derivedRecords = getDerivedPunchRecords(records);
  const messages: string[] = [];

  if (!schedule || schedule.schedule === "Not Rostered") {
    messages.push("Punches recorded on a non-rostered day");
    if (derivedRecords.length % 2 === 1) {
      messages.push("Punch missed");
    }
    return messages;
  }

  if (derivedRecords.length % 2 === 1) {
    messages.push("Punch missed");
  }

  const firstPunch = derivedRecords[0];

  if (firstPunch && schedule.startMinutes !== null) {
    const firstPunchMinutes = getTimeMinutesFromIso(firstPunch.punchedAt);
    const startDifference = firstPunchMinutes - schedule.startMinutes;
    const earliestAllowedStart = -gracePeriod.startBefore;
    const latestAllowedStart = gracePeriod.startAfter;

    if (startDifference < earliestAllowedStart || startDifference > latestAllowedStart) {
      messages.push(`Punch in ${describeMinutesDifference(startDifference)} from roster start`);
    }
  }

  const lastPunchOut = [...derivedRecords].reverse().find((record) => record.type === "out");

  if (lastPunchOut && schedule.endMinutes !== null) {
    let punchOutMinutes = getTimeMinutesFromIso(lastPunchOut.punchedAt);

    if (
      schedule.startMinutes !== null &&
      schedule.endMinutes > 24 * 60 &&
      punchOutMinutes < schedule.startMinutes
    ) {
      punchOutMinutes += 24 * 60;
    }

    const endDifference = punchOutMinutes - schedule.endMinutes;
    const earliestAllowedEnd = -gracePeriod.endBefore;
    const latestAllowedEnd = gracePeriod.endAfter;

    if (endDifference < earliestAllowedEnd || endDifference > latestAllowedEnd) {
      messages.push(`Punch out ${describeMinutesDifference(endDifference)} from roster end`);
    }
  }

  return messages;
}
