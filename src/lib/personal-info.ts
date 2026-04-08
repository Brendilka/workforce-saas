import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, CustomFieldDefinition, PageConfig, TenantConfig } from "@/lib/types/database";
import type { Database } from "@/lib/types";

const DEFAULT_PERSONAL_INFO_PAGE_CONFIG: PageConfig = {
  visibleFields: [
    "first_name",
    "last_name",
    "email",
    "employee_number",
    "hire_date",
    "department_id",
    "employment_status",
  ],
  fieldGroups: [
    {
      groupName: "Basic Information",
      fields: ["first_name", "last_name", "email"],
    },
    {
      groupName: "Employment Details",
      fields: ["employee_number", "hire_date", "department_id", "employment_status"],
    },
  ],
};

export async function getPersonalInfoPageData(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  userId: string
) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(`
      *,
      department:departments(id, name)
    `)
    .eq("user_id", userId)
    .single<Profile & { department: { id: string; name: string } | null }>();

  if (profileError || !profile) {
    return {
      profile: null,
      profileError,
      pageConfig: DEFAULT_PERSONAL_INFO_PAGE_CONFIG,
      customFieldDefinitions: [] as CustomFieldDefinition[],
      departments: [] as Array<{ id: string; name: string }>,
    };
  }

  const [{ data: configData }, { data: customFieldDefs }, { data: departments }] =
    await Promise.all([
      supabase
        .from("tenant_config")
        .select("field_visibility_config")
        .eq("tenant_id", tenantId)
        .single<Pick<TenantConfig, "field_visibility_config">>(),
      supabase
        .from("custom_field_definitions")
        .select("*")
        .eq("tenant_id", tenantId),
      supabase
        .from("departments")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name"),
    ]);

  const fieldVisibilityConfig = configData?.field_visibility_config || {};

  // Ensure the page config has the required properties
  const employeePersonalInfoConfig = fieldVisibilityConfig["employee-personal-info"];
  const isValidPageConfig = employeePersonalInfoConfig &&
    typeof employeePersonalInfoConfig === 'object' &&
    'visibleFields' in employeePersonalInfoConfig &&
    'fieldGroups' in employeePersonalInfoConfig &&
    Array.isArray(employeePersonalInfoConfig.visibleFields) &&
    Array.isArray(employeePersonalInfoConfig.fieldGroups);

  return {
    profile,
    profileError: null,
    pageConfig: isValidPageConfig ? employeePersonalInfoConfig as PageConfig : DEFAULT_PERSONAL_INFO_PAGE_CONFIG,
    customFieldDefinitions: (customFieldDefs || []) as CustomFieldDefinition[],
    departments: departments || [],
  };
}
