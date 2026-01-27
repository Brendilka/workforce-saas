import { redirect } from "next/navigation";
import { createClient, getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { CSVImporter } from "./csv-importer";
import type { TenantConfig } from "@/lib/types/database";

export default async function HRImportPage() {
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

  // Fetch departments for mapping
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("tenant_id", user.user_metadata.tenant_id);

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
        title="CSV Import Manager"
        description="Import employee data from your HR system"
      />
      <div className="mt-6">
        {!config?.hr_import_config ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
              Configuration Required
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Please configure your HR import settings before importing data.
            </p>
            <a
              href="/admin/hr-import-config"
              className="text-sm text-yellow-800 dark:text-yellow-200 underline mt-2 inline-block"
            >
              Go to HR Import Configuration →
            </a>
          </div>
        ) : (
          <CSVImporter
            config={config.hr_import_config}
            departments={departments || []}
            tenantId={user.user_metadata.tenant_id}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
