import { redirect } from "next/navigation";
import { getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const role = await getUserRole();
  if (!role) {
    redirect("/login");
  }

  const userName = user.user_metadata?.full_name || user.email || "User";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DashboardLayout
      userRole={role as "admin" | "employee" | "manager"}
      userName={userName}
      userInitials={userInitials}
    >
      <SettingsClient />
    </DashboardLayout>
  );
}
