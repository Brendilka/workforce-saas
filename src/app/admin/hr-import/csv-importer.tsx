"use client";

import { useState, useCallback, useEffect, useMemo, startTransition } from "react";
import Papa from "papaparse";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import type { HRImportConfig, ImportJob } from "@/lib/types/database";

interface CSVImporterProps {
  config: HRImportConfig;
  departments: Array<{ id: string; name: string }>;
  tenantId: string;
}

interface ParsedRow {
  [key: string]: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export function CSVImporter({ config, departments, tenantId }: CSVImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Create supabase client once with useMemo to prevent re-creation
  const supabase = useMemo(() => createClient(), []);

  // Subscribe to Realtime updates for current job with fallback polling
  useEffect(() => {
    if (!currentJob?.id) return;
    if (currentJob.status === 'completed' || currentJob.status === 'failed') return;

    const jobId = currentJob.id;
    const initialStatus = currentJob.status;

    console.log(`[CSV Importer] Subscribing to job ${jobId}`);
    let realtimeWorking = false;
    let pollInterval: NodeJS.Timeout | null = null;
    let isCleanedUp = false;

    // Realtime subscription
    const channel = supabase
      .channel(`import-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'import_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          if (isCleanedUp) return;

          console.log('[CSV Importer] Received Realtime update:', payload.new);
          realtimeWorking = true;
          const updatedJob = payload.new as ImportJob;

          setCurrentJob((prev) => {
            // Show completion toast on state transition
            if (updatedJob.status === 'completed' && prev?.status !== 'completed') {
              const duration = updatedJob.result?.duration
                ? (updatedJob.result.duration / 1000).toFixed(1)
                : '?';
              const newCount = updatedJob.auth_created_count;
              const updatedCount = updatedJob.success_count - updatedJob.auth_created_count;
              const parts = [];
              if (newCount > 0) parts.push(`${newCount} new`);
              if (updatedCount > 0) parts.push(`${updatedCount} updated`);
              if (updatedJob.failed_count > 0) parts.push(`${updatedJob.failed_count} failed`);

              toast.success(
                `Import completed in ${duration}s: ${parts.join(', ')}`
              );
              setIsImporting(false);
            } else if (updatedJob.status === 'failed' && prev?.status !== 'failed') {
              toast.error('Import failed. Check errors below.');
              setIsImporting(false);
            }

            return updatedJob;
          });
        }
      )
      .subscribe((status) => {
        console.log(`[CSV Importer] Realtime subscription status:`, status);
      });

    // Fallback polling mechanism (polls every 2 seconds if Realtime isn't working)
    const startPolling = () => {
      pollInterval = setInterval(async () => {
        if (isCleanedUp) return;

        if (realtimeWorking) {
          console.log('[CSV Importer] Realtime is working, stopping fallback polling');
          if (pollInterval) clearInterval(pollInterval);
          return;
        }

        console.log('[CSV Importer] Polling job status (Realtime fallback)...');
        try {
          const response = await fetch(`/api/admin/hr-import/status/${jobId}`);
          if (response.ok) {
            const updatedJob = await response.json() as ImportJob;

            setCurrentJob((prev) => {
              // Show completion toast on state transition
              if (updatedJob.status === 'completed' && prev?.status !== 'completed') {
                const duration = updatedJob.result?.duration
                  ? (updatedJob.result.duration / 1000).toFixed(1)
                  : '?';
                const newCount = updatedJob.auth_created_count;
                const updatedCount = updatedJob.success_count - updatedJob.auth_created_count;
                const parts = [];
                if (newCount > 0) parts.push(`${newCount} new`);
                if (updatedCount > 0) parts.push(`${updatedCount} updated`);
                if (updatedJob.failed_count > 0) parts.push(`${updatedJob.failed_count} failed`);

                toast.success(
                  `Import completed in ${duration}s: ${parts.join(', ')}`
                );
                setIsImporting(false);
                if (pollInterval) clearInterval(pollInterval);
              } else if (updatedJob.status === 'failed' && prev?.status !== 'failed') {
                toast.error('Import failed. Check errors below.');
                setIsImporting(false);
                if (pollInterval) clearInterval(pollInterval);
              }

              return updatedJob;
            });
          }
        } catch (error) {
          console.error('[CSV Importer] Error polling job status:', error);
        }
      }, 2000); // Poll every 2 seconds
    };

    // Start polling immediately as primary update mechanism (Realtime as backup)
    // Poll more aggressively at first, then back off
    console.log('[CSV Importer] Starting status polling...');
    startPolling();

    // If Realtime starts working, the polling will stop itself
    const realtimeCheckTimeout = setTimeout(() => {
      if (realtimeWorking) {
        console.log('[CSV Importer] Realtime is working, will stop polling');
      } else {
        console.log('[CSV Importer] Relying on polling for updates (Realtime not active)');
      }
    }, 5000);

    return () => {
      console.log(`[CSV Importer] Unsubscribing from job ${jobId}`);
      isCleanedUp = true;
      clearTimeout(realtimeCheckTimeout);
      if (pollInterval) clearInterval(pollInterval);
      channel.unsubscribe();
    };
  }, [currentJob?.id, supabase]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
        setCurrentJob(null);

        // Parse CSV
        Papa.parse(selectedFile, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setParsedData(results.data as ParsedRow[]);
            validateData(results.data as ParsedRow[]);
            toast.success(`Parsed ${results.data.length} rows from CSV`);
          },
          error: (error) => {
            toast.error(`Error parsing CSV: ${error.message}`);
          },
        });
      }
    },
    []
  );

  const validateData = (data: ParsedRow[]) => {
    const errors: ValidationError[] = [];

    data.forEach((row, index) => {
      // Check required fields based on config
      config.requiredFields.forEach((field) => {
        const sourceField = Object.keys(config.fieldMapping).find(
          (key) => config.fieldMapping[key] === field
        );
        if (sourceField && !row[sourceField]) {
          errors.push({
            row: index + 1,
            field: sourceField,
            message: `Required field "${sourceField}" is missing`,
          });
        }
      });

      // Validate email format
      const emailSourceField = Object.keys(config.fieldMapping).find(
        (key) => config.fieldMapping[key] === "email"
      );
      if (emailSourceField && row[emailSourceField]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(row[emailSourceField])) {
          errors.push({
            row: index + 1,
            field: emailSourceField,
            message: `Invalid email format: "${row[emailSourceField]}"`,
          });
        }
      }
    });

    setValidationErrors(errors);
  };

  const handleImport = async () => {
    if (validationErrors.length > 0) {
      toast.error("Please fix validation errors before importing");
      return;
    }

    setIsImporting(true);
    setStartTime(Date.now());

    try {
      // Create import job
      const response = await fetch("/api/admin/hr-import/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          data: parsedData,
          config,
          departments,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start import");
      }

      const { jobId } = await response.json();
      toast.success("Import started! Processing in background...");

      // Fetch initial job status
      const statusResponse = await fetch(`/api/admin/hr-import/status/${jobId}`);
      if (statusResponse.ok) {
        const job = await statusResponse.json();

        // Batch state updates to prevent multiple renders
        // Keep parsedData visible during import so user can see what's being processed
        startTransition(() => {
          setCurrentJob(job as ImportJob);
          setFile(null);
          setValidationErrors([]);
          // Don't clear parsedData here - keep it visible during import
        });
      }
    } catch (error) {
      console.error("Error starting import:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to start import"
      );
      setIsImporting(false);
      setStartTime(null);
    }
  };

  // Calculate progress percentage
  const progressPercent = currentJob
    ? Math.round((currentJob.processed_rows / currentJob.total_rows) * 100)
    : 0;

  // Calculate elapsed time
  const elapsedTime = startTime && currentJob?.status === 'processing'
    ? Math.floor((Date.now() - startTime) / 1000)
    : currentJob?.result?.duration
    ? Math.floor(currentJob.result.duration / 1000)
    : 0;

  // Estimate remaining time
  const estimatedRemaining = currentJob && currentJob.processed_rows > 0 && currentJob.status === 'processing'
    ? Math.floor((elapsedTime / currentJob.processed_rows) * (currentJob.total_rows - currentJob.processed_rows))
    : 0;

  // Create table columns dynamically from CSV headers (memoized to prevent recreation)
  const columns = useMemo(() => {
    if (parsedData.length === 0) return [];

    const columnHelper = createColumnHelper<ParsedRow>();
    return Object.keys(parsedData[0]).map((key) =>
      columnHelper.accessor(key, {
        header: key,
        cell: (info) => info.getValue(),
      })
    );
  }, [parsedData]);

  // Memoize preview data to prevent slice on every render
  const previewData = useMemo(() => parsedData.slice(0, 10), [parsedData]);

  // useReactTable is already optimized - just pass memoized inputs
  const table = useReactTable({
    data: previewData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Upload CSV File</CardTitle>
          <CardDescription>
            Select a CSV file from {config.systemName} to import employee data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isImporting}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary/10 file:text-primary
                  hover:file:bg-primary/20
                  cursor-pointer
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            {file && (
              <div className="text-sm text-muted-foreground">
                Selected: <strong>{file.name}</strong> (
                {(file.size / 1024).toFixed(2)} KB)
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import Progress */}
      {currentJob && (
        <Card className={
          currentJob.status === 'completed' ? 'border-green-500' :
          currentJob.status === 'failed' ? 'border-red-500' :
          'border-blue-500'
        }>
          <CardHeader>
            <CardTitle>
              {currentJob.status === 'pending' && 'Import Starting...'}
              {currentJob.status === 'processing' && 'Import in Progress'}
              {currentJob.status === 'completed' && 'Import Complete!'}
              {currentJob.status === 'failed' && 'Import Failed'}
            </CardTitle>
            <CardDescription>
              Job ID: {currentJob.id.slice(0, 8)}...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Progress Bar */}
              {(currentJob.status === 'processing' || currentJob.status === 'pending') && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processing {currentJob.processed_rows} / {currentJob.total_rows} employees</span>
                    <span className="font-semibold">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Elapsed: {elapsedTime}s</span>
                    {estimatedRemaining > 0 && (
                      <span>Est. remaining: {estimatedRemaining}s</span>
                    )}
                  </div>
                </div>
              )}

              {/* Results */}
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">New Employees</div>
                  <div className="text-2xl font-bold text-green-600">
                    {currentJob.auth_created_count}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Created accounts</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Updated</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {currentJob.success_count - currentJob.auth_created_count}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Existing employees</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Failed</div>
                  <div className="text-2xl font-bold text-red-600">
                    {currentJob.failed_count}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Errors</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Success</div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {currentJob.success_count}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Processed</div>
                </div>
              </div>

              {/* Errors */}
              {currentJob.errors && currentJob.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold mb-2 text-red-600">
                    Errors ({currentJob.errors.length}):
                  </p>
                  <div className="max-h-40 overflow-y-auto bg-red-50 dark:bg-red-950 p-2 rounded">
                    <ul className="text-xs text-red-900 dark:text-red-100 space-y-1">
                      {currentJob.errors.map((error, index) => (
                        <li key={index}>
                          Row {error.row}: {error.message}
                          {error.email && ` (${error.email})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Completion Message */}
              {currentJob.status === 'completed' && currentJob.auth_created_count > 0 && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Note:</strong> {currentJob.auth_created_count} new {currentJob.auth_created_count === 1 ? 'employee' : 'employees'} can now log in with their email and default password: <code className="font-mono font-bold">password123</code>
                  </p>
                </div>
              )}

              {/* Clear button after completion */}
              {(currentJob.status === 'completed' || currentJob.status === 'failed') && (
                <Button
                  onClick={() => {
                    setCurrentJob(null);
                    setStartTime(null);
                    setParsedData([]); // Clear data when starting new import
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Start New Import
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">
              Validation Errors ({validationErrors.length})
            </CardTitle>
            <CardDescription>
              Fix these errors before importing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationErrors.map((error, index) => (
                    <TableRow key={index}>
                      <TableCell>{error.row}</TableCell>
                      <TableCell className="font-mono">{error.field}</TableCell>
                      <TableCell className="text-destructive">
                        {error.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Preview */}
      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Data Preview ({parsedData.length} rows total, showing first 10)
            </CardTitle>
            <CardDescription>
              Review the data before importing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="whitespace-nowrap">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="whitespace-nowrap">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Button */}
      {parsedData.length > 0 && !currentJob && (
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => {
              startTransition(() => {
                setFile(null);
                setParsedData([]);
                setValidationErrors([]);
              });
            }}
            variant="outline"
            disabled={isImporting}
          >
            Clear
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              isImporting ||
              validationErrors.length > 0 ||
              parsedData.length === 0
            }
          >
            {isImporting
              ? "Starting Import..."
              : `Import ${parsedData.length} Employees`}
          </Button>
        </div>
      )}

      {/* Field Mapping Info */}
      <Card>
        <CardHeader>
          <CardTitle>Current Field Mapping</CardTitle>
          <CardDescription>
            CSV columns will be mapped to these database fields
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(config.fieldMapping).map(([source, target]) => (
              <div key={source} className="flex justify-between border-b pb-1">
                <span className="font-mono font-semibold text-foreground">
                  {source}
                </span>
                <span className="font-mono font-bold text-foreground">
                  → {target}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
