import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// GET all work schedules
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get user from session to extract tenant_id
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant ID" }, { status: 400 });
    }

    const { data: schedules, error } = await supabase
      .from("work_schedules")
      .select(
        `
        id,
        shift_id,
        shift_type,
        created_at,
        updated_at,
        work_schedule_timeframes(id, start_time, end_time, frame_order)
      `
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Error fetching schedules:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Detailed error:", errorMessage);
    return NextResponse.json(
      { error: errorMessage || "Failed to fetch schedules" },
      { status: 500 }
    );
  }
}

// POST create new work schedule
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get user from session to verify authentication and get tenant_id
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant ID" }, { status: 400 });
    }

    const body = await request.json();
    const { shiftId, shiftType, timeframes } = body;

    if (!shiftId || !shiftType || !timeframes || timeframes.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS (we already validated auth above)
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create work schedule
    const { data: schedule, error: scheduleError } = await adminSupabase
      .from("work_schedules")
      .insert({
        tenant_id: tenantId,
        shift_id: shiftId,
        shift_type: shiftType,
      })
      .select()
      .single();

    if (scheduleError) throw scheduleError;

    // Insert timeframes
    const timeframesData = timeframes.map(
      (tf: { startTime: string; endTime: string }, index: number) => ({
        work_schedule_id: schedule.id,
        start_time: tf.startTime,
        end_time: tf.endTime,
        frame_order: index,
      })
    );

    const { error: timeframesError } = await adminSupabase
      .from("work_schedule_timeframes")
      .insert(timeframesData);

    if (timeframesError) throw timeframesError;

    // Fetch complete schedule with timeframes using regular client for consistency
    const { data: completeSchedule, error: fetchError } = await supabase
      .from("work_schedules")
      .select(
        `
        id,
        shift_id,
        shift_type,
        created_at,
        updated_at,
        work_schedule_timeframes(id, start_time, end_time, frame_order)
      `
      )
      .eq("id", schedule.id)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json(completeSchedule, { status: 201 });
  } catch (error) {
    console.error("Error creating schedule:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Detailed error:", errorMessage);
    return NextResponse.json(
      { error: errorMessage || "Failed to create schedule" },
      { status: 500 }
    );
  }
}
