"use client";

import { useState, useCallback } from "react";
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
import type { HRImportConfig } from "@/lib/types/database";

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
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    authCreated: number;
    errors: string[];
  } | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
        setImportResult(null);

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

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch("/api/admin/hr-import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          data: parsedData,
          config,
          departments,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import data");
      }

      const result = await response.json();
      setImportResult(result);
      toast.success(
        `Import completed: ${result.success} succeeded, ${result.failed} failed, ${result.authCreated} auth accounts created`
      );

      // Clear file input
      setFile(null);
      setParsedData([]);
      setValidationErrors([]);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Error importing data:", error);

      if (error instanceof Error && error.name === 'AbortError') {
        toast.error("Import request timed out. Please try with fewer rows or contact support.");
      } else {
        toast.error(
          error instanceof Error ? error.message : "Failed to import data"
        );
      }
    } finally {
      setIsImporting(false);
    }
  };

  // Create table columns dynamically from CSV headers
  const columnHelper = createColumnHelper<ParsedRow>();
  const columns =
    parsedData.length > 0
      ? Object.keys(parsedData[0]).map((key) =>
          columnHelper.accessor(key, {
            header: key,
            cell: (info) => info.getValue(),
          })
        )
      : [];

  const table = useReactTable({
    data: parsedData.slice(0, 10), // Show first 10 rows for preview
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
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary/10 file:text-primary
                  hover:file:bg-primary/20
                  cursor-pointer"
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
          </CardContent>
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Card className="border-success">
          <CardHeader>
            <CardTitle className="text-success">
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">
                <strong>Success:</strong> {importResult.success} employees
                imported
              </p>
              <p className="text-sm">
                <strong>Failed:</strong> {importResult.failed} rows
              </p>
              <p className="text-sm">
                <strong>Auth Accounts Created:</strong> {importResult.authCreated} new login accounts
              </p>
              {importResult.authCreated > 0 && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Note:</strong> New employees can now log in with their email and default password: <code className="font-mono font-bold">password123</code>
                  </p>
                </div>
              )}
              {importResult.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold mb-2">Errors:</p>
                  <ul className="text-sm text-destructive space-y-1 max-h-40 overflow-y-auto">
                    {importResult.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Button */}
      {parsedData.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => {
              setFile(null);
              setParsedData([]);
              setValidationErrors([]);
              setImportResult(null);
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
              ? "Importing..."
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
