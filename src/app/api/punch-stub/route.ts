import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser, getUserRole } from "@/lib/supabase/server";
import {
  extractPunchRecords,
  extractTimecardEntries,
  mergePunchRecords,
  mergeTimecardEntries,
  syncTimecardEntriesFromPunchRecords,
  type PunchRecord,
  type TimecardEmployeeSummary,
} from "@/lib/timecard";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function resolveAdminTargetProfile(targetUserId?: string) {
  const viewer = await getUser();
  const viewerRole = await getUserRole();

  if (!viewer || viewerRole !== "admin") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const tenantId = viewer.user_metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    return { error: NextResponse.json({ error: "Missing tenant context" }, { status: 400 }) };
  }

  if (!targetUserId) {
    return { error: NextResponse.json({ error: "User is required." }, { status: 400 }) };
  }

  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, user_id, first_name, last_name, email, employee_number, custom_fields")
    .eq("tenant_id", tenantId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (profileError || !profile?.user_id) {
    return {
      error: NextResponse.json({ error: "Unable to find that user profile." }, { status: 404 }),
    };
  }

  const { data: tenantUser, error: userError } = await supabase
    .from("users")
    .select("id, role")
    .eq("tenant_id", tenantId)
    .eq("id", targetUserId)
    .maybeSingle();

  if (userError || !tenantUser) {
    return {
      error: NextResponse.json({ error: "Unable to load the selected user." }, { status: 404 }),
    };
  }

  const employee: TimecardEmployeeSummary = {
    userId: tenantUser.id,
    profileId: profile.id,
    fullName: `${profile.first_name} ${profile.last_name}`.trim() || profile.email,
    email: profile.email,
    employeeNumber: profile.employee_number,
    role: tenantUser.role,
  };

  return { supabase, profile, employee };
}

export async function GET(request: NextRequest) {
  const targetUserId = request.nextUrl.searchParams.get("userId") || undefined;
  const resolved = await resolveAdminTargetProfile(targetUserId);

  if ("error" in resolved) {
    return resolved.error;
  }

  return NextResponse.json({
    employee: resolved.employee,
    punchRecords: extractPunchRecords(resolved.profile.custom_fields),
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    userId?: string;
    punchedAt?: string;
  };

  const resolved = await resolveAdminTargetProfile(body.userId);
  if ("error" in resolved) {
    return resolved.error;
  }

  if (!body.punchedAt) {
    return NextResponse.json(
      { error: "Punch date/time is required." },
      { status: 400 }
    );
  }

  const currentPunchRecords = extractPunchRecords(resolved.profile.custom_fields);
  const nextPunchRecord: PunchRecord = {
    id: randomUUID(),
    punchedAt: body.punchedAt,
  };
  const nextPunchRecords = [...currentPunchRecords, nextPunchRecord].sort((left, right) =>
    left.punchedAt.localeCompare(right.punchedAt)
  );
  const syncedEntries = syncTimecardEntriesFromPunchRecords(
    extractTimecardEntries(resolved.profile.custom_fields),
    nextPunchRecords
  );

  let nextCustomFields = mergePunchRecords(resolved.profile.custom_fields, nextPunchRecords);
  nextCustomFields = mergeTimecardEntries(nextCustomFields, syncedEntries);

  const { error } = await resolved.supabase
    .from("profiles")
    .update({ custom_fields: nextCustomFields })
    .eq("id", resolved.profile.id);

  if (error) {
    return NextResponse.json({ error: "Unable to save punch record." }, { status: 500 });
  }

  return NextResponse.json({
    employee: resolved.employee,
    punchRecords: nextPunchRecords,
  });
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json()) as {
    userId?: string;
    recordId?: string;
  };

  const resolved = await resolveAdminTargetProfile(body.userId);
  if ("error" in resolved) {
    return resolved.error;
  }

  if (!body.recordId) {
    return NextResponse.json({ error: "Record id is required." }, { status: 400 });
  }

  const currentPunchRecords = extractPunchRecords(resolved.profile.custom_fields);
  const nextPunchRecords = currentPunchRecords.filter((record) => record.id !== body.recordId);
  const syncedEntries = syncTimecardEntriesFromPunchRecords(
    extractTimecardEntries(resolved.profile.custom_fields),
    nextPunchRecords
  );

  let nextCustomFields = mergePunchRecords(resolved.profile.custom_fields, nextPunchRecords);
  nextCustomFields = mergeTimecardEntries(nextCustomFields, syncedEntries);

  const { error } = await resolved.supabase
    .from("profiles")
    .update({ custom_fields: nextCustomFields })
    .eq("id", resolved.profile.id);

  if (error) {
    return NextResponse.json({ error: "Unable to delete punch record." }, { status: 500 });
  }

  return NextResponse.json({
    employee: resolved.employee,
    punchRecords: nextPunchRecords,
  });
}
