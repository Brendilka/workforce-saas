import { NextRequest, NextResponse } from 'next/server';
import { createClient, getUser, getUserRole } from '@/lib/supabase/server';
import type { HRImportConfig, ImportJob } from '@/lib/types/database';

interface ParsedRow {
  [key: string]: string;
}

interface StartImportRequest {
  tenantId: string;
  data: ParsedRow[];
  config: HRImportConfig;
  departments: Array<{ id: string; name: string }>;
}

/**
 * POST /api/admin/hr-import/start
 *
 * Creates a new import job and returns immediately with job_id.
 * The actual processing happens in the background via /process endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    const role = await getUserRole();

    if (!user || role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as StartImportRequest;
    const { data, config, departments } = body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'No data provided for import' },
        { status: 400 }
      );
    }

    const tenantId = user.user_metadata.tenant_id;
    const supabase = await createClient();

    // Create import job record
    const { data: job, error: jobError } = (await supabase
      .from('import_jobs')
      // @ts-ignore - TypeScript has trouble inferring insert types
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        status: 'pending',
        total_rows: data.length,
        config,
        data, // Store CSV data temporarily
      })
      .select()
      .single()) as { data: ImportJob | null; error: any };

    if (jobError || !job) {
      console.error('Error creating import job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create import job' },
        { status: 500 }
      );
    }

    console.log(`[HR Import] Created job ${job.id} for ${data.length} rows`);

    // Trigger background processing (fire-and-forget)
    // Don't await this - return immediately to client
    fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/hr-import/process`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          departments,
        }),
      }
    ).catch((error) => {
      console.error(`[HR Import] Failed to trigger processing for job ${job.id}:`, error);
    });

    // Return immediately with job ID
    return NextResponse.json({
      jobId: job.id,
      message: `Import job created for ${data.length} rows`,
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/admin/hr-import/start:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
