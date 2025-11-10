import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser, getUserRole } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { HRImportConfig } from "@/lib/types/database";

interface ParsedRow {
  [key: string]: string;
}

interface ImportRequest {
  tenantId: string;
  data: ParsedRow[];
  config: HRImportConfig;
  departments: Array<{ id: string; name: string }>;
}

// Default password for newly imported users
const DEFAULT_PASSWORD = "password123";

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    const role = await getUserRole();

    if (!user || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ImportRequest;
    const { data, config, departments } = body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: "No data provided for import" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();
    const tenantId = user.user_metadata.tenant_id;

    let successCount = 0;
    let failedCount = 0;
    let authCreatedCount = 0;
    const errors: string[] = [];

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      console.log(`Processing row ${i + 1} of ${data.length}`);
      try {
        // Map CSV fields to profile fields
        const profileData: {
          tenant_id: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          employee_number?: string;
          hire_date?: string;
          department_id?: string;
          employment_status?: string;
          custom_fields?: Record<string, string>;
        } = {
          tenant_id: tenantId,
        };

        const customFields: Record<string, string> = {};

        // Map each field according to config
        Object.entries(config.fieldMapping).forEach(([sourceField, targetField]) => {
          const value = row[sourceField];
          if (!value) return;

          // Standard fields
          if (targetField === "email") profileData.email = value.toLowerCase();
          else if (targetField === "first_name") profileData.first_name = value;
          else if (targetField === "last_name") profileData.last_name = value;
          else if (targetField === "employee_number") profileData.employee_number = value;
          else if (targetField === "hire_date") profileData.hire_date = value;
          else if (targetField === "employment_status") profileData.employment_status = value;
          else if (targetField === "department_id") {
            // Map department name to ID
            const dept = departments.find(
              (d) => d.name.toLowerCase() === value.toLowerCase()
            );
            if (dept) {
              profileData.department_id = dept.id;
            }
          } else {
            // Custom field - store in custom_fields JSONB
            customFields[targetField] = value;
          }
        });

        // Add custom fields if any
        if (Object.keys(customFields).length > 0) {
          profileData.custom_fields = customFields;
        }

        // Validate required fields
        if (!profileData.email) {
          throw new Error("Email is required");
        }

        // Step 1: Check if user exists in public.users table
        const { data: existingUser } = await adminClient
          .from("users")
          .select("id")
          .eq("email", profileData.email)
          .maybeSingle<{ id: string }>();

        let userId: string;

        if (!existingUser) {
          // Step 2: Create auth.users record with default password
          const { data: newAuthUser, error: authError } = await adminClient.auth.admin.createUser({
            email: profileData.email,
            password: DEFAULT_PASSWORD,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
              tenant_id: tenantId,
              role: "employee",
            },
          });

          if (authError || !newAuthUser.user) {
            throw new Error(`Failed to create auth user: ${authError?.message || "Unknown error"}`);
          }

          userId = newAuthUser.user.id;
          authCreatedCount++;

          // Step 3: Create public.users record
          const { error: userError } = await adminClient
            .from("users")
            // @ts-ignore - TypeScript has trouble inferring insert types with admin client
            .insert({
              id: userId,
              email: profileData.email,
              role: "employee",
              tenant_id: tenantId,
            });

          if (userError) {
            throw new Error(`Failed to create user record: ${userError.message}`);
          }
        } else {
          // Use existing user ID
          userId = existingUser.id;
        }

        // Step 4: Check if profile exists and insert/update with user_id link
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("email", profileData.email)
          .maybeSingle<{ id: string }>();

        const profileDataWithUser = {
          ...profileData,
          user_id: userId,
        };

        if (existingProfile) {
          // Update existing profile
          const { error: updateError } = await supabase
            .from("profiles")
            // @ts-ignore - TypeScript has trouble inferring update types
            .update(profileDataWithUser)
            .eq("id", existingProfile.id);

          if (updateError) throw updateError;
        } else {
          // Insert new profile
          const { error: insertError } = await supabase
            .from("profiles")
            // @ts-ignore - TypeScript has trouble inferring insert types
            .insert(profileDataWithUser);

          if (insertError) throw insertError;
        }

        successCount++;
      } catch (error) {
        failedCount++;
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Row ${i + 1}: ${errorMsg}`);
        console.error(`Error importing row ${i + 1}:`, error);
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: failedCount,
      authCreated: authCreatedCount,
      errors: errors.slice(0, 20), // Limit to first 20 errors to avoid huge responses
      message: `Import completed: ${successCount} succeeded, ${failedCount} failed, ${authCreatedCount} auth accounts created`,
    });
  } catch (error) {
    console.error("Unexpected error in POST /api/admin/hr-import/execute:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
