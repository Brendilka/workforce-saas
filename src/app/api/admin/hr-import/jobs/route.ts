import { NextRequest, NextResponse } from 'next/server';
import { createClient, getUser, getUserRole } from '@/lib/supabase/server';
import type { ImportJob } from '@/lib/types/database';

/**
 * GET /api/admin/hr-import/jobs
 *
 * Returns a list of recent import jobs for the current tenant.
 * Supports pagination via query parameters.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    const role = await getUserRole();

    if (!user || role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = await createClient();

    // Fetch recent jobs (RLS will automatically filter by tenant)
    const { data: jobs, error, count } = await supabase
      .from('import_jobs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching import jobs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch import jobs' },
        { status: 500 }
      );
    }

    // Return simplified job info (exclude large data field)
    const jobList = (jobs || []).map((job) => ({
      id: job.id,
      status: job.status,
      totalRows: job.total_rows,
      processedRows: job.processed_rows,
      successCount: job.success_count,
      failedCount: job.failed_count,
      authCreatedCount: job.auth_created_count,
      errorCount: Array.isArray(job.errors) ? job.errors.length : 0,
      result: job.result,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at,
    }));

    return NextResponse.json({
      jobs: jobList,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/hr-import/jobs:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
