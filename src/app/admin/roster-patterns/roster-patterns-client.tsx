"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar as CalendarIcon, Plus, Trash2, Minus, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/supabase";

interface TimeFrame {
  start_time: string;
  end_time: string;
  meal_type?: string | null;
  meal_start?: string | null;
  meal_end?: string | null;
  frame_order: number;
}

interface PatternRow {
  id: string;
  number: number;
  monday: WorkSchedule[];
  tuesday: WorkSchedule[];
  wednesday: WorkSchedule[];
  thursday: WorkSchedule[];
  friday: WorkSchedule[];
  saturday: WorkSchedule[];
  sunday: WorkSchedule[];
}

interface WorkSchedule {
  id: string;
  shift_id: string;
  shift_type: string;
  created_at: string;
  work_schedule_timeframes: TimeFrame[];
}

interface SavedPattern {
  id: string;
  shift_id: string;
  start_date: string;
  end_date_type: "specify" | "continuous";
  end_date: string | null;
  weeks_pattern: string;
  start_pattern_week: string;
  start_day: string;
  pattern_rows: PatternRow[];
  created_at?: string;
}

export function RosterPatternsClient() {
  const [showForm, setShowForm] = useState(false);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [shiftId, setShiftId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDateType, setEndDateType] = useState<"specify" | "continuous">("continuous");
  const [endDate, setEndDate] = useState("");
  const [weeksPattern, setWeeksPattern] = useState("1");
  const [startPatternWeek, setStartPatternWeek] = useState("1");
  const [startDay, setStartDay] = useState("Monday");
  const [patternRows, setPatternRows] = useState<PatternRow[]>([
    {
      id: "1",
      number: 1,
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    },
  ]);
  const [draggedSchedule, setDraggedSchedule] = useState<WorkSchedule | null>(null);
  const [stretchStart, setStretchStart] = useState<{rowId: string, day: string, schedule: WorkSchedule} | null>(null);
  const [stretchCurrent, setStretchCurrent] = useState<{rowId: string, day: string} | null>(null);
  const [selectedCell, setSelectedCell] = useState<{rowId: string, day: string} | null>(null);
  const [undoHistory, setUndoHistory] = useState<PatternRow[][]>([]);
  const [multiSelect, setMultiSelect] = useState<{rowId: string, day: string}[]>([]);
  const [hoverEdge, setHoverEdge] = useState<{rowId: string, day: string, edge: string} | null>(null);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState<{rowId: string, day: string} | null>(null);
  const [removeConfirmation, setRemoveConfirmation] = useState<{rowId: string, show: boolean}>({rowId: '', show: false});
  const [savedPatterns, setSavedPatterns] = useState<SavedPattern[]>([]);
  const [loadingPatterns, setLoadingPatterns] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPatternId, setEditingPatternId] = useState<string | null>(null);
  const [overlapError, setOverlapError] = useState<{message: string, timeout?: NodeJS.Timeout} | null>(null);

  const supabase = createClient();

  useEffect(() => {
    console.log("Component mounted, loading work schedules...");
    loadWorkSchedules();
    loadSavedPatterns();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (multiSelect.length > 0) {
          saveToHistory();
          multiSelect.forEach(sel => {
            clearCell(sel.rowId, sel.day);
          });
          setMultiSelect([]);
          setSelectedCell(null);
          setSelectionAnchor(null);
        } else if (selectedCell) {
          saveToHistory();
          clearCell(selectedCell.rowId, selectedCell.day);
          setSelectedCell(null);
          setSelectionAnchor(null);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && undoHistory.length > 0) {
        e.preventDefault();
        const previousState = undoHistory[undoHistory.length - 1];
        setPatternRows(previousState);
        setUndoHistory(prev => prev.slice(0, -1));
      }
      
      // Shift+Arrow for selection
      if (e.shiftKey && selectedCell && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const allDays = getOrderedDays();
        const currentRowIndex = patternRows.findIndex(r => r.id === selectedCell.rowId);
        const currentDayIndex = allDays.indexOf(selectedCell.day);
        
        let newRowIndex = currentRowIndex;
        let newDayIndex = currentDayIndex;
        
        if (e.key === 'ArrowUp') newRowIndex = Math.max(0, currentRowIndex - 1);
        if (e.key === 'ArrowDown') newRowIndex = Math.min(patternRows.length - 1, currentRowIndex + 1);
        if (e.key === 'ArrowLeft') newDayIndex = Math.max(0, currentDayIndex - 1);
        if (e.key === 'ArrowRight') newDayIndex = Math.min(allDays.length - 1, currentDayIndex + 1);
        
        const newRowId = patternRows[newRowIndex].id;
        const newDay = allDays[newDayIndex];
        
        if (!selectionAnchor) {
          setSelectionAnchor(selectedCell);
        }
        
        const anchor = selectionAnchor || selectedCell;
        const anchorRowIndex = patternRows.findIndex(r => r.id === anchor.rowId);
        const anchorDayIndex = allDays.indexOf(anchor.day);
        
        const minRow = Math.min(anchorRowIndex, newRowIndex);
        const maxRow = Math.max(anchorRowIndex, newRowIndex);
        const minDay = Math.min(anchorDayIndex, newDayIndex);
        const maxDay = Math.max(anchorDayIndex, newDayIndex);
        
        const newSelection: {rowId: string, day: string}[] = [];
        for (let r = minRow; r <= maxRow; r++) {
          for (let d = minDay; d <= maxDay; d++) {
            newSelection.push({rowId: patternRows[r].id, day: allDays[d]});
          }
        }
        
        // Only set multi-select if at least one cell has a schedule
        if (hasAnySchedule(newSelection)) {
          setMultiSelect(newSelection);
        } else {
          setMultiSelect([]);
        }
        setSelectedCell({rowId: newRowId, day: newDay});
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, undoHistory, multiSelect, patternRows, selectionAnchor]);

  const loadWorkSchedules = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/work-schedules");
      if (!response.ok) throw new Error("Failed to fetch schedules");
      const data = await response.json();
      console.log("Loaded work schedules:", data);
      console.log("Number of schedules:", data?.length);
      setWorkSchedules(data || []);
    } catch (error) {
      console.error("Error loading work schedules:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedPatterns = async () => {
    setLoadingPatterns(true);
    try {
      const { data, error } = await supabase
        .from('roster_patterns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSavedPatterns((data as unknown as SavedPattern[]) || []);
    } catch (error) {
      console.error('Error loading saved patterns:', error);
    } finally {
      setLoadingPatterns(false);
    }
  };

  const addPatternRow = () => {
    const newNumber = patternRows.length + 1;
    setPatternRows([
      ...patternRows,
      {
        id: Date.now().toString(),
        number: newNumber,
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      },
    ]);
    setWeeksPattern(newNumber.toString());
  };

  const isRowNonEmpty = (row: PatternRow): boolean => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
    return days.some(day => row[day].length > 0);
  };

  const removePatternRow = (id: string) => {
    if (patternRows.length > 1) {
      const rowToRemove = patternRows.find(row => row.id === id);
      if (rowToRemove && isRowNonEmpty(rowToRemove)) {
        // Show confirmation dialog for non-empty rows
        setRemoveConfirmation({rowId: id, show: true});
        return;
      }
      // Proceed with removal for empty rows
      performRemovePatternRow(id);
    }
  };

  const performRemovePatternRow = (id: string) => {
    const filtered = patternRows.filter((row) => row.id !== id);
    // Renumber the rows
    const renumbered = filtered.map((row, idx) => ({
      ...row,
      number: idx + 1,
    }));
    setPatternRows(renumbered);
    setWeeksPattern(renumbered.length.toString());
    setRemoveConfirmation({rowId: '', show: false});
  };

  const handleWeeksPatternChange = (value: string) => {
    const numWeeks = parseInt(value) || 1;
    const clampedWeeks = Math.min(Math.max(numWeeks, 1), 52);
    setWeeksPattern(clampedWeeks.toString());
    
    // Adjust rows to match the number
    if (clampedWeeks > patternRows.length) {
      // Add rows
      const newRows = [...patternRows];
      for (let i = patternRows.length; i < clampedWeeks; i++) {
        newRows.push({
          id: Date.now().toString() + i,
          number: i + 1,
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: [],
          saturday: [],
          sunday: [],
        });
      }
      setPatternRows(newRows);
    } else if (clampedWeeks < patternRows.length) {
      // Remove rows
      const newRows = patternRows.slice(0, clampedWeeks).map((row, idx) => ({
        ...row,
        number: idx + 1,
      }));
      setPatternRows(newRows);
    }
  };

  const hasAnySchedule = (selections: {rowId: string, day: string}[]): boolean => {
    return selections.some(sel => {
      const row = patternRows.find(r => r.id === sel.rowId);
      if (!row) return false;
      const dayKey = sel.day.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
      return row[dayKey].length > 0;
    });
  };

  const getOrderedDays = () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const startIndex = days.indexOf(startDay);
    return [...days.slice(startIndex), ...days.slice(0, startIndex)];
  };

  // Derive weekday name from an ISO date string (YYYY-MM-DD)
  const getDayOfWeek = (dateString: string): string => {
    if (!dateString) return 'Monday';
    const date = new Date(dateString + 'T00:00:00');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  // Compute end date as start + (weeks * 7) days
  const computeEndDate = (start: string, weeks: string): string => {
    if (!start) return '';
    const w = Math.max(1, Math.min(52, parseInt(weeks || '1', 10)));
    const d = new Date(start + 'T00:00:00');
    d.setDate(d.getDate() + (w * 7));
    return d.toISOString().split('T')[0];
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    const dayOfWeek = getDayOfWeek(value);
    setStartDay(dayOfWeek);
  };

  // Helper function to check if a shift spans midnight
  const shiftSpansMidnight = (schedule: WorkSchedule): boolean => {
    const timeframes = schedule.work_schedule_timeframes || [];
    return timeframes.some(tf => {
      const [sH, sM] = tf.start_time.split(':').map(Number);
      const [eH, eM] = tf.end_time.split(':').map(Number);
      const startMins = sH * 60 + sM;
      const endMins = eH * 60 + eM;
      return endMins < startMins; // midnight crossing
    });
  };

  // Helper function to get next day name
  const getNextDay = (dayName: string): string => {
    const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const currentIndex = allDays.indexOf(dayName);
    return allDays[(currentIndex + 1) % 7];
  };

  // Helper function to get previous day name
  const getPreviousDay = (dayName: string): string => {
    const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const currentIndex = allDays.indexOf(dayName);
    return allDays[(currentIndex - 1 + 7) % 7];
  };

  const formatScheduleDisplay = (schedule: WorkSchedule): string => {
    const timeframes = schedule.work_schedule_timeframes?.sort(
      (a, b) => a.frame_order - b.frame_order
    ) || [];
    
    const parts: string[] = [];
    
    timeframes.forEach((tf, idx) => {
      parts.push(`${tf.start_time.slice(0, 5)}-${tf.end_time.slice(0, 5)}`);
      if (tf.meal_start && tf.meal_end) {
        parts.push(`M:${tf.meal_start.slice(0, 5)}-${tf.meal_end.slice(0, 5)}`);
      }
    });
    
    return parts.join(' | ');
  };

  // Helper function to truncate overnight shifts at midnight for display when at last cell in specify dates mode
  const formatScheduleDisplayTruncated = (schedule: WorkSchedule, truncateAtMidnight: boolean): string => {
    const timeframes = schedule.work_schedule_timeframes?.sort(
      (a, b) => a.frame_order - b.frame_order
    ) || [];
    
    const parts: string[] = [];
    
    timeframes.forEach((tf, idx) => {
      let endTime = tf.end_time;
      
      // If truncating and this timeframe spans midnight, cut it at 00:00
      if (truncateAtMidnight) {
        const [endH, endM] = tf.end_time.split(':').map(Number);
        const [startH, startM] = tf.start_time.split(':').map(Number);
        const startMins = startH * 60 + startM;
        const endMins = endH * 60 + endM;
        
        if (endMins < startMins) { // crosses midnight
          endTime = '00:00';
        }
      }
      
      parts.push(`${tf.start_time.slice(0, 5)}-${endTime.slice(0, 5)}`);
      if (tf.meal_start && tf.meal_end) {
        parts.push(`M:${tf.meal_start.slice(0, 5)}-${tf.meal_end.slice(0, 5)}`);
      }
    });
    
    return parts.join(' | ');
  };

  // Helper function to check if two shifts overlap
  const shiftsOverlap = (schedule1: WorkSchedule, schedule2: WorkSchedule): boolean => {
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
        const start2 = s2H * 60 + s2M;
        const end2 = e2H * 60 + e2M;
        
        // Handle midnight shifts
        const spans1 = end1 < start1; // crosses midnight
        const spans2 = end2 < start2; // crosses midnight
        
        if (spans1 && spans2) {
          // Both span midnight: no overlap only if one ends before the other starts
          if (!(end1 < start2 && end2 < start1)) {
            return true;
          }
        } else if (spans1) {
          // Only first spans midnight (00:00-end1 or start1-23:59)
          // Overlaps if: start2 < end1 OR start2 >= start1
          if (start2 < end1 || start2 >= start1) {
            return true;
          }
        } else if (spans2) {
          // Only second spans midnight (e.g., 22:00-00:00)
          // Second shift covers start2 to end of day (1440 mins)
          // Overlaps if first shift ends after second shift starts
          if (end1 > start2) {
            return true;
          }
        } else {
          // Neither spans midnight: standard overlap check
          if (start1 < end2 && start2 < end1) {
            return true;
          }
        }
      }
    }
    
    return false;
  };

  // Calculate the date for a specific cell (weekNumber, dayName)
  const handleDragStart = (schedule: WorkSchedule) => {
    setDraggedSchedule(schedule);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (rowId: string, dayName: string) => {
    if (!draggedSchedule) return;
    
    setPatternRows(rows => 
      rows.map(row => {
        if (row.id === rowId) {
          const dayKey = dayName.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
          const dayValue = row[dayKey];
          const existingShifts = Array.isArray(dayValue) ? dayValue : [];
          
          // Check if we've reached max 3 shifts
          if (existingShifts.length >= 3) {
            const message = `Cannot add ${draggedSchedule.shift_id}: maximum 3 shifts per day`;
            setOverlapError({ message });
            if (overlapError?.timeout) clearTimeout(overlapError.timeout);
            const timeout = setTimeout(() => setOverlapError(null), 5000);
            setOverlapError({ message, timeout });
            return row; // Don't add the shift
          }
          
          // Check for overlaps with existing shifts
          for (const existing of existingShifts) {
            if (shiftsOverlap(draggedSchedule, existing)) {
              const message = `Cannot add ${draggedSchedule.shift_id}: overlaps with ${existing.shift_id}`;
              setOverlapError({ message });
              if (overlapError?.timeout) clearTimeout(overlapError.timeout);
              const timeout = setTimeout(() => setOverlapError(null), 5000);
              setOverlapError({ message, timeout });
              return row; // Don't add the shift
            }
          }
          
          return {
            ...row,
            [dayKey]: [...existingShifts, draggedSchedule]
          };
        }
        return row;
      })
    );
    setDraggedSchedule(null);
  };

  const getSelectionType = (): 'single' | 'horizontal' | 'vertical' | 'rectangular' => {
    if (multiSelect.length <= 1) return 'single';
    
    const allDays = getOrderedDays();
    const rowIndices = multiSelect.map(s => patternRows.findIndex(r => r.id === s.rowId));
    const dayIndices = multiSelect.map(s => allDays.indexOf(s.day));
    
    const uniqueRows = new Set(rowIndices).size;
    const uniqueDays = new Set(dayIndices).size;
    
    if (uniqueRows === 1 && uniqueDays > 1) return 'horizontal';
    if (uniqueDays === 1 && uniqueRows > 1) return 'vertical';
    return 'rectangular';
  };

  const getSelectionBounds = () => {
    const allDays = getOrderedDays();
    const rowIndices = multiSelect.map(s => patternRows.findIndex(r => r.id === s.rowId));
    const dayIndices = multiSelect.map(s => allDays.indexOf(s.day));
    return {
      minRow: Math.min(...rowIndices),
      maxRow: Math.max(...rowIndices),
      minDay: Math.min(...dayIndices),
      maxDay: Math.max(...dayIndices),
    };
  };

  const handleLinearStretch = (targetRowId: string, targetDay: string) => {
    // Simplified for array-based shifts - just clear for now
    setMultiSelect([]);
    setSelectionAnchor(null);
  };

  const saveToHistory = () => {
    setUndoHistory(prev => [...prev, JSON.parse(JSON.stringify(patternRows))]);
  };

  const handleStretchStart = (e: React.MouseEvent, rowId: string, dayName: string, schedule: WorkSchedule) => {
    e.preventDefault();
    // If this cell is part of a multi-select, stretch all selected cells
    const isPartOfMultiSelect = multiSelect.some(s => s.rowId === rowId && s.day === dayName);
    if (isPartOfMultiSelect && multiSelect.length > 0) {
      const bounds = getSelectionBounds();
      const allDays = getOrderedDays();
      const anchorRowId = patternRows[bounds.minRow].id;
      const anchorDay = allDays[bounds.minDay];
      setStretchStart({rowId: anchorRowId, day: anchorDay, schedule});
    } else {
      setStretchStart({rowId, day: dayName, schedule});
    }
    setStretchCurrent({rowId, day: dayName});
  };

  const handleStretchMove = (rowId: string, dayName: string) => {
    if (stretchStart) {
      setStretchCurrent({rowId, day: dayName});
    }
  };

  const handleStretchEnd = () => {
    if (!stretchStart || !stretchCurrent) {
      setStretchStart(null);
      setStretchCurrent(null);
      return;
    }

    if (multiSelect.length > 0) {
      const allDays = getOrderedDays();
      console.log('[stretchEnd]', {
        selectionType: getSelectionType(),
        bounds: getSelectionBounds(),
        startRow: stretchStart.rowId,
        startDay: stretchStart.day,
        endRow: stretchCurrent.rowId,
        endDay: stretchCurrent.day,
        startRowIndex: patternRows.findIndex(r => r.id === stretchStart.rowId),
        endRowIndex: patternRows.findIndex(r => r.id === stretchCurrent.rowId),
        startDayIndex: allDays.indexOf(stretchStart.day),
        endDayIndex: allDays.indexOf(stretchCurrent.day),
        multiSelectLen: multiSelect.length,
      });
    }

    saveToHistory();

    const allDays = getOrderedDays();
    const selectionType = getSelectionType();
    const startRowIndex = patternRows.findIndex(r => r.id === stretchStart.rowId);
    const endRowIndex = patternRows.findIndex(r => r.id === stretchCurrent.rowId);
    const startDayIndex = allDays.indexOf(stretchStart.day);
    const endDayIndex = allDays.indexOf(stretchCurrent.day);

    // If we have a multi-select with vertical layout and dragging horizontally, copy all to columns right
    if (multiSelect.length > 0 && selectionType === 'vertical' && startDayIndex !== endDayIndex) {
      const bounds = getSelectionBounds();
      const minDay = Math.min(startDayIndex, endDayIndex);
      const maxDay = Math.max(startDayIndex, endDayIndex);
      
      // Template: extract the schedule from each selected cell
      const template: {[key: number]: WorkSchedule[]} = {};
      multiSelect.forEach(sel => {
        const rowIdx = patternRows.findIndex(r => r.id === sel.rowId);
        const row = patternRows.find(r => r.id === sel.rowId);
        if (row) {
          const dayKey = sel.day.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
          template[rowIdx] = row[dayKey] as WorkSchedule[];
        }
      });

      setPatternRows(rows =>
        rows.map((row, rowIdx) => {
          // Apply template to all columns from start to end
          if (template.hasOwnProperty(rowIdx)) {
            const updatedRow = {...row};
            for (let d = minDay; d <= maxDay; d++) {
              const dayName = allDays[d];
              const dayKey = dayName.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
              if (!updatedRow[dayKey]) {
                updatedRow[dayKey] = template[rowIdx];
              }
            }
            return updatedRow;
          }
          return row;
        })
      );
    } else if (multiSelect.length > 0) {
      const bounds = getSelectionBounds();
      const targetRowIndex = patternRows.findIndex(r => r.id === stretchCurrent.rowId);
      const targetDayIndex = allDays.indexOf(stretchCurrent.day);

      if (selectionType === 'horizontal') {
        const sourceRowId = multiSelect[0].rowId;
        const newMinDay = Math.min(bounds.minDay, targetDayIndex);
        const newMaxDay = Math.max(bounds.maxDay, targetDayIndex);
        const newMinRow = Math.min(bounds.minRow, targetRowIndex);
        const newMaxRow = Math.max(bounds.maxRow, targetRowIndex);

        // Template from the selected row across the selected day range
        const template: {[key: string]: WorkSchedule[]} = {};
        multiSelect.forEach(sel => {
          const dayKey = sel.day.toLowerCase();
          const row = patternRows.find(r => r.id === sel.rowId);
          if (row) template[dayKey] = row[dayKey as keyof Omit<PatternRow, 'id' | 'number'>] as WorkSchedule[];
        });

        setPatternRows(rows =>
          rows.map((row, rowIdx) => {
            // Apply to every row in the stretch range
            if (rowIdx < newMinRow || rowIdx > newMaxRow) return row;

            const updatedRow = {...row};
            for (let d = newMinDay; d <= newMaxDay; d++) {
              const dayName = allDays[d];
              const dayKey = dayName.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
              const sourceDayKey = allDays[d].toLowerCase();
              // Overwrite with template (behaves like Excel fill)
              updatedRow[dayKey] = template[sourceDayKey] ?? null;
            }
            return updatedRow;
          })
        );
      } else if (selectionType === 'vertical') {
        const dayName = multiSelect[0].day;
        const dayKey = dayName.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
        const selectedRows = [...new Set(multiSelect.map(sel => patternRows.findIndex(r => r.id === sel.rowId)))].sort((a, b) => a - b);
        const template = selectedRows.map(idx => patternRows[idx]?.[dayKey] as WorkSchedule[]);
        const newMinRow = Math.min(bounds.minRow, targetRowIndex);
        const newMaxRow = Math.max(bounds.maxRow, targetRowIndex);

        setPatternRows(rows =>
          rows.map((row, rowIdx) => {
            if (rowIdx < newMinRow || rowIdx > newMaxRow) return row;

            // Preserve existing selection block as-is
            if (rowIdx >= bounds.minRow && rowIdx <= bounds.maxRow) {
              return row;
            }

            const templateIndex = (rowIdx - newMinRow) % template.length;
            return {
              ...row,
              [dayKey]: template[templateIndex],
            };
          })
        );
      }
    } else {
      const startDayIndex = allDays.indexOf(stretchStart.day);
      const endDayIndex = allDays.indexOf(stretchCurrent.day);

      const minRow = Math.min(startRowIndex, endRowIndex);
      const maxRow = Math.max(startRowIndex, endRowIndex);
      const minDay = Math.min(startDayIndex, endDayIndex);
      const maxDay = Math.max(startDayIndex, endDayIndex);

      setPatternRows(rows => 
        rows.map((row, rowIdx) => {
          if (rowIdx >= minRow && rowIdx <= maxRow) {
            const updatedRow = {...row};
            for (let dayIdx = minDay; dayIdx <= maxDay; dayIdx++) {
              const dayName = allDays[dayIdx];
              const dayKey = dayName.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
              if (!updatedRow[dayKey] || updatedRow[dayKey].length === 0) {
                updatedRow[dayKey] = [stretchStart.schedule];
              }
            }
            return updatedRow;
          }
          return row;
        })
      );
    }

    setStretchStart(null);
    setStretchCurrent(null);
    setMultiSelect([]);
    setSelectionAnchor(null);
  };

  // End stretch even if mouseup happens outside the table
  useEffect(() => {
    if (!stretchStart) return;
    const onUp = () => handleStretchEnd();
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [stretchStart]);

  const detectEdge = (e: React.MouseEvent, element: HTMLElement): string | null => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const edgeThreshold = 8;
    
    const isLeft = x < edgeThreshold;
    const isRight = x > rect.width - edgeThreshold;
    const isTop = y < edgeThreshold;
    const isBottom = y > rect.height - edgeThreshold;
    
    if (isLeft && isTop) return 'nw';
    if (isRight && isTop) return 'ne';
    if (isLeft && isBottom) return 'sw';
    if (isRight && isBottom) return 'se';
    if (isLeft) return 'w';
    if (isRight) return 'e';
    if (isTop) return 'n';
    if (isBottom) return 's';
    
    return null;
  };

  const getEdgeCursor = (edge: string | null): string => {
    if (!edge) return 'pointer';
    if (edge === 'n' || edge === 's') return 'ns-resize';
    if (edge === 'e' || edge === 'w') return 'ew-resize';
    if (edge === 'ne' || edge === 'sw') return 'nesw-resize';
    if (edge === 'nw' || edge === 'se') return 'nwse-resize';
    return 'pointer';
  };

  const clearCell = (rowId: string, dayName: string) => {
    setPatternRows(rows => 
      rows.map(row => {
        if (row.id === rowId) {
          const dayKey = dayName.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
          return {
            ...row,
            [dayKey]: []
          };
        }
        return row;
      })
    );
  };

  const isInStretchRange = (rowId: string, dayName: string): boolean => {
    if (!stretchStart || !stretchCurrent) return false;

    const allDays = getOrderedDays();
    const startRowIndex = patternRows.findIndex(r => r.id === stretchStart.rowId);
    const endRowIndex = patternRows.findIndex(r => r.id === stretchCurrent.rowId);
    const currentRowIndex = patternRows.findIndex(r => r.id === rowId);
    const startDayIndex = allDays.indexOf(stretchStart.day);
    const endDayIndex = allDays.indexOf(stretchCurrent.day);
    const currentDayIndex = allDays.indexOf(dayName);

    let minRow = Math.min(startRowIndex, endRowIndex);
    let maxRow = Math.max(startRowIndex, endRowIndex);
    let minDay = Math.min(startDayIndex, endDayIndex);
    let maxDay = Math.max(startDayIndex, endDayIndex);

    // If stretching a horizontal selection vertically, keep full horizontal span for shadow
    if (multiSelect.length > 0 && getSelectionType() === 'horizontal') {
      const bounds = getSelectionBounds();
      minDay = bounds.minDay;
      maxDay = bounds.maxDay;
    }

    // If stretching a vertical selection horizontally, keep full vertical span for shadow
    if (multiSelect.length > 0 && getSelectionType() === 'vertical') {
      const bounds = getSelectionBounds();
      minRow = bounds.minRow;
      maxRow = bounds.maxRow;
    }

    return currentRowIndex >= minRow && currentRowIndex <= maxRow &&
           currentDayIndex >= minDay && currentDayIndex <= maxDay;
  };

  const getCellDate = (weekNumber: number, dayName: string): string => {
    if (endDateType !== 'specify' || !startDate) return '';
    
    const orderedDays = getOrderedDays();
    const dayIndex = orderedDays.indexOf(dayName);
    if (dayIndex === -1) return '';
    
    // Calculate total days offset: (weekNumber - 1) * 7 + dayIndex
    const daysOffset = (weekNumber - 1) * 7 + dayIndex;
    const date = new Date(startDate + 'T00:00:00');
    date.setDate(date.getDate() + daysOffset);
    
    // Format as DD/MM/YY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  // Keep endDate in sync when using specific dates
  useEffect(() => {
    if (endDateType === 'specify' && startDate) {
      setEndDate(computeEndDate(startDate, weeksPattern));
    }
  }, [endDateType, startDate, weeksPattern]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSavePattern();
  };

  const handleSavePattern = async () => {
    setSaving(true);
    try {
      const payload = {
        shift_id: shiftId || 'Untitled Pattern',
        start_date: startDate || null,
        end_date_type: endDateType,
        end_date: endDate || null,
        weeks_pattern: weeksPattern,
        start_pattern_week: startPatternWeek,
        start_day: startDay,
        pattern_rows: patternRows as unknown as Json,
      };

      if (editingPatternId) {
        const { error } = await supabase
          .from('roster_patterns')
          .update(payload)
          .eq('id', editingPatternId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('roster_patterns')
          .insert(payload);
        if (error) throw error;
      }

      await loadSavedPatterns();
      setShowForm(false);
      setEditingPatternId(null);
    } catch (error) {
      console.error('Error saving pattern:', error);
      alert('Failed to save pattern.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPattern = (pattern: SavedPattern) => {
    setShiftId(pattern.shift_id || '');
    setStartDate(pattern.start_date || '');
    setEndDateType(pattern.end_date_type);
    setEndDate(pattern.end_date || '');
    setWeeksPattern(pattern.weeks_pattern);
    setStartPatternWeek(pattern.start_pattern_week);
    setStartDay(pattern.start_day || 'Monday');
    
    // Ensure pattern rows have arrays for each day (database might return non-arrays)
    const normalizedRows = (pattern.pattern_rows || []).map(row => ({
      ...row,
      monday: Array.isArray(row.monday) ? row.monday : [],
      tuesday: Array.isArray(row.tuesday) ? row.tuesday : [],
      wednesday: Array.isArray(row.wednesday) ? row.wednesday : [],
      thursday: Array.isArray(row.thursday) ? row.thursday : [],
      friday: Array.isArray(row.friday) ? row.friday : [],
      saturday: Array.isArray(row.saturday) ? row.saturday : [],
      sunday: Array.isArray(row.sunday) ? row.sunday : [],
    }));
    
    setPatternRows(normalizedRows);
    setEditingPatternId(pattern.id);
    setShowForm(true);
  };

  const handleDeletePattern = async (id: string) => {
    const confirmed = confirm('Delete this pattern?');
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('roster_patterns').delete().eq('id', id);
      if (error) throw error;
      await loadSavedPatterns();
    } catch (error) {
      console.error('Error deleting pattern:', error);
      alert('Failed to delete pattern.');
    }
  };

  return (
    <>
      {/* Remove Row Confirmation Dialog */}
      <Dialog open={removeConfirmation.show} onOpenChange={(open) => !open && setRemoveConfirmation({rowId: '', show: false})}>
        <DialogContent>
          <DialogTitle>Remove Week</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove this non-empty week?
          </DialogDescription>
          <DialogFooter className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveConfirmation({rowId: '', show: false})}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => performRemovePatternRow(removeConfirmation.rowId)}
            >
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!showForm ? (
        <div className="flex flex-col gap-4 h-[calc(100vh-12rem)]">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Saved Patterns</h2>
            <Button
              onClick={() => {
                setShowForm(true);
                setEditingPatternId(null);
                // reset form
                setShiftId('');
                setStartDate('');
                setEndDateType('continuous');
                setEndDate('');
                setWeeksPattern('1');
                setStartPatternWeek('1');
                setStartDay('Monday');
                setPatternRows([{
                  id: '1',
                  number: 1,
                  monday: [],
                  tuesday: [],
                  wednesday: [],
                  thursday: [],
                  friday: [],
                  saturday: [],
                  sunday: [],
                }]);
              }}
              size="lg"
              className="gap-2"
            >
              <Plus className="h-5 w-5" />
              Add Roster Pattern
            </Button>
          </div>

          <Card className="p-4 h-full overflow-auto">
            {loadingPatterns ? (
              <div className="text-sm text-gray-600">Loading patterns…</div>
            ) : savedPatterns.length === 0 ? (
              <div className="text-sm text-gray-600">No patterns saved yet.</div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {savedPatterns.map((p) => (
                  <div
                    key={p.id}
                    className="group border border-gray-300 rounded-lg p-4 cursor-pointer hover:border-blue-500 relative"
                    onClick={() => handleOpenPattern(p)}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-semibold">{p.shift_id || 'Untitled'}</div>
                        <div className="text-xs text-gray-600">Weeks: {p.weeks_pattern}</div>
                        {p.start_date && (
                          <div className="text-xs text-gray-600">Start: {p.start_date}</div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePattern(p.id);
                        }}
                        aria-label="Delete pattern"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <div className="flex gap-6 h-[calc(100vh-12rem)]">
          {/* Main Content Area - Left */}
          <div className="flex-1 overflow-auto">
          <Card className="p-6">
            <Alert className="mb-6 bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <div className="ml-3 text-sm text-blue-800">
                Drag the Work schedules from the list on the right and drop them to a day cell in the pattern. If you would like to add more Work schedules, please go to <a href="/admin/work-schedule" className="font-semibold underline hover:text-blue-900">this page</a>.
              </div>
            </Alert>
            {overlapError && (
              <Alert 
                className="mb-6 bg-red-50 border-red-200 cursor-pointer hover:bg-red-100"
                onClick={() => {
                  if (overlapError?.timeout) clearTimeout(overlapError.timeout);
                  setOverlapError(null);
                }}
              >
                <div className="ml-0 text-sm text-red-800 font-semibold">
                  {overlapError.message}
                </div>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="border-2 border-gray-900 p-6">
                <h2 className="text-2xl font-bold mb-6">Work Schedule Pattern</h2>

                {/* Shift ID Row */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <Label htmlFor="shiftId" className="text-base font-semibold mb-2">
                      Shift ID
                    </Label>
                    <Input
                      id="shiftId"
                      value={shiftId}
                      onChange={(e) => setShiftId(e.target.value)}
                      className="border-2 border-gray-900"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="startDay" className="text-base font-semibold mb-2">
                      Start Day
                    </Label>
                    <select
                      id="startDay"
                      value={startDay}
                      onChange={(e) => setStartDay(e.target.value)}
                      disabled={endDateType === "specify"}
                      className={`w-full h-10 px-3 border-2 border-gray-900 rounded-md ${endDateType === "specify" ? "bg-gray-100 cursor-not-allowed" : ""}`}
                      required
                    >
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                      <option value="Sunday">Sunday</option>
                    </select>
                  </div>
                </div>

                {/* Shift Dates Section */}
                <div className="mb-6">
                  <Label className="text-base font-semibold mb-3 block">Shift Dates</Label>
                  <div className="space-y-3 border-2 border-gray-900 p-4 rounded">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        id="continuously"
                        name="shiftDateType"
                        checked={endDateType === "continuous"}
                        onChange={() => setEndDateType("continuous")}
                        className="w-5 h-5 border-2 border-gray-900"
                      />
                      <Label htmlFor="continuously" className="cursor-pointer font-medium">
                        Continuously
                      </Label>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        id="specifyDates"
                        name="shiftDateType"
                        checked={endDateType === "specify"}
                        onChange={() => setEndDateType("specify")}
                        className="w-5 h-5 border-2 border-gray-900"
                      />
                      <Label htmlFor="specifyDates" className="cursor-pointer font-medium">
                        Specify dates
                      </Label>
                    </div>

                    {endDateType === "specify" && (
                      <div className="grid grid-cols-2 gap-4 ml-8 mt-4">
                        <div>
                          <Label htmlFor="shiftStartDate" className="text-sm font-semibold mb-2 block">
                            Start date
                          </Label>
                          <Input
                            id="shiftStartDate"
                            type="date"
                            value={startDate}
                            onChange={(e) => handleStartDateChange(e.target.value)}
                            className="border-2 border-gray-900 w-48"
                            required
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="shiftEndDate" className="text-sm font-semibold mb-2 block">
                            End date
                          </Label>
                          <Input
                            id="shiftEndDate"
                            type="date"
                            value={endDate}
                            readOnly
                            className="border-2 border-gray-900 w-48 bg-gray-100 cursor-not-allowed"
                            required
                          />
                          <div className="text-xs text-gray-600 mt-1">
                            Auto-calculated: start date + (weeks × 7 days)
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pattern Configuration Row */}
                <div className="mb-6">
                  <Label htmlFor="weeksPattern" className="text-base font-semibold mb-2">
                    Number of weeks in pattern
                  </Label>
                  <Input
                    id="weeksPattern"
                    type="number"
                    min="1"
                    max="52"
                    value={weeksPattern}
                    onChange={(e) => handleWeeksPatternChange(e.target.value)}
                    className="border-2 border-gray-900 w-32"
                    required
                  />
                </div>

                {/* Pattern Table */}
                <div className="border-2 border-gray-900">
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="border-b-2 border-gray-900">
                        <th className="border-r-2 border-gray-900 p-3 text-center font-semibold w-10">
                          No
                        </th>
                        {getOrderedDays().map((day, index) => (
                          <th 
                            key={day} 
                            className={`${index < 6 ? 'border-r-2 border-gray-900' : ''} p-3 font-semibold`}
                          >
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {patternRows.map((row) => (
                        <tr key={row.id} className="border-b border-gray-900">
                          <td className="border-r-2 border-gray-900 p-3 text-center">
                            {row.number}
                          </td>
                          {getOrderedDays().map((day, index) => {
                            const cellDate = getCellDate(row.number, day);
                            const dayKey = day.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
                            const dayValue = row[dayKey];
                            const schedules = Array.isArray(dayValue) ? dayValue : [];
                            
                            // Check if this is the last cell of the pattern (last row, Sunday)
                            const isLastRow = row.number === patternRows.length;
                            const isLastDay = day === 'Sunday';
                            const isLastCell = isLastRow && isLastDay;
                            
                            // Check if this is the first cell of the pattern (first row, Monday)
                            const isFirstRow = row.number === 1;
                            const isFirstDay = day === 'Monday';
                            const isFirstCell = isFirstRow && isFirstDay;
                            
                            // Get previous day's schedules to check for overflow into current day
                            let previousDay = getPreviousDay(day);
                            let previousDayKey = previousDay.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
                            let previousDaySchedules: WorkSchedule[] = [];
                            
                            // For continuous mode: check if previous day has overnight shifts
                            // If current day is Monday, check if previous Sunday (which could be in same row or previous row) has overnight shift
                            if (day === 'Monday' && endDateType === 'continuous' && patternRows.length > 0) {
                              // If this is the first Monday (week 1), check overflow from last Sunday of last week
                              if (isFirstCell) {
                                const lastRow = patternRows[patternRows.length - 1];
                                const lastRowSundayValue = lastRow.sunday;
                                previousDaySchedules = Array.isArray(lastRowSundayValue) ? lastRowSundayValue : [];
                              } else {
                                // For other Mondays, check from the previous row's Sunday
                                const prevRowIndex = row.number - 2; // row.number is 1-indexed
                                if (prevRowIndex >= 0) {
                                  const prevRow = patternRows[prevRowIndex];
                                  const prevRowSundayValue = prevRow.sunday;
                                  previousDaySchedules = Array.isArray(prevRowSundayValue) ? prevRowSundayValue : [];
                                }
                              }
                            }
                            // For specify dates mode: don't show overflow from previous day
                            else if (endDateType === 'specify') {
                              previousDaySchedules = [];
                            }
                            else {
                              const prevDayValue = row[previousDayKey];
                              previousDaySchedules = Array.isArray(prevDayValue) ? prevDayValue : [];
                            }
                            
                            // Get shifts from previous day that overflow into this day
                            const overflowFromPreviousDay = previousDaySchedules.filter(s => shiftSpansMidnight(s));
                            
                            // Check if any schedule from this day overflows to next day (for display purposes)
                            const hasOverflowToNextDay = schedules.some(s => shiftSpansMidnight(s));
                            
                            const isSelected = selectedCell?.rowId === row.id && selectedCell?.day === day;
                            const isMultiSelected = multiSelect.some(s => s.rowId === row.id && s.day === day);
                            const isInStretch = isInStretchRange(row.id, day);
                            return (
                              <td 
                                key={day}
                                className={`${
                                  index < 6 ? 'border-r-2 border-gray-900' : ''
                                } p-2 text-center relative select-none align-top ${
                                  schedules.length > 0 ? 'bg-blue-50 cursor-pointer' : ''
                                } ${
                                  isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''
                                } ${
                                  isMultiSelected ? 'ring-2 ring-purple-500 ring-inset bg-purple-50' : ''
                                } ${
                                  isInStretch ? 'bg-blue-200' : ''
                                }`}
                                onDragOver={handleDragOver}
                                onDrop={() => handleDrop(row.id, day)}
                                onMouseDown={(e) => {
                                  if (schedules.length > 0 && !e.shiftKey) {
                                    const edge = detectEdge(e, e.currentTarget);
                                    if (edge) {
                                      handleStretchStart(e, row.id, day, schedules[0]);
                                    } else {
                                      // Start drag selection
                                      setIsDraggingSelection(true);
                                      setSelectionAnchor({rowId: row.id, day});
                                      setSelectedCell({rowId: row.id, day});
                                      setMultiSelect([]);
                                    }
                                  } else if (schedules.length === 0 && !e.shiftKey) {
                                    setIsDraggingSelection(true);
                                    setSelectionAnchor({rowId: row.id, day});
                                    setSelectedCell({rowId: row.id, day});
                                    setMultiSelect([]);
                                  }
                                }}
                                onMouseEnter={() => {
                                  if (stretchStart) {
                                    handleStretchMove(row.id, day);
                                  } else if (isDraggingSelection && selectionAnchor) {
                                    // Update multi-select during drag
                                    const allDays = getOrderedDays();
                                    const anchorRowIndex = patternRows.findIndex(r => r.id === selectionAnchor.rowId);
                                    const anchorDayIndex = allDays.indexOf(selectionAnchor.day);
                                    const currentRowIndex = patternRows.findIndex(r => r.id === row.id);
                                    const currentDayIndex = allDays.indexOf(day);
                                    
                                    const minRow = Math.min(anchorRowIndex, currentRowIndex);
                                    const maxRow = Math.max(anchorRowIndex, currentRowIndex);
                                    const minDay = Math.min(anchorDayIndex, currentDayIndex);
                                    const maxDay = Math.max(anchorDayIndex, currentDayIndex);
                                    
                                    const newSelection: {rowId: string, day: string}[] = [];
                                    for (let r = minRow; r <= maxRow; r++) {
                                      for (let d = minDay; d <= maxDay; d++) {
                                        newSelection.push({rowId: patternRows[r].id, day: allDays[d]});
                                      }
                                    }
                                    // Only set multi-select if at least one cell has a schedule
                                    if (hasAnySchedule(newSelection)) {
                                      setMultiSelect(newSelection);
                                    } else {
                                      setMultiSelect([]);
                                    }
                                    setSelectedCell({rowId: row.id, day});
                                  }
                                }}
                                onMouseUp={() => {
                                  if (stretchStart) {
                                    handleStretchEnd();
                                  } else if (isDraggingSelection) {
                                    setIsDraggingSelection(false);
                                    const selectionType = getSelectionType();
                                    // Only keep multi-select if at least one cell has a schedule
                                    if (multiSelect.length > 0 && selectionType !== 'single' && hasAnySchedule(multiSelect)) {
                                      // Keep multi-select active for linear stretch or delete
                                    } else {
                                      setMultiSelect([]);
                                      setSelectionAnchor(null);
                                    }
                                  }
                                }}
                                onMouseMove={(e) => {
                                  if (stretchStart) {
                                    handleStretchMove(row.id, day);
                                    return;
                                  }
                                  if (schedules.length > 0 && !stretchStart) {
                                    const edge = detectEdge(e, e.currentTarget);
                                    if (edge) {
                                      setHoverEdge({rowId: row.id, day, edge});
                                    } else {
                                      setHoverEdge(null);
                                    }
                                  }
                                }}
                                onMouseLeave={() => setHoverEdge(null)}
                                onClick={(e) => {
                                  if (!isDraggingSelection && multiSelect.length === 0) {
                                    if (schedules.length > 0) {
                                      setSelectedCell({rowId: row.id, day});
                                    }
                                  }
                                }}
                                style={{
                                  cursor: schedules.length > 0 && hoverEdge?.rowId === row.id && hoverEdge?.day === day
                                    ? getEdgeCursor(hoverEdge.edge)
                                    : schedules.length > 0 ? 'pointer' : 'default'
                                }}
                              >
                                {cellDate && schedules.length === 0 && (
                                  <div className="text-xs text-gray-400">
                                    {cellDate}
                                  </div>
                                )}
                                <div className="flex flex-col gap-1 w-full">
                                  {overflowFromPreviousDay.length > 0 && (
                                    <div className="text-xs leading-tight px-1 bg-orange-50 rounded border border-orange-300 italic">
                                      <div className="text-orange-700">↑ overflow from prev</div>
                                    </div>
                                  )}
                                  {[...schedules].sort((a, b) => {
                                    // First, sort by start time of first timeframe
                                    const aFirstTimeframe = a.work_schedule_timeframes?.[0];
                                    const bFirstTimeframe = b.work_schedule_timeframes?.[0];
                                    
                                    if (aFirstTimeframe && bFirstTimeframe) {
                                      const aStartParts = aFirstTimeframe.start_time.split(':').map(Number);
                                      const bStartParts = bFirstTimeframe.start_time.split(':').map(Number);
                                      const aStartMinutes = aStartParts[0] * 60 + aStartParts[1];
                                      const bStartMinutes = bStartParts[0] * 60 + bStartParts[1];
                                      
                                      if (aStartMinutes !== bStartMinutes) {
                                        return aStartMinutes - bStartMinutes; // Earlier time first
                                      }
                                    }
                                    
                                    // If start times are equal or unavailable, put midnight-spanning shifts at bottom
                                    const aSpans = shiftSpansMidnight(a);
                                    const bSpans = shiftSpansMidnight(b);
                                    if (aSpans && !bSpans) return 1; // a goes to bottom
                                    if (!aSpans && bSpans) return -1; // b goes to bottom
                                    return 0; // maintain order
                                  }).map((schedule, idx) => (
                                    <div 
                                      key={idx} 
                                      className="text-xs leading-tight break-words px-1 bg-white rounded border border-blue-300 cursor-move"
                                      draggable
                                      onDragStart={() => {
                                        handleDragStart(schedule);
                                        setSelectedCell({rowId: row.id, day});
                                      }}
                                    >
                                      <div className="font-bold text-blue-900">{schedule.shift_id}</div>
                                      <div className="text-blue-700">
                                        {isLastCell && endDateType === 'specify' && shiftSpansMidnight(schedule) ? 
                                          formatScheduleDisplayTruncated(schedule, true) : 
                                          formatScheduleDisplay(schedule)
                                        }
                                      </div>
                                      {shiftSpansMidnight(schedule) && (
                                        isLastCell && endDateType === 'specify' ? (
                                          <div className="text-xs text-orange-700 italic">↓ Cut-off shift</div>
                                        ) : endDateType === 'continuous' ? (
                                          <div className="text-xs text-orange-700 italic">↓ Overflow</div>
                                        ) : null
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Add/Remove Row Buttons */}
                  <div className="flex gap-2 p-3 border-t-2 border-gray-900 bg-gray-50">
                    <Button
                      type="button"
                      onClick={addPatternRow}
                      variant="outline"
                      size="sm"
                      className="gap-1"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    {patternRows.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removePatternRow(patternRows[patternRows.length - 1].id)}
                        variant="outline"
                        size="sm"
                        className="gap-1"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                    {multiSelect.length > 0 && (
                      <div className="ml-auto text-sm text-purple-600 font-medium">
                        {multiSelect.length} cells selected - drag edge to stretch or press Delete/Backspace to clear
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex gap-4 mt-6">
                  <Button type="submit" size="lg" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Pattern'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      setShowForm(false);
                      setEditingPatternId(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </Card>
          </div>

          {/* Saved Work Schedules List - Right */}
          <div className="w-96 border-l pl-6">
        <div className="sticky top-0">
          <h3 className="text-lg font-semibold mb-4">Saved Work Schedules</h3>
          <div 
            className="space-y-3 max-h-[calc(100vh-14rem)] overflow-y-auto pr-2 border-2 border-dashed border-gray-300 rounded p-3"
            onDragOver={(e) => {
              e.preventDefault();
              if (selectedCell || multiSelect.length > 0) e.currentTarget.classList.add('bg-red-50');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('bg-red-50');
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('bg-red-50');
              if (multiSelect.length > 0) {
                saveToHistory();
                multiSelect.forEach(sel => {
                  clearCell(sel.rowId, sel.day);
                });
                setMultiSelect([]);
                setSelectionAnchor(null);
              } else if (selectedCell) {
                saveToHistory();
                clearCell(selectedCell.rowId, selectedCell.day);
                setSelectedCell(null);
                setSelectionAnchor(null);
              }
            }}
          >
            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : workSchedules.length === 0 ? (
              <p className="text-sm text-gray-500">No work schedules saved yet.</p>
            ) : (
              workSchedules.map((schedule) => {
                const timeframes = schedule.work_schedule_timeframes?.sort(
                  (a, b) => a.frame_order - b.frame_order
                ) || [];
                
                const calculateTotalHours = () => {
                  let totalMinutes = 0;
                  timeframes.forEach((tf) => {
                    const [startHour, startMin] = tf.start_time.split(':').map(Number);
                    const [endHour, endMin] = tf.end_time.split(':').map(Number);
                    const startMinutes = startHour * 60 + startMin;
                    const endMinutes = endHour * 60 + endMin;
                    totalMinutes += endMinutes - startMinutes;
                    
                    // Subtract meal time if unpaid
                    if (tf.meal_type === 'unpaid' && tf.meal_start && tf.meal_end) {
                      const [mealStartHour, mealStartMin] = tf.meal_start.split(':').map(Number);
                      const [mealEndHour, mealEndMin] = tf.meal_end.split(':').map(Number);
                      const mealStartMinutes = mealStartHour * 60 + mealStartMin;
                      const mealEndMinutes = mealEndHour * 60 + mealEndMin;
                      totalMinutes -= (mealEndMinutes - mealStartMinutes);
                    }
                  });
                  const hours = Math.floor(totalMinutes / 60);
                  const minutes = totalMinutes % 60;
                  return `${hours}h ${minutes}m`;
                };

                return (
                  <Card
                    key={schedule.id}
                    draggable
                    onDragStart={() => {
                      handleDragStart(schedule);
                      setSelectedCell(null);
                    }}
                    className="p-4 hover:bg-gray-50 cursor-move transition-colors"
                  >
                    <div className="font-bold text-base mb-2">{schedule.shift_id}</div>
                    <div className="text-sm text-gray-600 mb-2">
                      Type: {schedule.shift_type}
                    </div>
                    
                    {timeframes.map((tf, idx) => (
                      <div key={idx} className="text-sm mb-2">
                        <div className="font-medium">
                          Time Frame {idx + 1}: {tf.start_time.slice(0, 5)} - {tf.end_time.slice(0, 5)}
                        </div>
                        {tf.meal_start && tf.meal_end && (
                          <div className="text-xs text-gray-600 ml-2">
                            Meal ({tf.meal_type || 'paid'}): {tf.meal_start.slice(0, 5)} - {tf.meal_end.slice(0, 5)}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <div className="font-semibold text-sm mt-2 pt-2 border-t">
                      Total Hours: {calculateTotalHours()}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
          </div>
        </div>
      )}
    </>
  );
}
