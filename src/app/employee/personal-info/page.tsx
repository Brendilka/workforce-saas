import { redirect } from "next/navigation";
import { createClient, getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { PersonalInfoForm } from "./personal-info-form";
import type { Profile, CustomFieldDefinition, PageConfig, TenantConfig } from "@/lib/types/database";

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

  // Fetch the employee's profile (with department joined)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(`
      *,
      department:departments(id, name)
    `)
    .eq("user_id", user.id)
    .single<Profile & { department: { id: string; name: string } | null }>();

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

  // Fetch field visibility config from tenant_config
  const { data: configData } = await supabase
    .from("tenant_config")
    .select("field_visibility_config")
    .eq("tenant_id", tenantId)
    .single<Pick<TenantConfig, "field_visibility_config">>();

  const fieldVisibilityConfig = configData?.field_visibility_config || {};
  const pageConfig: PageConfig = fieldVisibilityConfig["employee-personal-info"] || {
    visibleFields: ["first_name", "last_name", "email", "employee_number", "hire_date", "department_id", "employment_status"],
    fieldGroups: [
      {
        groupName: "Basic Information",
        fields: ["first_name", "last_name", "email"],
      },
      {
        groupName: "Employment Details",
        fields: ["employee_number", "hire_date", "department_id", "employment_status"],
      },
    ],
  };

  // Fetch custom field definitions for this tenant
  const { data: customFieldDefs } = await supabase
    .from("custom_field_definitions")
    .select("*")
    .eq("tenant_id", tenantId);

  const customFieldDefinitions: CustomFieldDefinition[] = customFieldDefs || [];

  // Fetch all departments for the dropdown
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name");

  const departmentsList = departments || [];

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
        departments={departmentsList}
      />
    </DashboardLayout>
  );
}
