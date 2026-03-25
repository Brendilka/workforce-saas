"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calculateHoursWorked,
  formatDateIso,
  formatTimecardDate,
  formatWeekRange,
  getWeekDates,
  type TimecardEmployeeSummary,
  type TimecardEntry,
  type TimecardStatus,
} from "@/lib/timecard";

interface TimecardApiResponse {
  employee: TimecardEmployeeSummary;
  entries: TimecardEntry[];
  canEdit: boolean;
}

interface TimecardClientProps {
  viewerRole: "employee" | "admin";
  userOptions?: TimecardEmployeeSummary[];
  initialUserId?: string;
}

function statusBadgeVariant(status: TimecardStatus) {
  if (status === "approved") return "success";
  if (status === "exception") return "destructive";
  return "warning";
}

export function TimecardClient({
  viewerRole,
  userOptions = [],
  initialUserId,
}: TimecardClientProps) {
  const [selectedUserId, setSelectedUserId] = useState(initialUserId || "");
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [entries, setEntries] = useState<TimecardEntry[]>([]);
  const [employee, setEmployee] = useState<TimecardEmployeeSummary | null>(null);
  const [canEdit, setCanEdit] = useState(viewerRole === "employee");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (viewerRole === "admin" && !selectedUserId && userOptions[0]?.userId) {
      setSelectedUserId(userOptions[0].userId);
    }
  }, [selectedUserId, userOptions, viewerRole]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTimecard() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (selectedUserId) {
          params.set("userId", selectedUserId);
        }

        const response = await fetch(`/api/timecard?${params.toString()}`, {
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
        setCanEdit(data.canEdit);
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

    if (viewerRole === "employee" || selectedUserId) {
      void loadTimecard();
    }

    return () => controller.abort();
  }, [selectedUserId, viewerRole]);

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);

  const visibleEntries = useMemo(() => {
    const byDate = new Map(entries.map((entry) => [entry.date, entry]));

    return weekDates.map((date) => {
      const isoDate = formatDateIso(date);
      return (
        byDate.get(isoDate) || {
          date: isoDate,
          clockIn: "",
          clockOut: "",
          hoursWorked: 0,
          status: "pending" as const,
          notes: "",
        }
      );
    });
  }, [entries, weekDates]);

  const totalHours = visibleEntries.reduce((sum, entry) => sum + entry.hoursWorked, 0);
  const regularHours = Math.min(totalHours, 40);
  const overtimeHours = Math.max(totalHours - 40, 0);

  const updateEntry = (
    date: string,
    field: keyof TimecardEntry,
    value: string
  ) => {
    setEntries((currentEntries) => {
      const existing = currentEntries.find((entry) => entry.date === date) || {
        date,
        clockIn: "",
        clockOut: "",
        hoursWorked: 0,
        status: "pending" as const,
        notes: "",
      };

      const nextEntry: TimecardEntry = {
        ...existing,
        [field]: value,
      } as TimecardEntry;

      if (field === "clockIn" || field === "clockOut") {
        nextEntry.hoursWorked = calculateHoursWorked(
          field === "clockIn" ? value : nextEntry.clockIn,
          field === "clockOut" ? value : nextEntry.clockOut
        );
      }

      const remaining = currentEntries.filter((entry) => entry.date !== date);
      return [...remaining, nextEntry].sort((left, right) => left.date.localeCompare(right.date));
    });

    setNotice(null);
  };

  const saveEntries = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/timecard", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedUserId || undefined,
          entries,
        }),
      });

      const data = (await response.json()) as { entries?: TimecardEntry[]; error?: string };

      if (!response.ok || !data.entries) {
        throw new Error(data.error || "Unable to save timecard.");
      }

      setEntries(data.entries);
      setNotice("Timecard changes saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save timecard."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalHours.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">This week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Regular Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{regularHours.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Up to 40 hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Overtime Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overtimeHours.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Over 40 hours</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>{formatWeekRange(currentWeek)}</CardTitle>
              {employee && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {employee.fullName}
                  {employee.employeeNumber ? ` · Employee #${employee.employeeNumber}` : ""}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {viewerRole === "admin" && (
                <div className="min-w-[260px]">
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
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
              )}

              <div className="flex items-center gap-2">
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
              </div>
            </div>
          </div>

          {error && <Alert className="border-red-200 bg-red-50 text-red-700">{error}</Alert>}
          {notice && <Alert className="border-green-200 bg-green-50 text-green-700">{notice}</Alert>}
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-14 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading timecard...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Clock In</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Clock Out</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Hours</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntries.map((entry, index) => (
                      <tr key={entry.date} className={index < visibleEntries.length - 1 ? "border-b" : ""}>
                        <td className="px-4 py-3 font-medium">
                          {formatTimecardDate(new Date(`${entry.date}T00:00:00`))}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="time"
                            value={entry.clockIn}
                            disabled={!canEdit}
                            onChange={(event) =>
                              updateEntry(entry.date, "clockIn", event.target.value)
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="time"
                            value={entry.clockOut}
                            disabled={!canEdit}
                            onChange={(event) =>
                              updateEntry(entry.date, "clockOut", event.target.value)
                            }
                          />
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {entry.hoursWorked > 0 ? entry.hoursWorked.toFixed(2) : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {canEdit ? (
                            <Select
                              value={entry.status}
                              onValueChange={(value) =>
                                updateEntry(entry.date, "status", value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="exception">Exception</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={statusBadgeVariant(entry.status)}>
                              {entry.status}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={entry.notes}
                            disabled={!canEdit}
                            placeholder={canEdit ? "Add a note" : "No notes"}
                            onChange={(event) =>
                              updateEntry(entry.date, "notes", event.target.value)
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canEdit && (
                <div className="flex justify-end">
                  <Button onClick={saveEntries} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Timecard
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
