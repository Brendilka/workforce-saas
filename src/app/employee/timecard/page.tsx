import { redirect } from "next/navigation";
import { getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { TimecardClient } from "@/components/timecard/timecard-client";

export default async function TimecardPage() {
  const user = await getUser();
  const role = await getUserRole();

  if (!user) {
    redirect("/login");
  }

  if (role !== "employee") {
    redirect(`/${role}/dashboard`);
  }

  const userName = user.user_metadata?.full_name || user.email || "Employee";
  const userInitials = userName
    .split(" ")
    .map((name: string) => name[0])
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
        title="My Timecard"
        description="View and save your clock-in, clock-out, and timecard notes"
      />
      <TimecardClient viewerRole="employee" />
    </DashboardLayout>
  );
}
