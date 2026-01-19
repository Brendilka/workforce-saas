import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET all work schedules
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant ID" }, { status: 400 });
    }

    const supabase = await createClient();

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
    return NextResponse.json(
      { error: "Failed to fetch schedules" },
      { status: 500 }
    );
  }
}

// POST create new work schedule
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
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

    const supabase = await createClient();

    // Create work schedule
    const { data: schedule, error: scheduleError } = await supabase
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

    const { error: timeframesError } = await supabase
      .from("work_schedule_timeframes")
      .insert(timeframesData);

    if (timeframesError) throw timeframesError;

    // Fetch complete schedule with timeframes
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
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json(completeSchedule, { status: 201 });
  } catch (error) {
    console.error("Error creating schedule:", error);
    return NextResponse.json(
      { error: "Failed to create schedule" },
      { status: 500 }
    );
  }
}
