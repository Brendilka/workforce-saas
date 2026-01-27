"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Calendar as CalendarIcon, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface TimeFrame {
  start_time: string;
  end_time: string;
}

interface PatternRow {
  id: string;
  number: number;
  monday: TimeFrame[];
  tuesday: TimeFrame[];
  wednesday: TimeFrame[];
  thursday: TimeFrame[];
  friday: TimeFrame[];
  saturday: TimeFrame[];
  sunday: TimeFrame[];
}

interface TimeFrame {
  start_time: string;
  end_time: string;
  meal_type?: string | null;
  meal_start?: string | null;
  meal_end?: string | null;
  frame_order: number;
}

interface WorkSchedule {
  id: string;
  shift_id: string;
  shift_type: string;
  created_at: string;
  work_schedule_timeframes: TimeFrame[];
}

export function RosterPatternsClient() {
  const [showForm, setShowForm] = useState(false);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [shiftId, setShiftId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDateType, setEndDateType] = useState<"specify" | "continuous">("continuous");
  const [endDate, setEndDate] = useState("");
  const [weeksPattern, setWeeksPattern] = useState("1");
  const [startPatternWeek, setStartPatternWeek] = useState("1");
  const [patternRows, setPatternRows] = useState<PatternRow[]>([
    {
      id: "1",
      number: 1,
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    },
  ]);

  const supabase = createClient();

  useEffect(() => {
    console.log("Component mounted, loading work schedules...");
    loadWorkSchedules();
  }, []);

  const loadWorkSchedules = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/work-schedules");
      if (!response.ok) throw new Error("Failed to fetch schedules");
      const data = await response.json();
      console.log("Loaded work schedules:", data);
      console.log("Number of schedules:", data?.length);
      setWorkSchedules(data || []);
    } catch (error) {
      console.error("Error loading work schedules:", error);
    } finally {
      setLoading(false);
    }
  };

  const addPatternRow = () => {
    const newNumber = patternRows.length + 1;
    setPatternRows([
      ...patternRows,
      {
        id: Date.now().toString(),
        number: newNumber,
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      },
    ]);
  };

  const removePatternRow = (id: string) => {
    if (patternRows.length > 1) {
      const filtered = patternRows.filter((row) => row.id !== id);
      // Renumber the rows
      const renumbered = filtered.map((row, idx) => ({
        ...row,
        number: idx + 1,
      }));
      setPatternRows(renumbered);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement save logic
    console.log("Saving roster pattern:", {
      shiftId,
      startDate,
      endDateType,
      endDate,
      weeksPattern,
      startPatternWeek,
      patternRows,
    });
  };

  return (
    <>
      {!showForm ? (
        <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
          <Button
            onClick={() => setShowForm(true)}
            size="lg"
            className="gap-2"
          >
            <Plus className="h-5 w-5" />
            Add Roster Pattern
          </Button>
        </div>
      ) : (
        <div className="flex gap-6 h-[calc(100vh-12rem)]">
          {/* Main Content Area - Left */}
          <div className="flex-1 overflow-auto">
          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="border-2 border-gray-900 p-6">
                <h2 className="text-2xl font-bold mb-6">Work Schedule Pattern</h2>

                {/* Shift ID and Dates Row */}
                <div className="grid grid-cols-3 gap-6 mb-6">
                  <div>
                    <Label htmlFor="shiftId" className="text-base font-semibold mb-2">
                      Shift ID
                    </Label>
                    <Input
                      id="shiftId"
                      value={shiftId}
                      onChange={(e) => setShiftId(e.target.value)}
                      className="border-2 border-gray-900"
                      required
                    />
                  </div>

                  <div className="relative">
                    <Label htmlFor="startDate" className="text-base font-semibold mb-2">
                      Start Date
                    </Label>
                    <div className="relative">
                      <Input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="border-2 border-gray-900 pr-10"
                        required
                      />
                      <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-pink-500 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <Label className="text-base font-semibold mb-2 block">End Date</Label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="specifyDate"
                          checked={endDateType === "specify"}
                          onChange={(e) =>
                            setEndDateType(e.target.checked ? "specify" : "continuous")
                          }
                          className="w-5 h-5 border-2 border-gray-900"
                        />
                        <Label htmlFor="specifyDate" className="cursor-pointer">
                          Specify date
                        </Label>
                      </div>
                      {endDateType === "specify" && (
                        <div className="relative">
                          <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="border-2 border-gray-900 pr-10"
                            placeholder="DD/MM/YYYY"
                          />
                          <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-pink-500 pointer-events-none" />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="continuous"
                          checked={endDateType === "continuous"}
                          onChange={(e) =>
                            setEndDateType(e.target.checked ? "continuous" : "specify")
                          }
                          className="w-5 h-5 border-2 border-gray-900"
                        />
                        <Label htmlFor="continuous" className="cursor-pointer">
                          Contiunually
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pattern Configuration Row */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <Label htmlFor="weeksPattern" className="text-base font-semibold mb-2">
                      Define Pattern for Week(s)
                    </Label>
                    <Input
                      id="weeksPattern"
                      type="number"
                      min="1"
                      value={weeksPattern}
                      onChange={(e) => setWeeksPattern(e.target.value)}
                      className="border-2 border-gray-900 w-32"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="startPatternWeek" className="text-base font-semibold mb-2">
                      Start Pattern on week
                    </Label>
                    <div className="text-sm text-gray-600 mb-1">
                      (If more than 1 week shift cycle)
                    </div>
                    <Input
                      id="startPatternWeek"
                      type="number"
                      min="1"
                      value={startPatternWeek}
                      onChange={(e) => setStartPatternWeek(e.target.value)}
                      className="border-2 border-gray-900 w-32"
                      required
                    />
                  </div>
                </div>

                {/* Pattern Table */}
                <div className="border-2 border-gray-900">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-900">
                        <th className="border-r-2 border-gray-900 p-3 text-left font-semibold">
                          No:
                        </th>
                        <th className="border-r-2 border-gray-900 p-3 font-semibold">
                          Monday
                        </th>
                        <th className="border-r-2 border-gray-900 p-3 font-semibold">
                          Tuesday
                        </th>
                        <th className="border-r-2 border-gray-900 p-3 font-semibold">
                          Wednesday
                        </th>
                        <th className="border-r-2 border-gray-900 p-3 font-semibold">
                          Thursday
                        </th>
                        <th className="border-r-2 border-gray-900 p-3 font-semibold">
                          Friday
                        </th>
                        <th className="border-r-2 border-gray-900 p-3 font-semibold">
                          Saturday
                        </th>
                        <th className="p-3 font-semibold">Sunday</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patternRows.map((row) => (
                        <tr key={row.id} className="border-b border-gray-900">
                          <td className="border-r-2 border-gray-900 p-3">
                            {row.number}
                          </td>
                          <td className="border-r-2 border-gray-900 p-3"></td>
                          <td className="border-r-2 border-gray-900 p-3"></td>
                          <td className="border-r-2 border-gray-900 p-3"></td>
                          <td className="border-r-2 border-gray-900 p-3"></td>
                          <td className="border-r-2 border-gray-900 p-3"></td>
                          <td className="border-r-2 border-gray-900 p-3"></td>
                          <td className="p-3"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Add/Remove Row Buttons */}
                  <div className="flex gap-2 p-3 border-t-2 border-gray-900 bg-gray-50">
                    <Button
                      type="button"
                      onClick={addPatternRow}
                      variant="outline"
                      size="sm"
                      className="gap-1"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    {patternRows.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removePatternRow(patternRows[patternRows.length - 1].id)}
                        variant="outline"
                        size="sm"
                        className="gap-1"
                      >
                        <Plus className="h-4 w-4 rotate-45" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex gap-4 mt-6">
                  <Button type="submit" size="lg">
                    Save Pattern
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </Card>
          </div>

          {/* Saved Work Schedules List - Right */}
          <div className="w-96 border-l pl-6">
        <div className="sticky top-0">
          <h3 className="text-lg font-semibold mb-4">Saved Work Schedules</h3>
          <div className="space-y-3 max-h-[calc(100vh-14rem)] overflow-y-auto pr-2">
            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : workSchedules.length === 0 ? (
              <p className="text-sm text-gray-500">No work schedules saved yet.</p>
            ) : (
              workSchedules.map((schedule) => {
                const timeframes = schedule.work_schedule_timeframes?.sort(
                  (a, b) => a.frame_order - b.frame_order
                ) || [];
                
                const calculateTotalHours = () => {
                  let totalMinutes = 0;
                  timeframes.forEach((tf) => {
                    const [startHour, startMin] = tf.start_time.split(':').map(Number);
                    const [endHour, endMin] = tf.end_time.split(':').map(Number);
                    const startMinutes = startHour * 60 + startMin;
                    const endMinutes = endHour * 60 + endMin;
                    totalMinutes += endMinutes - startMinutes;
                    
                    // Subtract meal time if unpaid
                    if (tf.meal_type === 'unpaid' && tf.meal_start && tf.meal_end) {
                      const [mealStartHour, mealStartMin] = tf.meal_start.split(':').map(Number);
                      const [mealEndHour, mealEndMin] = tf.meal_end.split(':').map(Number);
                      const mealStartMinutes = mealStartHour * 60 + mealStartMin;
                      const mealEndMinutes = mealEndHour * 60 + mealEndMin;
                      totalMinutes -= (mealEndMinutes - mealStartMinutes);
                    }
                  });
                  const hours = Math.floor(totalMinutes / 60);
                  const minutes = totalMinutes % 60;
                  return `${hours}h ${minutes}m`;
                };

                return (
                  <Card
                    key={schedule.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="font-bold text-base mb-2">{schedule.shift_id}</div>
                    <div className="text-sm text-gray-600 mb-2">
                      Type: {schedule.shift_type}
                    </div>
                    
                    {timeframes.map((tf, idx) => (
                      <div key={idx} className="text-sm mb-2">
                        <div className="font-medium">
                          Time Frame {idx + 1}: {tf.start_time.slice(0, 5)} - {tf.end_time.slice(0, 5)}
                        </div>
                        {tf.meal_start && tf.meal_end && (
                          <div className="text-xs text-gray-600 ml-2">
                            Meal ({tf.meal_type || 'paid'}): {tf.meal_start.slice(0, 5)} - {tf.meal_end.slice(0, 5)}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <div className="font-semibold text-sm mt-2 pt-2 border-t">
                      Total Hours: {calculateTotalHours()}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
          </div>
        </div>
      )}
    </>
  );
}
