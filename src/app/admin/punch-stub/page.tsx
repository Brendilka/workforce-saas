import { redirect } from "next/navigation";
import { createClient, getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { PunchStubClient } from "@/components/timecard/punch-stub-client";
import type { TimecardEmployeeSummary } from "@/lib/timecard";

export default async function AdminPunchStubPage() {
  const user = await getUser();
  const role = await getUserRole();

  if (!user) {
    redirect("/login");
  }

  if (role !== "admin") {
    redirect(`/${role}/dashboard`);
  }

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) {
    redirect("/login?error=no_tenant");
  }

  const supabase = await createClient();
  const [{ data: usersData }, { data: profilesData }] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, role")
      .eq("tenant_id", tenantId)
      .order("email"),
    supabase
      .from("profiles")
      .select("id, user_id, first_name, last_name, email, employee_number")
      .eq("tenant_id", tenantId)
      .order("first_name"),
  ]);

  const profileByUserId = new Map(
    (profilesData || [])
      .filter((profile) => profile.user_id)
      .map((profile) => [profile.user_id as string, profile])
  );

  const userOptions: TimecardEmployeeSummary[] = (usersData || [])
    .map((tenantUser) => {
      const profile = profileByUserId.get(tenantUser.id);
      if (!profile) return null;

      return {
        userId: tenantUser.id,
        profileId: profile.id,
        fullName: `${profile.first_name} ${profile.last_name}`.trim() || profile.email,
        email: profile.email,
        employeeNumber: profile.employee_number,
        role: tenantUser.role,
      } satisfies TimecardEmployeeSummary;
    })
    .filter((value): value is TimecardEmployeeSummary => value !== null);

  const userName = user.user_metadata?.full_name || user.email || "Admin";
  const userInitials = userName
    .split(" ")
    .map((name: string) => name[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DashboardLayout userRole="admin" userName={userName} userInitials={userInitials}>
      <PageHeader
        title="Punch Stub"
        description="Simulate punch in and punch out events for a selected user"
      />
      <PunchStubClient userOptions={userOptions} initialUserId={userOptions[0]?.userId} />
    </DashboardLayout>
  );
}
