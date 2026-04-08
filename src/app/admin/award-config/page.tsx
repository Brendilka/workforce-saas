import { redirect } from "next/navigation";
import { getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { AwardConfigClient } from "./award-config-client";

export default async function AwardConfigPage() {
  const user = await getUser();
  const role = await getUserRole();

  if (!user || role !== "admin") {
    redirect("/login");
  }

  const tenantId = user.user_metadata?.tenant_id;

  if (!tenantId) {
    redirect("/login?error=no_tenant");
  }

  // Get user name for header
  const userName = `${user.user_metadata?.first_name || ""} ${user.user_metadata?.last_name || ""}`.trim() || user.email || "Admin";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DashboardLayout userRole="admin" userName={userName} userInitials={userInitials}>
      <PageHeader
        title="AI Award & EBA Configuration"
        description="Automatically configure payroll parameters from Australian awards and enterprise agreements"
      />
      <AwardConfigClient tenantId={tenantId} />
    </DashboardLayout>
  );
}