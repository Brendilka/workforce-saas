"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WorkScheduleForm } from "@/components/work-schedule-form";
import type { ShiftTypeOption, DayPeriodConfig } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_DAY_PERIODS: DayPeriodConfig[] = [
  { id: "night", label: "Night", startMinutes: 0, endMinutes: 360 },
  { id: "morning", label: "Morning", startMinutes: 360, endMinutes: 720 },
  { id: "day", label: "Day", startMinutes: 720, endMinutes: 1080 },
  { id: "evening", label: "Evening", startMinutes: 1080, endMinutes: 1440 },
];

function minutesFromMidnight(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatPeriodTime(startMinutes: number, endMinutes: number): string {
  const toStr = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  return `${toStr(startMinutes)}-${toStr(endMinutes)}`;
}

interface Timeframe {
  id: string;
  start_time: string;
  end_time: string;
  frame_order: number;
  meal_type?: string | null;
  meal_start?: string | null;
  meal_end?: string | null;
}

interface WorkSchedule {
  id: string;
  shift_id: string;
  shift_type: string;
   description?: string | null;
  created_at: string;
  work_schedule_timeframes: Timeframe[];
}

export function WorkScheduleClient() {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(
    null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [hoveredScheduleId, setHoveredScheduleId] = useState<string | null>(
    null
  );
  const [validationError, setValidationError] = useState<{
    message: string;
    affectedPatterns?: Array<{ patternName: string; patternId?: string; violations: string[] }>;
  } | null>(null);
  const [saveWarning, setSaveWarning] = useState<{
    restTimeViolations: Array<{ patternName: string; patternId?: string; violations: string[] }>;
  } | null>(null);
  const [pendingSaveWarnings, setPendingSaveWarnings] = useState<Array<{ patternName: string; patternId?: string; violations: string[] }> | null>(null);
  const [pendingSaveFormData, setPendingSaveFormData] = useState<any>(null);
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeOption[] | null>(null);
  const [dayPeriods, setDayPeriods] = useState<DayPeriodConfig[]>(DEFAULT_DAY_PERIODS);

  const supabase = createClient();

  // Fetch schedules and tenant config (shift types, day periods)
  useEffect(() => {
    fetchSchedules();
    fetchTenantConfig();
  }, []);

  const fetchTenantConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.user_metadata?.tenant_id;
      if (!tenantId) return;
      const { data } = await supabase
        .from("tenant_config")
        .select("shift_types, day_periods")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      const row = data as unknown as { shift_types: ShiftTypeOption[] | null; day_periods: DayPeriodConfig[] | null };
      if (Array.isArray(row?.shift_types) && row.shift_types.length > 0) {
        setShiftTypes(row.shift_types);
      }
      if (Array.isArray(row?.day_periods) && row.day_periods.length > 0) {
        setDayPeriods([...row.day_periods].sort((a, b) => a.startMinutes - b.startMinutes));
      }
    } catch {
      // use defaults
    }
  };

  const fetchSchedules = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/work-schedules");
      if (!response.ok) throw new Error("Failed to fetch schedules");
      const data = await response.json();
      setSchedules(data);
    } catch (error) {
      console.error("Error fetching schedules:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const performSave = async (formData: any, isValidateOnly: boolean) => {
    const url = editingSchedule
      ? `/api/admin/work-schedules/${editingSchedule.id}`
      : "/api/admin/work-schedules";
    const method = editingSchedule ? "PUT" : "POST";
    const body = editingSchedule && isValidateOnly
      ? { ...formData, validateOnly: true }
      : formData;
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { response, data: response.ok ? await response.json() : await response.json().catch(() => ({})) };
  };

  const handleSubmit = async (formData: any) => {
    try {
      setIsFormLoading(true);
      setValidationError(null);
      setPendingSaveWarnings(null);
      setPendingSaveFormData(null);

      if (editingSchedule) {
        const { response, data } = await performSave(formData, true);
        if (!response.ok) {
          if (data?.affectedPatterns) {
            setValidationError({
              message: data.error || "Validation error",
              affectedPatterns: data.affectedPatterns,
            });
          } else {
            setValidationError({
              message: data?.error || "Failed to save schedule",
            });
          }
          return;
        }
        if (data?.restTimeAffectedPatterns?.length > 0) {
          setPendingSaveWarnings(data.restTimeAffectedPatterns);
          setPendingSaveFormData(formData);
          return;
        }
      }

      const { response, data } = await performSave(formData, false);
      if (!response.ok) {
        const err = data;
        if (err?.affectedPatterns) {
          setValidationError({
            message: err.error || "Validation error",
            affectedPatterns: err.affectedPatterns,
          });
        } else {
          setValidationError({
            message: err?.error || "Failed to save schedule",
          });
        }
        return;
      }

      await fetchSchedules();
      setIsDialogOpen(false);
      setEditingSchedule(null);
      setValidationError(null);
      setPendingSaveWarnings(null);
      setPendingSaveFormData(null);
      setSaveWarning(null);
    } catch (error) {
      console.error("Error saving schedule:", error);
      setValidationError({
        message: error instanceof Error ? error.message : "Failed to save schedule"
      });
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleSaveAnyway = async () => {
    if (!pendingSaveFormData || !editingSchedule) return;
    try {
      setIsFormLoading(true);
      setValidationError(null);
      const { response, data } = await performSave(pendingSaveFormData, false);
      if (!response.ok) {
        setValidationError({
          message: data?.error || "Failed to save schedule",
        });
        return;
      }
      await fetchSchedules();
      setIsDialogOpen(false);
      setEditingSchedule(null);
      setPendingSaveWarnings(null);
      setPendingSaveFormData(null);
      setSaveWarning(null);
    } catch (error) {
      console.error("Error saving schedule:", error);
      setValidationError({
        message: error instanceof Error ? error.message : "Failed to save schedule"
      });
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleCancelConfirm = () => {
    setPendingSaveWarnings(null);
    setPendingSaveFormData(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;

    try {
      const response = await fetch(`/api/admin/work-schedules/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete schedule");

      await fetchSchedules();
    } catch (error) {
      console.error("Error deleting schedule:", error);
    }
  };

  const formatTimeframe = (timeframe: Timeframe) => {
    return `${timeframe.start_time} - ${timeframe.end_time}`;
  };

  const calculateTotalHours = (timeframes: Timeframe[]) => {
    let totalMinutes = 0;
    for (const tf of timeframes) {
      const [startHour, startMin] = tf.start_time.split(":").map(Number);
      const [endHour, endMin] = tf.end_time.split(":").map(Number);
      const startTotalMin = startHour * 60 + startMin;
      let endTotalMin = endHour * 60 + endMin;

      if (endTotalMin < startTotalMin) {
        endTotalMin += 24 * 60;
      }

      totalMinutes += endTotalMin - startTotalMin;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const calculateExpectedWorkHours = (timeframes: Timeframe[]) => {
    let totalMinutes = 0;
    let unpaidMealMinutes = 0;

    for (const tf of timeframes) {
      const [startHour, startMin] = tf.start_time.split(":").map(Number);
      const [endHour, endMin] = tf.end_time.split(":").map(Number);
      const startTotalMin = startHour * 60 + startMin;
      let endTotalMin = endHour * 60 + endMin;

      if (endTotalMin < startTotalMin) {
        endTotalMin += 24 * 60;
      }

      totalMinutes += endTotalMin - startTotalMin;

      // Subtract unpaid meal time
      if (tf.meal_type === "unpaid" && tf.meal_start && tf.meal_end) {
        const [mealStartHour, mealStartMin] = tf.meal_start.split(":").map(Number);
        const [mealEndHour, mealEndMin] = tf.meal_end.split(":").map(Number);
        const mealStartTotalMin = mealStartHour * 60 + mealStartMin;
        const mealEndTotalMin = mealEndHour * 60 + mealEndMin;
        unpaidMealMinutes += mealEndTotalMin - mealStartTotalMin;
      }
    }

    const netMinutes = Math.max(0, totalMinutes - unpaidMealMinutes);
    const hours = Math.floor(netMinutes / 60);
    const minutes = netMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const getShiftPeriodId = (timeframes: Timeframe[]): string => {
    if (timeframes.length === 0 || dayPeriods.length === 0) return dayPeriods[0]?.id ?? "day";
    const first = timeframes.slice().sort((a, b) => a.frame_order - b.frame_order)[0];
    const startMins = minutesFromMidnight(first.start_time);
    const period = dayPeriods.find((p) => startMins >= p.startMinutes && startMins < p.endMinutes);
    return period?.id ?? dayPeriods[0].id;
  };

  const sortSchedules = (schedules: WorkSchedule[]): WorkSchedule[] => {
    return [...schedules].sort((a, b) => {
      const aFirstFrame = a.work_schedule_timeframes.sort((x, y) => x.frame_order - y.frame_order)[0];
      const bFirstFrame = b.work_schedule_timeframes.sort((x, y) => x.frame_order - y.frame_order)[0];
      
      if (!aFirstFrame || !bFirstFrame) return 0;
      
      // Compare start times
      const aStartMinutes = timeToMinutes(aFirstFrame.start_time);
      const bStartMinutes = timeToMinutes(bFirstFrame.start_time);
      
      if (aStartMinutes !== bStartMinutes) {
        return aStartMinutes - bStartMinutes;
      }
      
      // If start times are equal, compare end times (earlier end time comes first)
      const aEndMinutes = timeToMinutes(aFirstFrame.end_time);
      const bEndMinutes = timeToMinutes(bFirstFrame.end_time);
      return aEndMinutes - bEndMinutes;
    });
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Match split shifts by configured "split" type label from Settings, or fallback to "Split shift"
  const splitShiftLabel =
    (shiftTypes?.find((t) => t.id === "split")?.label ?? "Split shift").trim();
  const isSplitShift = (s: WorkSchedule) =>
    (s.shift_type ?? "").trim() === splitShiftLabel;

  // Split shifts appear only in the Split shifts column; other shifts go to time-period columns by first frame start
  const nonSplitSchedules = schedules.filter((s) => !isSplitShift(s));
  const schedulesByPeriodId: Record<string, WorkSchedule[]> = {};
  dayPeriods.forEach((p) => {
    schedulesByPeriodId[p.id] = sortSchedules(nonSplitSchedules.filter((s) => getShiftPeriodId(s.work_schedule_timeframes) === p.id));
  });
  const splitShiftsList = sortSchedules(schedules.filter(isSplitShift));

  const periodColors: string[] = ["bg-blue-900", "bg-yellow-600", "bg-gray-300", "bg-orange-600", "bg-violet-600", "bg-emerald-600", "bg-rose-500", "bg-cyan-600", "bg-amber-500", "bg-slate-500"];
  const periodBgLight: string[] = ["bg-blue-900/10", "bg-yellow-200/70", "bg-white", "bg-orange-200/70", "bg-violet-100", "bg-emerald-100", "bg-rose-100", "bg-cyan-100", "bg-amber-100", "bg-slate-100"];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Work Schedule"
        description="Manage employee work schedules"
      />

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        // Only close on explicit X click or successful submit
        if (!open && isDialogOpen) return;
        setIsDialogOpen(open);
        if (!open) {
          setPendingSaveWarnings(null);
          setPendingSaveFormData(null);
          setValidationError(null);
        }
      }}>
        <DialogTrigger asChild>
          <Button onClick={() => {
            setEditingSchedule(null);
            setIsDialogOpen(true);
          }} className="gap-2 w-fit">
            <Plus className="h-4 w-4" />
            Add Schedule
          </Button>
        </DialogTrigger>
        <DialogContent 
          className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button.absolute.right-4.top-4]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>
                {editingSchedule ? "Edit Schedule" : "Add New Schedule"}
              </DialogTitle>
              <button
                onClick={() => {
                  setIsDialogOpen(false);
                  setPendingSaveWarnings(null);
                  setPendingSaveFormData(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </DialogHeader>
          
          {validationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex gap-2">
                <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-800 mb-2">
                    {validationError.message}
                  </h3>
                  {validationError.affectedPatterns && validationError.affectedPatterns.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-red-700 font-medium">Affected Roster Patterns:</p>
                      <ul className="space-y-2">
                        {validationError.affectedPatterns.map((pattern, idx) => (
                          <li key={idx} className="text-sm">
                            <div className="font-medium text-red-800">{pattern.patternName}</div>
                            <ul className="mt-1 ml-4 space-y-1">
                              {pattern.violations.map((violation, vIdx) => (
                                <li key={vIdx} className="text-red-700 text-xs">• {violation}</li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setValidationError(null)}
                  className="text-red-600 hover:text-red-800 flex-shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {pendingSaveWarnings && pendingSaveWarnings.length > 0 && editingSchedule && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-1">
                This edit would cause rest-time issues for &quot;{editingSchedule.shift_id}&quot;
              </h3>
              <p className="text-sm text-amber-700 mb-3">
                The roster patterns below <strong>use this work schedule</strong>. With your changes, the rest time between this schedule and the next or previous shift would be below the minimum in these places. You can save anyway and fix the patterns later, or cancel to change the schedule.
              </p>
              <p className="text-xs text-amber-600 mb-2 font-medium">Roster patterns affected:</p>
              <ul className="space-y-2 mb-4">
                {pendingSaveWarnings.map((p, idx) => (
                  <li key={idx} className="text-sm">
                    <span className="font-medium text-amber-800">{p.patternName}</span>
                    <ul className="mt-1 ml-4 space-y-0.5">
                      {p.violations.map((v, vIdx) => (
                        <li key={vIdx} className="text-amber-700 text-xs">• {v}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleSaveAnyway}
                  disabled={isFormLoading}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {isFormLoading ? "Saving..." : "Save anyway"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelConfirm}
                  disabled={isFormLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          
          <WorkScheduleForm
            schedule={editingSchedule || undefined}
            shiftTypes={shiftTypes}
            onSubmit={handleSubmit}
            isLoading={isFormLoading}
            hideSubmitButton={!!(pendingSaveWarnings && pendingSaveWarnings.length > 0)}
          />
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading schedules...</div>
      ) : schedules.length === 0 ? (
        <Card className="p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No schedules yet
          </h3>
          <p className="text-sm text-gray-500">
            Create your first work schedule to get started
          </p>
        </Card>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${dayPeriods.length + 1}, minmax(0, 1fr))` }}>
          {dayPeriods.map((period, idx) => (
            <div key={period.id} className="flex flex-col gap-4">
              <div className={`${periodColors[idx % periodColors.length]} text-white p-3 rounded-t-lg text-center font-semibold`}>
                {period.label} ({formatPeriodTime(period.startMinutes, period.endMinutes)})
              </div>
              <div className={`${periodBgLight[idx % periodBgLight.length]} p-4 rounded-b-lg min-h-[200px] space-y-4 border border-t-0 ${idx === 2 ? "border-gray-300" : ""}`}>
                {(schedulesByPeriodId[period.id] ?? []).length === 0 ? (
                  <p className="text-sm text-gray-500 text-center">No shifts</p>
                ) : (
                  (schedulesByPeriodId[period.id] ?? []).map((schedule) => (
                    <Card
                      key={schedule.id}
                      className="p-4 hover:shadow-md transition-shadow relative flex flex-col bg-white"
                      onMouseEnter={() => setHoveredScheduleId(schedule.id)}
                      onMouseLeave={() => setHoveredScheduleId(null)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{schedule.shift_id}</h3>
                          <p className="text-sm text-gray-600">Type: {schedule.shift_type}</p>
                          {schedule.description && <p className="text-sm text-gray-600 mt-1">{schedule.description}</p>}
                        </div>
                        {hoveredScheduleId === schedule.id && (
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setEditingSchedule(schedule); setIsDialogOpen(true); }}>
                              <Edit2 className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(schedule.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {schedule.work_schedule_timeframes.sort((a, b) => a.frame_order - b.frame_order).map((tf, i) => (
                          <div key={tf.id} className="text-sm text-gray-600">
                            <p>Time Frame {i + 1}: {formatTimeframe(tf)}</p>
                            {tf.meal_start && tf.meal_end && <p className="ml-4 text-xs">Meal ({tf.meal_type}): {tf.meal_start} - {tf.meal_end}</p>}
                          </div>
                        ))}
                      </div>
                      <p className="text-sm font-medium text-gray-700 mt-3">Expected work hours: {calculateExpectedWorkHours(schedule.work_schedule_timeframes)}</p>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}

          {/* Split Shifts Column */}
          <div className="flex flex-col gap-4">
            <div className="bg-black text-white p-3 rounded-t-lg text-center font-semibold">
              Split shifts
            </div>
            <div className="bg-gray-100 p-4 rounded-b-lg min-h-[200px] space-y-4">
              {splitShiftsList.length === 0 ? (
                <p className="text-sm text-gray-500 text-center">No split shifts</p>
              ) : (
                splitShiftsList.map((schedule) => (
                  <Card
                    key={schedule.id}
                    className="p-4 hover:shadow-md transition-shadow relative flex flex-col bg-white"
                    onMouseEnter={() => setHoveredScheduleId(schedule.id)}
                    onMouseLeave={() => setHoveredScheduleId(null)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {schedule.shift_id}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Type: {schedule.shift_type}
                        </p>
                        {schedule.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {schedule.description}
                          </p>
                        )}
                      </div>

                      {hoveredScheduleId === schedule.id && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingSchedule(schedule);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4 text-blue-500" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(schedule.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {schedule.work_schedule_timeframes
                        .sort((a, b) => a.frame_order - b.frame_order)
                        .map((tf, idx) => (
                          <div key={tf.id} className="text-sm text-gray-600">
                            <p>Time Frame {idx + 1}: {formatTimeframe(tf)}</p>
                            {tf.meal_start && tf.meal_end && (
                              <p className="ml-4 text-xs">
                                Meal ({tf.meal_type}): {tf.meal_start} - {tf.meal_end}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>

                    <p className="text-sm font-medium text-gray-700 mt-3">
                      Expected work hours: {calculateExpectedWorkHours(schedule.work_schedule_timeframes)}
                    </p>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
