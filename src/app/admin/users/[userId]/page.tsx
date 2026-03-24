import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient, getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { PersonalInfoForm } from "@/app/employee/personal-info/personal-info-form";
import { getPersonalInfoPageData } from "@/lib/personal-info";
import type { UserRole } from "@/lib/types/database";
import { cn } from "@/lib/utils";

interface AdminUserDetailsPageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default async function AdminUserDetailsPage({
  params,
}: AdminUserDetailsPageProps) {
  const { userId } = await params;
  const currentUser = await getUser();
  const currentRole = await getUserRole();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentRole !== "admin") {
    redirect(`/${currentRole}/dashboard`);
  }

  const tenantId = currentUser.user_metadata?.tenant_id;

  if (!tenantId) {
    redirect("/login?error=no_tenant");
  }

  const supabase = await createClient();

  const { data: targetUser } = await supabase
    .from("users")
    .select("id, email, role, tenant_id")
    .eq("id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ id: string; email: string; role: UserRole; tenant_id: string }>();

  if (!targetUser) {
    notFound();
  }

  const { profile, pageConfig, customFieldDefinitions, departments } =
    await getPersonalInfoPageData(supabase, tenantId, userId);

  if (!profile) {
    notFound();
  }

  const adminName = currentUser.user_metadata?.full_name || currentUser.email || "Admin";
  const adminInitials = adminName
    .split(" ")
    .map((name: string) => name[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const viewedUserName =
    `${profile.first_name} ${profile.last_name}`.trim() || targetUser.email;

  return (
    <DashboardLayout
      userRole="admin"
      userName={adminName}
      userInitials={adminInitials}
    >
      <div className="mb-4">
        <Link
          href="/admin/users"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to User Management
        </Link>
      </div>

      <PageHeader
        title={viewedUserName}
        description={`${targetUser.role.charAt(0).toUpperCase() + targetUser.role.slice(1)} account personal information`}
      />

      <PersonalInfoForm
        profile={profile}
        pageConfig={pageConfig}
        customFieldDefinitions={customFieldDefinitions}
        departments={departments}
        allowEditing={false}
      />
    </DashboardLayout>
  );
}
