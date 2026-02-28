/**
 * Shift Details Panel Component
 * 
 * Displays details of a selected shift in the roster pattern calendar,
 * including allocation date computed by current settings.
 */

import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { format, startOfDay, isSameDay, differenceInMinutes } from 'date-fns';
import type { WorkSchedule } from '@/app/admin/roster-patterns/roster-patterns-client';
import {
  computeAllocationDate,
  formatAllocationResult,
  type RosterPatternSettings,
  type Shift,
} from '@/lib/shift-allocation';

interface TimeFrame {
  start_time: string;
  end_time: string;
  meal_type?: string | null;
  meal_start?: string | null;
  meal_end?: string | null;
  frame_order: number;
}

interface SelectedCell {
  rowId: string;
  day: string;
  date: Date;
  weekNumber?: number; // For continuous mode week display
}

interface SelectedShiftData {
  schedule: WorkSchedule;
  daySchedules: WorkSchedule[]; // All schedules on selected day
}

interface ShiftDetailsPanelProps {
  selectedCell: SelectedCell | null;
  selectedShift: SelectedShiftData | null;
  allocationSettings: RosterPatternSettings;
  isUnsaved?: boolean;
  timezone?: string;
  endDateType?: 'continuous' | 'specify';
  formatDateForDisplay?: (date: Date, isPatternDate?: boolean) => string;
  startDate?: string; // For continuous mode week number calculation
}

/**
 * Format duration in minutes to HH:mm format
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

/**
 * Format time in HH:mm format
 */
function formatTime(timeStr: string): string {
  if (!timeStr) return 'N/A';
  const [hours, minutes] = timeStr.split(':');
  return `${hours}:${minutes}`;
}

/**
 * Compute shift duration from timeframes
 */
function computeShiftDuration(timeframes: TimeFrame[] = []): number {
  if (timeframes.length === 0) return 0;
  
  let totalMinutes = 0;
  for (const frame of timeframes) {
    const [startH, startM] = frame.start_time.split(':').map(Number);
    const [endH, endM] = frame.end_time.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    
    // Handle overnight shifts: if end < start, add 24 hours
    const duration = endMinutes < startMinutes 
      ? (24 * 60) - startMinutes + endMinutes
      : endMinutes - startMinutes;
    
    // Subtract meal break if present
    if (frame.meal_start && frame.meal_end) {
      const [mealStartH, mealStartM] = frame.meal_start.split(':').map(Number);
      const [mealEndH, mealEndM] = frame.meal_end.split(':').map(Number);
      const mealDuration = (mealEndH * 60 + mealEndM) - (mealStartH * 60 + mealStartM);
      totalMinutes += Math.max(0, duration - mealDuration);
    } else {
      totalMinutes += duration;
    }
  }
  
  return totalMinutes;
}

/**
 * Create a Shift object from WorkSchedule for allocation computation
 */
function workScheduleToShift(
  schedule: WorkSchedule,
  selectedDate: Date
): Shift {
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  
  // Parse timeframes to get start and end times
  const timeframes = schedule.work_schedule_timeframes?.sort((a: TimeFrame, b: TimeFrame) => a.frame_order - b.frame_order) || [];
  
  if (timeframes.length === 0) {
    return {
      id: schedule.id,
      startDateTime: selectedDate,
      endDateTime: selectedDate,
    };
  }
  
  const firstFrame = timeframes[0];
  const lastFrame = timeframes[timeframes.length - 1];
  
  const [startH, startM] = firstFrame.start_time.split(':').map(Number);
  const [endH, endM] = lastFrame.end_time.split(':').map(Number);
  
  const startDateTime = new Date(`${dateStr}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`);
  
  // If end time is less than start time, assume it's next day (overnight shift)
  let endDateTime = new Date(`${dateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`);
  if (endDateTime < startDateTime) {
    endDateTime = new Date(endDateTime.getTime() + 24 * 60 * 60 * 1000);
  }
  
  return {
    id: schedule.id,
    startDateTime,
    endDateTime,
  };
}

export function ShiftDetailsPanel({
  selectedCell,
  selectedShift,
  allocationSettings,
  isUnsaved = false,
  timezone,
  endDateType = 'specify',
  formatDateForDisplay,
  startDate,
}: ShiftDetailsPanelProps) {
  if (!selectedCell || !selectedShift) {
    return null;
  }
  
  const { schedule, daySchedules } = selectedShift;
  const shiftDuration = computeShiftDuration(schedule.work_schedule_timeframes);
  
  // Compute allocation date using current settings
  const shift = workScheduleToShift(schedule, selectedCell.date);
  const allocationResult = computeAllocationDate(shift, allocationSettings, {
    allShifts: daySchedules.map(s => workScheduleToShift(s, selectedCell.date)),
    timezone,
  });
  
  // Use provided formatter or create fallback formatter
  const defaultFormatter = (date: Date, isPatternDate: boolean = false): string => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    
    if (endDateType === 'continuous' && isPatternDate && selectedCell?.weekNumber) {
      return `Week ${selectedCell.weekNumber}: ${dayName}`;
    }
    
    if (endDateType === 'continuous' && isPatternDate && startDate) {
      const patternStart = new Date(startDate);
      const dateCopy = new Date(date);
      const diffTime = Math.abs(dateCopy.getTime() - patternStart.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const weekNum = Math.floor(diffDays / 7) + 1;
      return `Week ${weekNum}: ${dayName}`;
    }
    
    if (endDateType === 'continuous') {
      return dayName;
    }
    
    return format(date, 'yyyy-MM-dd (EEEE)');
  };
  const formatter = formatDateForDisplay || defaultFormatter;
  
  const allocationDateStr = allocationResult.allocationDate
    ? formatter(allocationResult.allocationDate, true)
    : 'N/A';
  
  // For selected date, always use week number logic for continuous mode (don't rely on passed formatter)
  let selectedDateStr: string;
  if (endDateType === 'continuous' && selectedCell?.weekNumber) {
    const dayName = selectedCell.date.toLocaleDateString('en-US', { weekday: 'long' });
    selectedDateStr = `Week ${selectedCell.weekNumber}: ${dayName}`;
  } else {
    selectedDateStr = formatter(selectedCell.date, true);
  }
  
  const allocationDiffersFromSelected = allocationResult.allocationDate
    ? !isSameDay(allocationResult.allocationDate, selectedCell.date)
    : false;
  
  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Shift Details
          {isUnsaved && (
            <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-100 px-2 py-1 rounded">
              Preview (unsaved)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected Date */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Selected Date</p>
          <p className="text-sm font-medium text-gray-900">{selectedDateStr}</p>
        </div>
        
        {/* Shifts on Selected Day */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Shifts on This Day</p>
          {daySchedules.length === 0 ? (
            <p className="text-sm text-gray-600 italic">No shift scheduled</p>
          ) : (
            <div className="space-y-2">
              {daySchedules.map((sched, idx) => (
                <div
                  key={sched.id}
                  className={`p-2 rounded text-sm ${
                    sched.id === selectedShift.schedule.id
                      ? 'bg-blue-200 border border-blue-400'
                      : 'bg-gray-100'
                  }`}
                >
                  <p className="font-medium text-gray-900">
                    {sched.shift_id}
                    {sched.id === selectedShift.schedule.id && (
                      <span className="ml-2 text-xs font-normal text-blue-700">(Currently Viewing)</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Selected Shift Details */}
        {daySchedules.length > 0 && (
          <>
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Shift Timing</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Shift ID:</span>
                  <span className="font-medium">{schedule.shift_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium">{schedule.shift_type}</span>
                </div>
                {schedule.work_schedule_timeframes && schedule.work_schedule_timeframes.length > 0 && (
                  <>
                    {schedule.work_schedule_timeframes.length > 1 ? (
                      // Split shift - show all timeframes
                      <div className="space-y-2">
                        {schedule.work_schedule_timeframes.map((tf, idx) => (
                          <div key={idx} className="border-l-2 border-blue-300 pl-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">Frame {idx + 1}:</span>
                              <span className="font-medium">
                                {formatTime(tf.start_time)} - {formatTime(tf.end_time)}
                              </span>
                            </div>
                            {tf.meal_start && (
                              <div className="flex justify-between text-xs text-gray-600">
                                <span>Meal:</span>
                                <span>
                                  {formatTime(tf.meal_start)} - {formatTime(tf.meal_end || '')}
                                  {tf.meal_type && (
                                    <span className="ml-1 font-medium text-blue-600">
                                      ({tf.meal_type === 'paid' ? 'Paid' : 'Unpaid'})
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Single shift - show start/end
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Start:</span>
                          <span className="font-medium">
                            {formatTime(schedule.work_schedule_timeframes[0].start_time)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">End:</span>
                          <span className="font-medium">
                            {formatTime(schedule.work_schedule_timeframes[schedule.work_schedule_timeframes.length - 1].end_time)}
                          </span>
                        </div>
                        {schedule.work_schedule_timeframes[0].meal_start && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Meal Break:</span>
                            <span className="font-medium">
                              {formatTime(schedule.work_schedule_timeframes[0].meal_start)} - {formatTime(schedule.work_schedule_timeframes[0].meal_end || '')}
                              {schedule.work_schedule_timeframes[0].meal_type && (
                                <span className="ml-1 text-blue-600">
                                  ({schedule.work_schedule_timeframes[0].meal_type === 'paid' ? 'Paid' : 'Unpaid'})
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-gray-600 font-medium">Duration:</span>
                      <span className="font-bold">{formatDuration(shiftDuration)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Allocation Result */}
            {endDateType === 'specify' && (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Payroll Allocation</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Day of Allocation:</p>
                    <p className="text-sm font-medium">{allocationDateStr}</p>
                  </div>
                  
                  {allocationDiffersFromSelected && (
                    <Alert className="bg-orange-50 border-orange-200 py-2 px-3">
                      <AlertCircle className="h-3.5 w-3.5 text-orange-600 inline mr-2" />
                      <span className="text-xs text-orange-700">
                        This shift will be allocated to a different day ({allocationDateStr}) than the selected calendar date ({selectedDateStr})
                      </span>
                    </Alert>
                  )}
                  
                  {allocationResult.error && (
                    <Alert className="bg-red-50 border-red-200 py-2 px-3">
                      <AlertCircle className="h-3.5 w-3.5 text-red-600 inline mr-2" />
                      <span className="text-xs text-red-700">{allocationResult.error}</span>
                    </Alert>
                  )}
                  
                  {allocationResult.daySegments && (
                    <div className="text-xs">
                      <p className="text-gray-700 mb-2">
                        Split across {allocationResult.daySegments.length} calendar days:
                      </p>
                      <ul className="space-y-1 list-disc list-inside">
                        {allocationResult.daySegments.map((segment, idx) => (
                          <li key={idx} className="text-gray-700">
                            {formatter(segment.date, true)}: {formatDuration(segment.minutes)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
            {endDateType === 'continuous' && (
              <>
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Payroll Allocation</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Day of Allocation:</p>
                      <p className="text-sm font-medium">{allocationDateStr}</p>
                    </div>
                    
                    {allocationResult.error && (
                      <Alert className="bg-red-50 border-red-200 py-2 px-3">
                        <AlertCircle className="h-3.5 w-3.5 text-red-600 inline mr-2" />
                        <span className="text-xs text-red-700">{allocationResult.error}</span>
                      </Alert>
                    )}
                  </div>
                </div>
                <div className="bg-gray-100 p-2 rounded text-xs text-gray-700">
                  <p className="font-medium mb-1">Mode: {allocationSettings.nightShiftAllocationMode}</p>
                  <p className="text-gray-600">
                    Using the currently configured allocation rule. {isUnsaved && 'This is a preview of unsaved changes.'}
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
