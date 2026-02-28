/**
 * API Route: Explain Allocation Decision
 *
 * GET /api/admin/allocations/explain?shiftId=...
 *
 * Returns human-readable explanation for why a shift was allocated to specific date.
 * TODO: This is a stub integration point. Needs mapping to actual decision engine.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserRole } from '@/lib/supabase/server';

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

    // TODO: Integrate with explainAllocation function
    // This endpoint will explain why a specific shift was allocated to a given date
    // based on the allocation mode and settings configured for the roster pattern.

    return NextResponse.json({
      error: 'Not yet implemented - integration pending',
      message: 'This endpoint requires mapping shift data to the allocation explainability engine',
      status: 'stub',
    }, { status: 501 });
  } catch (error) {
    console.error('[API] Error explaining allocation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
