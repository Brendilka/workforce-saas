"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// Mock user data
const MOCK_USER = {
  name: "John Doe",
  initials: "JD",
  role: "employee" as const,
};

// Mock notifications
const MOCK_NOTIFICATIONS = [
  {
    id: "1",
    type: "schedule",
    title: "Schedule Updated",
    message: "Your schedule for next week has been updated by your manager.",
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    read: false,
    priority: "normal",
  },
  {
    id: "2",
    type: "approval",
    title: "Leave Request Approved",
    message: "Your leave request for Feb 10-14 has been approved.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    read: false,
    priority: "high",
  },
  {
    id: "3",
    type: "alert",
    title: "Timecard Exception",
    message: "You clocked in 15 minutes late on Jan 28. Please provide a reason.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    read: true,
    priority: "high",
  },
  {
    id: "4",
    type: "info",
    title: "Training Module Available",
    message: "New safety training module is now available in your training portal.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    read: true,
    priority: "low",
  },
  {
    id: "5",
    type: "schedule",
    title: "Shift Swap Accepted",
    message: "Your shift swap request with Sarah Johnson has been accepted.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    read: true,
    priority: "normal",
  },
];

type NotificationFilter = "all" | "unread" | "schedule" | "approval" | "alert";

export default function NotificationsPage() {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const getIcon = (type: string) => {
    switch (type) {
      case "schedule":
        return <Calendar className="h-5 w-5 text-employee" />;
      case "approval":
        return <CheckCircle className="h-5 w-5 text-success" />;
      case "alert":
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case "info":
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, read: true }))
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === "all") return true;
    if (filter === "unread") return !notif.read;
    return notif.type === filter;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <DashboardLayout
      userRole={MOCK_USER.role}
      userName={MOCK_USER.name}
      userInitials={MOCK_USER.initials}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <PageHeader
            title="My Notifications"
            description="Stay updated with important alerts and messages"
            className="mb-0"
          />
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          variant={filter === "all" ? "secondary" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All
          <Badge variant="outline" className="ml-2">
            {notifications.length}
          </Badge>
        </Button>
        <Button
          variant={filter === "unread" ? "secondary" : "outline"}
          size="sm"
          onClick={() => setFilter("unread")}
        >
          Unread
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount}
            </Badge>
          )}
        </Button>
        <Button
          variant={filter === "schedule" ? "secondary" : "outline"}
          size="sm"
          onClick={() => setFilter("schedule")}
        >
          <Calendar className="h-4 w-4 mr-1" />
          Schedule
        </Button>
        <Button
          variant={filter === "approval" ? "secondary" : "outline"}
          size="sm"
          onClick={() => setFilter("approval")}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Approvals
        </Button>
        <Button
          variant={filter === "alert" ? "secondary" : "outline"}
          size="sm"
          onClick={() => setFilter("alert")}
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Alerts
        </Button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.map((notification) => (
          <Card
            key={notification.id}
            className={`p-4 transition-all hover:shadow-md ${
              !notification.read ? "border-l-4 border-l-employee bg-blue-50/30" : ""
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="mt-1">{getIcon(notification.type)}</div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    {notification.title}
                    {!notification.read && (
                      <span className="h-2 w-2 rounded-full bg-employee"></span>
                    )}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => deleteNotification(notification.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <p className="text-sm text-gray-700 mb-2">
                  {notification.message}
                </p>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(notification.timestamp, {
                      addSuffix: true,
                    })}
                  </span>
                  {!notification.read && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => markAsRead(notification.id)}
                    >
                      Mark as read
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}

        {filteredNotifications.length === 0 && (
          <Card className="p-12">
            <div className="text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No notifications</p>
              <p className="text-sm">
                {filter === "all"
                  ? "You're all caught up!"
                  : `No ${filter} notifications`}
              </p>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
