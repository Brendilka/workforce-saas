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

// Parse hour input: accepts "0-23", "9p", "9pm", "8a", "8am"
// Returns hour in 24h format (00-23) as string, or empty if invalid
function parseHourInput(input: string): string {
  if (!input.trim()) return "";
  
  const normalized = input.trim().toLowerCase();
  
  // Check for 12-hour format with am/pm (e.g., "9p", "9pm", "8a", "8am")
  const match12h = normalized.match(/^(\d{1,2})\s*([ap])(?:m)?$/);
  if (match12h) {
    let hour = parseInt(match12h[1]);
    const meridiem = match12h[2];
    
    // Validate hour for 12h format
    if (hour < 1 || hour > 12) return "";
    
    // Convert to 24h format
    if (meridiem === "p" && hour !== 12) {
      hour += 12;
    } else if (meridiem === "a" && hour === 12) {
      hour = 0;
    }
    
    return String(hour).padStart(2, "0");
  }
  
  // Check for 24-hour format (0-23)
  const match24h = normalized.match(/^(\d{1,2})$/);
  if (match24h) {
    const hour = parseInt(match24h[1]);
    if (hour < 0 || hour > 23) return "";
    return String(hour).padStart(2, "0");
  }
  
  return "";
}

// Parse minute input: accepts "0-59"
function parseMinuteInput(input: string): string {
  if (!input.trim()) return "";
  
  const normalized = input.trim();
  const match = normalized.match(/^(\d{1,2})$/);
  
  if (match) {
    const minute = parseInt(match[1]);
    if (minute < 0 || minute > 59) return "";
    return String(minute).padStart(2, "0");
  }
  
  return "";
}

interface HourInputProps {
  id: string;
  value: string; // hour in 24h format (00-23)
  onChange: (hour: string) => void;
  disabled?: boolean;
}

function HourInput({ id, value, onChange, disabled = false }: HourInputProps) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;
    
    // Remove non-alphanumeric characters except a/p
    input = input.replace(/[^0-9ap]/gi, "");
    
    const numericPart = input.replace(/[ap]/gi, "");
    const letterPart = input.match(/[ap]/gi)?.[0] || "";
    
    // If more than 2 numeric digits, shift left (remove first, keep last 2)
    let finalNumeric = numericPart;
    if (numericPart.length > 2) {
      finalNumeric = numericPart.slice(1); // Remove first digit, keep rest
    }
    
    // Check bounds for numeric-only input (no a/p)
    if (!letterPart && finalNumeric.length === 2) {
      const hourVal = parseInt(finalNumeric);
      if (hourVal > 23) {
        // Don't allow the change
        return;
      }
    }
    
    input = finalNumeric + letterPart;
    
    const parsed = parseHourInput(input);
    if (parsed) {
      // If user typed with a/p meridiem, display the converted 24-hour format
      if (letterPart) {
        setDisplayValue(parsed.split(":")[0]); // Show just the hour part (13, 14, etc)
      } else {
        setDisplayValue(input); // Show numeric input as-is
      }
      onChange(parsed);
    } else if (input === "") {
      setDisplayValue("");
      onChange("");
    } else {
      // Invalid input, show what user typed
      setDisplayValue(input);
    }
  };

  const handleBlur = () => {
    if (!displayValue.trim()) {
      setDisplayValue("");
      onChange("");
      return;
    }
    
    const parsed = parseHourInput(displayValue);
    if (parsed) {
      setDisplayValue(parsed);
      onChange(parsed);
    } else {
      setDisplayValue(value === "00" ? "" : value);
    }
  };

  return (
    <Input
      id={id}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder="hh"
      className="font-mono text-center placeholder:text-gray-400"
    />
  );
}

interface MinuteInputProps {
  id: string;
  value: string; // minute (00-59)
  onChange: (minute: string) => void;
  disabled?: boolean;
}

function MinuteInput({ id, value, onChange, disabled = false }: MinuteInputProps) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;
    
    // Remove non-numeric characters
    input = input.replace(/[^0-9]/g, "");
    
    // If more than 2 digits, shift left (remove first, keep last 2)
    if (input.length > 2) {
      input = input.slice(1); // Remove first digit, keep rest
    }
    
    // Check bounds
    if (input.length === 2) {
      const minVal = parseInt(input);
      if (minVal > 59) {
        // Don't allow the change
        return;
      }
    }
    
    setDisplayValue(input);
    
    const parsed = parseMinuteInput(input);
    if (parsed) {
      onChange(parsed);
    } else if (input === "") {
      onChange("");
    }
  };

  const handleBlur = () => {
    if (!displayValue.trim()) {
      setDisplayValue("");
      onChange("");
      return;
    }
    
    const parsed = parseMinuteInput(displayValue);
    if (parsed) {
      setDisplayValue(parsed);
      onChange(parsed);
    } else {
      setDisplayValue(value === "00" ? "" : value);
    }
  };

  return (
    <Input
      id={id}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder="mm"
      className="font-mono text-center placeholder:text-gray-400"
    />
  );
}

// Parse time input: accepts "HH:MM", "H:MM", "9p", "9pm", "21", "9a", etc.
// Returns time in "HH:MM" format or empty string if invalid
function parseTimeInput(input: string): string {
  if (!input.trim()) return "";
  
  const normalized = input.trim().toLowerCase();
  
  // Check for 12-hour format with am/pm (e.g., "9p", "9pm", "9a", "9am")
  const match12h = normalized.match(/^(\d{1,2})\s*([ap])(?:m)?$/);
  if (match12h) {
    let hour = parseInt(match12h[1]);
    const meridiem = match12h[2];
    
    // Validate hour for 12h format
    if (hour < 1 || hour > 12) return "";
    
    // Convert to 24h format
    if (meridiem === "p" && hour !== 12) {
      hour += 12;
    } else if (meridiem === "a" && hour === 12) {
      hour = 0;
    }
    
    return `${String(hour).padStart(2, "0")}:00`;
  }
  
  // Check for 24-hour format (e.g., "9", "09", "21", "9:30", "09:30")
  const match24h = normalized.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (match24h) {
    const hour = parseInt(match24h[1]);
    const minute = match24h[2] ? parseInt(match24h[2]) : 0;
    
    if (hour < 0 || hour > 23) return "";
    if (minute < 0 || minute > 59) return "";
    
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  
  return "";
}

interface TimeInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function TimeInput({ id, value, onChange, disabled = false }: TimeInputProps) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setDisplayValue(input);
    
    const parsed = parseTimeInput(input);
    if (parsed) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseTimeInput(displayValue);
    if (parsed) {
      setDisplayValue(parsed);
      onChange(parsed);
    } else {
      setDisplayValue(value);
    }
  };

  return (
    <Input
      id={id}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder="e.g., 9, 9p, 9am, 21:30"
      className="font-mono"
    />
  );
}

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
      : [{ startTime: ":", endTime: ":", mealType: "paid", mealStart: ":", mealEnd: ":" }]
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
      
      // Only validate if both times have actual values (not empty or just ":")
      if (tf.startTime && tf.endTime && tf.startTime !== ":" && tf.endTime !== ":") {
        const [startHour, startMin] = tf.startTime.split(":").map(Number);
        const [endHour, endMin] = tf.endTime.split(":").map(Number);
        
        // Skip if parsing resulted in NaN
        if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
          continue;
        }
        
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
      // Meals are optional - skip validation if both start and end are empty or just ":"
      const mealStartEmpty = !tf.mealStart || tf.mealStart === ":";
      const mealEndEmpty = !tf.mealEnd || tf.mealEnd === ":";

      // If both are empty, no validation needed (meals are optional)
      if (mealStartEmpty && mealEndEmpty) return;

      // If only one is set, that's an error
      if (mealStartEmpty || mealEndEmpty) {
        errors[index] = "Both meal start and end are required if one is set";
        return;
      }

      // Both are set, validate they have proper values
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

  // Validate end time vs start time in real-time
  useEffect(() => {
    validateEndTimeAfterStartTime();
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
    field: "startTime" | "endTime" | "mealType" | "mealStart" | "mealEnd" | "startTimeHour" | "startTimeMinute" | "endTimeHour" | "endTimeMinute" | "mealStartHour" | "mealStartMinute" | "mealEndHour" | "mealEndMinute",
    value: string
  ) => {
    const newTimeframes = [...timeframes];
    const tf = newTimeframes[index];
    
    if (field === "startTimeHour") {
      const [, min] = tf.startTime.split(":");
      tf.startTime = `${value || ""}:${min || ""}`;
    } else if (field === "startTimeMinute") {
      const [hour] = tf.startTime.split(":");
      tf.startTime = `${hour || ""}:${value || ""}`;
    } else if (field === "endTimeHour") {
      const [, min] = tf.endTime.split(":");
      tf.endTime = `${value || ""}:${min || ""}`;
    } else if (field === "endTimeMinute") {
      const [hour] = tf.endTime.split(":");
      tf.endTime = `${hour || ""}:${value || ""}`;
    } else if (field === "mealStartHour") {
      const [, min] = tf.mealStart.split(":");
      tf.mealStart = `${value || ""}:${min || ""}`;
    } else if (field === "mealStartMinute") {
      const [hour] = tf.mealStart.split(":");
      tf.mealStart = `${hour || ""}:${value || ""}`;
    } else if (field === "mealEndHour") {
      const [, min] = tf.mealEnd.split(":");
      tf.mealEnd = `${value || ""}:${min || ""}`;
    } else if (field === "mealEndMinute") {
      const [hour] = tf.mealEnd.split(":");
      tf.mealEnd = `${hour || ""}:${value || ""}`;
    } else {
      (tf as any)[field] = value;
    }
    
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

            <div className="space-y-3 pt-1">
              <div className="space-y-2">
                <Label>Shift Start</Label>
                <div className="flex items-center gap-2">
                  <HourInput
                    id={`start-hour-${index}`}
                    value={timeframe.startTime.split(":")[0] || ""}
                    onChange={(hour) => updateTimeframe(index, "startTimeHour", hour)}
                    disabled={isLoading}
                  />
                  <span className="text-xl font-semibold text-gray-400">:</span>
                  <MinuteInput
                    id={`start-min-${index}`}
                    value={timeframe.startTime.split(":")[1] || ""}
                    onChange={(min) => updateTimeframe(index, "startTimeMinute", min)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Shift End</Label>
                <div className="flex items-center gap-2">
                  <HourInput
                    id={`end-hour-${index}`}
                    value={timeframe.endTime.split(":")[0] || ""}
                    onChange={(hour) => updateTimeframe(index, "endTimeHour", hour)}
                    disabled={isLoading}
                  />
                  <span className="text-xl font-semibold text-gray-400">:</span>
                  <MinuteInput
                    id={`end-min-${index}`}
                    value={timeframe.endTime.split(":")[1] || ""}
                    onChange={(min) => updateTimeframe(index, "endTimeMinute", min)}
                    disabled={isLoading}
                  />
                </div>
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

              <div className="space-y-3 pt-1">
                <div className="space-y-2">
                  <Label>Shift Meal Start</Label>
                  <div className="flex items-center gap-2">
                    <HourInput
                      id={`meal-start-hour-${index}`}
                      value={timeframe.mealStart.split(":")[0] || ""}
                      onChange={(hour) => updateTimeframe(index, "mealStartHour", hour)}
                      disabled={isLoading}
                    />
                    <span className="text-xl font-semibold text-gray-400">:</span>
                    <MinuteInput
                      id={`meal-start-min-${index}`}
                      value={timeframe.mealStart.split(":")[1] || ""}
                      onChange={(min) => updateTimeframe(index, "mealStartMinute", min)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Shift Meal End</Label>
                  <div className="flex items-center gap-2">
                    <HourInput
                      id={`meal-end-hour-${index}`}
                      value={timeframe.mealEnd.split(":")[0] || ""}
                      onChange={(hour) => updateTimeframe(index, "mealEndHour", hour)}
                      disabled={isLoading}
                    />
                    <span className="text-xl font-semibold text-gray-400">:</span>
                    <MinuteInput
                      id={`meal-end-min-${index}`}
                      value={timeframe.mealEnd.split(":")[1] || ""}
                      onChange={(min) => updateTimeframe(index, "mealEndMinute", min)}
                      disabled={isLoading}
                    />
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
