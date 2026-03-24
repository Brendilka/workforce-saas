import { redirect } from "next/navigation";
import { createClient, getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { PersonalInfoForm } from "./personal-info-form";
import { getPersonalInfoPageData } from "@/lib/personal-info";

export default async function PersonalInfoPage() {
  const user = await getUser();
  const role = await getUserRole();

  if (!user) {
    redirect("/login");
  }

  const tenantId = user.user_metadata?.tenant_id;

  if (!tenantId) {
    redirect("/login?error=no_tenant");
  }

  const supabase = await createClient();
  const {
    profile,
    profileError,
    pageConfig,
    customFieldDefinitions,
    departments,
  } = await getPersonalInfoPageData(supabase, tenantId, user.id);

  if (profileError || !profile) {
    console.error("Error fetching profile:", profileError);
    return (
      <DashboardLayout
        userRole={role || "employee"}
        userName={user.email || "User"}
        userInitials="U"
      >
        <PageHeader title="Personal Information" description="View and update your personal details" />
        <div className="text-center py-8 text-muted-foreground">
          <p>Unable to load your profile. Please contact support.</p>
        </div>
      </DashboardLayout>
    );
  }

  // Get user name for layout
  const userName = `${profile.first_name} ${profile.last_name}`.trim() || user.email || "User";
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DashboardLayout
      userRole={role || "employee"}
      userName={userName}
      userInitials={userInitials}
    >
      <PageHeader
        title="My Personal Information"
        description="View and update your personal details"
      />
      <PersonalInfoForm
        profile={profile as any}
        pageConfig={pageConfig}
        customFieldDefinitions={customFieldDefinitions}
        departments={departments}
      />
    </DashboardLayout>
  );
}
