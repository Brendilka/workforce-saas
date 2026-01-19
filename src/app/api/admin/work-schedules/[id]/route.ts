import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET single schedule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant ID" }, { status: 400 });
    }

    const { id } = await params;
    const supabase = createClient();

    const { data: schedule, error } = await supabase
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
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (error) throw error;
    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    return NextResponse.json(schedule);
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedule" },
      { status: 500 }
    );
  }
}

// PUT update work schedule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant ID" }, { status: 400 });
    }

    const { id } = await params;
    const body = await request.json();
    const { shiftId, shiftType, timeframes } = body;

    if (!shiftId || !shiftType || !timeframes || timeframes.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Update work schedule
    const { error: updateError } = await supabase
      .from("work_schedules")
      .update({
        shift_id: shiftId,
        shift_type: shiftType,
      })
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (updateError) throw updateError;

    // Delete existing timeframes
    await supabase
      .from("work_schedule_timeframes")
      .delete()
      .eq("work_schedule_id", id);

    // Insert new timeframes
    const timeframesData = timeframes.map(
      (tf: { startTime: string; endTime: string }, index: number) => ({
        work_schedule_id: id,
        start_time: tf.startTime,
        end_time: tf.endTime,
        frame_order: index,
      })
    );

    const { error: timeframesError } = await supabase
      .from("work_schedule_timeframes")
      .insert(timeframesData);

    if (timeframesError) throw timeframesError;

    // Fetch updated schedule
    const { data: updatedSchedule, error: fetchError } = await supabase
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
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json(updatedSchedule);
  } catch (error) {
    console.error("Error updating schedule:", error);
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 }
    );
  }
}

// DELETE work schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant ID" }, { status: 400 });
    }

    const { id } = await params;
    const supabase = createClient();

    const { error } = await supabase
      .from("work_schedules")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (error) throw error;

    return NextResponse.json({ message: "Schedule deleted" });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    return NextResponse.json(
      { error: "Failed to delete schedule" },
      { status: 500 }
    );
  }
}
