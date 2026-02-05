import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// Helper functions for overlap detection
function shiftSpansMidnight(schedule: any): boolean {
  const timeframes = schedule?.work_schedule_timeframes || [];
  if (!Array.isArray(timeframes)) return false;
  return timeframes.some((tf: any) => {
    if (!tf || typeof tf.start_time !== 'string' || typeof tf.end_time !== 'string') return false;
    const [sH, sM] = tf.start_time.split(':').map(Number);
    const [eH, eM] = tf.end_time.split(':').map(Number);
    const startMins = (Number.isNaN(sH) ? 0 : sH) * 60 + (Number.isNaN(sM) ? 0 : sM);
    const endMins = (Number.isNaN(eH) ? 0 : eH) * 60 + (Number.isNaN(eM) ? 0 : eM);
    return endMins < startMins;
  });
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

type PatternRowRecord = { number?: number; [key: string]: unknown };

function getPreviousDay(day: string): string {
  const index = DAYS.indexOf(day.toLowerCase() as typeof DAYS[number]);
  return DAYS[(index - 1 + 7) % 7];
}

function getNextDay(day: string): string {
  const index = DAYS.indexOf(day.toLowerCase() as typeof DAYS[number]);
  return DAYS[(index + 1) % 7];
}

function timeStringToMinutes(timeStr: string | undefined | null): number {
  if (timeStr == null || typeof timeStr !== 'string') return 0;
  const parts = timeStr.split(':').map(Number);
  const hours = Number.isNaN(parts[0]) ? 0 : parts[0];
  const minutes = Number.isNaN(parts[1]) ? 0 : parts[1];
  return hours * 60 + minutes;
}

function getTimeBetweenShifts(endTime: string, startTime: string, isDifferentDay: boolean): number {
  const endMinutes = timeStringToMinutes(endTime);
  const startMinutes = timeStringToMinutes(startTime);
  const minsPerDay = 24 * 60;
  if (isDifferentDay) {
    const minutesToMidnight = minsPerDay - endMinutes;
    const minutesFromMidnight = startMinutes;
    return (minutesToMidnight + minutesFromMidnight) / 60;
  }
  let diffMinutes = startMinutes - endMinutes;
  if (diffMinutes < 0) diffMinutes += minsPerDay;
  return diffMinutes / 60;
}

function getShiftEndTime(schedule: any): string {
  const tf = (schedule?.work_schedule_timeframes || []).filter(
    (t: any) => t != null && typeof t.end_time === 'string'
  );
  if (tf.length === 0) return '00:00';
  const sorted = [...tf].sort((a: any, b: any) => (a.frame_order ?? 0) - (b.frame_order ?? 0));
  const end = sorted[sorted.length - 1]?.end_time;
  return typeof end === 'string' ? end : '00:00';
}

function getShiftStartTime(schedule: any): string {
  const tf = (schedule?.work_schedule_timeframes || []).filter(
    (t: any) => t != null && typeof t.start_time === 'string'
  );
  if (tf.length === 0) return '00:00';
  const sorted = [...tf].sort((a: any, b: any) => (a.frame_order ?? 0) - (b.frame_order ?? 0));
  const start = sorted[0]?.start_time;
  return typeof start === 'string' ? start : '00:00';
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
    const { shiftId, shiftType, description, timeframes, validateOnly } = body;

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

    const normalizeInterval = (start: unknown, end: unknown) => {
      const startStr = typeof start === "string" ? start : "";
      const endStr = typeof end === "string" ? end : "";
      const [sH, sM] = startStr.split(":").map((n) => (Number.isNaN(Number(n)) ? 0 : Number(n)));
      const [eH, eM] = endStr.split(":").map((n) => (Number.isNaN(Number(n)) ? 0 : Number(n)));
      const s = sH * 60 + sM;
      let e = eH * 60 + eM;
      if (e < s) e += 24 * 60;
      return { start: s, end: e };
    };

    // Validate each timeframe's meal is within its own boundaries
    for (const tf of timeframes) {
      if (tf.mealStart && tf.mealEnd) {
        if (tf.startTime == null || tf.endTime == null || typeof tf.startTime !== "string" || typeof tf.endTime !== "string") {
          return NextResponse.json(
            { error: "Each timeframe must have valid start and end times" },
            { status: 400 }
          );
        }
        const meal = normalizeInterval(tf.mealStart, tf.mealEnd);
        const frame = normalizeInterval(tf.startTime, tf.endTime);
        if (Number.isNaN(frame.start) || Number.isNaN(frame.end) || Number.isNaN(meal.start) || Number.isNaN(meal.end)) {
          return NextResponse.json(
            { error: "Invalid time format in timeframe or meal" },
            { status: 400 }
          );
        }
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

    // Get the current schedule and its timeframes (for "only warn when this edit causes the violation")
    const { data: currentSchedule, error: fetchCurrentError } = await adminClient
      .from("work_schedules")
      .select("shift_id, work_schedule_timeframes(start_time, end_time, frame_order)")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchCurrentError) throw fetchCurrentError;
    if (!currentSchedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const currentTimeframes = (currentSchedule as any).work_schedule_timeframes || [];
    const currentScheduleWithTimeframes = {
      id,
      shift_id: (currentSchedule as any).shift_id,
      work_schedule_timeframes: Array.isArray(currentTimeframes)
        ? currentTimeframes.map((tf: any, index: number) => ({
            start_time: tf.start_time,
            end_time: tf.end_time,
            frame_order: tf.frame_order ?? index,
          }))
        : [],
    };

    // Load minimum hours between shifts from tenant config
    let minHoursBetweenShifts = 8;
    const { data: tenantConfig } = await adminClient
      .from("tenant_config")
      .select("min_hours_between_shifts")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (tenantConfig?.min_hours_between_shifts != null) {
      minHoursBetweenShifts = Number(tenantConfig.min_hours_between_shifts);
    }

    // Check if this work schedule is used in any roster patterns
    const { data: rosterPatterns, error: rosterError } = await adminClient
      .from("roster_patterns")
      .select("id, shift_id, pattern_rows")
      .eq("tenant_id", tenantId);

    if (rosterError) throw rosterError;

    // Single modified schedule with new timeframes for validation
    const modifiedSchedule = {
      id,
      shift_id: shiftId,
      work_schedule_timeframes: timeframes.map((tf: any, index: number) => ({
        start_time: tf.startTime,
        end_time: tf.endTime,
        frame_order: index,
      })),
    };

    const overlapAffectedPatterns: Array<{ id: string; shift_id: string; violations: string[] }> = [];
    const restTimeAffectedPatterns: Array<{ id: string; shift_id: string; violations: string[] }> = [];

    try {
      if (rosterPatterns && Array.isArray(rosterPatterns)) {
        for (const pattern of rosterPatterns) {
          const patternRows = pattern?.pattern_rows;
          if (!Array.isArray(patternRows)) continue;
          let patternUsesSchedule = false;
          const overlapViolations: string[] = [];
          const restTimeViolations: string[] = [];

          for (const row of patternRows) {
            if (!row) continue;
            const rowRecord = row as PatternRowRecord;
            for (const day of DAYS) {
              const rawSchedules = rowRecord[day];
              if (!Array.isArray(rawSchedules)) continue;
              const schedules = rawSchedules.map((s: any) => (s?.id === id ? modifiedSchedule : s));

              for (const schedule of schedules) {
                if (schedule?.id === id) patternUsesSchedule = true;
              }
              // Overlap: same day with other shifts (when current day has the edited schedule)
              for (const schedule of schedules) {
                if (schedule?.id === id) {
                  for (const other of schedules) {
                    if (other?.id !== id && other && checkShiftOverlap(modifiedSchedule, other, false)) {
                      overlapViolations.push(`Week ${rowRecord.number ?? '?'}, ${day.charAt(0).toUpperCase() + day.slice(1)}: overlaps with ${other.shift_id ?? 'shift'}`);
                    }
                  }
                  break;
                }
              }
              // Overlap: overflow from previous day (run for every day; prev day uses modified times when it's the edited schedule)
              const prevDay = getPreviousDay(day);
              const prevDaySchedules = Array.isArray(rowRecord[prevDay]) ? (rowRecord[prevDay] as any[]).map((s: any) => (s?.id === id ? modifiedSchedule : s)) : [];
              const firstCurrent = schedules[0];
              if (firstCurrent) {
                for (const prev of prevDaySchedules) {
                  if (prev && shiftSpansMidnight(prev) && checkShiftOverlap(firstCurrent, prev, true)) {
                    overlapViolations.push(`Week ${rowRecord.number ?? '?'}, ${day.charAt(0).toUpperCase() + day.slice(1)}: overlaps with overnight shift ${prev.shift_id ?? 'shift'} from ${prevDay}`);
                  }
                }
              }

              // Helper: only add rest-time violation if this edit *causes* it (new gap < min, old gap was >= min)
              const maybeAddRestViolation = (
                lastSchedule: any,
                nextSchedule: any,
                isDifferentDay: boolean,
                label: string
              ) => {
                if (!lastSchedule || !nextSchedule) return;
                const involvesEdited = lastSchedule.id === id || nextSchedule.id === id;
                if (!involvesEdited) return;
                const endOld = lastSchedule.id === id ? getShiftEndTime(currentScheduleWithTimeframes) : getShiftEndTime(lastSchedule);
                const startOld = nextSchedule.id === id ? getShiftStartTime(currentScheduleWithTimeframes) : getShiftStartTime(nextSchedule);
                const timeBetweenOld = getTimeBetweenShifts(endOld, startOld, isDifferentDay);
                const timeBetweenNew = getTimeBetweenShifts(getShiftEndTime(lastSchedule), getShiftStartTime(nextSchedule), isDifferentDay);
                if (timeBetweenNew < minHoursBetweenShifts && timeBetweenOld >= minHoursBetweenShifts) {
                  restTimeViolations.push(`Week ${rowRecord.number ?? '?'}, ${label}: rest involving this schedule is ${timeBetweenNew.toFixed(1)}h (min ${minHoursBetweenShifts}h)`);
                }
              };

              // Rest time: previous day last (non-overflow) -> current first; reuse prevDaySchedules from overlap block
              const prevNonOverflow = prevDaySchedules.filter((s: any) => s && !shiftSpansMidnight(s));
              const currentSchedules = schedules;
              if (prevNonOverflow.length > 0 && currentSchedules.length > 0) {
                const lastPrev = prevNonOverflow[prevNonOverflow.length - 1];
                const firstCur = currentSchedules[0];
                const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
                maybeAddRestViolation(lastPrev, firstCur, true, `${dayLabel}: rest between previous day and ${dayLabel}`);
              }
              // Rest time: within same day
              for (let i = 0; i < schedules.length - 1; i++) {
                const cur = schedules[i];
                const next = schedules[i + 1];
                const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
                maybeAddRestViolation(cur, next, false, `${dayLabel}: rest between shifts`);
              }
              // Rest time: current day last -> next day first
              const nextDay = getNextDay(day);
              const nextDaySchedules = Array.isArray(rowRecord[nextDay]) ? (rowRecord[nextDay] as any[]).map((s: any) => (s?.id === id ? modifiedSchedule : s)) : [];
              if (currentSchedules.length > 0 && nextDaySchedules.length > 0) {
                const lastCur = currentSchedules[currentSchedules.length - 1];
                const firstNext = nextDaySchedules[0];
                const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
                maybeAddRestViolation(lastCur, firstNext, true, `${dayLabel} → ${nextDay}: rest to next day`);
              }
            }
          }

          if (patternUsesSchedule && overlapViolations.length > 0) {
            overlapAffectedPatterns.push({
              id: pattern.id,
              shift_id: pattern.shift_id || 'Unnamed Pattern',
              violations: overlapViolations,
            });
          }
          if (patternUsesSchedule && restTimeViolations.length > 0) {
            restTimeAffectedPatterns.push({
              id: pattern.id,
              shift_id: pattern.shift_id || 'Unnamed Pattern',
              violations: restTimeViolations,
            });
          }
        }
      }
    } catch (validationErr) {
      console.error("Work schedule update: roster validation error", validationErr);
      return NextResponse.json(
        {
          error: "Validation failed while checking roster patterns. You can try saving again, or remove this work schedule from all roster patterns first and then edit it.",
        },
        { status: 400 }
      );
    }

    // Block save if any pattern would have overlaps; user must remove schedule from those patterns first
    if (overlapAffectedPatterns.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot save: this change would cause overlapping shifts in one or more roster patterns. Remove this work schedule from the affected pattern(s) before saving, or edit the pattern to resolve the overlap.",
          blockReason: "overlap",
          affectedPatterns: overlapAffectedPatterns.map((p) => ({
            patternName: p.shift_id,
            patternId: p.id,
            violations: p.violations,
          })),
        },
        { status: 400 }
      );
    }

    // Validate-only: return rest-time warnings without saving (so client can show Save anyway / Cancel)
    if (validateOnly === true) {
      return NextResponse.json({
        allowed: true,
        restTimeAffectedPatterns: restTimeAffectedPatterns.map((p) => ({
          patternName: p.shift_id,
          patternId: p.id,
          violations: p.violations,
        })),
      });
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

    // Build the updated schedule definition to push into roster patterns
    const updatedScheduleDefinition = {
      id,
      shift_id: shiftId,
      shift_type: shiftType,
      description: description || null,
      work_schedule_timeframes: timeframes.map(
        (tf: { startTime: string; endTime: string; mealType?: string; mealStart?: string; mealEnd?: string }, index: number) => ({
          start_time: tf.startTime,
          end_time: tf.endTime,
          frame_order: index,
          meal_type: tf.mealType || "paid",
          meal_start: tf.mealStart || null,
          meal_end: tf.mealEnd || null,
        })
      ),
    };

    // Refresh this schedule's definition in all roster patterns that use it (so pattern UI shows updated times)
    if (rosterPatterns && Array.isArray(rosterPatterns)) {
      for (const pattern of rosterPatterns) {
        const patternRows = pattern?.pattern_rows;
        if (!Array.isArray(patternRows)) continue;
        let hasChanges = false;
        const updatedRows = JSON.parse(JSON.stringify(patternRows));

        for (const row of updatedRows) {
          for (const day of DAYS) {
            const schedules = row[day];
            if (!Array.isArray(schedules)) continue;
            for (let i = 0; i < schedules.length; i++) {
              if (schedules[i]?.id === id) {
                schedules[i] = { ...schedules[i], ...updatedScheduleDefinition };
                hasChanges = true;
              }
            }
          }
        }

        if (hasChanges) {
          await adminClient
            .from("roster_patterns")
            .update({ pattern_rows: updatedRows })
            .eq("id", pattern.id)
            .eq("tenant_id", tenantId);
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

    const payload: Record<string, unknown> = { ...schedules[0] };
    if (restTimeAffectedPatterns.length > 0) {
      payload.warnings = {
        restTimeViolations: restTimeAffectedPatterns.map((p) => ({
          patternName: p.shift_id,
          patternId: p.id,
          violations: p.violations,
        })),
      };
    }
    return NextResponse.json(payload);
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
