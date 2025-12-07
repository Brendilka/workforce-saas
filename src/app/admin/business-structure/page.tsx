import { redirect } from "next/navigation";
import { getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

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
      <PageHeader
        title="Business Structure"
        description="Manage your organizational hierarchy and structure"
      />

      <div className="space-y-6">
        {/* Action Bar */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">
              Define your company's organizational structure, departments, and teams.
            </p>
          </div>
          <Button className="bg-admin hover:bg-admin/90">
            <Plus className="h-4 w-4 mr-2" />
            Create business structure
          </Button>
        </div>

        {/* Content Area - Placeholder for now */}
        <div className="border rounded-lg p-12 text-center bg-gray-50">
          <div className="max-w-md mx-auto">
            <div className="mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-admin/10 mb-4">
                <Plus className="h-8 w-8 text-admin" />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2">No business structure defined yet</h3>
            <p className="text-muted-foreground mb-6">
              Get started by creating your first business structure to organize your company's hierarchy.
            </p>
            <Button className="bg-admin hover:bg-admin/90">
              <Plus className="h-4 w-4 mr-2" />
              Create business structure
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
