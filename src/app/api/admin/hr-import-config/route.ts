import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser, getUserRole } from "@/lib/supabase/server";
import type { HRImportConfig, TenantConfig } from "@/lib/types/database";

export async function GET() {
  try {
    const user = await getUser();
    const role = await getUserRole();

    if (!user || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tenant_config")
      .select("hr_import_config")
      .eq("tenant_id", user.user_metadata.tenant_id)
      .single<Pick<TenantConfig, "hr_import_config">>();

    if (error) {
      console.error("Error fetching HR import config:", error);
      return NextResponse.json(
        { error: "Failed to fetch configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ config: data?.hr_import_config || null });
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/hr-import-config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    const role = await getUserRole();

    if (!user || role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { config } = body as { tenantId: string; config: HRImportConfig };

    // Validate config structure
    if (!config || typeof config !== "object") {
      return NextResponse.json(
        { error: "Invalid configuration format" },
        { status: 400 }
      );
    }

    if (
      !config.systemName ||
      !Array.isArray(config.sourceFields) ||
      !config.fieldMapping ||
      !Array.isArray(config.requiredFields)
    ) {
      return NextResponse.json(
        {
          error:
            "Configuration must include systemName, sourceFields, fieldMapping, and requiredFields",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Update or insert the configuration
    const { error } = await supabase
      .from("tenant_config")
      // @ts-ignore - TypeScript has trouble inferring JSONB column types
      .update({ hr_import_config: config })
      .eq("tenant_id", user.user_metadata.tenant_id);

    if (error) {
      console.error("Error saving HR import config:", error);
      return NextResponse.json(
        { error: "Failed to save configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Configuration saved successfully",
    });
  } catch (error) {
    console.error("Unexpected error in POST /api/admin/hr-import-config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
