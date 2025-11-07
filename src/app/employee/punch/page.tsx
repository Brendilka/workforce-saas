"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut, Timer } from "lucide-react";
import { format } from "date-fns";

// Mock user data
const MOCK_USER = {
  name: "John Doe",
  initials: "JD",
  role: "employee" as const,
};

// Mock punch data
const MOCK_PUNCHES = [
  { id: "1", type: "in", time: "08:02:15", date: "2025-01-27" },
  { id: "2", type: "out", time: "16:05:32", date: "2025-01-27" },
  { id: "3", type: "in", time: "08:15:08", date: "2025-01-28" },
  { id: "4", type: "out", time: "16:00:45", date: "2025-01-28" },
];

export default function PunchPage() {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const [isLoading, setIsLoading] = useState(false);

  // Update elapsed time every second
  useEffect(() => {
    if (!isClockedIn || !clockInTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = now.getTime() - clockInTime.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsedTime(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isClockedIn, clockInTime]);

  const handleClockIn = async () => {
    setIsLoading(true);
    // TODO: API call to clock in
    await new Promise((resolve) => setTimeout(resolve, 500));

    setIsClockedIn(true);
    setClockInTime(new Date());
    setIsLoading(false);
  };

  const handleClockOut = async () => {
    setIsLoading(true);
    // TODO: API call to clock out
    await new Promise((resolve) => setTimeout(resolve, 500));

    setIsClockedIn(false);
    setClockInTime(null);
    setElapsedTime("00:00:00");
    setIsLoading(false);
  };

  return (
    <DashboardLayout
      userRole={MOCK_USER.role}
      userName={MOCK_USER.name}
      userInitials={MOCK_USER.initials}
    >
      <PageHeader
        title="Clock In / Out & Punch"
        description="Track your work hours with time clock"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clock In/Out Card */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              {/* Status Badge */}
              <Badge
                variant={isClockedIn ? "success" : "outline"}
                className="mb-4 px-4 py-2 text-base"
              >
                {isClockedIn ? (
                  <>
                    <Timer className="h-4 w-4 mr-2" />
                    Clocked In
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Not Clocked In
                  </>
                )}
              </Badge>

              {/* Current Time */}
              <div className="text-5xl font-bold text-primary mb-2">
                {format(new Date(), "HH:mm:ss")}
              </div>
              <div className="text-muted-foreground mb-8">
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </div>

              {/* Elapsed Time (if clocked in) */}
              {isClockedIn && (
                <div className="mb-8 text-center">
                  <p className="text-sm text-muted-foreground mb-1">
                    Time worked today
                  </p>
                  <div className="text-3xl font-bold text-employee">
                    {elapsedTime}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Clocked in at {clockInTime && format(clockInTime, "h:mm a")}
                  </p>
                </div>
              )}

              {/* Clock In/Out Button */}
              <Button
                size="lg"
                onClick={isClockedIn ? handleClockOut : handleClockIn}
                disabled={isLoading}
                className={`h-16 px-12 text-lg font-bold ${
                  isClockedIn
                    ? "bg-destructive hover:bg-destructive/90"
                    : "bg-success hover:bg-success/90"
                }`}
              >
                {isLoading ? (
                  "Processing..."
                ) : isClockedIn ? (
                  <>
                    <LogOut className="h-5 w-5 mr-2" />
                    Clock Out
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5 mr-2" />
                    Clock In
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Today's Punches */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Punches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MOCK_PUNCHES.filter(
                (p) => p.date === format(new Date(), "yyyy-MM-dd")
              ).map((punch) => (
                <div
                  key={punch.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {punch.type === "in" ? (
                      <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                        <LogIn className="h-5 w-5 text-success" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                        <LogOut className="h-5 w-5 text-destructive" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">
                        {punch.type === "in" ? "Clock In" : "Clock Out"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {punch.time}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {format(new Date(`2000-01-01 ${punch.time}`), "h:mm a")}
                  </Badge>
                </div>
              ))}

              {MOCK_PUNCHES.filter(
                (p) => p.date === format(new Date(), "yyyy-MM-dd")
              ).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No punches recorded today
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Punch History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {MOCK_PUNCHES.slice(0, 4).map((punch) => (
                <div
                  key={punch.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {punch.type === "in" ? (
                      <LogIn className="h-4 w-4 text-success" />
                    ) : (
                      <LogOut className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-sm capitalize">{punch.type}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{punch.time}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(punch.date), "MMM d")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
