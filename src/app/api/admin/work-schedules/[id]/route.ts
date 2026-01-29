import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// Helper functions for overlap detection
function shiftSpansMidnight(schedule: any): boolean {
  const timeframes = schedule.work_schedule_timeframes || [];
  return timeframes.some((tf: any) => {
    const [sH, sM] = tf.start_time.split(':').map(Number);
    const [eH, eM] = tf.end_time.split(':').map(Number);
    const startMins = sH * 60 + sM;
    const endMins = eH * 60 + eM;
    return endMins < startMins;
  });
}

function getPreviousDay(day: string): string {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const index = days.indexOf(day.toLowerCase());
  return days[(index - 1 + 7) % 7];
}

function checkShiftOverlap(schedule1: any, schedule2: any, isSchedule2Overflow: boolean): boolean {
  const tf1 = schedule1.work_schedule_timeframes || [];
  const tf2 = schedule2.work_schedule_timeframes || [];
  
  for (const t1 of tf1) {
    for (const t2 of tf2) {
      const [s1H, s1M] = t1.start_time.split(':').map(Number);
      const [e1H, e1M] = t1.end_time.split(':').map(Number);
      const [s2H, s2M] = t2.start_time.split(':').map(Number);
      const [e2H, e2M] = t2.end_time.split(':').map(Number);
      
      const start1 = s1H * 60 + s1M;
      const end1 = e1H * 60 + e1M;
      let start2 = s2H * 60 + s2M;
      let end2 = e2H * 60 + e2M;
      
      if (isSchedule2Overflow && end2 < start2) {
        start2 = 0;
      }
      
      const spans1 = end1 < start1;
      const spans2 = end2 < start2;
      
      if (spans1 && spans2) {
        if (!(end1 < start2 && end2 < start1)) {
          return true;
        }
      } else if (spans1) {
        if (start2 < end1 || start2 >= start1) {
          return true;
        }
      } else if (spans2) {
        if (end1 > start2) {
          return true;
        }
      } else {
        if (start1 < end2 && start2 < end1) {
          return true;
        }
      }
    }
  }
  
  return false;
}

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

    // Get the current schedule to detect changes
    const { data: currentSchedule, error: fetchCurrentError } = await adminClient
      .from("work_schedules")
      .select("shift_id")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchCurrentError) throw fetchCurrentError;

    // Check if this work schedule is used in any roster patterns
    const { data: rosterPatterns, error: rosterError } = await adminClient
      .from("roster_patterns")
      .select("id, shift_id, pattern_rows")
      .eq("tenant_id", tenantId);

    if (rosterError) throw rosterError;

    // Find patterns that use this schedule and check for violations
    const affectedPatterns: Array<{id: string, shift_id: string, violations: string[]}> = [];
    
    if (rosterPatterns) {
      for (const pattern of rosterPatterns) {
        const patternRows = pattern.pattern_rows as any[];
        let hasShift = false;
        const violations: string[] = [];

        for (const row of patternRows) {
          for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
            const schedules = row[day];
            if (Array.isArray(schedules)) {
              for (const schedule of schedules) {
                if (schedule.id === id) {
                  hasShift = true;
                  
                  // Create a modified version with new timeframes
                  const modifiedSchedule = {
                    ...schedule,
                    shift_id: shiftId,
                    work_schedule_timeframes: timeframes.map((tf: any, index: number) => ({
                      start_time: tf.startTime,
                      end_time: tf.endTime,
                      frame_order: index,
                    }))
                  };

                  // Check overlaps with other shifts in same day
                  for (const otherSchedule of schedules) {
                    if (otherSchedule.id !== id) {
                      if (checkShiftOverlap(modifiedSchedule, otherSchedule, false)) {
                        violations.push(`Week ${row.number}, ${day.charAt(0).toUpperCase() + day.slice(1)}: overlaps with ${otherSchedule.shift_id}`);
                      }
                    }
                  }

                  // Check overlaps with overflow from previous day
                  const prevDay = getPreviousDay(day);
                  const prevDaySchedules = row[prevDay];
                  if (Array.isArray(prevDaySchedules)) {
                    for (const prevSchedule of prevDaySchedules) {
                      if (shiftSpansMidnight(prevSchedule)) {
                        if (checkShiftOverlap(modifiedSchedule, prevSchedule, true)) {
                          violations.push(`Week ${row.number}, ${day.charAt(0).toUpperCase() + day.slice(1)}: overlaps with overnight shift ${prevSchedule.shift_id} from ${prevDay}`);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        if (hasShift && violations.length > 0) {
          affectedPatterns.push({
            id: pattern.id,
            shift_id: pattern.shift_id || 'Unnamed Pattern',
            violations
          });
        }
      }
    }

    // If there are violations, return error with details
    if (affectedPatterns.length > 0) {
      return NextResponse.json({
        error: "Cannot update schedule: changes would cause overlaps in roster patterns",
        affectedPatterns: affectedPatterns.map(p => ({
          patternName: p.shift_id,
          violations: p.violations
        }))
      }, { status: 400 });
    }

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

    // If shift_id changed, update all roster pattern references
    if (currentSchedule.shift_id !== shiftId) {
      // Update all roster patterns that reference this schedule
      if (rosterPatterns) {
        for (const pattern of rosterPatterns) {
          const patternRows = pattern.pattern_rows as any[];
          let hasChanges = false;

          // Deep clone to avoid modifying original
          const updatedRows = JSON.parse(JSON.stringify(patternRows));

          for (const row of updatedRows) {
            for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
              const schedules = row[day];
              if (Array.isArray(schedules)) {
                for (const schedule of schedules) {
                  if (schedule.id === id) {
                    schedule.shift_id = shiftId;
                    hasChanges = true;
                  }
                }
              }
            }
          }

          // Update pattern if changes were made
          if (hasChanges) {
            await adminClient
              .from("roster_patterns")
              .update({ pattern_rows: updatedRows })
              .eq("id", pattern.id)
              .eq("tenant_id", tenantId);
          }
        }
      }
    }

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
