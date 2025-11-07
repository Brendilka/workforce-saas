import { redirect } from "next/navigation";
import { createClient, getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { FieldVisibilityEditor } from "./field-visibility-editor";
import type { TenantConfig } from "@/lib/types/database";

export default async function FieldVisibilityConfigPage() {
  const user = await getUser();
  const role = await getUserRole();

  if (!user || role !== "admin") {
    redirect("/login");
  }

  const tenantId = user.user_metadata?.tenant_id;

  if (!tenantId) {
    redirect("/login?error=no_tenant");
  }

  // Fetch current field visibility config from tenant_config
  const supabase = await createClient();
  const { data: configData, error } = await supabase
    .from("tenant_config")
    .select("field_visibility_config")
    .eq("tenant_id", tenantId)
    .single<Pick<TenantConfig, "field_visibility_config">>();

  if (error) {
    console.error("Error fetching field visibility config:", error);
  }

  const initialConfig = configData?.field_visibility_config || {};

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
        title="Field Visibility Configuration"
        description="Configure which fields are visible on employee pages for your organization"
      />
      <FieldVisibilityEditor initialConfig={initialConfig} tenantId={tenantId} />
    </DashboardLayout>
  );
}
