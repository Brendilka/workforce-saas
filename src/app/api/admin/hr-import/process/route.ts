import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processHRImport } from '@/lib/hr-import/processor';
import type { ImportJob, HRImportConfig } from '@/lib/types/database';

// Configure API route for long-running operations
export const maxDuration = 300; // 5 minutes maximum
export const dynamic = 'force-dynamic';

interface ProcessImportRequest {
  jobId: string;
  departments: Array<{ id: string; name: string }>;
}

/**
 * POST /api/admin/hr-import/process
 *
 * Background processor for HR imports.
 * This endpoint processes the import job and updates progress in real-time.
 * Can run for up to 5 minutes (maxDuration=300).
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let jobId = '';

  try {
    const body = (await request.json()) as ProcessImportRequest;
    jobId = body.jobId;
    const { departments } = body;

    const supabase = createAdminClient();

    // Fetch the job
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .single<ImportJob>();

    if (jobError || !job) {
      console.error(`[HR Import ${jobId}] Job not found:`, jobError);
      return NextResponse.json(
        { error: 'Import job not found' },
        { status: 404 }
      );
    }

    // Check if job is already being processed or completed
    if (job.status !== 'pending') {
      console.log(
        `[HR Import ${jobId}] Job already in status: ${job.status}. Skipping.`
      );
      return NextResponse.json({
        message: `Job is already ${job.status}`,
        jobId,
      });
    }

    console.log(
      `[HR Import ${jobId}] Starting processing of ${job.total_rows} rows`
    );

    // Update status to processing
    await supabase
      .from('import_jobs')
      // @ts-ignore - TypeScript has trouble inferring update types
      .update({ status: 'processing' })
      .eq('id', jobId);

    // Progress callback - updates job record every 50 rows
    const onProgress = async (
      processed: number,
      success: number,
      failed: number,
      authCreated: number
    ) => {
      await supabase
        .from('import_jobs')
        // @ts-ignore - TypeScript has trouble inferring update types
        .update({
          processed_rows: processed,
          success_count: success,
          failed_count: failed,
          auth_created_count: authCreated,
        })
        .eq('id', jobId);
    };

    // Process the import with optimizations
    const result = await processHRImport(
      job.data,
      job.config as HRImportConfig,
      departments,
      job.tenant_id,
      jobId,
      onProgress
    );

    const duration = Date.now() - startTime;

    // Update job with final results
    await supabase
      .from('import_jobs')
      // @ts-ignore - TypeScript has trouble inferring update types
      .update({
        status: 'completed',
        processed_rows: job.total_rows,
        success_count: result.successCount,
        failed_count: result.failedCount,
        auth_created_count: result.authCreatedCount,
        errors: result.errors,
        result: {
          success: result.successCount,
          failed: result.failedCount,
          duration,
        },
        data: [], // Clear temporary CSV data to save space
      })
      .eq('id', jobId);

    console.log(
      `[HR Import ${jobId}] Completed successfully in ${duration}ms (${(duration / 1000).toFixed(1)}s)`
    );

    return NextResponse.json({
      jobId,
      status: 'completed',
      result: {
        success: result.successCount,
        failed: result.failedCount,
        authCreated: result.authCreatedCount,
        duration,
      },
    });
  } catch (error) {
    console.error(`[HR Import ${jobId}] Unexpected error:`, error);

    // Mark job as failed
    if (jobId) {
      try {
        const supabase = createAdminClient();
        await supabase
          .from('import_jobs')
          // @ts-ignore - TypeScript has trouble inferring update types
          .update({
            status: 'failed',
            errors: [
              {
                row: 0,
                message:
                  error instanceof Error
                    ? error.message
                    : 'Unexpected error during processing',
              },
            ],
          })
          .eq('id', jobId);
      } catch (updateError) {
        console.error(
          `[HR Import ${jobId}] Failed to update job status:`,
          updateError
        );
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        jobId,
      },
      { status: 500 }
    );
  }
}
