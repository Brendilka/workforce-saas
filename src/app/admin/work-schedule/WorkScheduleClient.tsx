"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Edit2, Trash2 } from "lucide-react";
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
        let message = "Failed to save schedule";
        try {
          const err = await response.json();
          if (err?.error) message = err.error;
        } catch (_) {
          // ignore parse errors
        }
        throw new Error(message);
      }

      await fetchSchedules();
      setIsDialogOpen(false);
      setEditingSchedule(null);
    } catch (error) {
      console.error("Error saving schedule:", error);
      throw error;
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
          className="max-w-md max-h-[90vh] overflow-y-auto [&>button.absolute.right-4.top-4]:hidden"
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
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {schedules.map((schedule) => (
            <Card
              key={schedule.id}
              className="p-4 hover:shadow-md transition-shadow relative flex flex-col"
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
          ))}
        </div>
      )}
    </div>
  );
}
