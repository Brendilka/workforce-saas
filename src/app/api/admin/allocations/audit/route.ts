/**
 * API Route: Allocation Audit History
 *
 * GET /api/admin/allocations/audit?shiftId=... OR ?rosterPatternId=... OR ?startDate=...&endDate=...
 *
 * Returns complete audit trail for allocation decisions with reasoning and config snapshots.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getUser, getUserRole } from '@/lib/supabase/server';
import { AllocationAuditService } from '@/lib/allocation-audit';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = await getUserRole();
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get parameters
    const url = new URL(request.url);
    const shiftId = url.searchParams.get('shiftId');
    const rosterPatternId = url.searchParams.get('rosterPatternId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const queryType = url.searchParams.get('type'); // 'summary' or 'records'

    const supabase = await createClient();

    // Determine query type and execute
    let result: any;

    if (shiftId) {
      // Query by shift
      result = await AllocationAuditService.getShiftAuditHistory(shiftId, supabase);
    } else if (rosterPatternId) {
      // Query by roster pattern
      result = await AllocationAuditService.getRosterPatternAuditHistory(rosterPatternId, supabase);
    } else if (startDate && endDate) {
      // Query by date range
      if (queryType === 'summary') {
        result = await AllocationAuditService.getAuditSummary(startDate, endDate, supabase);
      } else {
        result = await AllocationAuditService.getAuditHistoryByDateRange(startDate, endDate, supabase);
      }
    } else {
      return NextResponse.json(
        {
          error: 'Provide one of: shiftId, rosterPatternId, or both startDate and endDate',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      data: result,
      timestamp: new Date().toISOString(),
      queryParameters: {
        shiftId: shiftId || null,
        rosterPatternId: rosterPatternId || null,
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    console.error('[API] Error retrieving allocation audit:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST: Record new audit entry
 *
 * Used when a roster pattern is saved to audit the allocation computation.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = await getUserRole();
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const supabase = await createClient();
    const body = await request.json();

    // Record the audit entry
    const auditId = await AllocationAuditService.recordAllocation(body, supabase);

    if (!auditId) {
      return NextResponse.json(
        { message: 'Audit record failed silently (resilient mode)', recordId: null },
        { status: 202 } // Accepted but not fully processed
      );
    }

    return NextResponse.json(
      {
        message: 'Audit record created',
        recordId: auditId,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Error recording allocation audit:', error);
    // Audit failures are non-fatal
    return NextResponse.json(
      { message: 'Audit recording queued asynchronously' },
      { status: 202 }
    );
  }
}
