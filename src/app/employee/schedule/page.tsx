"use client";

import { use, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek } from "date-fns";

// This will be replaced with actual user data
const MOCK_USER = {
  name: "John Doe",
  initials: "JD",
  role: "employee" as const,
};

// Mock schedule data - replace with API calls
const MOCK_SCHEDULE = [
  { date: "2025-01-27", shift_type: "day", start: "08:00", end: "16:00" },
  { date: "2025-01-28", shift_type: "day", start: "08:00", end: "16:00" },
  { date: "2025-01-29", shift_type: "night", start: "20:00", end: "04:00" },
  { date: "2025-01-30", shift_type: "leave", start: "", end: "" },
];

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleData, setScheduleData] = useState<any[]>([]);

  useEffect(() => {
    // TODO: Fetch schedule data from API
    setScheduleData(MOCK_SCHEDULE);
  }, [currentDate]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const previousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  };

  const getShiftForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return scheduleData.find((s) => s.date === dateStr);
  };

  const getShiftColor = (shiftType: string) => {
    switch (shiftType) {
      case "day":
        return "bg-shift-day";
      case "night":
        return "bg-shift-night";
      case "leave":
        return "bg-shift-leave";
      default:
        return "bg-gray-200";
    }
  };

  return (
    <DashboardLayout
      userRole={MOCK_USER.role}
      userName={MOCK_USER.name}
      userInitials={MOCK_USER.initials}
    >
      <PageHeader
        title="My Schedule"
        description="View your upcoming shifts and work schedule"
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-6 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-shift-day"></div>
          <span className="text-sm">Day Shift</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-shift-night"></div>
          <span className="text-sm">Night Shift</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-shift-leave"></div>
          <span className="text-sm">Day Off / Leave</span>
        </div>
      </div>

      {/* Calendar */}
      <Card className="p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={previousMonth}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>

          <h2 className="text-xl font-semibold text-primary">
            {format(currentDate, "MMMM yyyy")}
          </h2>

          <Button
            variant="outline"
            size="sm"
            onClick={nextMonth}
            className="gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Day Headers */}
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="text-center font-bold text-sm text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}

          {/* Calendar Days */}
          {calendarDays.map((day) => {
            const shift = getShiftForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[100px] p-2 border rounded-lg transition-colors ${
                  isCurrentMonth ? "bg-white" : "bg-gray-50"
                } ${
                  isCurrentDay ? "border-employee border-2" : "border-border"
                } hover:shadow-sm`}
              >
                <div
                  className={`text-sm font-medium mb-1 ${
                    isCurrentMonth ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  {format(day, "d")}
                </div>

                {shift && isCurrentMonth && (
                  <div
                    className={`${getShiftColor(
                      shift.shift_type
                    )} text-white text-xs rounded px-2 py-1 truncate`}
                  >
                    {shift.shift_type === "leave"
                      ? "Day Off"
                      : `${shift.start} - ${shift.end}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </DashboardLayout>
  );
}
