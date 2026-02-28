"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Check, AlertCircle, X, Trash2, GripVertical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DayPeriodConfig } from "@/lib/types/database";
import { getPeriodColor, DEFAULT_PERIOD_COLORS } from "@/lib/day-period-colors";

const DEFAULT_DAY_PERIODS: DayPeriodConfig[] = [
  { id: "night", label: "Night", startMinutes: 0, endMinutes: 360, color: "#1e3a5f" },
  { id: "morning", label: "Morning", startMinutes: 360, endMinutes: 720, color: "#ca8a04" },
  { id: "day", label: "Day", startMinutes: 720, endMinutes: 1080, color: "#9ca3af" },
  { id: "evening", label: "Evening", startMinutes: 1080, endMinutes: 1440, color: "#ea580c" },
];

const MIN_PERIOD_MINUTES = 30;
const MAX_DAY_PERIODS = 10;

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function validateDayPeriods(periods: DayPeriodConfig[]): string | null {
  if (periods.length === 0) return "At least one period is required.";
  if (periods.length > MAX_DAY_PERIODS) return `Maximum ${MAX_DAY_PERIODS} periods allowed.`;
  const sorted = [...periods].sort((a, b) => a.startMinutes - b.startMinutes);
  if (sorted[0].startMinutes !== 0) return "First period must start at 0:00.";
  if (sorted[sorted.length - 1].endMinutes !== 1440) return "Last period must end at 24:00.";
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].startMinutes >= sorted[i].endMinutes) return `Period "${sorted[i].label}" has invalid time range.`;
    if (i < sorted.length - 1 && sorted[i].endMinutes !== sorted[i + 1].startMinutes) {
      return "Periods must not overlap and must cover the full 24 hours with no gaps.";
    }
  }
  return null;
}

export function SettingsClient() {
  const [minHoursBetweenShifts, setMinHoursBetweenShifts] = useState<number>(8);
  const [dayPeriods, setDayPeriods] = useState<DayPeriodConfig[]>(DEFAULT_DAY_PERIODS);
  const [dayPeriodsError, setDayPeriodsError] = useState<string | null>(null);
  const dayBarRef = useRef<HTMLDivElement>(null);
  const draggingHandleIndex = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const supabase = createClient();

  // Auto-dismiss notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      // Get current user's tenant_id
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;

      const tenantId = user?.user_metadata?.tenant_id;
      if (!tenantId) {
        console.warn("Unable to determine tenant");
        return;
      }

      const { data, error } = await supabase
        .from("tenant_config")
        .select("min_hours_between_shifts, day_periods")
        .eq("tenant_id", tenantId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading settings:", error);
      } else if (data) {
        const row = data as unknown as {
          min_hours_between_shifts: number | null;
          day_periods: DayPeriodConfig[] | null;
        };
        if (row.min_hours_between_shifts != null) {
          setMinHoursBetweenShifts(row.min_hours_between_shifts);
        }
        if (Array.isArray(row.day_periods) && row.day_periods.length > 0) {
          // Preserve stored order (used for column order on Work Schedule Templates page)
          const loaded = row.day_periods as DayPeriodConfig[];
          setDayPeriods(loaded.map((p, i) => ({
            ...p,
            color: p.color && /^#[0-9A-Fa-f]{6}$/.test(String(p.color).trim()) ? String(p.color).trim() : DEFAULT_PERIOD_COLORS[i % DEFAULT_PERIOD_COLORS.length],
          })));
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    const err = validateDayPeriods(dayPeriods);
    if (err) {
      setDayPeriodsError(err);
      setNotification({ type: "error", message: err });
      return;
    }
    setDayPeriodsError(null);
    setIsSaving(true);
    try {
      // Get current user's tenant_id
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;

      // Get the tenant_id from the user's custom claims
      const tenantId = user?.user_metadata?.tenant_id;
      if (!tenantId) {
        throw new Error("Unable to determine tenant. Please log in again.");
      }

      const payload = {
        tenant_id: tenantId,
        min_hours_between_shifts: minHoursBetweenShifts,
        day_periods: dayPeriods.map((p) => ({ ...p, label: p.label.trim() || p.label })),
      };

      const { error } = await supabase.from("tenant_config").upsert(payload as any, {
        onConflict: "tenant_id",
      });

      if (error) throw error;
      setNotification({
        type: "success",
        message: "Settings saved successfully!",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      const err = error as { message?: string; details?: string; hint?: string };
      const errorMessage =
        err?.message || (error instanceof Error ? error.message : "Failed to save settings.");
      setNotification({
        type: "error",
        message: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleIncrement = () => {
    setMinHoursBetweenShifts((prev) => Math.min(23, prev + 0.25));
  };

  const handleDecrement = () => {
    setMinHoursBetweenShifts((prev) => Math.max(0, prev - 0.25));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 23) {
      setMinHoursBetweenShifts(value);
    } else if (e.target.value === "") {
      setMinHoursBetweenShifts(0);
    }
  };

  const handleInputBlur = () => {
    // Round to nearest 0.25
    const rounded = Math.round(minHoursBetweenShifts * 4) / 4;
    const clamped = Math.max(0, Math.min(23, rounded));
    setMinHoursBetweenShifts(clamped);
  };

  // Day periods: move boundary between period[index] and period[index+1]
  const moveDayPeriodBoundary = useCallback((handleIndex: number, minutes: number) => {
    setDayPeriods((prev) => {
      if (handleIndex < 0 || handleIndex >= prev.length - 1) return prev;
      const low = prev[handleIndex].startMinutes + MIN_PERIOD_MINUTES;
      const isLastPeriod = handleIndex + 1 === prev.length - 1;
      const high = isLastPeriod ? 1440 - MIN_PERIOD_MINUTES : prev[handleIndex + 1].endMinutes - MIN_PERIOD_MINUTES;
      const clamped = Math.round(Math.max(low, Math.min(high, minutes)) / 15) * 15; // snap to 15 min
      const next = prev.map((p, i) => ({ ...p }));
      next[handleIndex] = { ...next[handleIndex], endMinutes: clamped };
      next[handleIndex + 1] = { ...next[handleIndex + 1], startMinutes: clamped };
      if (isLastPeriod) next[handleIndex + 1].endMinutes = 1440;
      return next;
    });
  }, []);

  const handleBarMouseMove = useCallback(
    (e: MouseEvent) => {
      if (draggingHandleIndex.current === null || !dayBarRef.current) return;
      const rect = dayBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const minutes = Math.round(pct * 1440);
      moveDayPeriodBoundary(draggingHandleIndex.current, minutes);
    },
    [moveDayPeriodBoundary]
  );

  const handleBarMouseUp = useCallback(() => {
    draggingHandleIndex.current = null;
    window.removeEventListener("mousemove", handleBarMouseMove);
    window.removeEventListener("mouseup", handleBarMouseUp);
  }, [handleBarMouseMove]);

  const startDragHandle = (handleIndex: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    draggingHandleIndex.current = handleIndex;
    window.addEventListener("mousemove", handleBarMouseMove);
    window.addEventListener("mouseup", handleBarMouseUp);
  };

  const updateDayPeriodLabel = (index: number, label: string) => {
    setDayPeriods((prev) => {
      const next = [...prev];
      const rawLabel = typeof label === "string" ? label : next[index].label;
      const trimmedForMatch = rawLabel.trim();
      const existing = next.find((p, i) => i !== index && p.label.trim().toLowerCase() === trimmedForMatch.toLowerCase());
      next[index] = {
        ...next[index],
        label: rawLabel,
        ...(existing && { color: existing.color ?? next[index].color }),
      };
      return next;
    });
  };

  const updateDayPeriodColor = (index: number, color: string) => {
    setDayPeriods((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], color: color || undefined };
      return next;
    });
  };

  const moveDayPeriodRow = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= dayPeriods.length) return;
    setDayPeriods((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  };

  const addDayPeriod = () => {
    if (dayPeriods.length >= MAX_DAY_PERIODS) return;
    setDayPeriods((prev) => {
      const last = prev[prev.length - 1];
      const mid = last.startMinutes + Math.floor((last.endMinutes - last.startMinutes) / 2);
      const newId = `period-${Date.now()}`;
      const newLabel = "New period";
      const existing = prev.find((p) => p.label.trim().toLowerCase() === newLabel.toLowerCase());
      const newPeriod: DayPeriodConfig = {
        id: newId,
        label: newLabel,
        startMinutes: mid,
        endMinutes: last.endMinutes,
        color: existing?.color ?? DEFAULT_PERIOD_COLORS[prev.length % DEFAULT_PERIOD_COLORS.length],
      };
      const next = prev.map((p, i) => (i === prev.length - 1 ? { ...p, endMinutes: mid } : { ...p }));
      return [...next, newPeriod];
    });
  };

  const removeDayPeriod = (index: number) => {
    if (dayPeriods.length <= 1) return;
    setDayPeriods((prev) => {
      const next = prev.filter((_, i) => i !== index).map((p) => ({ ...p }));
      if (index === 0) {
        next[0].startMinutes = 0;
      } else if (index === prev.length - 1) {
        next[next.length - 1].endMinutes = 1440;
      } else {
        next[index - 1].endMinutes = prev[index].endMinutes;
        next[index].startMinutes = prev[index].startMinutes;
      }
      return next;
    });
  };

  const [draggedPeriodIndex, setDraggedPeriodIndex] = useState<number | null>(null);
  const handlePeriodDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedPeriodIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    if (e.target instanceof HTMLElement) e.target.classList.add("opacity-50");
  };
  const handlePeriodDragEnd = (e: React.DragEvent) => {
    setDraggedPeriodIndex(null);
    if (e.target instanceof HTMLElement) e.target.classList.remove("opacity-50");
  };
  const handlePeriodDragOver = (e: React.DragEvent) => e.preventDefault();
  const handlePeriodDrop = (toIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!Number.isNaN(fromIndex) && fromIndex !== toIndex) moveDayPeriodRow(fromIndex, toIndex);
    setDraggedPeriodIndex(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Configure system settings" />

      <Card className="p-6 max-w-2xl">
        {isLoading ? (
          <div className="text-sm text-gray-500">Loading settings...</div>
        ) : (
          <div className="space-y-6">
            <div>
              <Label htmlFor="minHoursBetweenShifts" className="text-base font-semibold mb-3 block">
                Min allowed number of hours between shifts
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleDecrement}
                  disabled={minHoursBetweenShifts <= 0}
                  className="h-10 w-10"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id="minHoursBetweenShifts"
                  type="number"
                  step="0.25"
                  min="0"
                  max="23"
                  value={minHoursBetweenShifts}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  className="w-32 text-center"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleIncrement}
                  disabled={minHoursBetweenShifts >= 23}
                  className="h-10 w-10"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600">hours</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Minimum rest time required between consecutive shifts (0 - 23 hours, in 0.25 hour increments)
              </p>
            </div>

            <div className="border-t pt-6">
              <Label className="text-base font-semibold mb-3 block">
                Day periods (Work Schedule Templates columns)
              </Label>
              <p className="text-xs text-gray-500 mb-3">
                Customize names and time ranges for the Work Schedule Templates page columns. Must cover 24 hours with no gaps or overlaps (max {MAX_DAY_PERIODS} periods). Drag the handles between segments to adjust.
              </p>
              {dayPeriodsError && (
                <p className="text-sm text-red-600 mb-2">{dayPeriodsError}</p>
              )}
              <div ref={dayBarRef} className="flex h-10 w-full rounded-lg overflow-hidden border border-gray-300 bg-gray-100 select-none mb-4">
                {dayPeriods.map((period, i) => (
                  <div key={period.id} className="flex items-stretch min-w-0" style={{ width: `${((period.endMinutes - period.startMinutes) / 1440) * 100}%` }}>
                    <div
                      className="flex-1 flex items-center justify-center text-white text-xs font-medium truncate px-0.5"
                      style={{ backgroundColor: getPeriodColor(period, i), minWidth: 0 }}
                      title={`${period.label} (${minutesToTime(period.startMinutes)}–${minutesToTime(period.endMinutes)})`}
                    >
                      {period.label}
                    </div>
                    {i < dayPeriods.length - 1 && (
                      <div
                        role="slider"
                        aria-label={`Boundary between ${period.label} and ${dayPeriods[i + 1].label}`}
                        tabIndex={0}
                        className="w-2 flex-shrink-0 bg-gray-400 hover:bg-gray-600 cursor-ew-resize active:bg-gray-700"
                        onMouseDown={startDragHandle(i)}
                        style={{ touchAction: "none" }}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-2 mb-3">
                {dayPeriods.map((period, i) => (
                  <div
                    key={period.id}
                    draggable
                    onDragStart={handlePeriodDragStart(i)}
                    onDragEnd={handlePeriodDragEnd}
                    onDragOver={handlePeriodDragOver}
                    onDrop={handlePeriodDrop(i)}
                    className={`flex items-center gap-2 rounded border border-gray-200 bg-white p-2 transition-opacity ${draggedPeriodIndex === i ? "opacity-50" : ""} ${draggedPeriodIndex !== null ? "hover:border-blue-300" : ""}`}
                  >
                    <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600" aria-label="Drag to reorder">
                      <GripVertical className="h-5 w-5" />
                    </div>
                    <input
                      type="color"
                      value={getPeriodColor(period, i)}
                      onChange={(e) => updateDayPeriodColor(i, e.target.value)}
                      className="w-9 h-9 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                      title="Day type colour"
                    />
                    <Input
                      value={period.label}
                      onChange={(e) => updateDayPeriodLabel(i, e.target.value)}
                      placeholder="Period name"
                      className="flex-1 text-sm h-9"
                    />
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {minutesToTime(period.startMinutes)} – {minutesToTime(period.endMinutes)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDayPeriod(i)}
                      disabled={dayPeriods.length <= 1}
                      className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                      aria-label="Remove period"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {dayPeriods.length < MAX_DAY_PERIODS && (
                  <Button type="button" variant="outline" size="sm" onClick={addDayPeriod} className="gap-1 h-9">
                    <Plus className="h-4 w-4" />
                    Add period
                  </Button>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={saveSettings} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed bottom-4 right-4 max-w-sm rounded-lg shadow-lg border p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4 fade-in ${
            notification.type === "success"
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div className="flex-shrink-0">
            {notification.type === "success" ? (
              <Check className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
          </div>
          <div className="flex-1">
            <p
              className={`text-sm font-medium ${
                notification.type === "success"
                  ? "text-green-800"
                  : "text-red-800"
              }`}
            >
              {notification.message}
            </p>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}    </div>
  );
}
