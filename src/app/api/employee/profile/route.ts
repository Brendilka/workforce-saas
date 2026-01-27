import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID not found" }, { status: 400 });
    }

    const body = await request.json();
    const { standardFields, customFields } = body;

    if (!standardFields && !customFields) {
      return NextResponse.json({ error: "No data provided" }, { status: 400 });
    }

    const supabase = await createClient();

    // First, fetch the current profile to get existing custom_fields
    const { data: currentProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("custom_fields")
      .eq("user_id", user.id)
      .single<{ custom_fields: Record<string, any> }>();

    if (fetchError) {
      console.error("Error fetching current profile:", fetchError);
      return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }

    // Merge custom fields with existing ones
    const mergedCustomFields = {
      ...(currentProfile?.custom_fields || {}),
      ...(customFields || {}),
    };

    // Build the update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Add standard fields if provided
    if (standardFields) {
      // Validate and add allowed standard fields
      const allowedFields = [
        "first_name",
        "last_name",
        "employee_number",
        "hire_date",
        "department_id",
        // Note: email, employment_status, and tenant_id are typically not user-editable
      ];

      Object.keys(standardFields).forEach((key) => {
        if (allowedFields.includes(key)) {
          // Convert empty strings to null for nullable fields
          if (["employee_number", "hire_date", "department_id"].includes(key) && standardFields[key] === "") {
            updateData[key] = null;
          } else {
            updateData[key] = standardFields[key];
          }
        }
      });
    }

    // Add merged custom fields
    updateData.custom_fields = mergedCustomFields;

    // Update the profile
    // RLS policy ensures user can only update their own profile
    const { data, error } = await supabase
      .from("profiles")
      // @ts-ignore - TypeScript has trouble inferring update types
      .update(updateData)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating profile:", error);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: data });
  } catch (error) {
    console.error("Error in PATCH /api/employee/profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(`
        *,
        department:departments(id, name)
      `)
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Error in GET /api/employee/profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
