import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser, getUserRole } from "@/lib/supabase/server";
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
    const tenantId = user.user_metadata.tenant_id;

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
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

        // Check if profile already exists (by email)
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("email", profileData.email)
          .maybeSingle<{ id: string }>();

        if (existingProfile) {
          // Update existing profile
          const { error: updateError } = await supabase
            .from("profiles")
            // @ts-ignore - TypeScript has trouble inferring update types
            .update(profileData)
            .eq("id", existingProfile.id);

          if (updateError) throw updateError;
        } else {
          // Insert new profile
          const { error: insertError } = await supabase
            .from("profiles")
            // @ts-ignore - TypeScript has trouble inferring insert types
            .insert(profileData);

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
      errors: errors.slice(0, 20), // Limit to first 20 errors to avoid huge responses
      message: `Import completed: ${successCount} succeeded, ${failedCount} failed`,
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
