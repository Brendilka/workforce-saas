"use client";

import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  userRole: "employee" | "manager" | "admin";
  userName: string;
  userInitials: string;
}

export function DashboardLayout({
  children,
  userRole,
  userName,
  userInitials,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        userRole={userRole}
        userName={userName}
        userInitials={userInitials}
      />

      {/* Main Content Area */}
      <div className="lg:pl-64 min-h-screen">
        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
