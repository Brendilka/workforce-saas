import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser, getUserRole } from "@/lib/supabase/server";
import type { TenantConfig } from "@/lib/types/database";

export async function GET() {
  try {
    const user = await getUser();
    const role = await getUserRole();

    if (!user || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID not found" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tenant_config")
      .select("field_visibility_config")
      .eq("tenant_id", tenantId)
      .single<Pick<TenantConfig, "field_visibility_config">>();

    if (error) {
      console.error("Error fetching field visibility config:", error);
      return NextResponse.json({ error: "Failed to fetch configuration" }, { status: 500 });
    }

    return NextResponse.json({ config: data?.field_visibility_config || {} });
  } catch (error) {
    console.error("Error in GET /api/admin/field-visibility-config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    const role = await getUserRole();

    if (!user || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID not found" }, { status: 400 });
    }

    const body = await request.json();
    const { config } = body;

    if (!config || typeof config !== "object") {
      return NextResponse.json({ error: "Invalid configuration format" }, { status: 400 });
    }

    // Validate configuration structure (basic validation)
    for (const pageKey in config) {
      const pageConfig = config[pageKey];
      if (!pageConfig.visibleFields || !Array.isArray(pageConfig.visibleFields)) {
        return NextResponse.json(
          { error: `Invalid config for ${pageKey}: visibleFields must be an array` },
          { status: 400 }
        );
      }
      if (!pageConfig.fieldGroups || !Array.isArray(pageConfig.fieldGroups)) {
        return NextResponse.json(
          { error: `Invalid config for ${pageKey}: fieldGroups must be an array` },
          { status: 400 }
        );
      }
      // Validate each field group
      for (const group of pageConfig.fieldGroups) {
        if (!group.groupName || typeof group.groupName !== "string") {
          return NextResponse.json(
            { error: `Invalid field group in ${pageKey}: groupName must be a string` },
            { status: 400 }
          );
        }
        if (!group.fields || !Array.isArray(group.fields)) {
          return NextResponse.json(
            { error: `Invalid field group in ${pageKey}: fields must be an array` },
            { status: 400 }
          );
        }
      }
    }

    const supabase = await createClient();

    // Update the field_visibility_config column
    const { error } = await supabase
      .from("tenant_config")
      // @ts-ignore - TypeScript has trouble inferring JSONB column types
      .update({
        field_visibility_config: config,
      })
      .eq("tenant_id", tenantId);

    if (error) {
      console.error("Error updating field visibility config:", error);
      return NextResponse.json({ error: "Failed to save configuration" }, { status: 500 });
    }

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error("Error in POST /api/admin/field-visibility-config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
