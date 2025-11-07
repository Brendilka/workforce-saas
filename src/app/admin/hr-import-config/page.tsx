import { redirect } from "next/navigation";
import { createClient, getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { HRImportConfigEditor } from "./config-editor";
import type { TenantConfig } from "@/lib/types/database";

export default async function HRImportConfigPage() {
  const user = await getUser();
  const role = await getUserRole();

  if (!user || role !== "admin") {
    redirect("/login");
  }

  // Fetch current tenant's HR import config
  const supabase = await createClient();
  const { data: config, error } = await supabase
    .from("tenant_config")
    .select("hr_import_config")
    .eq("tenant_id", user.user_metadata.tenant_id)
    .single<Pick<TenantConfig, "hr_import_config">>();

  if (error) {
    console.error("Error fetching HR import config:", error);
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
      <PageHeader
        title="HR Import Configuration"
        description="Configure field mappings for CSV imports from your HR system"
      />
      <div className="mt-6">
        <HRImportConfigEditor
          initialConfig={config?.hr_import_config || null}
          tenantId={user.user_metadata.tenant_id}
        />
      </div>
    </DashboardLayout>
  );
}
