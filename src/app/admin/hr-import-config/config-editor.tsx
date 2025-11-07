"use client";

import { useState } from "react";
import JsonView from "@uiw/react-json-view";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { HRImportConfig } from "@/lib/types/database";

interface HRImportConfigEditorProps {
  initialConfig: HRImportConfig | null;
  tenantId: string;
}

const defaultConfig: HRImportConfig = {
  systemName: "HR System",
  sourceFields: [
    "Email",
    "FirstName",
    "LastName",
    "EmployeeNumber",
    "HireDate",
    "Department",
    "Status",
  ],
  fieldMapping: {
    Email: "email",
    FirstName: "first_name",
    LastName: "last_name",
    EmployeeNumber: "employee_number",
    HireDate: "hire_date",
    Department: "department_id",
    Status: "employment_status",
  },
  requiredFields: ["email", "first_name", "last_name"],
};

export function HRImportConfigEditor({
  initialConfig,
  tenantId,
}: HRImportConfigEditorProps) {
  const [config, setConfig] = useState<HRImportConfig>(
    initialConfig || defaultConfig
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [jsonText, setJsonText] = useState(
    JSON.stringify(config, null, 2)
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validate JSON if in text edit mode
      if (isEditing) {
        try {
          const parsed = JSON.parse(jsonText);
          setConfig(parsed);
        } catch (e) {
          toast.error("Invalid JSON format");
          setIsSaving(false);
          return;
        }
      }

      const response = await fetch("/api/admin/hr-import-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          config: isEditing ? JSON.parse(jsonText) : config,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save configuration");
      }

      toast.success("Configuration saved successfully");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save configuration"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Configuration Editor</CardTitle>
          <CardDescription style={{ color: '#4a4a4a' }}>
            View or edit the HR import configuration. This defines how CSV columns map
            to employee profile fields. Use the text editor to make changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button
                variant={!isEditing ? "default" : "outline"}
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                Visual View
              </Button>
              <Button
                variant={isEditing ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsEditing(true);
                  setJsonText(JSON.stringify(config, null, 2));
                }}
              >
                Text Editor
              </Button>
            </div>

            {!isEditing ? (
              <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
                <JsonView
                  value={config}
                  collapsed={1}
                  displayDataTypes={false}
                  displayObjectSize={false}
                  enableClipboard={false}
                  style={{
                    fontSize: "14px",
                    fontFamily: "monospace",
                  }}
                />
              </div>
            ) : (
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full h-96 p-4 font-mono text-sm border rounded-lg bg-slate-50 dark:bg-slate-900"
                spellCheck={false}
              />
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                onClick={() => {
                  setConfig(initialConfig || defaultConfig);
                  setJsonText(JSON.stringify(initialConfig || defaultConfig, null, 2));
                  toast.info("Configuration reset to initial values");
                }}
                variant="outline"
                disabled={isSaving}
              >
                Reset
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuration Schema</CardTitle>
          <CardDescription style={{ color: '#4a4a4a' }}>
            Understanding the HR import configuration structure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <strong className="font-bold" style={{ color: '#1a1a1a' }}>
                systemName:
              </strong>{" "}
              <span style={{ color: '#2d2d2d' }}>
                Name of your HR system (e.g., &quot;BambooHR&quot;,
                &quot;Workday&quot;)
              </span>
            </div>
            <div>
              <strong className="font-bold" style={{ color: '#1a1a1a' }}>
                sourceFields:
              </strong>{" "}
              <span style={{ color: '#2d2d2d' }}>
                Array of CSV column headers from your HR system
              </span>
            </div>
            <div>
              <strong className="font-bold" style={{ color: '#1a1a1a' }}>
                fieldMapping:
              </strong>{" "}
              <span style={{ color: '#2d2d2d' }}>
                Object mapping source fields to database fields (email,
                first_name, last_name, employee_number, hire_date,
                department_id, employment_status, custom_fields)
              </span>
            </div>
            <div>
              <strong className="font-bold" style={{ color: '#1a1a1a' }}>
                requiredFields:
              </strong>{" "}
              <span style={{ color: '#2d2d2d' }}>
                Array of fields that must be present in the CSV for validation
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
