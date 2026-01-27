import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET single schedule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant ID" }, { status: 400 });
    }

    const { id } = await params;

    // Use admin client to bypass RLS
    const adminClient = createAdminClient();

    const { data: schedule, error } = await adminClient
      .from("work_schedules")
      .select(
        `
        id,
        shift_id,
        shift_type,
        description,
        created_at,
        updated_at,
        work_schedule_timeframes(id, start_time, end_time, frame_order, meal_type, meal_start, meal_end)
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
    const supabase = await createClient();
    
    // Get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant ID" }, { status: 400 });
    }

    const { id } = await params;
    const body = await request.json();
    const { shiftId, shiftType, description, timeframes } = body;

    if (!shiftId || !shiftType || !timeframes || timeframes.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate each timeframe's meal data
    for (const tf of timeframes) {
      if ((tf.mealStart && !tf.mealEnd) || (!tf.mealStart && tf.mealEnd)) {
        return NextResponse.json(
          { error: "Both meal start and end are required if one is provided" },
          { status: 400 }
        );
      }
    }

    const normalizeInterval = (start: string, end: string) => {
      const [sH, sM] = start.split(":").map(Number);
      const [eH, eM] = end.split(":").map(Number);
      const s = sH * 60 + sM;
      let e = eH * 60 + eM;
      if (e < s) e += 24 * 60;
      return { start: s, end: e };
    };

    // Validate each timeframe's meal is within its own boundaries
    for (const tf of timeframes) {
      if (tf.mealStart && tf.mealEnd) {
        const meal = normalizeInterval(tf.mealStart, tf.mealEnd);
        const frame = normalizeInterval(tf.startTime, tf.endTime);
        
        if (meal.end <= meal.start) {
          return NextResponse.json(
            { error: "Meal end must be later than meal start" },
            { status: 400 }
          );
        }

        let ms = meal.start;
        let me = meal.end;
        if (ms < frame.start) {
          ms += 24 * 60;
          me += 24 * 60;
        }

        if (!(frame.start <= ms && me <= frame.end)) {
          return NextResponse.json(
            { error: "Meal timeframe must be inside its shift timeframe" },
            { status: 400 }
          );
        }
      }
    }

    // Use service role client for updates
    const adminClient = createAdminClient();

    // Update work schedule
    const { error: updateError } = await adminClient
      .from("work_schedules")
      .update({
        shift_id: shiftId,
        shift_type: shiftType,
        description: description || null,
      })
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (updateError) throw updateError;

    // Delete existing timeframes
    await adminClient
      .from("work_schedule_timeframes")
      .delete()
      .eq("work_schedule_id", id);

    // Insert new timeframes (including meal data)
    const timeframesData = timeframes.map(
      (tf: { startTime: string; endTime: string; mealType?: string; mealStart?: string; mealEnd?: string }, index: number) => ({
        work_schedule_id: id,
        start_time: tf.startTime,
        end_time: tf.endTime,
        frame_order: index,
        meal_type: tf.mealType || 'paid',
        meal_start: tf.mealStart || null,
        meal_end: tf.mealEnd || null,
      })
    );

    const { error: timeframesError } = await adminClient
      .from("work_schedule_timeframes")
      .insert(timeframesData);

    if (timeframesError) throw timeframesError;

    // Fetch updated schedule using admin client for consistency
    const { data: schedules, error: fetchError } = await adminClient
      .from("work_schedules")
      .select(
        `
        id,
        shift_id,
        shift_type,
        description,
        created_at,
        updated_at,
        work_schedule_timeframes(id, start_time, end_time, frame_order, meal_type, meal_start, meal_end)
      `
      )
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .limit(1);

    if (fetchError) throw fetchError;
    if (!schedules || schedules.length === 0) {
      throw new Error("Schedule was updated but could not be fetched");
    }

    return NextResponse.json(schedules[0]);
  } catch (error) {
    console.error("Error updating schedule:", error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : JSON.stringify(error);
    return NextResponse.json(
      { error: message || "Failed to update schedule" },
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
    const supabase = await createClient();
    
    // Get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant ID" }, { status: 400 });
    }

    const { id } = await params;

    // Use service role client for delete
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("work_schedules")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (error) throw error;

    return NextResponse.json({ message: "Schedule deleted" });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage || "Failed to delete schedule" },
      { status: 500 }
    );
  }
}
