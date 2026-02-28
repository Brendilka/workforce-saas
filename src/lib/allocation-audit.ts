/**
 * Audit Mode for Night Shift Allocation
 *
 * Provides complete traceability of allocation decisions with audit logging.
 * Async-first, resilient to failures, supports compliance and debugging.
 */

import { ExplanationResult } from './allocation-explainability';
import { Shift, NightShiftAllocationSettings } from '@/lib/types/allocation';

/**
 * Represents a recorded allocation decision in the audit trail.
 */
export interface ShiftAllocationAuditRecord {
  id: string;
  shiftId: string;
  rosterPatternId: string;
  allocationMode: string;
  allocationDate: string | null; // ISO date or null for unallocated
  allocationDates: string[] | null; // For SPLIT_BY_DAY mode
  allocationParamsSnapshot: Record<string, any>;
  ruleVersion: string;
  explanationSnapshot: ExplanationResult;
  shiftStartTime: string; // HH:mm
  shiftEndTime: string; // HH:mm
  shiftDate: string; // YYYY-MM-DD
  shiftDurationMinutes: number;
  computedAt: string; // ISO timestamp
  computedBy: string; // User ID or 'system'
  contextMetadata: Record<string, any> | null;
  createdAt: string; // ISO timestamp
}

/**
 * Audit event types that trigger logging.
 */
export enum AuditEventType {
  ALLOCATION_COMPUTED = 'ALLOCATION_COMPUTED',
  ROSTER_PATTERN_SAVED = 'ROSTER_PATTERN_SAVED',
  ALLOCATION_SETTINGS_CHANGED = 'ALLOCATION_SETTINGS_CHANGED',
  PAYROLL_EXPORT = 'PAYROLL_EXPORT',
  MANUAL_RECOMPUTE = 'MANUAL_RECOMPUTE',
}

/**
 * Request to create an audit record.
 */
export interface AuditRecordRequest {
  tenantId: string;
  shiftId: string;
  rosterPatternId: string;
  shift: Shift;
  settings: NightShiftAllocationSettings;
  explanation: ExplanationResult;
  computedBy?: string; // Defaults to 'system'
  eventType?: AuditEventType;
  contextMetadata?: Record<string, any>;
}

/**
 * Service for creating and querying allocation audit records.
 *
 * Methods are designed to be called from async contexts (API routes, server actions).
 * Failures are logged but don't break the allocation workflow (resilient).
 */
export class AllocationAuditService {
  /**
   * Records an allocation decision in the audit trail.
   *
   * @param request - Audit record request with all necessary data
   * @param supabaseClient - Authenticated Supabase client with tenant context
   * @returns Audit record ID if successful, or null if failed
   *
   * @example
   * const auditId = await auditService.recordAllocation(
   *   {
   *     tenantId: 'd5cb6bd8-...',
   *     shiftId: 'shift-123',
   *     rosterPatternId: 'pattern-456',
   *     shift: { startDateTime: new Date(...), endDateTime: new Date(...) },
   *     settings: { mode: 'MAJORITY_HOURS' },
   *     explanation: { allocationDate: '2025-02-15', reasoningSteps: [...] },
   *     computedBy: 'user-789',
   *     eventType: AuditEventType.ROSTER_PATTERN_SAVED
   *   },
   *   supabaseClient
   * );
   */
  static async recordAllocation(request: AuditRecordRequest, supabaseClient: any): Promise<string | null> {
    try {
      const {
        tenantId,
        shiftId,
        rosterPatternId,
        shift,
        settings,
        explanation,
        computedBy = 'system',
        eventType = AuditEventType.ALLOCATION_COMPUTED,
        contextMetadata = null,
      } = request;

      // Prepare shift data
      const startDate = shift.startDateTime instanceof Date ? shift.startDateTime : new Date(shift.startDateTime);
      const endDate = shift.endDateTime instanceof Date ? shift.endDateTime : new Date(shift.endDateTime);

      const shiftDate = startDate.toISOString().split('T')[0];
      const shiftStartTime = this.formatTime(startDate);
      const shiftEndTime = this.formatTime(endDate);
      const shiftDurationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

      // Prepare allocation data
      let allocationDate: string | null = null;
      let allocationDates: string[] | null = null;

      if (typeof explanation.allocationDate === 'string') {
        allocationDate = explanation.allocationDate;
      } else if (Array.isArray(explanation.allocationDate)) {
        allocationDates = explanation.allocationDate;
      }

      // Insert audit record
      const { data, error } = await supabaseClient.from('shift_allocation_audit').insert({
        tenant_id: tenantId,
        shift_id: shiftId,
        roster_pattern_id: rosterPatternId,
        allocation_mode: settings.mode,
        allocation_date: allocationDate,
        allocation_dates: allocationDates,
        allocation_params_snapshot: settings.params || {},
        rule_version: explanation.ruleVersion || 'v1',
        explanation_snapshot: explanation, // Store full explanation for traceability
        shift_start_time: shiftStartTime,
        shift_end_time: shiftEndTime,
        shift_date: shiftDate,
        shift_duration_minutes: shiftDurationMinutes,
        computed_by: computedBy,
        context_metadata: contextMetadata
          ? { eventType, ...contextMetadata }
          : { eventType },
      });

      if (error) {
        console.error('[AllocationAudit] Failed to record allocation:', {
          shiftId,
          rosterPatternId,
          error: error.message,
        });
        return null; // Fail silently - don't break the workflow
      }

      const recordId = data?.[0]?.id;
      console.info('[AllocationAudit] Successfully recorded allocation:', {
        shiftId,
        rosterPatternId,
        recordId,
        allocationDate,
        mode: settings.mode,
      });

      return recordId || null;
    } catch (error) {
      console.error('[AllocationAudit] Unexpected error recording allocation:', error);
      return null; // Fail silently
    }
  }

  /**
   * Retrieves all allocation audit records for a specific shift.
   *
   * @param shiftId - The shift ID to query
   * @param supabaseClient - Authenticated Supabase client
   * @returns Array of audit records, most recent first
   */
  static async getShiftAuditHistory(shiftId: string, supabaseClient: any): Promise<ShiftAllocationAuditRecord[]> {
    try {
      const { data, error } = await supabaseClient
        .from('shift_allocation_audit')
        .select('*')
        .eq('shift_id', shiftId)
        .order('computed_at', { ascending: false });

      if (error) {
        console.error('[AllocationAudit] Failed to retrieve audit history:', error);
        return [];
      }

      return (data || []).map((record: any) => ({
        id: record.id,
        shiftId: record.shift_id,
        rosterPatternId: record.roster_pattern_id,
        allocationMode: record.allocation_mode,
        allocationDate: record.allocation_date,
        allocationDates: record.allocation_dates,
        allocationParamsSnapshot: record.allocation_params_snapshot,
        ruleVersion: record.rule_version,
        explanationSnapshot: record.explanation_snapshot,
        shiftStartTime: record.shift_start_time,
        shiftEndTime: record.shift_end_time,
        shiftDate: record.shift_date,
        shiftDurationMinutes: record.shift_duration_minutes,
        computedAt: record.computed_at,
        computedBy: record.computed_by,
        contextMetadata: record.context_metadata,
        createdAt: record.created_at,
      }));
    } catch (error) {
      console.error('[AllocationAudit] Unexpected error retrieving audit history:', error);
      return [];
    }
  }

  /**
   * Retrieves audit records for a roster pattern.
   *
   * @param rosterPatternId - The roster pattern ID to query
   * @param supabaseClient - Authenticated Supabase client
   * @returns Array of audit records
   */
  static async getRosterPatternAuditHistory(
    rosterPatternId: string,
    supabaseClient: any
  ): Promise<ShiftAllocationAuditRecord[]> {
    try {
      const { data, error } = await supabaseClient
        .from('shift_allocation_audit')
        .select('*')
        .eq('roster_pattern_id', rosterPatternId)
        .order('computed_at', { ascending: false });

      if (error) {
        console.error('[AllocationAudit] Failed to retrieve roster pattern audit:', error);
        return [];
      }

      return (data || []).map((record: any) => ({
        id: record.id,
        shiftId: record.shift_id,
        rosterPatternId: record.roster_pattern_id,
        allocationMode: record.allocation_mode,
        allocationDate: record.allocation_date,
        allocationDates: record.allocation_dates,
        allocationParamsSnapshot: record.allocation_params_snapshot,
        ruleVersion: record.rule_version,
        explanationSnapshot: record.explanation_snapshot,
        shiftStartTime: record.shift_start_time,
        shiftEndTime: record.shift_end_time,
        shiftDate: record.shift_date,
        shiftDurationMinutes: record.shift_duration_minutes,
        computedAt: record.computed_at,
        computedBy: record.computed_by,
        contextMetadata: record.context_metadata,
        createdAt: record.created_at,
      }));
    } catch (error) {
      console.error('[AllocationAudit] Unexpected error retrieving roster pattern audit:', error);
      return [];
    }
  }

  /**
   * Retrieves audit records within a date range.
   *
   * @param startDate - Start date (inclusive)
   * @param endDate - End date (inclusive)
   * @param supabaseClient - Authenticated Supabase client
   * @returns Array of audit records
   */
  static async getAuditHistoryByDateRange(
    startDate: string,
    endDate: string,
    supabaseClient: any
  ): Promise<ShiftAllocationAuditRecord[]> {
    try {
      const { data, error } = await supabaseClient
        .from('shift_allocation_audit')
        .select('*')
        .gte('shift_date', startDate)
        .lte('shift_date', endDate)
        .order('computed_at', { ascending: false });

      if (error) {
        console.error('[AllocationAudit] Failed to retrieve audit history by date range:', error);
        return [];
      }

      return (data || []).map((record: any) => ({
        id: record.id,
        shiftId: record.shift_id,
        rosterPatternId: record.roster_pattern_id,
        allocationMode: record.allocation_mode,
        allocationDate: record.allocation_date,
        allocationDates: record.allocation_dates,
        allocationParamsSnapshot: record.allocation_params_snapshot,
        ruleVersion: record.rule_version,
        explanationSnapshot: record.explanation_snapshot,
        shiftStartTime: record.shift_start_time,
        shiftEndTime: record.shift_end_time,
        shiftDate: record.shift_date,
        shiftDurationMinutes: record.shift_duration_minutes,
        computedAt: record.computed_at,
        computedBy: record.computed_by,
        contextMetadata: record.context_metadata,
        createdAt: record.created_at,
      }));
    } catch (error) {
      console.error('[AllocationAudit] Unexpected error retrieving audit history by date range:', error);
      return [];
    }
  }

  /**
   * Generates a summary of allocation decisions for a date range.
   *
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @param supabaseClient - Authenticated Supabase client
   * @returns Summary object with counts and statistics
   */
  static async getAuditSummary(
    startDate: string,
    endDate: string,
    supabaseClient: any
  ): Promise<{
    totalRecords: number;
    modeDistribution: Record<string, number>;
    computedByDistribution: Record<string, number>;
    ruleVersions: string[];
    dateRange: { startDate: string; endDate: string };
  }> {
    try {
      const records = await this.getAuditHistoryByDateRange(startDate, endDate, supabaseClient);

      const modeDistribution: Record<string, number> = {};
      const computedByDistribution: Record<string, number> = {};
      const ruleVersions = new Set<string>();

      records.forEach((record) => {
        // Count by mode
        modeDistribution[record.allocationMode] = (modeDistribution[record.allocationMode] || 0) + 1;

        // Count by computed_by
        computedByDistribution[record.computedBy] = (computedByDistribution[record.computedBy] || 0) + 1;

        // Collect rule versions
        ruleVersions.add(record.ruleVersion);
      });

      return {
        totalRecords: records.length,
        modeDistribution,
        computedByDistribution,
        ruleVersions: Array.from(ruleVersions),
        dateRange: { startDate, endDate },
      };
    } catch (error) {
      console.error('[AllocationAudit] Unexpected error generating audit summary:', error);
      return {
        totalRecords: 0,
        modeDistribution: {},
        computedByDistribution: {},
        ruleVersions: [],
        dateRange: { startDate, endDate },
      };
    }
  }

  /**
   * Utility: Format Date to HH:mm string.
   */
  private static formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}
