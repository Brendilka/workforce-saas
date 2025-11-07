"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from "date-fns";

// Mock user data
const MOCK_USER = {
  name: "John Doe",
  initials: "JD",
  role: "employee" as const,
};

// Mock timecard data
const MOCK_TIMECARD = [
  {
    date: "2025-01-27",
    clockIn: "08:02",
    clockOut: "16:05",
    hoursWorked: 8.05,
    status: "approved",
  },
  {
    date: "2025-01-28",
    clockIn: "08:15",
    clockOut: "16:00",
    hoursWorked: 7.75,
    status: "exception",
  },
  {
    date: "2025-01-29",
    clockIn: "07:58",
    clockOut: "16:10",
    hoursWorked: 8.2,
    status: "approved",
  },
  {
    date: "2025-01-30",
    clockIn: "08:00",
    clockOut: "16:00",
    hoursWorked: 8.0,
    status: "pending",
  },
];

export default function TimecardPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const weekStart = startOfWeek(currentWeek);
  const weekEnd = endOfWeek(currentWeek);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const totalHours = MOCK_TIMECARD.reduce((sum, entry) => sum + entry.hoursWorked, 0);
  const regularHours = Math.min(totalHours, 40);
  const overtimeHours = Math.max(totalHours - 40, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="success">Approved</Badge>;
      case "pending":
        return <Badge variant="warning">Pending</Badge>;
      case "exception":
        return <Badge variant="destructive">Exception</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-5 w-5 text-success" />;
      case "exception":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout
      userRole={MOCK_USER.role}
      userName={MOCK_USER.name}
      userInitials={MOCK_USER.initials}
    >
      <PageHeader
        title="My Timecard"
        description="View your clock-in/out times and hours worked"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">
              Total Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalHours.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">
              Regular Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{regularHours.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Up to 40 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">
              Overtime Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overtimeHours.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Over 40 hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Timecard Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous Week
            </Button>

            <CardTitle>
              {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
            </CardTitle>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            >
              Next Week
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-sm">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">Clock In</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">Clock Out</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_TIMECARD.map((entry) => (
                  <tr key={entry.date} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium">
                        {format(new Date(entry.date), "EEE, MMM d")}
                      </div>
                    </td>
                    <td className="py-3 px-4">{entry.clockIn}</td>
                    <td className="py-3 px-4">{entry.clockOut}</td>
                    <td className="py-3 px-4 font-medium">
                      {entry.hoursWorked.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(entry.status)}
                        {getStatusBadge(entry.status)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {MOCK_TIMECARD.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No timecard entries for this week
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
