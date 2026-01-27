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

    // Determine the base URL for background processing
    // In production, use NEXT_PUBLIC_APP_URL or construct from request headers
    let processUrl: string;
    let urlSource: string;

    if (process.env.NEXT_PUBLIC_APP_URL) {
      processUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/hr-import/process`;
      urlSource = 'NEXT_PUBLIC_APP_URL env var';
    } else {
      // Fallback: construct from request headers (works in Vercel)
      const host = request.headers.get('host');
      const protocol = host?.includes('localhost') ? 'http' : 'https';
      processUrl = `${protocol}://${host}/api/admin/hr-import/process`;
      urlSource = 'request headers fallback';

      // Log warning about missing env var
      console.warn(
        `[HR Import] WARNING: NEXT_PUBLIC_APP_URL not set. Using fallback URL construction. ` +
        `This may be unreliable in serverless environments. ` +
        `Please set NEXT_PUBLIC_APP_URL in your deployment environment.`
      );
    }

    console.log(`[HR Import] Job ${job.id}: Triggering background processing`);
    console.log(`[HR Import] Job ${job.id}: Process URL: ${processUrl} (source: ${urlSource})`);

    // Trigger background processing (fire-and-forget)
    // Don't await this - return immediately to client
    const fetchStartTime = Date.now();
    fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'workforce-saas-import-trigger',
      },
      body: JSON.stringify({
        jobId: job.id,
        departments,
      }),
    })
      .then((response) => {
        const fetchDuration = Date.now() - fetchStartTime;
        if (response.ok) {
          console.log(
            `[HR Import] Job ${job.id}: Background processing triggered successfully ` +
            `(${fetchDuration}ms, status: ${response.status})`
          );
        } else {
          console.error(
            `[HR Import] Job ${job.id}: Background processing trigger returned error ` +
            `(${fetchDuration}ms, status: ${response.status})`
          );
        }
      })
      .catch((error) => {
        const fetchDuration = Date.now() - fetchStartTime;
        console.error(`[HR Import] Job ${job.id}: Failed to trigger processing (${fetchDuration}ms)`);
        console.error(`[HR Import] Job ${job.id}: Process URL was: ${processUrl} (source: ${urlSource})`);
        console.error(`[HR Import] Job ${job.id}: Error details:`, error);
        console.error(
          `[HR Import] Job ${job.id}: TROUBLESHOOTING: ` +
          `1. Ensure NEXT_PUBLIC_APP_URL is set in your environment variables. ` +
          `2. Use the manual trigger endpoint: POST /api/admin/hr-import/trigger-process ` +
          `3. See docs/TROUBLESHOOTING.md for more details.`
        );
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
