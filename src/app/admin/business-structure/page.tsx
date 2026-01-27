import { redirect } from "next/navigation";
import { getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { BusinessStructurePageClient } from "./business-structure-client";

export default async function BusinessStructurePage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await getUserRole();

  if (!role || role !== "admin") {
    redirect(`/${role}/dashboard`);
  }

  const userName =
    user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
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
      <BusinessStructurePageClient />
    </DashboardLayout>
  );
}
