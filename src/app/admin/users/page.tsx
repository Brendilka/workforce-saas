import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getUser, getUserRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

interface AdminUserRow {
  id: string;
  email: string;
  role: "admin" | "manager" | "employee";
  first_name: string | null;
  last_name: string | null;
  employee_number: string | null;
  employment_status: string | null;
}

export default async function AdminUsersPage() {
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

  const [{ data: usersData, error: usersError }, { data: profilesData, error: profilesError }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, email, role")
        .eq("tenant_id", tenantId)
        .order("email"),
      supabase
        .from("profiles")
        .select("user_id, first_name, last_name, employee_number, employment_status")
        .eq("tenant_id", tenantId)
        .order("first_name"),
    ]);

  const profileByUserId = new Map(
    (profilesData || []).map((profile) => [profile.user_id, profile])
  );

  const users: AdminUserRow[] = (usersData || []).map((tenantUser) => {
    const profile = profileByUserId.get(tenantUser.id);

    return {
      id: tenantUser.id,
      email: tenantUser.email,
      role: tenantUser.role,
      first_name: profile?.first_name || null,
      last_name: profile?.last_name || null,
      employee_number: profile?.employee_number || null,
      employment_status: profile?.employment_status || null,
    };
  });

  const userName = user.user_metadata?.full_name || user.email || "Admin";
  const userInitials = userName
    .split(" ")
    .map((name: string) => name[0])
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
        title="User Management"
        description="Browse users and open each person's personal information record"
      />

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {usersError || profilesError ? (
            <div className="text-sm text-destructive">
              Unable to load users right now.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Account Type</TableHead>
                  <TableHead>Employee Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px] text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((tenantUser) => {
                  const fullName =
                    `${tenantUser.first_name || ""} ${tenantUser.last_name || ""}`.trim() ||
                    "No profile name";

                  return (
                    <TableRow key={tenantUser.id}>
                      <TableCell>
                        <Link
                          href={`/admin/users/${tenantUser.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{tenantUser.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {tenantUser.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{tenantUser.employee_number || "-"}</TableCell>
                      <TableCell className="capitalize">
                        {tenantUser.employment_status || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/admin/users/${tenantUser.id}`}
                          className="inline-flex items-center text-primary hover:text-primary/80"
                          aria-label={`Open ${fullName}`}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
