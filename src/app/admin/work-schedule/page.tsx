import { redirect } from "next/navigation";
import { getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { WorkScheduleClient } from "./WorkScheduleClient";

export default async function WorkSchedulePage() {
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
      <WorkScheduleClient />
    </DashboardLayout>
  );
}
