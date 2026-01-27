import { redirect } from "next/navigation";
import { getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { FeatureCard } from "@/components/layout/feature-card";
import {
  Clock,
  Calendar,
  PlaneTakeoff,
  MousePointerClick,
  Bell,
  Scale,
  IdCard,
  ArrowLeftRight,
  Award,
  FolderOpen,
  UserPlus,
  FileText,
  Bed,
  CalendarDays,
  HelpCircle,
  LifeBuoy,
  GraduationCap,
  Gavel,
} from "lucide-react";

const employeeFeatures = [
  {
    title: "My Timecard",
    href: "/employee/timecard",
    icon: Clock,
    disabled: false,
  },
  {
    title: "My Schedule",
    href: "/employee/schedule",
    icon: Calendar,
    disabled: false,
  },
  {
    title: "My Leave Request",
    href: "/employee/leave-request",
    icon: PlaneTakeoff,
    disabled: false,
  },
  {
    title: "Clock In / Out & Punch",
    href: "/employee/punch",
    icon: MousePointerClick,
    disabled: false,
  },
  {
    title: "My Notifications",
    href: "/employee/notifications",
    icon: Bell,
    disabled: false,
  },
  {
    title: "My Leave Balances",
    href: "/employee/leave-balances",
    icon: Scale,
    disabled: false,
  },
  {
    title: "My Personal Information",
    href: "/employee/personal-info",
    icon: IdCard,
    disabled: false,
  },
  {
    title: "My Shift Swaps",
    href: "/employee/shift-swaps",
    icon: ArrowLeftRight,
    disabled: true,
  },
  {
    title: "My Skills",
    href: "/employee/skills",
    icon: Award,
    disabled: true,
  },
  {
    title: "My Documents",
    href: "/employee/documents",
    icon: FolderOpen,
    disabled: true,
  },
  {
    title: "My Pre-approved Overtime",
    href: "/employee/overtime",
    icon: UserPlus,
    disabled: true,
  },
  {
    title: "My Claims",
    href: "/employee/claims",
    icon: FileText,
    disabled: true,
  },
  {
    title: "My Fatigue Tracker",
    href: "/employee/fatigue-tracker",
    icon: Bed,
    disabled: true,
  },
  {
    title: "My Team's Calendar",
    href: "/employee/team-calendar",
    icon: CalendarDays,
    disabled: true,
  },
  {
    title: "FAQ Help",
    href: "/employee/faq",
    icon: HelpCircle,
    disabled: true,
  },
  {
    title: "Product Help",
    href: "/employee/product-help",
    icon: LifeBuoy,
    disabled: true,
  },
  {
    title: "My Knowledge Training",
    href: "/employee/training",
    icon: GraduationCap,
    disabled: true,
  },
  {
    title: "My Policy Actions",
    href: "/employee/policy",
    icon: Gavel,
    disabled: true,
  },
];

export default async function EmployeeDashboardPage() {
  const user = await getUser();
  const role = await getUserRole();

  if (!user) {
    redirect("/login");
  }

  if (role !== "employee") {
    redirect(`/${role}/dashboard`);
  }

  // Get user initials
  const userName = user.user_metadata?.full_name || user.email || "User";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DashboardLayout
      userRole="employee"
      userName={userName}
      userInitials={userInitials}
    >
      <PageHeader
        title="Employee Dashboard"
        description="Access your schedule, timecards, leave requests, and more"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {employeeFeatures.map((feature) => (
          <FeatureCard
            key={feature.href}
            title={feature.title}
            href={feature.href}
            icon={feature.icon}
            variant="employee"
            disabled={feature.disabled}
          />
        ))}
      </div>
    </DashboardLayout>
  );
}
