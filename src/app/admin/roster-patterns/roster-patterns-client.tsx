"use client";

import { useState, useEffect, Fragment } from "react";
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
import { Calendar as CalendarIcon, Plus, Trash2, Minus, Info, Copy, Zap, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/supabase";
import type { ShiftTypeOption, DayPeriodConfig } from "@/lib/types/database";
import { getPeriodCardStyle, getPeriodTileTextColor } from "@/lib/day-period-colors";
import { computeAllocationDate, type Shift, type RosterPatternSettings } from "@/lib/shift-allocation";
import { simulateAllocationImpact } from "@/lib/allocation-simulation";
import { AllocationExplanationDrawer } from "@/components/allocation-explanation-drawer";
import { AllocationSimulationModal } from "@/components/allocation-simulation-modal";
import { ShiftDetailsPanel } from "@/components/shift-details-panel";

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

export interface WorkSchedule {
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
  night_shift_allocation_mode?: "START_DAY" | "MAJORITY_HOURS" | "FIXED_ROSTER_DAY" | "SPLIT_BY_DAY" | "WEEKLY_BALANCING";
  night_shift_allocation_params?: Record<string, unknown> | null;
  pattern_rows: PatternRow[];
  created_at?: string;
}

interface AssignableUser {
  userId: string;
  profileId: string;
  fullName: string;
  email: string;
  role: "admin" | "manager" | "employee";
  employeeNumber: string | null;
  customFields: Json | null;
}

interface AssignmentAvailability {
  isSelected: boolean;
  isLocked: boolean;
  lockedPatternId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAssignedPatternIds(customFields: Json | null | undefined): string[] {
  if (!isRecord(customFields) || !Array.isArray(customFields.assigned_roster_pattern_ids)) {
    return [];
  }

  return customFields.assigned_roster_pattern_ids.filter(
    (value): value is string => typeof value === "string"
  );
}

function withAssignedPatternIds(
  customFields: Json | null | undefined,
  patternIds: string[]
): Json {
  const base = isRecord(customFields) ? { ...customFields } : {};

  return {
    ...base,
    assigned_roster_pattern_ids: patternIds,
  } as Json;
}

function getUserAssignedPatternId(
  customFields: Json | null | undefined
): string | null {
  const patternIds = getAssignedPatternIds(customFields);
  return patternIds[0] || null;
}

const DEFAULT_DAY_PERIODS: DayPeriodConfig[] = [
  { id: "night", label: "Night", startMinutes: 0, endMinutes: 360 },
  { id: "morning", label: "Morning", startMinutes: 360, endMinutes: 720 },
  { id: "day", label: "Day", startMinutes: 720, endMinutes: 1080 },
  { id: "evening", label: "Evening", startMinutes: 1080, endMinutes: 1440 },
];

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
  const [allocationMode, setAllocationMode] = useState<"START_DAY" | "MAJORITY_HOURS" | "FIXED_ROSTER_DAY" | "SPLIT_BY_DAY" | "WEEKLY_BALANCING">("MAJORITY_HOURS");
  const [savedAllocationMode, setSavedAllocationMode] = useState<"START_DAY" | "MAJORITY_HOURS" | "FIXED_ROSTER_DAY" | "SPLIT_BY_DAY" | "WEEKLY_BALANCING">("MAJORITY_HOURS");
  const [savedAllocationParams, setSavedAllocationParams] = useState<Record<string, unknown>>({});
  const [allocationParams, setAllocationParams] = useState<Record<string, unknown>>({});
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
  const [selectedCellDetails, setSelectedCellDetails] = useState<{rowId: string, day: string, date: Date, weekNumber?: number} | null>(null);
  const [selectedShiftDetails, setSelectedShiftDetails] = useState<{schedule: WorkSchedule; daySchedules: WorkSchedule[]} | null>(null);
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
  const [scheduleFilter, setScheduleFilter] = useState<string>("all");
  const [copiedSchedules, setCopiedSchedules] = useState<WorkSchedule[] | null>(null);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [copySourcePattern, setCopySourcePattern] = useState<SavedPattern | null>(null);
  const [copyName, setCopyName] = useState("");
  const [isCopying, setIsCopying] = useState(false);
  const [minHoursBetweenShifts, setMinHoursBetweenShifts] = useState(8);
  const [shiftViolationDialog, setShiftViolationDialog] = useState<{show: boolean, message: string, shiftId?: string}>({show: false, message: ""});
  const [navigationPending, setNavigationPending] = useState(false);
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [weeksReductionDialog, setWeeksReductionDialog] = useState<{show: boolean, targetWeeks: number, nonEmptyWeeks: number[]}>({show: false, targetWeeks: 0, nonEmptyWeeks: []});
  const [dayPeriods, setDayPeriods] = useState<DayPeriodConfig[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeOption[] | null>(null);
  const [tenantUsers, setTenantUsers] = useState<AssignableUser[]>([]);
  const [patternAssignments, setPatternAssignments] = useState<Record<string, string[]>>({});
  const [assignmentDialog, setAssignmentDialog] = useState<{open: boolean; pattern: SavedPattern | null}>({ open: false, pattern: null });
  const [selectedAssignmentUserIds, setSelectedAssignmentUserIds] = useState<string[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

  // Enterprise allocation features
  const [showExplanation, setShowExplanation] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);
  const [selectedShiftForExplanation, setSelectedShiftForExplanation] = useState<Shift | null>(null);
  const [selectedShiftForSimulation, setSelectedShiftForSimulation] = useState<WorkSchedule | null>(null);
  const [simulationResult, setSimulationResult] = useState<ReturnType<typeof simulateAllocationImpact> | null>(null);
  const [expandedPayrollRows, setExpandedPayrollRows] = useState<Set<string>>(new Set());
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    console.log("Component mounted, loading work schedules...");
    loadWorkSchedules();
    loadSavedPatterns();
    loadTenantConfig();
    loadAssignableUsers();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        const source = selectedCell || multiSelect[0];
        if (source) {
          const cellSchedules = getCellSchedules(source.rowId, source.day);
          if (cellSchedules.length > 0) {
            e.preventDefault();
            setCopiedSchedules(cellSchedules);
          }
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        if (!copiedSchedules || copiedSchedules.length === 0) return;
        const targets = multiSelect.length > 0 ? multiSelect : selectedCell ? [selectedCell] : [];
        if (targets.length > 0) {
          e.preventDefault();
          saveToHistory();
          const targetMap = targets.reduce<Record<string, Set<string>>>((acc, sel) => {
            if (!acc[sel.rowId]) acc[sel.rowId] = new Set();
            acc[sel.rowId].add(sel.day);
            return acc;
          }, {});

          let warningShown = false;

          setPatternRows(rows =>
            rows.map(row => {
              if (!targetMap[row.id]) return row;
              const updatedRow = { ...row };

              targetMap[row.id].forEach(dayName => {
                const dayKey = dayName.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
                const existingShifts = Array.isArray(updatedRow[dayKey]) ? updatedRow[dayKey] : [];
                const overflowFromPrevious = getOverflowFromPreviousDay(row, dayName);
                const nextDayShifts = shouldCheckNextDay(row, dayName)
                  ? getAdjacentDaySchedules(row, dayName, 'next')
                  : [];
                const allowOvernightWrap = !!copiedSchedules[0]
                  && shouldAllowLastCellOvernightOverlap(row, dayName, copiedSchedules[0]);
                const { blockMessage, warningMessage } = getOverlapMessage(
                  existingShifts,
                  copiedSchedules,
                  overflowFromPrevious,
                  nextDayShifts,
                  allowOvernightWrap
                );

                if (warningMessage && !warningShown) {
                  showOverlapWarning(warningMessage);
                  warningShown = true;
                }

                if (blockMessage) {
                  if (!warningShown) {
                    showOverlapWarning(blockMessage);
                    warningShown = true;
                  }
                  return;
                }

                updatedRow[dayKey] = [...existingShifts, ...copiedSchedules];
              });

              return updatedRow;
            })
          );
        }
        return;
      }

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
  }, [selectedCell, undoHistory, multiSelect, patternRows, selectionAnchor, copiedSchedules]);

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

  const loadAssignableUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.user_metadata?.tenant_id as string | undefined;
      if (!tenantId) return;

      const [{ data: usersData, error: usersError }, { data: profilesData, error: profilesError }] =
        await Promise.all([
          supabase
            .from("users")
            .select("id, email, role")
            .eq("tenant_id", tenantId)
            .order("email"),
          supabase
            .from("profiles")
            .select("id, user_id, first_name, last_name, email, employee_number, custom_fields")
            .eq("tenant_id", tenantId)
            .order("first_name"),
        ]);

      if (usersError) throw usersError;
      if (profilesError) throw profilesError;

      const userById = new Map((usersData || []).map((tenantUser) => [tenantUser.id, tenantUser]));
      const nextUsers: AssignableUser[] = (profilesData || [])
        .filter((profile) => profile.user_id && userById.has(profile.user_id))
        .map((profile) => {
          const tenantUser = userById.get(profile.user_id as string)!;
          return {
            userId: tenantUser.id,
            profileId: profile.id,
            fullName: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email,
            email: profile.email,
            role: tenantUser.role,
            employeeNumber: profile.employee_number,
            customFields: profile.custom_fields,
          };
        });

      const assignments: Record<string, string[]> = {};
      nextUsers.forEach((tenantUser) => {
        getAssignedPatternIds(tenantUser.customFields).forEach((patternId) => {
          if (!assignments[patternId]) assignments[patternId] = [];
          assignments[patternId].push(tenantUser.userId);
        });
      });

      setTenantUsers(nextUsers);
      setPatternAssignments(assignments);
    } catch (error) {
      console.error("Error loading assignable users:", error);
    }
  };

  const loadTenantConfig = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;

      const { data, error } = await supabase
        .from('tenant_config')
        .select('min_hours_between_shifts, day_periods, shift_types')
        .eq('tenant_id', user.user.user_metadata?.tenant_id)
        .single();

      if (error) throw error;
      if (data) {
        const row = data as unknown as {
          min_hours_between_shifts: number | null;
          day_periods: DayPeriodConfig[] | null;
          shift_types: ShiftTypeOption[] | null;
        };

        if (row.min_hours_between_shifts != null) {
          setMinHoursBetweenShifts(row.min_hours_between_shifts);
        }

        if (Array.isArray(row.day_periods) && row.day_periods.length > 0) {
          // Preserve stored order (matches Settings and Work Schedule columns)
          setDayPeriods([...row.day_periods]);
        } else {
          setDayPeriods(DEFAULT_DAY_PERIODS);
        }

        if (Array.isArray(row.shift_types) && row.shift_types.length > 0) {
          setShiftTypes(row.shift_types);
        } else {
          setShiftTypes(null);
        }
      }
    } catch (error) {
      console.error('Error loading tenant config:', error);
      setMinHoursBetweenShifts(8);
      setDayPeriods(DEFAULT_DAY_PERIODS);
      setShiftTypes(null);
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

  const reorderPatternRows = (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return;
    const updated = [...patternRows];
    const [moved] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, moved);

    const renumbered = updated.map((row, idx) => ({
      ...row,
      number: idx + 1,
    }));

    setPatternRows(renumbered);
    saveToHistory();
  };

  const handleRowDrop = (targetRowId: string) => {
    if (endDateType !== 'continuous') return;
    if (!draggedRowId || draggedRowId === targetRowId) return;
    const sourceIndex = patternRows.findIndex(row => row.id === draggedRowId);
    const targetIndex = patternRows.findIndex(row => row.id === targetRowId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    reorderPatternRows(sourceIndex, targetIndex);
    setDraggedRowId(null);
  };

  const hasOverflowFromPreviousWeek = (rowIndex: number): boolean => {
    if (rowIndex <= 0) return false;
    const orderedDays = getOrderedDays();
    const lastDayInOrder = orderedDays[orderedDays.length - 1];
    const lastDayKey = lastDayInOrder.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
    const prevRow = patternRows[rowIndex - 1];
    return (prevRow[lastDayKey] ?? []).some((s: WorkSchedule) => shiftSpansMidnight(s));
  };

  const getNonEmptyWeeksInRange = (targetWeeks: number): number[] => {
    return patternRows.slice(targetWeeks).map((row, idx) => {
      const rowIndex = targetWeeks + idx;
      const hasSchedules = isRowNonEmpty(row);
      const hasOverflow = hasOverflowFromPreviousWeek(rowIndex);
      return hasSchedules || hasOverflow ? row.number : null;
    }).filter((value): value is number => value !== null);
  };

  const applyWeeksPattern = (targetWeeks: number) => {
    const clampedWeeks = Math.min(Math.max(targetWeeks, 1), 52);
    setWeeksPattern(clampedWeeks.toString());

    if (clampedWeeks > patternRows.length) {
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
      const newRows = patternRows.slice(0, clampedWeeks).map((row, idx) => ({
        ...row,
        number: idx + 1,
      }));
      setPatternRows(newRows);
    }
  };

  const handleWeeksPatternChange = (value: string) => {
    setWeeksPattern(value);
    if (value.trim() === "") return;
    if (!/^\d+$/.test(value)) return;

    const numWeeks = parseInt(value, 10);
    const clampedWeeks = Math.min(Math.max(numWeeks, 1), 52);

    if (clampedWeeks < patternRows.length) {
      const nonEmptyWeeks = getNonEmptyWeeksInRange(clampedWeeks);
      if (nonEmptyWeeks.length > 0) {
        setWeeksReductionDialog({show: true, targetWeeks: clampedWeeks, nonEmptyWeeks});
        return;
      }
    }

    applyWeeksPattern(clampedWeeks);
  };

  const handleWeeksPatternBlur = () => {
    const value = weeksPattern.trim();
    if (value === "" || !/^\d+$/.test(value)) {
      setWeeksPattern(patternRows.length.toString());
      return;
    }

    const numWeeks = parseInt(value, 10);
    const clampedWeeks = Math.min(Math.max(numWeeks, 1), 52);

    if (clampedWeeks < patternRows.length) {
      const nonEmptyWeeks = getNonEmptyWeeksInRange(clampedWeeks);
      if (nonEmptyWeeks.length > 0) {
        setWeeksReductionDialog({show: true, targetWeeks: clampedWeeks, nonEmptyWeeks});
        return;
      }
    }

    applyWeeksPattern(clampedWeeks);
  };

  const hasAnySchedule = (selections: {rowId: string, day: string}[]): boolean => {
    return selections.some(sel => {
      const row = patternRows.find(r => r.id === sel.rowId);
      if (!row) return false;
      const dayKey = sel.day.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
      return row[dayKey].length > 0;
    });
  };

  const getCellSchedules = (rowId: string, dayName: string): WorkSchedule[] => {
    const row = patternRows.find(r => r.id === rowId);
    if (!row) return [];
    const dayKey = dayName.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
    return Array.isArray(row[dayKey]) ? row[dayKey] : [];
  };

  const getAdjacentDaySchedules = (row: PatternRow, dayName: string, direction: 'next' | 'prev'): WorkSchedule[] => {
    const orderedDays = getOrderedDays();
    const dayIndex = orderedDays.indexOf(dayName);
    if (dayIndex === -1) return [];

    const rowIndex = patternRows.findIndex(r => r.id === row.id);
    if (rowIndex === -1) return [];

    if (direction === 'next') {
      if (dayIndex < orderedDays.length - 1) {
        return getCellSchedules(row.id, orderedDays[dayIndex + 1]);
      }
      const nextRow = patternRows[rowIndex + 1];
      if (nextRow) return getCellSchedules(nextRow.id, orderedDays[0]);
      if (endDateType === 'continuous' && patternRows.length > 0) {
        return getCellSchedules(patternRows[0].id, orderedDays[0]);
      }
      return [];
    }

    if (dayIndex > 0) {
      return getCellSchedules(row.id, orderedDays[dayIndex - 1]);
    }
    const prevRow = patternRows[rowIndex - 1];
    if (prevRow) return getCellSchedules(prevRow.id, orderedDays[orderedDays.length - 1]);
    if (endDateType === 'continuous' && patternRows.length > 0) {
      return getCellSchedules(patternRows[patternRows.length - 1].id, orderedDays[orderedDays.length - 1]);
    }
    return [];
  };

  const getOverflowFromPreviousDay = (row: PatternRow, dayName: string): WorkSchedule[] => {
    const isFirstRow = row.number === 1;
    const isLastRow = row.number === patternRows.length;
    const orderedDays = getOrderedDays();
    const currentDayIndex = orderedDays.indexOf(dayName);
    const isFirstDayInOrder = currentDayIndex === 0;
    const isFirstCell = isFirstRow && isFirstDayInOrder;

    let previousDay: string;
    let previousDayKey: keyof Omit<PatternRow, 'id' | 'number'>;
    let previousDaySchedules: WorkSchedule[] = [];

    if (isFirstDayInOrder) {
      // First day of the ordered week
      if (endDateType === 'specify' && isFirstCell) {
        // First cell of a specified pattern: no overflow
        previousDaySchedules = [];
      } else if (isFirstCell && endDateType === 'continuous') {
        // First cell of a continuous pattern: get overflow from last week's last day
        const lastDayInOrder = orderedDays[orderedDays.length - 1];
        const lastDayKey = lastDayInOrder.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
        const lastRow = patternRows[patternRows.length - 1];
        const lastRowLastDayValue = lastRow[lastDayKey];
        previousDaySchedules = Array.isArray(lastRowLastDayValue) ? lastRowLastDayValue : [];
      } else {
        // First day of week 2+: get overflow from previous row's last day
        const lastDayInOrder = orderedDays[orderedDays.length - 1];
        const lastDayKey = lastDayInOrder.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
        const prevRowIndex = row.number - 2;
        if (prevRowIndex >= 0) {
          const prevRow = patternRows[prevRowIndex];
          const prevRowLastDayValue = prevRow[lastDayKey];
          previousDaySchedules = Array.isArray(prevRowLastDayValue) ? prevRowLastDayValue : [];
        }
      }
    } else {
      // Regular case: check previous day in ordered sequence
      previousDay = orderedDays[currentDayIndex - 1];
      previousDayKey = previousDay.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
      
      // For continuous patterns on first week: ONLY check last week's previous day (wraparound)
      if (endDateType === 'continuous' && isFirstRow && patternRows.length > 1) {
        const lastRow = patternRows[patternRows.length - 1];
        const lastRowPrevDayValue = lastRow[previousDayKey];
        previousDaySchedules = Array.isArray(lastRowPrevDayValue) ? lastRowPrevDayValue : [];
      } else {
        // For all other weeks: check same week's previous day
        const prevDayValue = row[previousDayKey];
        previousDaySchedules = Array.isArray(prevDayValue) ? prevDayValue : [];
      }
    }

    return previousDaySchedules.filter(s => shiftSpansMidnight(s));
  };

  const timeStringToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const formatHoursValue = (hours: number): string => {
    return hours % 1 === 0 ? String(hours) : hours.toFixed(1);
  };

  const getViolationMessage = (actualHours: number, minHours: number, includeSettings: boolean): string => {
    const displayMin = formatHoursValue(minHours);
    if (actualHours < 0) {
      const overlap = formatHoursValue(Math.abs(actualHours));
      return `Shifts overlap by ${overlap} hours. Minimum rest is ${displayMin} hours.${includeSettings ? " You can change this value in Settings." : ""}`;
    }
    const displayActual = formatHoursValue(actualHours);
    return `Time between shifts is ${displayActual} hours, but minimum allowed is ${displayMin} hours.${includeSettings ? " You can change this value in Settings." : ""}`;
  };

  const getTimeBetweenShifts = (endTime: string, startTime: string, isDifferentDay: boolean = false): number => {
    const endMinutes = timeStringToMinutes(endTime);
    const startMinutes = timeStringToMinutes(startTime);
    const minsPerDay = 24 * 60;

    if (isDifferentDay) {
      // Consecutive days: rest = (end of day 1 → midnight) + (midnight → start of day 2)
      const minutesToMidnight = minsPerDay - endMinutes;
      const minutesFromMidnight = startMinutes;
      return (minutesToMidnight + minutesFromMidnight) / 60;
    }

    // Same day: rest = start - end (with wrap if overnight)
    let diffMinutes = startMinutes - endMinutes;
    if (diffMinutes < 0) {
      diffMinutes += minsPerDay;
    }
    return diffMinutes / 60;
  };

  const getShiftEndTime = (schedule: WorkSchedule): string => {
    const timeframes = schedule.work_schedule_timeframes || [];
    if (timeframes.length === 0) return '00:00';
    return timeframes[timeframes.length - 1].end_time;
  };

  const getShiftStartTime = (schedule: WorkSchedule): string => {
    const timeframes = schedule.work_schedule_timeframes || [];
    if (timeframes.length === 0) return '00:00';
    return timeframes[0].start_time;
  };

  const checkShiftViolations = (row: PatternRow, dayName: string): {violatingShifts: WorkSchedule[], violatesMin: (schedule: WorkSchedule) => boolean, getViolationDetails: (schedule: WorkSchedule) => {actualHours: number} | null} => {
    const schedules = sortSchedules(getCellSchedules(row.id, dayName));
    if (schedules.length === 0) {
      return { violatingShifts: [], violatesMin: () => false, getViolationDetails: () => null };
    }

    const violatingShifts: WorkSchedule[] = [];
    const violationDetails = new Map<string, {actualHours: number}>();
    
    // Get shifts from previous day overflow
    const overflowShifts = sortSchedules(getOverflowFromPreviousDay(row, dayName));
    
    // Check for overlaps with overflow shifts (only mark overlaps, not time gaps)
    if (overflowShifts.length > 0) {
      const lastOverflow = overflowShifts[overflowShifts.length - 1];
      const firstSchedule = schedules[0];
      
      // Only check for actual time overlap, not insufficient gap
      // (Gap violations are marked on the previous day's shift)
      if (shiftsOverlap(firstSchedule, lastOverflow, true)) {
        violatingShifts.push(firstSchedule);
        const overlapHours = getOverlapHours(firstSchedule, lastOverflow, true);
        violationDetails.set(firstSchedule.id, { actualHours: overlapHours > 0 ? -overlapHours : 0 });
      }
    }

    // Check time between last non-overflow shift of previous day and first shift of current day
    const previousDaySchedules = sortSchedules(getAdjacentDaySchedules(row, dayName, 'prev'));
    
    if (previousDaySchedules.length > 0) {
      // Get the last non-overflow shift from previous day
      const previousNonOverflowShifts = previousDaySchedules.filter(s => !shiftSpansMidnight(s));
      if (previousNonOverflowShifts.length > 0) {
        const lastPreviousShift = previousNonOverflowShifts[previousNonOverflowShifts.length - 1];
        const firstCurrentShift = schedules[0];
        const previousEnd = getShiftEndTime(lastPreviousShift);
        const currentStart = getShiftStartTime(firstCurrentShift);
        const timeBetween = getTimeBetweenShifts(previousEnd, currentStart, true);
        
        if (timeBetween < minHoursBetweenShifts) {
          // Only mark if there's no overflow (overflow takes precedence)
          if (overflowShifts.length === 0) {
            // Mark the previous shift (the one that ends) to show violation between days
            violatingShifts.push(lastPreviousShift);
            violationDetails.set(lastPreviousShift.id, { actualHours: timeBetween });
          }
        }
      }
    }
    
    // Check time between consecutive shifts within the same day
    for (let i = 0; i < schedules.length - 1; i++) {
      const currentShift = schedules[i];
      const nextShift = schedules[i + 1];
      let timeBetween: number;
      if (shiftsOverlap(currentShift, nextShift, false)) {
        const overlapHours = getOverlapHours(currentShift, nextShift, false);
        timeBetween = overlapHours > 0 ? -overlapHours : 0;
      } else {
        const currentEnd = getShiftEndTime(currentShift);
        const nextStart = getShiftStartTime(nextShift);
        timeBetween = getTimeBetweenShifts(currentEnd, nextStart);
      }
      if (timeBetween < minHoursBetweenShifts) {
        violatingShifts.push(currentShift);
        violationDetails.set(currentShift.id, { actualHours: timeBetween });
      }
    }

    // Check time between last shift of current day and first shift of next day (forward check)
    if (schedules.length > 0) {
      const lastScheduleOfDay = schedules[schedules.length - 1];
      const nextDaySchedules = sortSchedules(getAdjacentDaySchedules(row, dayName, 'next'));
      
      if (nextDaySchedules.length > 0) {
        const firstScheduleOfNextDay = nextDaySchedules[0];
        let timeBetween: number;
        if (shiftSpansMidnight(lastScheduleOfDay) && shiftsOverlap(firstScheduleOfNextDay, lastScheduleOfDay, true)) {
          const overlapHours = getOverlapHours(firstScheduleOfNextDay, lastScheduleOfDay, true);
          timeBetween = overlapHours > 0 ? -overlapHours : 0;
        } else if (shiftSpansMidnight(lastScheduleOfDay)) {
          // For overnight shifts: the end time is already on the next day, so just compare times directly
          const lastEnd = getShiftEndTime(lastScheduleOfDay);
          const nextStart = getShiftStartTime(firstScheduleOfNextDay);
          timeBetween = getTimeBetweenShifts(lastEnd, nextStart, false);
        } else {
          const lastEnd = getShiftEndTime(lastScheduleOfDay);
          const nextStart = getShiftStartTime(firstScheduleOfNextDay);
          timeBetween = getTimeBetweenShifts(lastEnd, nextStart, true);
        }
        if (timeBetween < minHoursBetweenShifts) {
          // When the violation is overlap with next day's first shift and we span midnight, only mark
          // the next day's shift (in the "overflow from prev" check), not this one - so we show a single exclamation.
          const isOverlapWithOvernight = shiftSpansMidnight(lastScheduleOfDay) && timeBetween < 0;
          if (!isOverlapWithOvernight) {
            violatingShifts.push(lastScheduleOfDay);
            violationDetails.set(lastScheduleOfDay.id, { actualHours: timeBetween });
          }
        }
      }
    }
    
    const violatingIds = new Set(violatingShifts.map(s => s.id));
    
    return {
      violatingShifts: violatingShifts,
      violatesMin: (schedule: WorkSchedule) => violatingIds.has(schedule.id),
      getViolationDetails: (schedule: WorkSchedule) => violationDetails.get(schedule.id) || null
    };
  };

  const showOverlapWarning = (message: string) => {
    setOverlapError({ message });
    if (overlapError?.timeout) clearTimeout(overlapError.timeout);
    const timeout = setTimeout(() => setOverlapError(null), 5000);
    setOverlapError({ message, timeout });
  };

  const getOverlapMessage = (
    existingShifts: WorkSchedule[],
    incomingShifts: WorkSchedule[],
    overflowFromPrevious: WorkSchedule[] = [],
    nextDayShifts: WorkSchedule[] = [],
    allowOvernightWrap: boolean = false
  ): { blockMessage: string | null; warningMessage: string | null } => {
    if (incomingShifts.length > 1) {
      return {
        blockMessage: `Cannot add ${incomingShifts[0]?.shift_id || 'shift'}: cannot add multiple shifts at once`,
        warningMessage: null,
      };
    }

    const incoming = incomingShifts[0];
    if (!incoming) {
      return { blockMessage: null, warningMessage: null };
    }

    // Check if trying to add a full schedule when one already exists
    const incomingIsFullSchedule = !shiftSpansMidnight(incoming);
    if (incomingIsFullSchedule && countFullSchedules(existingShifts) >= 1) {
      return {
        blockMessage: `Cannot add ${incoming.shift_id}: only 1 full schedule allowed per day`,
        warningMessage: null,
      };
    }

    // Check for actual time overlaps (not just multiple shifts)
    for (const existing of existingShifts) {
      if (shiftsOverlap(incoming, existing)) {
        return {
          blockMessage: `Cannot add ${incoming.shift_id}: overlaps with ${existing.shift_id}`,
          warningMessage: null,
        };
      }
    }

    for (const overflow of overflowFromPrevious) {
      if (shiftsOverlap(incoming, overflow, true)) {
        return {
          blockMessage: `Cannot add ${incoming.shift_id}: overlaps with overnight shift from previous day (${overflow.shift_id})`,
          warningMessage: null,
        };
      }
    }

    // If incoming spans midnight, its overflow would overlap with next day's shifts
    if (shiftSpansMidnight(incoming) && nextDayShifts.length > 0) {
      for (const nextShift of nextDayShifts) {
        if (shiftsOverlap(nextShift, incoming, true)) {
          if (allowOvernightWrap) {
            return {
              blockMessage: null,
              warningMessage: `Allowing ${incoming.shift_id}: overnight portion overlaps with ${nextShift.shift_id} on the next day but ends before 06:00`,
            };
          }
          return {
            blockMessage: `Cannot add ${incoming.shift_id}: its overnight portion would overlap with ${nextShift.shift_id} on the next day`,
            warningMessage: null,
          };
        }
      }
    }

    return { blockMessage: null, warningMessage: null };
  };

  const getOrderedDays = () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const startIndex = days.indexOf(startDay);
    return [...days.slice(startIndex), ...days.slice(0, startIndex)];
  };

  const shouldCheckNextDay = (row: PatternRow, dayName: string): boolean => {
    if (endDateType !== 'specify') return true;
    const orderedDays = getOrderedDays();
    const isLastDayInOrder = dayName === orderedDays[orderedDays.length - 1];
    const isLastRow = row.number === patternRows.length;
    return !(isLastRow && isLastDayInOrder);
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

  // Count full schedules (non-overflow) in a day
  const countFullSchedules = (schedules: WorkSchedule[]): number => {
    return schedules.filter(s => !shiftSpansMidnight(s)).length;
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

  const getOverflowEndMinutes = (schedule: WorkSchedule): number => {
    const timeframes = schedule.work_schedule_timeframes || [];
    if (timeframes.length === 0) return 0;
    const lastFrame = timeframes[timeframes.length - 1];
    const [endH, endM] = lastFrame.end_time.split(':').map(Number);
    return endH * 60 + endM;
  };

  const shouldAllowLastCellOvernightOverlap = (row: PatternRow, dayName: string, schedule: WorkSchedule): boolean => {
    if (endDateType !== 'continuous') return false;
    if (!shiftSpansMidnight(schedule)) return false;
    const orderedDays = getOrderedDays();
    const isLastDayInOrder = dayName === orderedDays[orderedDays.length - 1];
    const isLastRow = row.number === patternRows.length;
    if (!isLastRow || !isLastDayInOrder) return false;
    return getOverflowEndMinutes(schedule) < 360; // allow overlaps only if overflow ends before 06:00
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

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesFromMidnight = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours * 60) + minutes;
  };

  const getActiveDayPeriods = (): DayPeriodConfig[] => {
    if (dayPeriods.length > 0) {
      return [...dayPeriods].sort((a, b) => a.startMinutes - b.startMinutes);
    }
    return [...DEFAULT_DAY_PERIODS];
  };

  const getShiftPeriodId = (timeframes: TimeFrame[]): string => {
    const periods = getActiveDayPeriods();
    if (timeframes.length === 0 || periods.length === 0) return periods[0]?.id ?? "day";
    const first = timeframes.slice().sort((a, b) => a.frame_order - b.frame_order)[0];
    const startMins = minutesFromMidnight(first.start_time);
    const period = periods.find((p) => startMins >= p.startMinutes && startMins < p.endMinutes);
    return period?.id ?? periods[0].id;
  };

  const isSplitShift = (s: WorkSchedule): boolean => {
    const splitLabel = (shiftTypes?.find((t) => t.id === "split")?.label ?? "Split shift").trim();
    return (s.shift_type ?? "").trim() === splitLabel;
  };

  /**
   * Format a date for display based on pattern type
   * - For continuous patterns: "Week X: DayName"
   * - For specify dates patterns: "YYYY-MM-DD (DayName)"
   */
  const formatDateForDisplay = (date: Date, isPatternDate: boolean = false): string => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    
    if (endDateType === 'continuous') {
      if (isPatternDate) {
        // Calculate week number from the start date
        if (!startDate) return `${dayName}`;
        
        const patternStart = new Date(startDate);
        const dateCopy = new Date(date);
        
        // Calculate days difference
        const diffTime = Math.abs(dateCopy.getTime() - patternStart.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const weekNum = Math.floor(diffDays / 7) + 1;
        
        return `Week ${weekNum}: ${dayName}`;
      }
      return dayName;
    } else {
      // Specify dates mode
      const dateStr = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
      return `${dateStr} (${dayName})`;
    }
  };

  const sortSchedules = (schedules: WorkSchedule[]): WorkSchedule[] => {
    return [...schedules].sort((a, b) => {
      const aFrames = a.work_schedule_timeframes?.slice().sort((x, y) => x.frame_order - y.frame_order) || [];
      const bFrames = b.work_schedule_timeframes?.slice().sort((x, y) => x.frame_order - y.frame_order) || [];
      const aFirst = aFrames[0];
      const bFirst = bFrames[0];

      if (!aFirst || !bFirst) return 0;

      const aStart = minutesFromMidnight(aFirst.start_time);
      const bStart = minutesFromMidnight(bFirst.start_time);
      if (aStart !== bStart) return aStart - bStart;

      const aEnd = minutesFromMidnight(aFirst.end_time);
      const bEnd = minutesFromMidnight(bFirst.end_time);
      return aEnd - bEnd;
    });
  };

  const getShiftPeriod = (schedule: WorkSchedule) => {
    return getShiftPeriodId(schedule.work_schedule_timeframes || []);
  };

  /** Classes for shift tile (border, etc.). Use with getShiftTileStyle for saved period colors. */
  const getShiftTileClasses = (schedule: WorkSchedule) => {
    if (isSplitShift(schedule)) {
      return "bg-black text-white border-black";
    }
    return "border";
  };

  /** Inline style for shift tile from day period colour (sidebar and table cells). Returns null for split shifts. */
  const getShiftTileStyle = (schedule: WorkSchedule): React.CSSProperties | undefined => {
    if (isSplitShift(schedule)) return undefined;
    const periods = getActiveDayPeriods();
    const periodId = getShiftPeriodId(schedule.work_schedule_timeframes || []);
    const periodIndex = Math.max(0, periods.findIndex((p) => p.id === periodId));
    const period = periods[periodIndex];
    const cardStyle = getPeriodCardStyle(period, periodIndex);
    const textColor = getPeriodTileTextColor(period, periodIndex);
    return {
      backgroundColor: cardStyle.backgroundColor,
      borderColor: cardStyle.borderColor,
      color: textColor,
    };
  };

  // Helper function to check if two shifts overlap
  const shiftsOverlap = (schedule1: WorkSchedule, schedule2: WorkSchedule, isSchedule2Overflow: boolean = false): boolean => {
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
        
        // If schedule2 is overflow from previous day (midnight-spanning),
        // only check the "next day morning" portion (0:00 to end_time)
        if (isSchedule2Overflow && end2 < start2) {
          // This is an overnight shift. On the next day, it only occupies 0:00 to end2
          start2 = 0;
          // end2 stays the same (e.g., 420 for 07:00)
        }
        
        // Handle midnight shifts
        const spans1 = end1 < start1; // crosses midnight
        const spans2 = end2 < start2; // crosses midnight
        
        // When comparing incoming shift to overflow from previous day: only the current-day
        // portion of the incoming shift can overlap. Overflow on current day is [0, end2].
        // Incoming on current day: if it spans midnight, only [start1, 1440]; else [start1, end1].
        if (isSchedule2Overflow && spans1) {
          const incomingCurrentDayEnd = 1440;
          const overlap = start1 < end2 && incomingCurrentDayEnd > 0;
          if (overlap) return true;
          continue;
        }
        
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

  const getDayIntervals = (schedule: WorkSchedule, overflowOnly: boolean): Array<{ start: number; end: number }> => {
    const intervals: Array<{ start: number; end: number }> = [];
    const timeframes = schedule.work_schedule_timeframes || [];

    timeframes.forEach((tf) => {
      const start = minutesFromMidnight(tf.start_time);
      const end = minutesFromMidnight(tf.end_time);
      const spansMidnight = end < start;

      if (overflowOnly) {
        if (spansMidnight) {
          intervals.push({ start: 0, end });
        }
        return;
      }

      if (spansMidnight) {
        intervals.push({ start, end: 1440 });
      } else {
        intervals.push({ start, end });
      }
    });

    return intervals;
  };

  const getOverlapHours = (schedule1: WorkSchedule, schedule2: WorkSchedule, isSchedule2Overflow: boolean): number => {
    const intervals1 = getDayIntervals(schedule1, false);
    const intervals2 = getDayIntervals(schedule2, isSchedule2Overflow);
    let overlapMinutes = 0;

    intervals1.forEach((i1) => {
      intervals2.forEach((i2) => {
        const start = Math.max(i1.start, i2.start);
        const end = Math.min(i1.end, i2.end);
        if (end > start) {
          overlapMinutes += end - start;
        }
      });
    });

    return overlapMinutes / 60;
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
          const overflowFromPrevious = getOverflowFromPreviousDay(row, dayName);
          
          // Check if the dragged schedule is a full schedule (not overflow)
          const draggedIsFullSchedule = !shiftSpansMidnight(draggedSchedule);
          
          // If trying to add a full schedule, check we don't already have one
          if (draggedIsFullSchedule && countFullSchedules(existingShifts) >= 1) {
            const message = `Cannot add ${draggedSchedule.shift_id}: only 1 full schedule allowed per day`;
            showOverlapWarning(message);
            return row; // Don't add the shift
          }
          
          // Check for overlaps with existing shifts or overflow
          for (const existing of existingShifts) {
            if (shiftsOverlap(draggedSchedule, existing)) {
              const message = `Cannot add ${draggedSchedule.shift_id}: overlaps with ${existing.shift_id}`;
              showOverlapWarning(message);
              return row; // Don't add the shift
            }
          }

          for (const overflow of overflowFromPrevious) {
            if (shiftsOverlap(draggedSchedule, overflow, true)) {
              const message = `Cannot add ${draggedSchedule.shift_id}: overlaps with overnight shift from previous day (${overflow.shift_id})`;
              showOverlapWarning(message);
              return row; // Don't add the shift
            }
          }

          // If dropped shift spans midnight, its overflow would spill into next day: check overlap with next day's shifts
          const allowOvernightWrap = shouldAllowLastCellOvernightOverlap(row, dayName, draggedSchedule);
          if (shiftSpansMidnight(draggedSchedule) && shouldCheckNextDay(row, dayName)) {
            const nextDayName = getNextDay(dayName);
            const nextDayShifts = getAdjacentDaySchedules(row, dayName, 'next');
            for (const nextShift of nextDayShifts) {
              if (shiftsOverlap(nextShift, draggedSchedule, true)) {
                if (allowOvernightWrap) {
                  showOverlapWarning(
                    `Allowing ${draggedSchedule.shift_id}: overnight portion overlaps with ${nextShift.shift_id} on ${nextDayName} but ends before 06:00`
                  );
                  break;
                }
                const message = `Cannot add ${draggedSchedule.shift_id}: its overnight portion would overlap with ${nextShift.shift_id} on ${nextDayName}`;
                showOverlapWarning(message);
                return row; // Don't add the shift
              }
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
    
    // Align startDate with the pattern's startDay
    const baseDate = new Date(startDate + 'T00:00:00');
    const baseDayOfWeek = baseDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    
    // Get the target day of week from startDay
    const dayMap: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    const targetDayOfWeek = dayMap[startDay] ?? 1; // Default to Monday
    
    // Calculate adjustment: how many days to go back to reach the pattern's start day
    let adjustment = baseDayOfWeek - targetDayOfWeek;
    if (adjustment < 0) adjustment += 7; // Handle week wrap
    
    // Adjust baseDate to the pattern's start day
    baseDate.setDate(baseDate.getDate() - adjustment);
    
    // Now apply the offset for the specific week and day
    const daysOffset = (weekNumber - 1) * 7 + dayIndex;
    baseDate.setDate(baseDate.getDate() + daysOffset);
    
    // Format as DD/MM/YY
    const day = String(baseDate.getDate()).padStart(2, '0');
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const year = String(baseDate.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const getPatternBaseDate = (): Date => {
    const base = startDate
      ? new Date(startDate + 'T00:00:00')
      : new Date('2024-01-01T00:00:00');
    base.setHours(0, 0, 0, 0);

    const dayMap: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    const targetDayOfWeek = dayMap[startDay] ?? 1;

    let adjustment = base.getDay() - targetDayOfWeek;
    if (adjustment < 0) adjustment += 7;
    base.setDate(base.getDate() - adjustment);

    return base;
  };

  const getCellDateObject = (weekNumber: number, dayName: string): Date => {
    const orderedDays = getOrderedDays();
    const dayIndex = orderedDays.indexOf(dayName);
    const safeDayIndex = Math.max(dayIndex, 0);

    const baseDate = getPatternBaseDate();
    const daysOffset = (weekNumber - 1) * 7 + safeDayIndex;
    baseDate.setDate(baseDate.getDate() + daysOffset);
    baseDate.setHours(0, 0, 0, 0);
    return baseDate;
  };

  const workScheduleToShift = (schedule: WorkSchedule, selectedDate: Date, overrideId?: string): Shift => {
    const timeframes = schedule.work_schedule_timeframes?.slice().sort(
      (a, b) => a.frame_order - b.frame_order
    ) || [];

    if (timeframes.length === 0) {
      return {
        id: schedule.id,
        startDateTime: selectedDate,
        endDateTime: selectedDate,
      };
    }

    const firstFrame = timeframes[0];
    const lastFrame = timeframes[timeframes.length - 1];

    const startDateTime = new Date(selectedDate);
    const [startH, startM] = firstFrame.start_time.split(':').map(Number);
    startDateTime.setHours(startH, startM, 0, 0);

    const endDateTime = new Date(selectedDate);
    const [endH, endM] = lastFrame.end_time.split(':').map(Number);
    endDateTime.setHours(endH, endM, 0, 0);

    if (endDateTime.getTime() <= startDateTime.getTime()) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

    return {
      id: overrideId || schedule.id,
      startDateTime,
      endDateTime,
    };
  };

  const getAllocationModeLabel = (mode: typeof allocationMode): string => {
    switch (mode) {
      case 'START_DAY':
        return 'Start Day';
      case 'MAJORITY_HOURS':
        return 'Majority Hours';
      case 'FIXED_ROSTER_DAY':
        return 'Fixed Roster Day';
      case 'SPLIT_BY_DAY':
        return 'Split by Day';
      case 'WEEKLY_BALANCING':
        return 'Weekly Balancing';
      default:
        return 'New Settings';
    }
  };

  const buildAllShifts = (): Shift[] => {
    const shifts: Shift[] = [];
    const orderedDays = getOrderedDays();

    patternRows.forEach((row) => {
      orderedDays.forEach((dayName) => {
        const dayKey = dayName.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
        const dayValue = row[dayKey];
        const schedules = Array.isArray(dayValue) ? dayValue : [];
        const cellDate = getCellDateObject(row.number, dayName);

        // Get overflow from previous day (shifts that span midnight) - this is what the grid displays
        // Use week order: first day of week gets overflow from previous row's last day (or last row's last day for row 1)
        const orderedDays = getOrderedDays();
        const isFirstDayInOrder = dayName === orderedDays[0];
        let previousDaySchedules: WorkSchedule[] = [];
        if (isFirstDayInOrder && patternRows.length > 0) {
          if (row.number === 1) {
            const lastRow = patternRows[patternRows.length - 1];
            const lastDayKey = orderedDays[orderedDays.length - 1].toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
            const lastRowLastDayValue = lastRow[lastDayKey];
            previousDaySchedules = Array.isArray(lastRowLastDayValue) ? lastRowLastDayValue : [];
          } else {
            const prevRowIndex = row.number - 2;
            if (prevRowIndex >= 0) {
              const prevRow = patternRows[prevRowIndex];
              const lastDayKey = orderedDays[orderedDays.length - 1].toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
              const prevRowLastDayValue = prevRow[lastDayKey];
              previousDaySchedules = Array.isArray(prevRowLastDayValue) ? prevRowLastDayValue : [];
            }
          }
        } else {
          const previousDay = orderedDays[orderedDays.indexOf(dayName) - 1];
          const previousDayKey = previousDay.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
          const prevDayValue = row[previousDayKey];
          previousDaySchedules = Array.isArray(prevDayValue) ? prevDayValue : [];
        }
        
        // Get overflow shifts that span midnight - these are for display only
        // Don't add them as shifts here; they're already processed when added on their origin day
        const overflowShifts = previousDaySchedules.filter(s => shiftSpansMidnight(s));
        
        // Only add local schedules (not overflow) - overflow shifts are added when processing the day they originate from
        const localSchedules = schedules.sort((a, b) => {
          const aFirstTimeframe = a.work_schedule_timeframes?.[0];
          const bFirstTimeframe = b.work_schedule_timeframes?.[0];
          
          if (aFirstTimeframe && bFirstTimeframe) {
            const aStartParts = aFirstTimeframe.start_time.split(':').map(Number);
            const bStartParts = bFirstTimeframe.start_time.split(':').map(Number);
            const aStartMinutes = aStartParts[0] * 60 + aStartParts[1];
            const bStartMinutes = bStartParts[0] * 60 + bStartParts[1];
            
            if (aStartMinutes !== bStartMinutes) {
              return aStartMinutes - bStartMinutes;
            }
          }
          
          const aSpans = shiftSpansMidnight(a);
          const bSpans = shiftSpansMidnight(b);
          if (aSpans && !bSpans) return 1;
          if (!aSpans && bSpans) return -1;
          return 0;
        });

        localSchedules.forEach((schedule, idx) => {
          const shiftId = `${schedule.id}::${row.number}::${dayName}::${idx}`;
          const shift = workScheduleToShift(schedule, cellDate, shiftId);
          shifts.push(shift);
        });
      });
    });

    return shifts;
  };

  const buildSimulationData = () => {
    const shifts = buildAllShifts();
    const currentAllocations: Record<string, string | string[]> = {};

    // Provide defaults for WEEKLY_BALANCING if params are missing
    let savedParams = savedAllocationParams || {};
    if (savedAllocationMode === 'WEEKLY_BALANCING' && Object.keys(savedParams).length === 0) {
      savedParams = {
        weekStartDay: 'MON',
        weeklyOrdinaryHoursThresholdMinutes: 38 * 60,
        balancingStrategy: 'FILL_CURRENT_WEEK_FIRST',
        tieBreakerRule: 'PREFER_START_DAY',
        payPeriodDefinitionType: 'INHERIT_PAYROLL_CALENDAR',
      };
    }

    shifts.forEach((shift) => {
      const currentResult = computeAllocationDate(shift, {
        nightShiftAllocationMode: savedAllocationMode,
        nightShiftAllocationParams: savedParams,
      });

      if (Array.isArray(currentResult.allocationDate)) {
        currentAllocations[shift.id] = currentResult.allocationDate.map((d) =>
          getLocalDateString(d)
        );
      } else if (currentResult.allocationDate) {
        currentAllocations[shift.id] = getLocalDateString(currentResult.allocationDate);
      } else {
        currentAllocations[shift.id] = 'UNALLOCATED';
      }
    });

    return { shifts, currentAllocations };
  };

  const addMinutesToBucket = (bucket: Record<string, number>, date: Date, minutes: number) => {
    const key = getLocalDateString(date);
    bucket[key] = (bucket[key] || 0) + minutes;
  };

  const buildPayrollPreview = (mode: typeof allocationMode, useParams?: Record<string, unknown>) => {
    const shifts = buildAllShifts();
    
    const totals: Record<string, number> = {};
    const dateToWeekMap: Record<string, number> = {};
    const shiftsByDate: Record<string, Array<{ shiftId: string; minutes: number; schedule: WorkSchedule }>> = {};

    // Provide defaults for WEEKLY_BALANCING if params are missing
    let params = useParams || {};
    if (mode === 'WEEKLY_BALANCING' && Object.keys(params).length === 0) {
      params = {
        weekStartDay: 'MON',
        weeklyOrdinaryHoursThresholdMinutes: 38 * 60, // 38 hours = 2280 minutes
        balancingStrategy: 'FILL_CURRENT_WEEK_FIRST',
        tieBreakerRule: 'PREFER_START_DAY',
        payPeriodDefinitionType: 'INHERIT_PAYROLL_CALENDAR',
      };
    }

    shifts.forEach((shift) => {
      // Extract week number and schedule from shift ID (format: uuid::weekNumber::dayName::idx)
      const shiftIdParts = shift.id.split('::');
      const weekNumStr = shiftIdParts[1];
      const weekNum = parseInt(weekNumStr, 10);
      const dayNameFromId = shiftIdParts[2];
      
      // Find the schedule from patternRows
      let sourceSchedule: WorkSchedule | null = null;
      patternRows.forEach((row) => {
        getOrderedDays().forEach((day) => {
          const schedules = getCellSchedules(row.id, day);
          schedules.forEach((sched) => {
            if (sched.id === shiftIdParts[0]) {
              sourceSchedule = sched;
            }
          });
        });
      });
      
      const result = computeAllocationDate(shift, {
        nightShiftAllocationMode: mode,
        nightShiftAllocationParams: params,
      });

      const durationMinutes = Math.max(
        0,
        Math.round((shift.endDateTime.getTime() - shift.startDateTime.getTime()) / 60000)
      );

      if (Array.isArray(result.daySegments) && result.daySegments.length > 0) {
        result.daySegments.forEach((segment) => {
          const dateKey = getLocalDateString(segment.date);
          addMinutesToBucket(totals, segment.date, segment.minutes);
          if (endDateType === 'continuous' && !isNaN(weekNum)) {
            dateToWeekMap[dateKey] = weekNum;
          }
          if (!shiftsByDate[dateKey]) shiftsByDate[dateKey] = [];
          shiftsByDate[dateKey].push({
            shiftId: (sourceSchedule as WorkSchedule | null)?.shift_id || 'Unknown',
            minutes: segment.minutes,
            schedule: sourceSchedule || {} as WorkSchedule
          });
        });
        return;
      }

      if (Array.isArray(result.allocationDate)) {
        const perDay = durationMinutes / Math.max(1, result.allocationDate.length);
        result.allocationDate.forEach((date) => {
          const dateKey = getLocalDateString(date);
          addMinutesToBucket(totals, date, perDay);
          if (endDateType === 'continuous' && !isNaN(weekNum)) {
            dateToWeekMap[dateKey] = weekNum;
          }
          if (!shiftsByDate[dateKey]) shiftsByDate[dateKey] = [];
          shiftsByDate[dateKey].push({
            shiftId: (sourceSchedule as WorkSchedule | null)?.shift_id || 'Unknown',
            minutes: perDay,
            schedule: sourceSchedule || {} as WorkSchedule
          });
        });
        return;
      }

      if (result.allocationDate) {
        const dateKey = getLocalDateString(result.allocationDate);
        addMinutesToBucket(totals, result.allocationDate, durationMinutes);
        if (endDateType === 'continuous' && !isNaN(weekNum)) {
          dateToWeekMap[dateKey] = weekNum;
        }
        if (!shiftsByDate[dateKey]) shiftsByDate[dateKey] = [];
        shiftsByDate[dateKey].push({
          shiftId: (sourceSchedule as WorkSchedule | null)?.shift_id || 'Unknown',
          minutes: durationMinutes,
          schedule: sourceSchedule || {} as WorkSchedule
        });
      }
    });

    return Object.entries(totals)
      .map(([date, minutes]) => ({ 
        date, 
        minutes,
        weekNumber: dateToWeekMap[date],
        shifts: shiftsByDate[date] || []
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const formatMinutes = (minutes: number) => {
    const rounded = Math.round(minutes);
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    return `${hours}h ${String(mins).padStart(2, '0')}m`;
  };

  // Get date string in LOCAL timezone (not UTC) to avoid timezone shift bugs
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.user_metadata?.tenant_id as string | undefined;
      if (!tenantId && !editingPatternId) {
        alert('Unable to determine tenant. Please log in again.');
        setSaving(false);
        return;
      }

      const payload = {
        shift_id: shiftId || 'Untitled Pattern',
        start_date: startDate || null,
        end_date_type: endDateType,
        end_date: endDate || null,
        weeks_pattern: weeksPattern,
        start_pattern_week: startPatternWeek,
        start_day: startDay,
        night_shift_allocation_mode: allocationMode,
        night_shift_allocation_params: {},
        pattern_rows: patternRows as unknown as Json,
        ...(tenantId ? { tenant_id: tenantId } : {}),
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
    const rawMode = pattern.night_shift_allocation_mode || 'MAJORITY_HOURS';
    const mode = (rawMode === 'FIXED_ROSTER_DAY' || rawMode === 'WEEKLY_BALANCING') ? 'MAJORITY_HOURS' : rawMode;
    const params = pattern.night_shift_allocation_params || {};
    setAllocationMode(mode);
    setSavedAllocationMode(mode);
    setAllocationParams(params);
    setSavedAllocationParams(params);
    
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
      const assignedUsers = patternAssignments[id] || [];
      if (assignedUsers.length > 0) {
        await Promise.all(
          assignedUsers.map(async (userId) => {
            const tenantUser = tenantUsers.find((candidate) => candidate.userId === userId);
            if (!tenantUser) return;

            const nextPatternIds = getAssignedPatternIds(tenantUser.customFields).filter(
              (patternId) => patternId !== id
            );

            const { error } = await supabase
              .from("profiles")
              .update({
                custom_fields: withAssignedPatternIds(tenantUser.customFields, nextPatternIds),
              })
              .eq("id", tenantUser.profileId);

            if (error) throw error;
          })
        );
      }

      const { error } = await supabase.from('roster_patterns').delete().eq('id', id);
      if (error) throw error;
      await loadSavedPatterns();
      await loadAssignableUsers();
      setSavedAllocationMode(allocationMode);
    } catch (error) {
      console.error('Error deleting pattern:', error);
      alert('Failed to delete pattern.');
    }
  };

  const getDefaultCopyName = (name: string) => {
    const baseName = name || 'Untitled';
    const match = baseName.match(/_copy(\d+)?$/i);

    if (match) {
      const number = match[1] ? parseInt(match[1], 10) + 1 : 1;
      return baseName.replace(/_copy(\d+)?$/i, `_copy${number}`);
    }

    return `${baseName}_copy`;
  };

  const openCopyDialog = (pattern: SavedPattern) => {
    setCopySourcePattern(pattern);
    setCopyName(getDefaultCopyName(pattern.shift_id || 'Untitled'));
    setIsCopyDialogOpen(true);
  };

  const openAssignmentDialog = (pattern: SavedPattern) => {
    setAssignmentDialog({ open: true, pattern });
    setSelectedAssignmentUserIds(patternAssignments[pattern.id] || []);
  };

  const toggleAssignedUser = (userId: string) => {
    const availability = getAssignmentAvailability(userId);
    if (availability.isLocked) {
      return;
    }

    setSelectedAssignmentUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );
  };

  const getPatternNameById = (patternId: string | null | undefined) => {
    if (!patternId) {
      return "";
    }

    return savedPatterns.find((pattern) => pattern.id === patternId)?.shift_id || patternId;
  };

  const getAssignmentAvailability = (userId: string): AssignmentAvailability => {
    const activePatternId = assignmentDialog.pattern?.id || null;
    const tenantUser = tenantUsers.find((candidate) => candidate.userId === userId);
    const assignedPatternId = tenantUser ? getUserAssignedPatternId(tenantUser.customFields) : null;
    const isSelected = selectedAssignmentUserIds.includes(userId);
    const isLocked = Boolean(
      assignedPatternId && activePatternId && assignedPatternId !== activePatternId
    );

    return {
      isSelected,
      isLocked,
      lockedPatternId: isLocked ? assignedPatternId : null,
    };
  };

  const savePatternAssignments = async () => {
    const pattern = assignmentDialog.pattern;
    if (!pattern) return;

    setSavingAssignments(true);
    try {
      const previouslyAssignedUserIds = patternAssignments[pattern.id] || [];
      const affectedUserIds = Array.from(
        new Set([...previouslyAssignedUserIds, ...selectedAssignmentUserIds])
      );

      const updates = affectedUserIds.map(async (userId) => {
        const tenantUser = tenantUsers.find((candidate) => candidate.userId === userId);
        if (!tenantUser) return null;

        const currentPatternId = getUserAssignedPatternId(tenantUser.customFields);
        if (
          selectedAssignmentUserIds.includes(userId) &&
          currentPatternId &&
          currentPatternId !== pattern.id
        ) {
          return null;
        }

        const nextPatternIds = selectedAssignmentUserIds.includes(userId)
          ? [pattern.id]
          : currentPatternId === pattern.id
            ? []
            : currentPatternId
              ? [currentPatternId]
              : [];

        const nextCustomFields = withAssignedPatternIds(tenantUser.customFields, nextPatternIds);
        const { error } = await supabase
          .from("profiles")
          .update({ custom_fields: nextCustomFields })
          .eq("id", tenantUser.profileId);

        if (error) throw error;

        return {
          ...tenantUser,
          customFields: nextCustomFields,
        };
      });

      const updatedUsers = (await Promise.all(updates)).filter(
        (value): value is AssignableUser => value !== null
      );

      setTenantUsers((current) =>
        current.map((tenantUser) =>
          updatedUsers.find((updated) => updated.userId === tenantUser.userId) || tenantUser
        )
      );

      setPatternAssignments((current) => ({
        ...current,
        [pattern.id]: [...selectedAssignmentUserIds],
      }));
      await loadAssignableUsers();
      setAssignmentDialog({ open: false, pattern: null });
      setSelectedAssignmentUserIds([]);
    } catch (error) {
      console.error("Error saving pattern assignments:", error);
      alert("Failed to save pattern assignments.");
    } finally {
      setSavingAssignments(false);
    }
  };

  const getAssignedUsersForPattern = (patternId: string) => {
    const assignedUserIds = patternAssignments[patternId] || [];
    return tenantUsers.filter((tenantUser) => assignedUserIds.includes(tenantUser.userId));
  };

  const handleCopyPattern = async () => {
    if (!copySourcePattern) return;

    setIsCopying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.user_metadata?.tenant_id as string | undefined;
      if (!tenantId) {
        alert('Unable to determine tenant. Please log in again.');
        setIsCopying(false);
        return;
      }

      const payload = {
        shift_id: copyName || getDefaultCopyName(copySourcePattern.shift_id || 'Untitled'),
        start_date: copySourcePattern.start_date || null,
        end_date_type: copySourcePattern.end_date_type,
        end_date: copySourcePattern.end_date || null,
        weeks_pattern: copySourcePattern.weeks_pattern,
        start_pattern_week: copySourcePattern.start_pattern_week,
        start_day: copySourcePattern.start_day,
        night_shift_allocation_mode: copySourcePattern.night_shift_allocation_mode || 'MAJORITY_HOURS',
        night_shift_allocation_params: copySourcePattern.night_shift_allocation_params || {},
        pattern_rows: copySourcePattern.pattern_rows as unknown as Json,
        tenant_id: tenantId,
      };

      const { data, error } = await supabase
        .from('roster_patterns')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setSavedPatterns((prev) => [...prev, data as unknown as SavedPattern]);
      }

      setIsCopyDialogOpen(false);
      setCopySourcePattern(null);
      setCopyName('');
    } catch (error) {
      console.error('Error copying pattern:', error);
      alert('Failed to copy pattern.');
    } finally {
      setIsCopying(false);
    }
  };

  const minutesToTime = (m: number): string => {
    const hours = Math.floor(m / 60);
    const minutes = m % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const getFilteredSchedules = () => {
    const periods = getActiveDayPeriods();
    const nonSplitSchedules = workSchedules.filter((s) => !isSplitShift(s));
    const schedulesByPeriodId: Record<string, WorkSchedule[]> = {};
    periods.forEach((p) => {
      schedulesByPeriodId[p.id] = sortSchedules(
        nonSplitSchedules.filter((s) => getShiftPeriodId(s.work_schedule_timeframes || []) === p.id)
      );
    });
    const splitShiftsList = sortSchedules(workSchedules.filter(isSplitShift));

    if (scheduleFilter === "all") {
      const ordered = periods.flatMap((p) => schedulesByPeriodId[p.id] || []);
      return [...ordered, ...splitShiftsList];
    }

    if (scheduleFilter === "split") {
      return splitShiftsList;
    }

    return schedulesByPeriodId[scheduleFilter] || [];
  };

  const filteredSchedules = getFilteredSchedules();
  
  // Provide defaults for WEEKLY_BALANCING if params are missing
  let allocationParamsForSettings = allocationParams || {};
  if (allocationMode === 'WEEKLY_BALANCING' && Object.keys(allocationParamsForSettings).length === 0) {
    allocationParamsForSettings = {
      weekStartDay: 'MON',
      weeklyOrdinaryHoursThresholdMinutes: 38 * 60,
      balancingStrategy: 'FILL_CURRENT_WEEK_FIRST',
      tieBreakerRule: 'PREFER_START_DAY',
      payPeriodDefinitionType: 'INHERIT_PAYROLL_CALENDAR',
    };
  }

  const allocationSettings: RosterPatternSettings = {
    nightShiftAllocationMode: allocationMode,
    nightShiftAllocationParams: allocationParamsForSettings,
  };

  return (
    <>
      {/* Remove Row Confirmation Dialog */}
      <Dialog open={removeConfirmation.show} onOpenChange={(open) => !open && setRemoveConfirmation({rowId: '', show: false})}>
        <DialogContent className="sm:max-w-6xl">
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

      <Dialog open={weeksReductionDialog.show} onOpenChange={(open) => !open && setWeeksReductionDialog({show: false, targetWeeks: 0, nonEmptyWeeks: []})}>
        <DialogContent>
          <DialogTitle>Reduce Number of Weeks</DialogTitle>
          <DialogDescription>
            You are reducing the pattern to {weeksReductionDialog.targetWeeks} weeks. The following weeks contain schedules or overflow from previous week:
            <span className="block mt-2 font-semibold">Weeks: {weeksReductionDialog.nonEmptyWeeks.join(", ")}</span>
          </DialogDescription>
          <DialogFooter className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setWeeksReductionDialog({show: false, targetWeeks: 0, nonEmptyWeeks: []});
                setWeeksPattern(patternRows.length.toString());
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                applyWeeksPattern(weeksReductionDialog.targetWeeks);
                setWeeksReductionDialog({show: false, targetWeeks: 0, nonEmptyWeeks: []});
              }}
            >
              Delete Weeks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCopyDialogOpen} onOpenChange={(open) => !open && setIsCopyDialogOpen(false)}>
        <DialogContent>
          <DialogTitle>Copy Roster Pattern</DialogTitle>
          <DialogDescription>
            Enter a name for the copied roster pattern.
          </DialogDescription>
          <div className="mt-4">
            <Label htmlFor="copyPatternName" className="text-sm font-medium">
              New pattern name
            </Label>
            <Input
              id="copyPatternName"
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              className="mt-2"
              placeholder="Enter new roster pattern name"
            />
          </div>
          <DialogFooter className="flex gap-2 justify-end mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCopyDialogOpen(false)}
              disabled={isCopying}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCopyPattern}
              disabled={isCopying}
            >
              {isCopying ? 'Copying…' : 'Copy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={assignmentDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setAssignmentDialog({ open: false, pattern: null });
            setSelectedAssignmentUserIds([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-[96vw] xl:max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogTitle>Assign Roster Pattern</DialogTitle>
          <DialogDescription>
            Choose one or more users for {assignmentDialog.pattern?.shift_id || "this pattern"}.
          </DialogDescription>
          <div className="mt-4 grid flex-1 min-h-0 gap-4 md:grid-cols-[0.9fr_1.55fr]">
            <div className="min-w-0">
              <div className="mb-2 text-sm font-semibold text-gray-700">All Users</div>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {tenantUsers.length === 0 ? (
                  <div className="text-sm text-gray-600">No users available.</div>
                ) : (
                  tenantUsers.map((tenantUser) => {
                    const availability = getAssignmentAvailability(tenantUser.userId);
                    const lockedPatternName = getPatternNameById(availability.lockedPatternId);
                    return (
                      <button
                        key={tenantUser.userId}
                        type="button"
                        className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                          availability.isLocked
                            ? "cursor-not-allowed border-gray-200 bg-gray-100 opacity-60"
                            : availability.isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                        onClick={() => toggleAssignedUser(tenantUser.userId)}
                        disabled={availability.isLocked}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-sm">{tenantUser.fullName}</div>
                            <div className="text-xs text-gray-500">
                              {tenantUser.email}
                              {tenantUser.employeeNumber ? ` · #${tenantUser.employeeNumber}` : ""}
                            </div>
                            {availability.isLocked && (
                              <div className="mt-1 text-[11px] text-gray-500">
                                Already assigned to {lockedPatternName}
                              </div>
                            )}
                          </div>
                          <div className="text-xs font-semibold uppercase text-gray-500">
                            {tenantUser.role}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="min-w-0">
              <div className="mb-2 text-sm font-semibold text-gray-700">Assigned Users</div>
              <div className="max-h-80 overflow-auto rounded-md border border-gray-200 bg-gray-50">
                {tenantUsers.filter((tenantUser) => selectedAssignmentUserIds.includes(tenantUser.userId)).length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">No users assigned yet.</div>
                ) : (
                  <table className="min-w-[760px] w-full text-xs bg-white table-auto">
                    <thead className="sticky top-0 bg-gray-100 text-gray-700">
                      <tr>
                        <th className="px-2 py-2 text-left font-semibold w-10">#</th>
                        <th className="px-2 py-2 text-left font-semibold">Name</th>
                        <th className="px-2 py-2 text-left font-semibold">Email</th>
                        <th className="px-2 py-2 text-left font-semibold w-28">Employee #</th>
                        <th className="px-2 py-2 text-left font-semibold w-24">Account Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenantUsers
                        .filter((tenantUser) => selectedAssignmentUserIds.includes(tenantUser.userId))
                        .map((tenantUser, index) => (
                          <tr key={`assigned-${tenantUser.userId}`} className="border-t border-gray-200">
                            <td className="px-2 py-2 whitespace-nowrap text-gray-600">{index + 1}</td>
                            <td className="px-2 py-2 whitespace-nowrap font-medium text-gray-900">{tenantUser.fullName}</td>
                            <td className="px-2 py-2 whitespace-nowrap text-gray-600">{tenantUser.email}</td>
                            <td className="px-2 py-2 whitespace-nowrap text-gray-600">{tenantUser.employeeNumber || "-"}</td>
                            <td className="px-2 py-2 whitespace-nowrap text-gray-600 capitalize">{tenantUser.role}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6 flex flex-wrap gap-2 justify-end shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAssignmentDialog({ open: false, pattern: null });
                setSelectedAssignmentUserIds([]);
              }}
              disabled={savingAssignments}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={savePatternAssignments}
              disabled={savingAssignments}
            >
              {savingAssignments ? "Saving..." : "Save Assignments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Violation Dialog */}
      <Dialog open={shiftViolationDialog.show} onOpenChange={(open) => !open && setShiftViolationDialog({show: false, message: ""})}>
        <DialogContent>
          <DialogTitle>Shift Time Violation</DialogTitle>
          <DialogDescription className="mt-4">
            <p className="text-sm">{shiftViolationDialog.message}</p>
          </DialogDescription>
          <div className="mt-6 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShiftViolationDialog({show: false, message: ""})}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                setNavigationPending(true);
                setShiftViolationDialog({show: false, message: ""});
              }}
            >
              Go to Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Navigation Confirmation Dialog */}
      {navigationPending && (
        <Dialog open={navigationPending} onOpenChange={(open) => !open && setNavigationPending(false)}>
          <DialogContent>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Do you want to save the roster pattern before navigating to Settings?
            </DialogDescription>
            <DialogFooter className="flex gap-2 justify-end mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNavigationPending(false);
                  window.location.href = '/settings';
                }}
              >
                Go Without Saving
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNavigationPending(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  await handleSavePattern();
                  setNavigationPending(false);
                  window.location.href = '/settings';
                }}
              >
                Save and Go
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
                setAllocationMode('MAJORITY_HOURS');
                setSavedAllocationMode('MAJORITY_HOURS');
                setAllocationParams({});
                setSavedAllocationParams({});
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
                {savedPatterns.map((p) => {
                  const assignedUsers = getAssignedUsersForPattern(p.id);

                  return (
                    <div
                      key={p.id}
                      className="group border border-gray-300 rounded-lg p-4 cursor-pointer hover:border-blue-500 relative"
                      onClick={() => handleOpenPattern(p)}
                    >
                      <div className="flex justify-between items-start gap-2 min-h-[128px]">
                        <div className="pr-4">
                          <div className="font-semibold">{p.shift_id || 'Untitled'}</div>
                          <div className="text-xs text-gray-600">Weeks: {p.weeks_pattern}</div>
                          {p.start_date && (
                            <div className="text-xs text-gray-600">Start: {p.start_date}</div>
                          )}
                          <div className="mt-2 text-xs text-gray-600">
                            Assigned Users: {assignedUsers.length === 0 ? "None" : assignedUsers.length}
                          </div>
                          {assignedUsers.length > 0 && (
                            <div className="mt-1 text-xs text-gray-500">
                              {assignedUsers.slice(0, 3).map((user) => user.fullName).join(", ")}
                              {assignedUsers.length > 3 ? ` +${assignedUsers.length - 3} more` : ""}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end justify-between self-stretch gap-3">
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 opacity-0 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCopyDialog(p);
                              }}
                              aria-label="Copy pattern"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAssignmentDialog(p);
                            }}
                          >
                            Assign
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                Drag the Work Schedule Templates from the list on the right and drop them to a day cell in the pattern. If you would like to add more Work Schedule Templates, please go to <a href="/admin/work-schedule" className="font-semibold underline hover:text-blue-900">this page</a>.
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

                {/* Allocation Mode Section */}
                <div className="mb-6">
                  <Label htmlFor="allocationMode" className="text-base font-semibold mb-2">
                    Night Shift Allocation Mode
                  </Label>
                  <select
                    id="allocationMode"
                    value={allocationMode}
                    onChange={(e) => setAllocationMode(e.target.value as any)}
                    className="w-full h-10 px-3 border-2 border-gray-900 rounded-md"
                    required
                  >
                    <option value="MAJORITY_HOURS">Majority Hours - Allocate to day with most hours</option>
                    <option value="START_DAY">Start Day - Allocate to shift start date</option>
                    <option value="SPLIT_BY_DAY">Split by Day - Allocate one per day crossed</option>
                  </select>
                  <p className="text-xs text-gray-600 mt-2">
                    Controls how cross-midnight shifts are allocated to days for payroll and reporting.
                  </p>
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
                    onBlur={handleWeeksPatternBlur}
                    className="border-2 border-gray-900 w-32"
                    required
                  />
                </div>

                {/* Pattern Table */}
                <div className="border-2 border-gray-900">
                  <table className="w-full table-fixed border-collapse">
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
                        <tr
                          key={row.id}
                          className="border-b border-gray-900 group"
                          onDragOver={(e) => {
                            if (endDateType === 'continuous' && draggedRowId) {
                              e.preventDefault();
                            }
                          }}
                          onDrop={() => handleRowDrop(row.id)}
                        >
                          <td className="border-r-2 border-gray-900 p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span>{row.number}</span>
                              {endDateType === 'continuous' && (
                                <div
                                  className="flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 text-gray-500 cursor-grab"
                                  draggable
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    setDraggedRowId(row.id);
                                  }}
                                  onDragEnd={() => setDraggedRowId(null)}
                                  title="Drag to reorder week"
                                >
                                  <span className="w-1 h-1 bg-gray-400 rounded-full" />
                                  <span className="w-1 h-1 bg-gray-400 rounded-full" />
                                  <span className="w-1 h-1 bg-gray-400 rounded-full" />
                                </div>
                              )}
                            </div>
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
                            
                            // Check if this is the first cell of the pattern (first row, first day in week order)
                            const isFirstRow = row.number === 1;
                            const orderedDaysForCell = getOrderedDays();
                            const isFirstDayInWeekOrder = day === orderedDaysForCell[0];
                            const isFirstCell = isFirstRow && isFirstDayInWeekOrder;
                            
                            // Get previous day's schedules to check for overflow into current day
                            // When week start is e.g. Wednesday, "previous" for Wednesday = Tuesday of previous/last row
                            let previousDayKey: keyof Omit<PatternRow, 'id' | 'number'>;
                            let previousDaySchedules: WorkSchedule[] = [];
                            
                            if (isFirstDayInWeekOrder && patternRows.length > 0) {
                              if (endDateType === 'specify' && isFirstCell) {
                                previousDaySchedules = [];
                              } else if (isFirstCell) {
                                const lastRow = patternRows[patternRows.length - 1];
                                const lastDayInOrder = orderedDaysForCell[orderedDaysForCell.length - 1];
                                previousDayKey = lastDayInOrder.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
                                const lastRowValue = lastRow[previousDayKey];
                                previousDaySchedules = Array.isArray(lastRowValue) ? lastRowValue : [];
                              } else {
                                const prevRowIndex = row.number - 2;
                                if (prevRowIndex >= 0) {
                                  const prevRow = patternRows[prevRowIndex];
                                  const lastDayInOrder = orderedDaysForCell[orderedDaysForCell.length - 1];
                                  previousDayKey = lastDayInOrder.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
                                  const prevRowValue = prevRow[previousDayKey];
                                  previousDaySchedules = Array.isArray(prevRowValue) ? prevRowValue : [];
                                }
                              }
                            } else {
                              const prevDayName = orderedDaysForCell[orderedDaysForCell.indexOf(day) - 1];
                              previousDayKey = prevDayName.toLowerCase() as keyof Omit<PatternRow, 'id' | 'number'>;
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
                                    const cellDate = getCellDateObject(row.number, day);
                                    setSelectedCell({rowId: row.id, day});
                                    setSelectedCellDetails({rowId: row.id, day, date: cellDate, weekNumber: row.number});
                                    if (schedules.length > 0) {
                                      setSelectedShiftDetails({ schedule: schedules[0], daySchedules: schedules });
                                    } else {
                                      setSelectedShiftDetails(null);
                                    }
                                  }
                                }}
                                style={{
                                  cursor: schedules.length > 0 && hoverEdge?.rowId === row.id && hoverEdge?.day === day
                                    ? getEdgeCursor(hoverEdge.edge)
                                    : schedules.length > 0 ? 'pointer' : 'default'
                                }}
                              >
                                {schedules.length === 0 && overflowFromPreviousDay.length === 0 && (
                                  <div className="text-xs text-gray-400 bg-gray-50 rounded px-2 py-1">
                                    <div className="font-medium text-gray-500">Not rostered</div>
                                    {endDateType === 'specify' && cellDate && (
                                      <div className="mt-1 text-[11px] text-gray-400">{cellDate}</div>
                                    )}
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
                                  }).map((schedule, idx) => {
                                    const violations = checkShiftViolations(row, day);
                                    const hasViolation = violations.violatesMin(schedule);
                                    const violationDetails = violations.getViolationDetails(schedule);
                                    
                                    return (
                                      <div 
                                        key={idx} 
                                        className="relative group"
                                      >
                                        <div 
                                          className={`text-xs leading-tight break-words px-1 rounded border cursor-move ${getShiftTileClasses(schedule)}`}
                                          style={getShiftTileStyle(schedule)}
                                          draggable
                                          onDragStart={() => {
                                            handleDragStart(schedule);
                                            setSelectedCell({rowId: row.id, day});
                                          }}
                                        >
                                          <div className={`font-bold ${!getShiftTileStyle(schedule) ? 'text-blue-900' : ''}`}>{schedule.shift_id}</div>
                                          <div className={!getShiftTileStyle(schedule) ? 'text-blue-700' : ''}>
                                            {isLastCell && endDateType === 'specify' && shiftSpansMidnight(schedule) ? 
                                              formatScheduleDisplayTruncated(schedule, true) : 
                                              formatScheduleDisplay(schedule)
                                            }
                                          </div>
                                          {shiftSpansMidnight(schedule) && (
                                            isLastCell && endDateType === 'specify' ? (
                                              <div className="text-xs text-orange-700 italic">↓ Cut-off shift</div>
                                            ) : (
                                              <div className="text-xs text-orange-700 italic">↓ Overflow</div>
                                            )
                                          )}
                                          {/* Enterprise feature buttons */}
                                          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity pt-1 border-t border-gray-300/50">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const cellDate = getCellDateObject(row.number, day);
                                                const shift = workScheduleToShift(schedule, cellDate);
                                                setSelectedShiftForExplanation(shift);
                                                setShowExplanation(true);
                                              }}
                                              className="flex-1 px-1.5 py-0.5 text-xs rounded bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium transition-colors"
                                              title="Why was this shift allocated?"
                                            >
                                              <Eye className="h-3 w-3 inline mr-0.5" />
                                              Why
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedShiftForSimulation(schedule);
                                                setShowSimulation(true);
                                                setSimulationLoading(true);
                                                setSimulationError(null);

                                                try {
                                                  const { shifts, currentAllocations } = buildSimulationData();
                                                  
                                                  // Apply defaults for WEEKLY_BALANCING if needed
                                                  let currentParams = savedAllocationParams || {};
                                                  if (savedAllocationMode === 'WEEKLY_BALANCING' && Object.keys(currentParams).length === 0) {
                                                    currentParams = {
                                                      weekStartDay: 'MON',
                                                      weeklyOrdinaryHoursThresholdMinutes: 38 * 60,
                                                      balancingStrategy: 'FILL_CURRENT_WEEK_FIRST',
                                                      tieBreakerRule: 'PREFER_START_DAY',
                                                      payPeriodDefinitionType: 'INHERIT_PAYROLL_CALENDAR',
                                                    };
                                                  }
                                                  
                                                  let newParams = allocationParams || {};
                                                  if (allocationMode === 'WEEKLY_BALANCING' && Object.keys(newParams).length === 0) {
                                                    newParams = {
                                                      weekStartDay: 'MON',
                                                      weeklyOrdinaryHoursThresholdMinutes: 38 * 60,
                                                      balancingStrategy: 'FILL_CURRENT_WEEK_FIRST',
                                                      tieBreakerRule: 'PREFER_START_DAY',
                                                      payPeriodDefinitionType: 'INHERIT_PAYROLL_CALENDAR',
                                                    };
                                                  }
                                                  
                                                  const currentSettings: RosterPatternSettings = {
                                                    nightShiftAllocationMode: savedAllocationMode,
                                                    nightShiftAllocationParams: currentParams,
                                                  };
                                                  const newSettings: RosterPatternSettings = {
                                                    nightShiftAllocationMode: allocationMode,
                                                    nightShiftAllocationParams: newParams,
                                                  };

                                                  const result = simulateAllocationImpact(
                                                    shifts,
                                                    currentSettings,
                                                    newSettings,
                                                    currentAllocations
                                                  );
                                                  setSimulationResult(result);
                                                } catch (err) {
                                                  setSimulationError(err instanceof Error ? err.message : 'Failed to run simulation');
                                                } finally {
                                                  setSimulationLoading(false);
                                                }
                                              }}
                                              className="flex-1 px-1.5 py-0.5 text-xs rounded bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium transition-colors"
                                              title="Simulate allocation changes"
                                            >
                                              <Zap className="h-3 w-3 inline mr-0.5" />
                                              Test
                                            </button>
                                          </div>
                                        </div>
                                        {hasViolation && (
                                          <div 
                                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-700 transition-colors" 
                                            title={violationDetails ? `${getViolationMessage(violationDetails.actualHours, minHoursBetweenShifts, false)} Click for details.` : "Shift violation"}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (violationDetails) {
                                                setShiftViolationDialog({
                                                  show: true,
                                                  message: getViolationMessage(violationDetails.actualHours, minHoursBetweenShifts, true),
                                                  shiftId: schedule.shift_id
                                                });
                                              }
                                            }}
                                          >
                                            <span className="text-white text-xs font-bold">!</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
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
                        onClick={() => {
                          const targetWeeks = patternRows.length - 1;
                          const nonEmptyWeeks = getNonEmptyWeeksInRange(targetWeeks);
                          if (nonEmptyWeeks.length > 0) {
                            setWeeksReductionDialog({show: true, targetWeeks, nonEmptyWeeks});
                          } else {
                            applyWeeksPattern(targetWeeks);
                          }
                        }}
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
          <div className="mt-6">
            <ShiftDetailsPanel
              selectedCell={selectedCellDetails}
              selectedShift={selectedShiftDetails}
              allocationSettings={allocationSettings}
              isUnsaved={saving}
              endDateType={endDateType}
              formatDateForDisplay={formatDateForDisplay}
              startDate={startDate}
            />
          </div>
          <div className="mt-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Payroll Preview</h3>
                  <p className="text-sm text-gray-600">
                    Compare allocation totals for saved vs current allocation mode.
                  </p>
                </div>
              </div>
              {(() => {
                const currentPreview = buildPayrollPreview(savedAllocationMode, savedAllocationParams);
                const newPreview = buildPayrollPreview(allocationMode, allocationParams);
                const allDates = Array.from(new Set([
                  ...currentPreview.map((item) => item.date),
                  ...newPreview.map((item) => item.date),
                ])).sort();

                if (allDates.length === 0) {
                  return (
                    <div className="text-sm text-gray-600">Add shifts to see a payroll preview.</div>
                  );
                }

                const currentMap = Object.fromEntries(currentPreview.map((item) => [item.date, item.minutes]));
                const newMap = Object.fromEntries(newPreview.map((item) => [item.date, item.minutes]));
                const weekNumberMap = Object.fromEntries(
                  [...currentPreview, ...newPreview]
                    .filter((item) => !!item.weekNumber)
                    .map((item) => [item.date, item.weekNumber || 0])
                );
                const breakdownMap = Object.fromEntries(newPreview.map((item) => [item.date, item.shifts]));

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left p-2 border-b">Date</th>
                          <th className="text-left p-2 border-b">Saved ({getAllocationModeLabel(savedAllocationMode)})</th>
                          {allocationMode !== savedAllocationMode && (
                            <>
                              <th className="text-left p-2 border-b">Current ({getAllocationModeLabel(allocationMode)})</th>
                              <th className="text-left p-2 border-b">Delta</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Group dates by week number
                          const weekMap: Record<number, string[]> = {};
                          allDates.forEach((dateStr) => {
                            const weekNum = weekNumberMap[dateStr] || 0;
                            if (!weekMap[weekNum]) {
                              weekMap[weekNum] = [];
                            }
                            weekMap[weekNum].push(dateStr);
                          });

                          const weeks = Object.keys(weekMap)
                            .map(Number)
                            .sort((a, b) => a - b);

                          // Calculate totals
                          const totalCurrentMinutes = allDates.reduce((sum, d) => sum + (currentMap[d] || 0), 0);
                          const totalNewMinutes = allDates.reduce((sum, d) => sum + (newMap[d] || 0), 0);
                          const totalDelta = totalNewMinutes - totalCurrentMinutes;

                          const weekRows = weeks.map((weekNum) => {
                            const datesInWeek = weekMap[weekNum];
                            const weekCurrentMinutes = datesInWeek.reduce((sum, d) => sum + (currentMap[d] || 0), 0);
                            const weekNewMinutes = datesInWeek.reduce((sum, d) => sum + (newMap[d] || 0), 0);
                            const weekDelta = weekNewMinutes - weekCurrentMinutes;
                            const isExpanded = expandedPayrollRows.has(`week-${weekNum}`);

                            return (
                              <Fragment key={`week-${weekNum}`}>
                                <tr className="border-t cursor-pointer hover:bg-gray-100 bg-gray-50 font-semibold">
                                  <td 
                                    className="p-2" 
                                    onClick={() => {
                                      const newSet = new Set(expandedPayrollRows);
                                      if (isExpanded) {
                                        newSet.delete(`week-${weekNum}`);
                                      } else {
                                        newSet.add(`week-${weekNum}`);
                                      }
                                      setExpandedPayrollRows(newSet);
                                    }}
                                  >
                                    <span className="inline-block mr-2">{isExpanded ? '▼' : '▶'}</span>
                                    Week {weekNum}
                                  </td>
                                  <td className="p-2">{formatMinutes(weekCurrentMinutes)}</td>
                                  {allocationMode !== savedAllocationMode && (
                                    <>
                                      <td className="p-2">{formatMinutes(weekNewMinutes)}</td>
                                      <td className="p-2">
                                        {weekDelta === 0 ? 'No change' : `${weekDelta > 0 ? '+' : '-'}${formatMinutes(Math.abs(weekDelta))}`}
                                      </td>
                                    </>
                                  )}
                                </tr>

                                {isExpanded && (() => {
                                  // Sort dates in this week by roster day order
                                  const orderedDays = getOrderedDays();
                                  const sortedDatesInWeek = datesInWeek.sort((dateA, dateB) => {
                                    const dateObjA = new Date(`${dateA}T00:00:00`);
                                    const dateObjB = new Date(`${dateB}T00:00:00`);
                                    const dayNameA = dateObjA.toLocaleDateString('en-US', { weekday: 'long' });
                                    const dayNameB = dateObjB.toLocaleDateString('en-US', { weekday: 'long' });
                                    return orderedDays.indexOf(dayNameA) - orderedDays.indexOf(dayNameB);
                                  });
                                  return sortedDatesInWeek;
                                })().map((dateStr) => {
                                  const dateObj = new Date(`${dateStr}T00:00:00`);
                                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                                  const formattedDate = endDateType === 'continuous'
                                    ? dayName
                                    : formatDateForDisplay(dateObj, true);
                                  const currentMinutes = currentMap[dateStr] || 0;
                                  const newMinutes = newMap[dateStr] || 0;
                                  const delta = newMinutes - currentMinutes;
                                  const shiftsForDate = breakdownMap[dateStr] || [];

                                  return (
                                    <Fragment key={dateStr}>
                                      <tr className="border-t border-gray-200">
                                        <td className="p-2 pl-6 text-sm">{formattedDate}</td>
                                        <td className="p-2 text-sm">{formatMinutes(currentMinutes)}</td>
                                        {allocationMode !== savedAllocationMode && (
                                          <>
                                            <td className="p-2 text-sm">{formatMinutes(newMinutes)}</td>
                                            <td className="p-2 text-sm">
                                              {delta === 0 ? 'No change' : `${delta > 0 ? '+' : '-'}${formatMinutes(Math.abs(delta))}`}
                                            </td>
                                          </>
                                        )}
                                      </tr>

                                      {shiftsForDate.length > 0 && (
                                        <tr className="bg-blue-50 border-t border-gray-100">
                                          <td colSpan={allocationMode !== savedAllocationMode ? 4 : 2} className="p-3 pl-8">
                                            <div className="text-xs text-gray-700">
                                              <p className="font-medium mb-1">Shifts:</p>
                                              <ul className="space-y-0.5 list-disc list-inside">
                                                {shiftsForDate.map((shift, idx) => (
                                                  <li key={idx} className="text-gray-600">
                                                    {shift.shiftId} — {formatMinutes(shift.minutes)}
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </Fragment>
                                  );
                                })}
                              </Fragment>
                            );
                          });

                          return [
                            ...weekRows,
                            <tr key="totals" className="border-t border-b-2 border-b-gray-400 bg-gray-100 font-semibold">
                              <td className="p-2">
                                <span className="font-bold">Total</span>
                              </td>
                              <td className="p-2">{formatMinutes(totalCurrentMinutes)}</td>
                              {allocationMode !== savedAllocationMode && (
                                <>
                                  <td className="p-2">{formatMinutes(totalNewMinutes)}</td>
                                  <td className="p-2">
                                    {totalDelta === 0 ? 'No change' : `${totalDelta > 0 ? '+' : '-'}${formatMinutes(Math.abs(totalDelta))}`}
                                  </td>
                                </>
                              )}
                            </tr>,
                          ];
                        })()}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </Card>
          </div>
          </div>

          {/* Saved Work Schedule Templates List - Right */}
          <div className="w-96 border-l pl-6">
        <div className="sticky top-0">
          <h3 className="text-lg font-semibold mb-4">Saved Work Schedule Templates</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by shift period
            </label>
            <select
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              value={scheduleFilter}
              onChange={(e) => setScheduleFilter(e.target.value)}
            >
              <option value="all">All shifts</option>
              {getActiveDayPeriods().map((period) => (
                <option key={period.id} value={period.id}>
                  {period.label} ({minutesToTime(period.startMinutes)}-{minutesToTime(period.endMinutes)})
                </option>
              ))}
            </select>
          </div>
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
              <p className="text-sm text-gray-500">No work schedule templates saved yet.</p>
            ) : filteredSchedules.length === 0 ? (
              <p className="text-sm text-gray-500">No templates match this filter.</p>
            ) : (
              filteredSchedules.map((schedule) => {
                const isSplit = isSplitShift(schedule);
                const timeframes = schedule.work_schedule_timeframes?.sort(
                  (a, b) => a.frame_order - b.frame_order
                ) || [];
                
                const calculateTotalHours = () => {
                  let totalMinutes = 0;
                  timeframes.forEach((tf) => {
                    const [startHour, startMin] = tf.start_time.split(':').map(Number);
                    const [endHour, endMin] = tf.end_time.split(':').map(Number);
                    const startMinutes = startHour * 60 + startMin;
                    let endMinutes = endHour * 60 + endMin;
                    
                    // Handle overnight shifts: if end is before start, add 24 hours
                    if (endMinutes < startMinutes) {
                      endMinutes += 24 * 60;
                    }
                    
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
                    className={`p-4 cursor-move transition-colors border ${getShiftTileClasses(schedule)}`}
                    style={getShiftTileStyle(schedule)}
                  >
                    <div className={`font-bold text-base mb-2 ${isSplit ? "text-white" : (getShiftTileStyle(schedule) ? "" : "text-gray-900")}`}>
                      {schedule.shift_id}
                    </div>
                    <div className={`text-sm mb-2 ${isSplit ? "text-white/80" : (getShiftTileStyle(schedule) ? "" : "text-gray-600")}`}>
                      Type: {schedule.shift_type}
                    </div>
                    
                    {timeframes.map((tf, idx) => (
                      <div key={idx} className={`text-sm mb-2 ${isSplit ? "text-white/90" : (getShiftTileStyle(schedule) ? "" : "text-gray-700")}`}>
                        <div className={`font-medium ${isSplit ? "text-white" : (getShiftTileStyle(schedule) ? "" : "text-gray-900")}`}>
                          Time Frame {idx + 1}: {tf.start_time.slice(0, 5)} - {tf.end_time.slice(0, 5)}
                        </div>
                        {tf.meal_start && tf.meal_end && (
                          <div className={`text-xs ml-2 ${isSplit ? "text-white/70" : (getShiftTileStyle(schedule) ? "" : "text-gray-600")}`}>
                            Meal ({tf.meal_type || 'paid'}): {tf.meal_start.slice(0, 5)} - {tf.meal_end.slice(0, 5)}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <div className={`font-semibold text-sm mt-2 pt-2 border-t ${isSplit ? "border-white/30 text-white" : (getShiftTileStyle(schedule) ? "" : "border-gray-200 text-gray-800")}`}>
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

      {/* Enterprise Allocation Features */}
      {selectedShiftForExplanation && (
        <AllocationExplanationDrawer
          shift={selectedShiftForExplanation}
          allocationSettings={allocationSettings}
          isOpen={showExplanation}
          onClose={() => {
            setShowExplanation(false);
            setSelectedShiftForExplanation(null);
          }}
        />
      )}

      {selectedShiftForSimulation && (
        <AllocationSimulationModal
          isOpen={showSimulation}
          simulation={simulationResult || undefined}
          isLoading={simulationLoading}
          error={simulationError || undefined}
          newModeName={getAllocationModeLabel(allocationMode)}
          onClose={() => {
            setShowSimulation(false);
            setSelectedShiftForSimulation(null);
            setSimulationResult(null);
            setSimulationError(null);
          }}
        />
      )}
    </>
  );
}
