import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

    // Use admin client to bypass RLS for fetching
    const adminClient = createAdminClient();

    const { data: schedules, error } = await adminClient
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
      // Skip validation if both meal start and end are empty/null
      const mealStart = tf.mealStart || "";
      const mealEnd = tf.mealEnd || "";
      
      // Only validate if BOTH meal times are actually provided (non-empty)
      if (mealStart && mealEnd && mealStart !== ":" && mealEnd !== ":") {
        const meal = normalizeInterval(mealStart, mealEnd);
        const frame = normalizeInterval(tf.startTime, tf.endTime);
        
        // Don't validate meal end > meal start as meals can span midnight
        // The normalizeInterval function handles midnight-crossing

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

    // Create work schedule using service role client to bypass RLS
    const adminClient = createAdminClient();

    // Generate ID for the new schedule
    const scheduleId = crypto.randomUUID();

    // Detect if any timeframe spans midnight
    const spansMidnight = timeframes.some((tf: { startTime: string; endTime: string }) => {
      const [sH, sM] = tf.startTime.split(":").map(Number);
      const [eH, eM] = tf.endTime.split(":").map(Number);
      const startMins = sH * 60 + sM;
      const endMins = eH * 60 + eM;
      return endMins < startMins; // end_time < start_time indicates midnight crossing
    });

    const { error: scheduleError } = await adminClient
      .from("work_schedules")
      .insert({
        id: scheduleId,
        tenant_id: tenantId,
        shift_id: shiftId,
        shift_type: shiftType,
        description: description || null,
        spans_midnight: spansMidnight,
      });

    if (scheduleError) throw scheduleError;

    // Insert timeframes with service role (including meal data)
    const timeframesData = timeframes.map(
      (tf: { startTime: string; endTime: string; mealType?: string; mealStart?: string; mealEnd?: string }, index: number) => ({
        work_schedule_id: scheduleId,
        start_time: tf.startTime,
        end_time: tf.endTime,
        frame_order: index,
        meal_type: tf.mealType || 'paid',
        meal_start: (tf.mealStart && tf.mealStart !== ":") ? tf.mealStart : null,
        meal_end: (tf.mealEnd && tf.mealEnd !== ":") ? tf.mealEnd : null,
      })
    );

    const { error: timeframesError } = await adminClient
      .from("work_schedule_timeframes")
      .insert(timeframesData);

    if (timeframesError) throw timeframesError;

    // Fetch complete schedule with timeframes using admin client (bypasses RLS)
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
      .eq("id", scheduleId)
      .limit(1);

    if (fetchError) throw fetchError;
    if (!schedules || schedules.length === 0) {
      throw new Error("Schedule was created but could not be fetched");
    }

    return NextResponse.json(schedules[0], { status: 201 });
  } catch (error) {
    console.error("Error creating schedule:", error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : JSON.stringify(error);
    return NextResponse.json(
      { error: message || "Failed to create schedule" },
      { status: 500 }
    );
  }
}
