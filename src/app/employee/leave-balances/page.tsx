"use client";

import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Umbrella,
  Heart,
  Briefcase,
  AlertCircle,
  PlaneTakeoff,
} from "lucide-react";
import { format, addMonths } from "date-fns";

// Mock user data
const MOCK_USER = {
  name: "John Doe",
  initials: "JD",
  role: "employee" as const,
};

// Mock leave balances
const MOCK_BALANCES = [
  {
    id: "1",
    type: "Annual Leave",
    icon: Umbrella,
    allocated: 20,
    used: 8,
    remaining: 12,
    expiryDate: addMonths(new Date(), 3),
    color: "bg-blue-500",
    description: "Standard annual vacation days",
  },
  {
    id: "2",
    type: "Sick Leave",
    icon: Heart,
    allocated: 10,
    used: 2,
    remaining: 8,
    expiryDate: null,
    color: "bg-red-500",
    description: "Medical and health-related leave",
  },
  {
    id: "3",
    type: "Personal Leave",
    icon: Briefcase,
    allocated: 5,
    used: 1,
    remaining: 4,
    expiryDate: addMonths(new Date(), 6),
    color: "bg-purple-500",
    description: "Personal matters and emergencies",
  },
  {
    id: "4",
    type: "Floating Holidays",
    icon: CalendarDays,
    allocated: 3,
    used: 0,
    remaining: 3,
    expiryDate: addMonths(new Date(), 12),
    color: "bg-green-500",
    description: "Flexible holidays you can use anytime",
  },
];

export default function LeaveBalancesPage() {
  const totalAllocated = MOCK_BALANCES.reduce((sum, b) => sum + b.allocated, 0);
  const totalUsed = MOCK_BALANCES.reduce((sum, b) => sum + b.used, 0);
  const totalRemaining = MOCK_BALANCES.reduce((sum, b) => sum + b.remaining, 0);

  return (
    <DashboardLayout
      userRole={MOCK_USER.role}
      userName={MOCK_USER.name}
      userInitials={MOCK_USER.initials}
    >
      <div className="flex items-start justify-between mb-6">
        <PageHeader
          title="My Leave Balances"
          description="Track your available leave days across different types"
          className="mb-0"
        />
        <Link href="/employee/leave-request">
          <Button variant="secondary" className="gap-2">
            <PlaneTakeoff className="h-4 w-4" />
            Request Leave
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">
              Total Allocated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalAllocated}</div>
            <p className="text-xs text-muted-foreground mt-1">days per year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">
              Days Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUsed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {((totalUsed / totalAllocated) * 100).toFixed(0)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">
              Days Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {totalRemaining}
            </div>
            <p className="text-xs text-muted-foreground mt-1">available to use</p>
          </CardContent>
        </Card>
      </div>

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {MOCK_BALANCES.map((balance) => {
          const Icon = balance.icon;
          const usedPercentage = (balance.used / balance.allocated) * 100;
          const remainingPercentage = (balance.remaining / balance.allocated) * 100;

          return (
            <Card key={balance.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-12 w-12 rounded-lg ${balance.color} bg-opacity-10 flex items-center justify-center`}
                    >
                      <Icon className={`h-6 w-6 ${balance.color.replace("bg-", "text-")}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{balance.type}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {balance.description}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Usage</span>
                    <span className="font-medium">
                      {balance.used} / {balance.allocated} days
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${balance.color} transition-all duration-500`}
                      style={{ width: `${usedPercentage}%` }}
                    ></div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">{balance.allocated}</div>
                    <div className="text-xs text-muted-foreground">Allocated</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {balance.used}
                    </div>
                    <div className="text-xs text-muted-foreground">Used</div>
                  </div>
                  <div className="text-center p-3 bg-success/10 rounded-lg">
                    <div className="text-2xl font-bold text-success">
                      {balance.remaining}
                    </div>
                    <div className="text-xs text-muted-foreground">Remaining</div>
                  </div>
                </div>

                {/* Expiry Warning */}
                {balance.expiryDate && balance.remaining > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-medium text-warning">
                        {balance.remaining} {balance.remaining === 1 ? "day" : "days"}{" "}
                        will expire
                      </p>
                      <p className="text-muted-foreground mt-1">
                        Expiry Date: {format(balance.expiryDate, "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                )}

                {balance.remaining === 0 && (
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      No {balance.type.toLowerCase()} remaining for this period
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Policy Information */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Leave Policy Information</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-employee mt-1">•</span>
              <span>
                Annual leave must be requested at least 2 weeks in advance for
                approval.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-employee mt-1">•</span>
              <span>
                Unused annual leave may roll over up to 5 days to the next year.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-employee mt-1">•</span>
              <span>
                Sick leave can be used without prior notice but requires medical
                documentation for absences over 3 days.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-employee mt-1">•</span>
              <span>
                Floating holidays must be used within the calendar year and do not
                roll over.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
