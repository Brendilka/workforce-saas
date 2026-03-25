"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  formatDateIso,
  formatWorkedHoursAsMinutes,
  getActualShiftPunchesDisplay,
  getAssignedPatternScheduleForDate,
  getTimecardExceptionMessages,
  getWorkedHoursFromPunchRecords,
  getWeekDates,
  resolveGracePeriodForUser,
  type AssignedRosterPattern,
  type GracePeriodsConfig,
  type PunchRecord,
  type ResolvedGracePeriod,
  type TimecardEmployeeSummary,
  type TimecardEntry,
} from "@/lib/timecard";

interface TimecardApiResponse {
  employee: TimecardEmployeeSummary;
  entries: TimecardEntry[];
  punchRecords: PunchRecord[];
  assignedRosterPattern: AssignedRosterPattern | null;
  gracePeriodsConfig: GracePeriodsConfig | null;
  canEdit: boolean;
}

interface AdminTimecardViewProps {
  userOptions: TimecardEmployeeSummary[];
  initialUserId?: string;
}

type TimecardRow = {
  label: string;
  values: string[];
  variant?: "schedule" | "exceptions";
};

function formatWeekColumn(date: Date): string {
  const weekday = date.toLocaleDateString("en-AU", { weekday: "short" });
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${weekday} ${day}/${month}/${year}`;
}

function formatHoursAsMinutesDisplay(hours: number): string {
  if (!hours) {
    return "";
  }

  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return `${wholeHours}:${String(minutes).padStart(2, "0")}`;
}

function cellClass(variant?: string, value?: string) {
  if (variant === "schedule") {
    return "bg-[#fff6bf] font-semibold";
  }

  if (variant === "exceptions" && value) {
    return "bg-[#ef4444] text-white font-semibold";
  }

  if (value === "Not Rostered") {
    return "bg-gray-100 text-gray-500 font-medium";
  }

  return "";
}

export function AdminTimecardView({
  userOptions,
  initialUserId,
}: AdminTimecardViewProps) {
  const [selectedUserId, setSelectedUserId] = useState(initialUserId || userOptions[0]?.userId || "");
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [employee, setEmployee] = useState<TimecardEmployeeSummary | null>(null);
  const [entries, setEntries] = useState<TimecardEntry[]>([]);
  const [punchRecords, setPunchRecords] = useState<PunchRecord[]>([]);
  const [assignedRosterPattern, setAssignedRosterPattern] = useState<AssignedRosterPattern | null>(null);
  const [gracePeriodsConfig, setGracePeriodsConfig] = useState<GracePeriodsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTimecard() {
      if (!selectedUserId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/timecard?userId=${selectedUserId}`, {
          signal: controller.signal,
        });

        const data = (await response.json()) as TimecardApiResponse | { error?: string };

        if (!response.ok || !("employee" in data)) {
          throw new Error(
            "error" in data && typeof data.error === "string"
              ? data.error
              : "Unable to load timecard."
          );
        }

        setEmployee(data.employee);
        setEntries(data.entries);
        setPunchRecords(data.punchRecords);
        setAssignedRosterPattern(data.assignedRosterPattern);
        setGracePeriodsConfig(data.gracePeriodsConfig);
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load timecard."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadTimecard();

    return () => controller.abort();
  }, [selectedUserId]);

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);
  const weekColumns = useMemo(
    () => weekDates.map((date) => formatWeekColumn(date)),
    [weekDates]
  );

  const visibleEntries = useMemo(() => {
    const byDate = new Map(entries.map((entry) => [entry.date, entry]));

    return weekDates.map((date) => {
      const key = formatDateIso(date);
      return byDate.get(key) || null;
    });
  }, [entries, weekDates]);

  const visiblePunchRecords = useMemo(() => {
    const byDate = new Map<string, PunchRecord[]>();
    punchRecords.forEach((record) => {
      const date = record.punchedAt.slice(0, 10);
      const current = byDate.get(date) || [];
      current.push(record);
      byDate.set(date, current);
    });

    return weekDates.map((date) => byDate.get(formatDateIso(date)) || []);
  }, [punchRecords, weekDates]);

  const scheduledPatternDays = useMemo(
    () => weekDates.map((date) => getAssignedPatternScheduleForDate(assignedRosterPattern, date)),
    [assignedRosterPattern, weekDates]
  );

  const resolvedGracePeriod = useMemo<ResolvedGracePeriod | null>(() => {
    if (!employee || !gracePeriodsConfig) {
      return null;
    }

    return resolveGracePeriodForUser(
      gracePeriodsConfig,
      employee.userId,
      employee.departmentId
    );
  }, [employee, gracePeriodsConfig]);

  const dayExceptions = useMemo(
    () =>
      visiblePunchRecords.map((records, index) =>
        getTimecardExceptionMessages(
          records,
          scheduledPatternDays[index],
          resolvedGracePeriod || { before: 0, after: 0 }
        )
      ),
    [resolvedGracePeriod, scheduledPatternDays, visiblePunchRecords]
  );

  const exceptionSummary = useMemo(
    () =>
      dayExceptions.flatMap((messages, index) =>
        messages.map((message) => `${weekColumns[index]}: ${message}`)
      ),
    [dayExceptions, weekColumns]
  );

  const totalHours = visibleEntries.reduce(
    (sum, entry) => sum + (entry?.hoursWorked || 0),
    0
  );
  const exceptionCount = exceptionSummary.length;
  const unallocatedHours = visibleEntries.filter((entry) => !entry?.clockIn || !entry?.clockOut)
    .reduce((sum, entry) => sum + (entry?.hoursWorked || 0), 0);

  const scheduleRows: TimecardRow[] = [
    {
      label: "Schedule",
      values: scheduledPatternDays.map((day) => day?.schedule || "Not Rostered"),
      variant: "schedule",
    },
    {
      label: "Shift Hours (Minutes)",
      values: scheduledPatternDays.map((day) => day?.shiftHours || ""),
    },
    {
      label: "Actual Shift Punches",
      values: visiblePunchRecords.map((records) => getActualShiftPunchesDisplay(records)),
    },
    {
      label: "Unpaid Meal Break",
      values: weekDates.map(() => ""),
    },
    {
      label: "Worked Hrs (Minutes)",
      values: visiblePunchRecords.map((records) => formatWorkedHoursAsMinutes(getWorkedHoursFromPunchRecords(records))),
    },
    {
      label: "Leave",
      values: weekDates.map(() => ""),
    },
    {
      label: "Live Hrs/Part duration",
      values: visibleEntries.map((entry) => (entry?.notes ? entry.notes : "")),
    },
    {
      label: "Higher Duties",
      values: weekDates.map(() => ""),
    },
    {
      label: "Full Day Cost Transfer",
      values: weekDates.map(() => ""),
    },
    {
      label: "Multiple CC Job Trsf +",
      values: weekDates.map(() => ""),
    },
    {
      label: "Exceptions",
      values: dayExceptions.map((messages) => messages.join("\n")),
      variant: "exceptions",
    },
  ];

  const totalsSummary = [
    ["Ord Shift hrs", formatHoursAsMinutesDisplay(totalHours)],
    ["Actual", totalHours.toFixed(2)],
    ["Unallocated", unallocatedHours.toFixed(2)],
  ] as const;

  const totalsSections = [
    {
      title: "Ordinary",
      rows: [
        ["Pay Code", "Ord001", totalHours.toFixed(2), "", "", ""],
      ],
    },
    {
      title: "Shift Penalty",
      rows: [] as string[][],
    },
    {
      title: "Overtime",
      rows: totalHours > 40 ? [["Pay Code", "OT1.5", (totalHours - 40).toFixed(2), "", "", ""]] : [],
    },
    {
      title: "Allowances",
      rows: [] as string[][],
    },
    {
      title: "Leave",
      rows: [] as string[][],
    },
  ] as const;

  const weekLabel = `${weekColumns[0]} - ${weekColumns[weekColumns.length - 1]}`;

  return (
    <div className="rounded-2xl border border-gray-300 bg-[#f7f7f4] p-4 shadow-sm">
      <h2 className="mb-4 text-[28px] font-semibold tracking-tight text-[#3c6f96]">
        Employee Timecard - Schedule Vs. Actual
      </h2>

      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50 text-red-700">
          {error}
        </Alert>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        {[
          ["Home Business Structure", "-"],
          ["Company", "-"],
          ["Division", "-"],
          ["State", "-"],
          ["Location", "-"],
          ["Employee", employee?.fullName || "-"],
          ["Employee ID", employee?.employeeNumber || "-"],
          ["Employee Email", employee?.email || "-"],
          ["Account Type", employee?.role || "-"],
          ["Operations", "-"],
          ["Area", "-"],
          ["Department", employee?.departmentName || "-"],
          ["Sub Department", "-"],
          ["Cost Centre", "-"],
        ].map(([label, value]) => (
          <div key={label} className="border border-gray-400 bg-white">
            <div className="border-b border-gray-300 bg-[#e7e7e1] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
              {label}
            </div>
            <div className="px-2 py-1.5 text-xs font-medium text-gray-800">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <div className="font-semibold text-gray-700">
          Date Selection <span className="font-normal text-gray-500">{weekLabel}</span>
        </div>
        <div className="font-semibold text-red-600">Exceptions to fix</div>
        <Badge className="rounded-sm bg-red-700 px-2 py-0.5 text-[10px] text-white hover:bg-red-700">
          {exceptionCount}
        </Badge>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <div className="min-w-[260px]">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {userOptions.map((user) => (
                  <SelectItem key={user.userId} value={user.userId}>
                    {user.fullName} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentWeek((current) => {
                const next = new Date(current);
                next.setDate(next.getDate() - 7);
                return next;
              })
            }
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous Week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentWeek((current) => {
                const next = new Date(current);
                next.setDate(next.getDate() + 7);
                return next;
              })
            }
          >
            Next Week
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
          <div className="font-semibold text-red-700">Timecard Status</div>
          <Badge className="rounded-sm bg-[#d6402b] px-2 py-0.5 text-[10px] text-white hover:bg-[#d6402b]">
            {exceptionCount > 0 ? "Pending" : "Reviewed"}
          </Badge>
        </div>
      </div>

      {resolvedGracePeriod && (
        <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          Grace period: Before {resolvedGracePeriod.before} min, After {resolvedGracePeriod.after} min
          {" "}
          <span className="font-semibold">
            ({resolvedGracePeriod.source === "user" ? "User" : resolvedGracePeriod.source === "department" ? "Department" : "Company"} level)
          </span>
        </div>
      )}

      {!loading && exceptionSummary.length > 0 && (
        <Alert className="mb-4 border-red-200 bg-red-50 text-red-700">
          <div className="space-y-1">
            {exceptionSummary.map((message) => (
              <div key={message}>{message}</div>
            ))}
          </div>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading timecard...
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] border-collapse border border-gray-500 bg-white text-[11px]">
              <thead>
                <tr className="bg-[#4977a5] text-white">
                  <th className="border border-gray-500 px-2 py-1 text-left font-semibold">Date</th>
                  {weekColumns.map((column) => (
                    <th key={column} className="border border-gray-500 px-2 py-1 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((row) => (
                  <tr key={row.label}>
                    <td className="border border-gray-500 bg-[#f1f1ec] px-2 py-1 font-semibold text-gray-700">
                      {row.label}
                    </td>
                    {row.values.map((value, index) => (
                      <td
                        key={`${row.label}-${index}`}
                        className={cn(
                          "border border-gray-500 px-2 py-1 text-center text-gray-800",
                          row.label === "Actual Shift Punches" && "align-top whitespace-pre-line",
                          cellClass(row.variant, value)
                        )}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}

                <tr className="bg-[#efefea]">
                  <td className="border border-gray-500 px-2 py-1 font-semibold text-gray-700"> </td>
                  {weekColumns.map((_, index) => (
                    <td key={`daily-${index}`} className="border border-gray-500 px-2 py-1 text-center font-semibold text-gray-700">
                      Daily
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="border border-gray-500 bg-[#f8f8f5] px-2 py-1 font-semibold text-[#4e6887]">
                    Notes
                  </td>
                  {visibleEntries.map((entry, index) => (
                    <td key={`notes-${index}`} className="border border-gray-500 px-2 py-1 text-center">
                      {entry?.notes || ""}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[460px] border-collapse border border-gray-500 bg-white text-[11px]">
              <thead>
                <tr>
                  <th colSpan={6} className="border border-gray-500 bg-[#efefea] px-2 py-2 text-center text-sm font-semibold text-gray-700">
                    Pay Period To Date Totals (In Decimal)
                  </th>
                </tr>
                <tr className="bg-[#c92d25] text-white">
                  {totalsSummary.map(([label, value]) => (
                    <th key={label} className="border border-gray-500 px-2 py-1 text-left">
                      <div className="text-[10px] font-semibold uppercase">{label}</div>
                      <div className="text-xs">{value}</div>
                    </th>
                  ))}
                </tr>
                <tr className="bg-[#efefea] text-gray-700">
                  <th className="border border-gray-500 px-2 py-1 text-left">Pay Type</th>
                  <th className="border border-gray-500 px-2 py-1 text-left">Pay Code</th>
                  <th className="border border-gray-500 px-2 py-1 text-left">Hours</th>
                  <th className="border border-gray-500 px-2 py-1 text-left">$ Amount</th>
                  <th className="border border-gray-500 px-2 py-1 text-left">Cost Area</th>
                  <th className="border border-gray-500 px-2 py-1 text-left">Activity</th>
                </tr>
              </thead>
              <tbody>
                {totalsSections.map((section) => (
                  <Fragment key={section.title}>
                    <tr>
                      <td className="border border-gray-500 bg-[#f8f8f5] px-2 py-1 font-semibold text-gray-700">
                        {section.title}
                      </td>
                      <td className="border border-gray-500 px-2 py-1" />
                      <td className="border border-gray-500 px-2 py-1" />
                      <td className="border border-gray-500 px-2 py-1" />
                      <td className="border border-gray-500 px-2 py-1" />
                      <td className="border border-gray-500 px-2 py-1" />
                    </tr>
                    {section.rows.length === 0 ? (
                      Array.from({ length: 4 }).map((_, index) => (
                        <tr key={`${section.title}-blank-${index}`}>
                          <td className="border border-gray-500 px-2 py-1 text-gray-500">Pay Code</td>
                          <td className="border border-gray-500 px-2 py-1" />
                          <td className="border border-gray-500 px-2 py-1" />
                          <td className="border border-gray-500 px-2 py-1" />
                          <td className="border border-gray-500 px-2 py-1" />
                          <td className="border border-gray-500 px-2 py-1" />
                        </tr>
                      ))
                    ) : (
                      section.rows.map((row, rowIndex) => (
                        <tr key={`${section.title}-${rowIndex}`}>
                          {row.map((cell, cellIndex) => (
                            <td key={`${section.title}-${rowIndex}-${cellIndex}`} className="border border-gray-500 px-2 py-1">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
