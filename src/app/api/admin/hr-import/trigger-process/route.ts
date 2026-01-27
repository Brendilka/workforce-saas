import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserRole } from '@/lib/supabase/server';

/**
 * Manual trigger for stuck import jobs
 * POST /api/admin/hr-import/trigger-process
 * Body: { jobId: string, departments: [...] }
 *
 * This is a workaround endpoint to manually trigger processing
 * for jobs that got stuck at "pending" status.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    const role = await getUserRole();

    if (!user || role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, departments } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }

    console.log(`[Manual Trigger] Triggering processing for job ${jobId}`);

    // Get the base URL (works in both local and production)
    const host = request.headers.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Call the process endpoint directly
    const processUrl = `${baseUrl}/api/admin/hr-import/process`;

    console.log(`[Manual Trigger] Calling process endpoint: ${processUrl}`);

    const response = await fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward cookies for authentication
        Cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify({ jobId, departments }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`[Manual Trigger] Process endpoint failed:`, result);
      return NextResponse.json(
        {
          error: 'Failed to trigger processing',
          details: result,
          processUrl,
        },
        { status: 500 }
      );
    }

    console.log(`[Manual Trigger] Successfully triggered processing for job ${jobId}`);

    return NextResponse.json({
      message: 'Processing triggered successfully',
      jobId,
      result,
      processUrl,
    });
  } catch (error) {
    console.error('[Manual Trigger] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
