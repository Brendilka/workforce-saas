import { redirect } from "next/navigation";
import { getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { FeatureCard } from "@/components/layout/feature-card";
import {
  Upload,
  Settings,
  Users,
  Building2,
  FileSpreadsheet,
  BarChart3,
  Shield,
  Database,
  CalendarClock,
  Calendar,
} from "lucide-react";

const adminFeatures = [
  {
    title: "HR Import Configuration",
    href: "/admin/hr-import-config",
    icon: Settings,
    description: "Configure CSV field mapping for HR imports",
    disabled: false,
  },
  {
    title: "CSV Import Manager",
    href: "/admin/hr-import",
    icon: Upload,
    description: "Import employee data from CSV files",
    disabled: false,
  },
  {
    title: "Field Visibility Configuration",
    href: "/admin/field-visibility-config",
    icon: FileSpreadsheet,
    description: "Configure field visibility for employee pages",
    disabled: false,
  },
  {
    title: "Business Structure",
    href: "/admin/business-structure",
    icon: Building2,
    description: "Manage organizational hierarchy and structure",
    disabled: false,
  },
  {
    title: "Work Schedule",
    href: "/admin/work-schedule",
    icon: CalendarClock,
    description: "Manage work schedules and staffing patterns",
    disabled: false,
  },
  {
    title: "Roster Patterns",
    href: "/admin/roster-patterns",
    icon: Calendar,
    description: "Manage roster patterns and shift cycles",
    disabled: false,
  },
  {
    title: "User Management",
    href: "/admin/users",
    icon: Users,
    description: "Manage user accounts and permissions",
    disabled: true,
  },
  {
    title: "Department Management",
    href: "/admin/departments",
    icon: Building2,
    description: "Manage departments and organizational structure",
    disabled: true,
  },
  {
    title: "Reports & Analytics",
    href: "/admin/reports",
    icon: BarChart3,
    description: "View reports and analytics",
    disabled: true,
  },
  {
    title: "Tenant Settings",
    href: "/admin/tenant-settings",
    icon: Shield,
    description: "Configure tenant-wide settings",
    disabled: true,
  },
  {
    title: "System Settings",
    href: "/admin/system-settings",
    icon: Database,
    description: "Manage system configuration",
    disabled: true,
  },
];

export default async function AdminDashboardPage() {
  const user = await getUser();
  const role = await getUserRole();

  if (!user) {
    redirect("/login");
  }

  if (role !== "admin") {
    redirect(`/${role}/dashboard`);
  }

  // Get user initials
  const userName = user.user_metadata?.full_name || user.email || "Admin";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DashboardLayout
      userRole="admin"
      userName={userName}
      userInitials={userInitials}
    >
      <PageHeader
        title="Admin Dashboard"
        description="Manage your organization's workforce and configurations"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {adminFeatures.map((feature) => (
          <FeatureCard
            key={feature.href}
            title={feature.title}
            href={feature.href}
            icon={feature.icon}
            variant="admin"
            disabled={feature.disabled}
          />
        ))}
      </div>
    </DashboardLayout>
  );
}
