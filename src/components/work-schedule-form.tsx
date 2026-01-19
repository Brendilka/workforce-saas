"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, AlertCircle } from "lucide-react";

interface Timeframe {
  id?: string;
  startTime: string;
  endTime: string;
  mealType: string;
  mealStart: string;
  mealEnd: string;
}

interface WorkScheduleFormProps {
  schedule?: {
    id: string;
    shift_id: string;
    shift_type: string;
    description?: string | null;
    work_schedule_timeframes: Array<{
      id: string;
      start_time: string;
      end_time: string;
      frame_order: number;
      meal_type?: string | null;
      meal_start?: string | null;
      meal_end?: string | null;
    }>;
  };
  onSubmit: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export function WorkScheduleForm({
  schedule,
  onSubmit,
  isLoading = false,
}: WorkScheduleFormProps) {
  const [shiftId, setShiftId] = useState(schedule?.shift_id || "");
  const [shiftType, setShiftType] = useState(
    schedule?.shift_type || "Continuous shift"
  );
  const [description, setDescription] = useState(schedule?.description || "");
  const [timeframes, setTimeframes] = useState<Timeframe[]>(
    schedule?.work_schedule_timeframes
      ? schedule.work_schedule_timeframes
          .sort((a, b) => a.frame_order - b.frame_order)
          .map((tf) => ({
            id: tf.id,
            startTime: tf.start_time,
            endTime: tf.end_time,
            mealType: tf.meal_type || "paid",
            mealStart: tf.meal_start || "",
            mealEnd: tf.meal_end || "",
          }))
      : [{ startTime: "", endTime: "", mealType: "paid", mealStart: "", mealEnd: "" }]
  );
  const [overlapWarning, setOverlapWarning] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");
  const [timeframeErrors, setTimeframeErrors] = useState<string[]>([]);
  const [mealErrors, setMealErrors] = useState<string[]>([]);

  const normalizeInterval = (start: string, end: string) => {
    const [sH, sM] = start.split(":").map(Number);
    const [eH, eM] = end.split(":").map(Number);
    const s = sH * 60 + sM;
    let e = eH * 60 + eM;
    if (e < s) e += 24 * 60;
    return { start: s, end: e };
  };

  const durationInMinutes = (start: string, end: string) => {
    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    const startTotalMin = startHour * 60 + startMin;
    let endTotalMin = endHour * 60 + endMin;

    if (endTotalMin < startTotalMin) {
      endTotalMin += 24 * 60;
    }

    return endTotalMin - startTotalMin;
  };

  const mealWithinTimeframe = (tf: Timeframe) => {
    if (!tf.mealStart || !tf.mealEnd) return true;
    if (!tf.startTime || !tf.endTime) return false;

    const meal = normalizeInterval(tf.mealStart, tf.mealEnd);
    const frame = normalizeInterval(tf.startTime, tf.endTime);

    let mealStartAligned = meal.start;
    let mealEndAligned = meal.end;
    if (mealStartAligned < frame.start) {
      mealStartAligned += 24 * 60;
      mealEndAligned += 24 * 60;
    }

    return frame.start <= mealStartAligned && mealEndAligned <= frame.end;
  };

  // Calculate total shift hours
  const calculateShiftHours = () => {
    let totalMinutes = 0;
    for (const tf of timeframes) {
      if (tf.startTime && tf.endTime) {
        totalMinutes += durationInMinutes(tf.startTime, tf.endTime);
      }
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const calculateExpectedWorkHours = () => {
    let totalMinutes = 0;
    let unpaidMealMinutes = 0;

    for (const tf of timeframes) {
      if (tf.startTime && tf.endTime) {
        totalMinutes += durationInMinutes(tf.startTime, tf.endTime);
      }

      if (
        tf.mealType === "unpaid" &&
        tf.mealStart &&
        tf.mealEnd &&
        tf.startTime &&
        tf.endTime
      ) {
        unpaidMealMinutes += durationInMinutes(tf.mealStart, tf.mealEnd);
      }
    }

    const netMinutes = Math.max(0, totalMinutes - unpaidMealMinutes);
    const hours = Math.floor(netMinutes / 60);
    const minutes = netMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  // Check for overlapping timeframes
  const checkOverlap = () => {
    setOverlapWarning("");

    for (let i = 0; i < timeframes.length; i++) {
      for (let j = i + 1; j < timeframes.length; j++) {
        const tf1 = timeframes[i];
        const tf2 = timeframes[j];

        if (!tf1.startTime || !tf1.endTime || !tf2.startTime || !tf2.endTime) {
          continue;
        }

        const [start1Hour, start1Min] = tf1.startTime.split(":").map(Number);
        const [end1Hour, end1Min] = tf1.endTime.split(":").map(Number);
        const [start2Hour, start2Min] = tf2.startTime.split(":").map(Number);
        const [end2Hour, end2Min] = tf2.endTime.split(":").map(Number);

        const start1 = start1Hour * 60 + start1Min;
        let end1 = end1Hour * 60 + end1Min;
        const start2 = start2Hour * 60 + start2Min;
        let end2 = end2Hour * 60 + end2Min;

        // Handle midnight spans
        if (end1 < start1) end1 += 24 * 60;
        if (end2 < start2) end2 += 24 * 60;

        // Check overlap
        if (start1 < end2 && start2 < end1) {
          setOverlapWarning("Timeframes overlap detected!");
          return false;
        }
      }
    }

    return true;
  };

  // Validate that end time is later than start time
  const validateEndTimeAfterStartTime = () => {
    const errors: string[] = [];
    
    for (let i = 0; i < timeframes.length; i++) {
      const tf = timeframes[i];
      
      if (tf.startTime && tf.endTime) {
        const [startHour, startMin] = tf.startTime.split(":").map(Number);
        const [endHour, endMin] = tf.endTime.split(":").map(Number);
        
        const startTotalMin = startHour * 60 + startMin;
        const endTotalMin = endHour * 60 + endMin;
        
        // Check if end time is after start time (allowing midnight span)
        if (endTotalMin <= startTotalMin) {
          errors[i] = "End time must be later than start time";
        }
      }
    }
    
    setTimeframeErrors(errors);
    return errors.filter(Boolean).length === 0;
  };

  const validateMeals = () => {
    const errors: string[] = [];

    timeframes.forEach((tf, index) => {
      if (!tf.mealType) {
        errors[index] = "Meal type is required";
        return;
      }

      if (!tf.mealStart && !tf.mealEnd) return;

      if (!tf.mealStart || !tf.mealEnd) {
        errors[index] = "Both meal start and end are required if one is set";
        return;
      }

      const meal = normalizeInterval(tf.mealStart, tf.mealEnd);
      if (meal.end <= meal.start) {
        errors[index] = "Meal end must be later than meal start";
        return;
      }

      if (!mealWithinTimeframe(tf)) {
        errors[index] = "Meal timeframe must be inside this shift timeframe";
      }
    });

    setMealErrors(errors);
    return errors.filter(Boolean).length === 0;
  };

  useEffect(() => {
    checkOverlap();
    validateEndTimeAfterStartTime();
    validateMeals();
  }, [timeframes]);

  const addTimeframe = () => {
    if (timeframes.length < 5) {
      setTimeframes([
        ...timeframes,
        { startTime: "", endTime: "", mealType: "paid", mealStart: "", mealEnd: "" },
      ]);
    }
  };

  const removeTimeframe = (index: number) => {
    if (timeframes.length > 1) {
      setTimeframes(timeframes.filter((_, i) => i !== index));
    }
  };

  const updateTimeframe = (
    index: number,
    field: "startTime" | "endTime" | "mealType" | "mealStart" | "mealEnd",
    value: string
  ) => {
    const newTimeframes = [...timeframes];
    newTimeframes[index][field] = value;
    setTimeframes(newTimeframes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    // Validation
    if (!shiftId.trim()) {
      setSubmitError("Shift ID is required");
      return;
    }

    if (timeframes.some((tf) => !tf.startTime || !tf.endTime)) {
      setSubmitError("All timeframe fields are required");
      return;
    }

    if (!validateEndTimeAfterStartTime()) {
      setSubmitError("End time must be later than start time for all timeframes");
      return;
    }

    if (!checkOverlap()) {
      setSubmitError("Cannot submit with overlapping timeframes");
      return;
    }

    if (!validateMeals()) {
      setSubmitError("Meal validation failed");
      return;
    }

    try {
      await onSubmit({
        shiftId,
        shiftType,
        description: description.trim() || null,
        timeframes: timeframes.map((tf) => ({
          startTime: tf.startTime,
          endTime: tf.endTime,
          mealType: tf.mealType,
          mealStart: tf.mealStart || null,
          mealEnd: tf.mealEnd || null,
        })),
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to save schedule"
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {overlapWarning && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{overlapWarning}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="shift-id">Shift ID</Label>
        <Input
          id="shift-id"
          value={shiftId}
          onChange={(e) => setShiftId(e.target.value)}
          placeholder="e.g., SHIFT001"
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a short note"
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="shift-type">Shift Type</Label>
        <Select value={shiftType} onValueChange={setShiftType} disabled={isLoading}>
          <SelectTrigger id="shift-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Continuous shift">Continuous shift</SelectItem>
            <SelectItem value="Split shift">Split shift</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timeframes */}
      <div className="space-y-4">
        <h3 className="font-semibold">Time Frames</h3>

        {timeframes.map((timeframe, index) => (
          <Card key={index} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">
                Time Frame {index + 1}
                {index === 0 && <span className="text-gray-500 text-xs ml-2">(Required)</span>}
              </h4>
              {index > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTimeframe(index)}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`start-${index}`}>Start Time</Label>
                <Input
                  id={`start-${index}`}
                  type="time"
                  value={timeframe.startTime}
                  onChange={(e) =>
                    updateTimeframe(index, "startTime", e.target.value)
                  }
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`end-${index}`}>End Time</Label>
                <Input
                  id={`end-${index}`}
                  type="time"
                  value={timeframe.endTime}
                  onChange={(e) =>
                    updateTimeframe(index, "endTime", e.target.value)
                  }
                  disabled={isLoading}
                  className={timeframeErrors[index] ? "border-red-500" : ""}
                />
              </div>
            </div>
            {timeframeErrors[index] && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{timeframeErrors[index]}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3">
                <Label htmlFor={`meal-type-${index}`} className="whitespace-nowrap">
                  Meal
                </Label>
                <Select
                  value={timeframe.mealType}
                  onValueChange={(val) => updateTimeframe(index, "mealType", val)}
                  disabled={isLoading}
                >
                  <SelectTrigger id={`meal-type-${index}`} className="w-44">
                    <SelectValue placeholder="Select meal type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`meal-start-${index}`}>Shift meal start</Label>
                  <div className="relative">
                    <Input
                      id={`meal-start-${index}`}
                      type="time"
                      value={timeframe.mealStart}
                      onChange={(e) => updateTimeframe(index, "mealStart", e.target.value)}
                      disabled={isLoading}
                      className="pr-8"
                    />
                    {timeframe.mealStart && (
                      <button
                        type="button"
                        onClick={() => updateTimeframe(index, "mealStart", "")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        disabled={isLoading}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`meal-end-${index}`}>Shift meal end</Label>
                  <div className="relative">
                    <Input
                      id={`meal-end-${index}`}
                      type="time"
                      value={timeframe.mealEnd}
                      onChange={(e) => updateTimeframe(index, "mealEnd", e.target.value)}
                      disabled={isLoading}
                      className="pr-8"
                    />
                    {timeframe.mealEnd && (
                      <button
                        type="button"
                        onClick={() => updateTimeframe(index, "mealEnd", "")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        disabled={isLoading}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {mealErrors[index] && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{mealErrors[index]}</AlertDescription>
                </Alert>
              )}
            </div>
          </Card>
        ))}

        {shiftType === "Split shift" && timeframes.length < 5 && (
          <Button
            type="button"
            variant="outline"
            onClick={addTimeframe}
            disabled={isLoading}
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Timeframe (Split Shift)
          </Button>
        )}

        {timeframes.length >= 5 && (
          <p className="text-sm text-gray-500">Maximum 5 timeframes reached</p>
        )}
      </div>

      {/* Shift Hours */}
      <div className="space-y-2">
        <Label htmlFor="shift-hours">Total Shift Hours</Label>
        <Input
          id="shift-hours"
          value={calculateShiftHours()}
          readOnly
          className="bg-gray-50"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="expected-hours">Expected Work Hours</Label>
        <Input
          id="expected-hours"
          value={calculateExpectedWorkHours()}
          readOnly
          className="bg-gray-50"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? "Saving..." : "Save Schedule"}
        </Button>
      </div>
    </form>
  );
}
