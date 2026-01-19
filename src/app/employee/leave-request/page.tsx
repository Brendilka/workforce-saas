"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";

// Mock user data
const MOCK_USER = {
  name: "John Doe",
  initials: "JD",
  role: "employee" as const,
};

// Mock leave requests
const MOCK_REQUESTS = [
  {
    id: "1",
    type: "Annual Leave",
    startDate: "2025-02-10",
    endDate: "2025-02-14",
    days: 5,
    reason: "Family vacation",
    status: "approved",
    submittedDate: "2025-01-15",
  },
  {
    id: "2",
    type: "Sick Leave",
    startDate: "2025-01-20",
    endDate: "2025-01-20",
    days: 1,
    reason: "Medical appointment",
    status: "approved",
    submittedDate: "2025-01-19",
  },
  {
    id: "3",
    type: "Personal Leave",
    startDate: "2025-03-05",
    endDate: "2025-03-06",
    days: 2,
    reason: "Personal matters",
    status: "pending",
    submittedDate: "2025-01-25",
  },
];

export default function LeaveRequestPage() {
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Submit to API
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Reset form
    setLeaveType("");
    setStartDate("");
    setEndDate("");
    setReason("");
    setIsSubmitting(false);

    alert("Leave request submitted successfully!");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="warning" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout
      userRole={MOCK_USER.role}
      userName={MOCK_USER.name}
      userInitials={MOCK_USER.initials}
    >
      <PageHeader
        title="My Leave Request"
        description="Submit new leave requests and view request history"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Submit Leave Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="leaveType">Leave Type</Label>
                <Select
                  value={leaveType}
                  onValueChange={setLeaveType}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual Leave</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="personal">Personal Leave</SelectItem>
                    <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                    <SelectItem value="parental">Parental Leave</SelectItem>
                    <SelectItem value="bereavement">Bereavement Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    min={startDate}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide a brief reason for your leave request"
                  rows={4}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full"
                variant="secondary"
              >
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Request History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {MOCK_REQUESTS.map((request) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-sm">{request.type}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted {format(new Date(request.submittedDate), "MMM d, yyyy")}
                      </p>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(request.startDate), "MMM d")} -{" "}
                      {format(new Date(request.endDate), "MMM d, yyyy")}
                    </span>
                    <Badge variant="outline" className="ml-auto">
                      {request.days} {request.days === 1 ? "day" : "days"}
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-700 line-clamp-2">
                    {request.reason}
                  </p>
                </div>
              ))}

              {MOCK_REQUESTS.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No leave requests yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
