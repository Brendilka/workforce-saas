import { NextRequest, NextResponse } from 'next/server';
import { createClient, getUser, getUserRole } from '@/lib/supabase/server';
import type { ImportJob } from '@/lib/types/database';

/**
 * GET /api/admin/hr-import/status/[id]
 *
 * Returns the current status of an import job.
 * Used as fallback for polling if Realtime connection fails.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    const role = await getUserRole();

    if (!user || role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Next.js 15+ requires awaiting params
    const { id: jobId } = await params;
    const supabase = await createClient();

    // Fetch job status (RLS will automatically filter by tenant)
    const { data: job, error } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .single<ImportJob>();

    if (error || !job) {
      return NextResponse.json(
        { error: 'Import job not found' },
        { status: 404 }
      );
    }

    // Return the job object as-is to match ImportJob type (snake_case)
    return NextResponse.json(job);
  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
