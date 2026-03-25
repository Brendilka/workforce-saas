import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser, getUserRole } from "@/lib/supabase/server";
import {
  extractGracePeriodsConfig,
  extractTimecardEntries,
  extractPunchRecords,
  type AssignedRosterPattern,
  type GracePeriodsConfig,
  mergeTimecardEntries,
  type TimecardEmployeeSummary,
  type TimecardEntry,
} from "@/lib/timecard";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEntries(payload: unknown): TimecardEntry[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry) => {
      if (!isRecord(entry) || typeof entry.date !== "string") {
        return null;
      }

      const hoursWorked =
        typeof entry.hoursWorked === "number"
          ? entry.hoursWorked
          : typeof entry.hoursWorked === "string"
            ? Number(entry.hoursWorked)
            : 0;

      return {
        date: entry.date,
        clockIn: typeof entry.clockIn === "string" ? entry.clockIn : "",
        clockOut: typeof entry.clockOut === "string" ? entry.clockOut : "",
        hoursWorked: Number.isFinite(hoursWorked) ? Number(hoursWorked.toFixed(2)) : 0,
        status:
          entry.status === "approved" || entry.status === "exception"
            ? entry.status
            : "pending",
        notes: typeof entry.notes === "string" ? entry.notes : "",
      } satisfies TimecardEntry;
    })
    .filter((entry): entry is TimecardEntry => entry !== null)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function getAssignedPatternIds(customFields: unknown): string[] {
  if (!isRecord(customFields) || !Array.isArray(customFields.assigned_roster_pattern_ids)) {
    return [];
  }

  return customFields.assigned_roster_pattern_ids.filter(
    (value): value is string => typeof value === "string"
  );
}

async function resolveTargetProfile(targetUserId?: string) {
  const viewer = await getUser();
  const viewerRole = await getUserRole();

  if (!viewer || !viewerRole) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const tenantId = viewer.user_metadata?.tenant_id as string | undefined;

  if (!tenantId) {
    return { error: NextResponse.json({ error: "Missing tenant context" }, { status: 400 }) };
  }

  const effectiveUserId =
    viewerRole === "admin" && targetUserId ? targetUserId : viewer.id;

  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, user_id, first_name, last_name, email, employee_number, department_id, custom_fields, department:departments(name)")
    .eq("tenant_id", tenantId)
    .eq("user_id", effectiveUserId)
    .maybeSingle();

  if (profileError || !profile?.user_id) {
    return {
      error: NextResponse.json(
        { error: "Unable to find a profile for that user." },
        { status: 404 }
      ),
    };
  }

  const { data: tenantUser, error: userError } = await supabase
    .from("users")
    .select("id, role")
    .eq("tenant_id", tenantId)
    .eq("id", effectiveUserId)
    .maybeSingle();

  if (userError || !tenantUser) {
    return {
      error: NextResponse.json(
        { error: "Unable to load the selected user." },
        { status: 404 }
      ),
    };
  }

  const employee: TimecardEmployeeSummary = {
    userId: tenantUser.id,
    profileId: profile.id,
    fullName: `${profile.first_name} ${profile.last_name}`.trim() || profile.email,
    email: profile.email,
    employeeNumber: profile.employee_number,
    departmentId: profile.department_id ?? null,
    departmentName:
      profile.department &&
      typeof profile.department === "object" &&
      "name" in profile.department &&
      typeof profile.department.name === "string"
        ? profile.department.name
        : null,
    role: tenantUser.role,
  };

  return {
    viewer,
    viewerRole,
    tenantId,
    supabase,
    profile,
    employee,
  };
}

export async function GET(request: NextRequest) {
  const targetUserId = request.nextUrl.searchParams.get("userId") || undefined;
  const resolved = await resolveTargetProfile(targetUserId);

  if ("error" in resolved) {
    return resolved.error;
  }

  const assignedPatternIds = getAssignedPatternIds(resolved.profile.custom_fields);
  let assignedRosterPattern: AssignedRosterPattern | null = null;
  let gracePeriodsConfig: GracePeriodsConfig | null = null;

  if (assignedPatternIds.length > 0) {
    const { data: patterns, error: patternsError } = await resolved.supabase
      .from("roster_patterns")
      .select(
        "id, shift_id, start_date, end_date_type, end_date, weeks_pattern, start_pattern_week, start_day, pattern_rows"
      )
      .in("id", assignedPatternIds);

    if (!patternsError && patterns) {
      const patternById = new Map(patterns.map((pattern) => [pattern.id, pattern]));
      const firstAssignedPattern = assignedPatternIds
        .map((patternId) => patternById.get(patternId))
        .find((pattern): pattern is NonNullable<typeof pattern> => Boolean(pattern));

      if (firstAssignedPattern) {
        assignedRosterPattern = {
          ...firstAssignedPattern,
          pattern_rows: Array.isArray(firstAssignedPattern.pattern_rows)
            ? (firstAssignedPattern.pattern_rows as unknown as AssignedRosterPattern["pattern_rows"])
            : [],
        };
      }
    }
  }

  const { data: tenantConfig } = await resolved.supabase
    .from("tenant_config")
    .select("field_visibility_config")
    .eq("tenant_id", resolved.tenantId)
    .maybeSingle();

  gracePeriodsConfig = extractGracePeriodsConfig(
    (tenantConfig?.field_visibility_config as any) ?? null
  );

  return NextResponse.json({
    employee: resolved.employee,
    entries: extractTimecardEntries(resolved.profile.custom_fields),
    punchRecords: extractPunchRecords(resolved.profile.custom_fields),
    assignedRosterPattern,
    gracePeriodsConfig,
    canEdit: resolved.viewerRole !== "admin" && resolved.viewer.id === resolved.employee.userId,
  });
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as {
    userId?: string;
    entries?: unknown;
  };

  const resolved = await resolveTargetProfile(body.userId);

  if ("error" in resolved) {
    return resolved.error;
  }

  if (resolved.viewerRole === "admin" || resolved.viewer.id !== resolved.employee.userId) {
    return NextResponse.json(
      { error: "Only employees can edit their own timecard." },
      { status: 403 }
    );
  }

  const entries = normalizeEntries(body.entries);
  const customFields = mergeTimecardEntries(resolved.profile.custom_fields, entries);

  const { error } = await resolved.supabase
    .from("profiles")
    .update({ custom_fields: customFields })
    .eq("id", resolved.profile.id);

  if (error) {
    return NextResponse.json(
      { error: "Unable to save timecard changes." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    employee: resolved.employee,
    entries,
    canEdit: true,
  });
}
