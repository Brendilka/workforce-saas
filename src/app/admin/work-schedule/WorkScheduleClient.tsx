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
    affectedPatterns?: Array<{patternName: string; violations: string[]}>;
  } | null>(null);

  // Fetch schedules
  useEffect(() => {
    fetchSchedules();
  }, []);

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

  const handleSubmit = async (formData: any) => {
    try {
      setIsFormLoading(true);
      setValidationError(null);
      const url = editingSchedule
        ? `/api/admin/work-schedules/${editingSchedule.id}`
        : "/api/admin/work-schedules";
      const method = editingSchedule ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const err = await response.json();
        if (err?.affectedPatterns) {
          setValidationError({
            message: err.error || "Validation error",
            affectedPatterns: err.affectedPatterns
          });
        } else {
          setValidationError({
            message: err?.error || "Failed to save schedule"
          });
        }
        return;
      }

      await fetchSchedules();
      setIsDialogOpen(false);
      setEditingSchedule(null);
      setValidationError(null);
    } catch (error) {
      console.error("Error saving schedule:", error);
      setValidationError({
        message: error instanceof Error ? error.message : "Failed to save schedule"
      });
    } finally {
      setIsFormLoading(false);
    }
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

  const getShiftPeriod = (timeframes: Timeframe[]): 'night' | 'morning' | 'day' | 'evening' => {
    if (timeframes.length === 0) return 'day';
    const firstTimeframe = timeframes.sort((a, b) => a.frame_order - b.frame_order)[0];
    const [hour] = firstTimeframe.start_time.split(':').map(Number);
    
    if (hour >= 0 && hour < 6) return 'night';
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'day';
    return 'evening';
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

  const schedulesByPeriod = {
    night: sortSchedules(schedules.filter(s => getShiftPeriod(s.work_schedule_timeframes) === 'night')),
    morning: sortSchedules(schedules.filter(s => getShiftPeriod(s.work_schedule_timeframes) === 'morning')),
    day: sortSchedules(schedules.filter(s => getShiftPeriod(s.work_schedule_timeframes) === 'day')),
    evening: sortSchedules(schedules.filter(s => getShiftPeriod(s.work_schedule_timeframes) === 'evening')),
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Work Schedule"
        description="Manage employee work schedules"
      />

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        // Only close on explicit X click or successful submit
        // Prevent closing from overlay/outside clicks by ignoring them
        if (!open && isDialogOpen) {
          // Dialog tried to close from outside - prevent it
          return;
        }
        setIsDialogOpen(open);
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
                onClick={() => setIsDialogOpen(false)}
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
          
          <WorkScheduleForm
            schedule={editingSchedule || undefined}
            onSubmit={handleSubmit}
            isLoading={isFormLoading}
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
        <div className="grid grid-cols-4 gap-4">
          {/* Night Column (0:00-5:59) */}
          <div className="flex flex-col gap-4">
            <div className="bg-blue-900 text-white p-3 rounded-t-lg text-center font-semibold">
              Night (0:00-5:59)
            </div>
            <div className="bg-blue-900/10 p-4 rounded-b-lg min-h-[200px] space-y-4">
              {schedulesByPeriod.night.length === 0 ? (
                <p className="text-sm text-gray-500 text-center">No night shifts</p>
              ) : (
                schedulesByPeriod.night.map((schedule) => (
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

          {/* Morning Column (6:00-11:59) */}
          <div className="flex flex-col gap-4">
            <div className="bg-yellow-600 text-gray-900 p-3 rounded-t-lg text-center font-semibold">
              Morning (6:00-11:59)
            </div>
            <div className="bg-yellow-200/70 p-4 rounded-b-lg min-h-[200px] space-y-4">
              {schedulesByPeriod.morning.length === 0 ? (
                <p className="text-sm text-gray-500 text-center">No morning shifts</p>
              ) : (
                schedulesByPeriod.morning.map((schedule) => (
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

          {/* Day Column (12:00-17:59) */}
          <div className="flex flex-col gap-4">
            <div className="bg-gray-200 text-gray-900 p-3 rounded-t-lg text-center font-semibold">
              Day (12:00-17:59)
            </div>
            <div className="bg-white p-4 rounded-b-lg min-h-[200px] space-y-4 border">
              {schedulesByPeriod.day.length === 0 ? (
                <p className="text-sm text-gray-500 text-center">No day shifts</p>
              ) : (
                schedulesByPeriod.day.map((schedule) => (
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

          {/* Evening Column (18:00-23:59) */}
          <div className="flex flex-col gap-4">
            <div className="bg-orange-600 text-white p-3 rounded-t-lg text-center font-semibold">
              Evening (18:00-23:59)
            </div>
            <div className="bg-orange-200/70 p-4 rounded-b-lg min-h-[200px] space-y-4">
              {schedulesByPeriod.evening.length === 0 ? (
                <p className="text-sm text-gray-500 text-center">No evening shifts</p>
              ) : (
                schedulesByPeriod.evening.map((schedule) => (
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
