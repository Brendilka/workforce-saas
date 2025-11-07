"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import JsonView from "@uiw/react-json-view";

interface FieldVisibilityEditorProps {
  initialConfig: Record<string, any>;
  tenantId: string;
}

// Available pages to configure
const AVAILABLE_PAGES = [
  { value: "employee-personal-info", label: "Employee Personal Info" },
  // Future pages can be added here
  // { value: "employee-emergency-contacts", label: "Emergency Contacts" },
];

// Standard fields available for employee personal info
const STANDARD_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "employee_number",
  "hire_date",
  "employment_status",
  "department_id",
];

// Default config template for new pages
const DEFAULT_PAGE_CONFIG = {
  visibleFields: ["first_name", "last_name", "email"],
  fieldGroups: [
    {
      groupName: "Basic Information",
      fields: ["first_name", "last_name", "email"],
    },
  ],
};

export function FieldVisibilityEditor({ initialConfig, tenantId }: FieldVisibilityEditorProps) {
  const [selectedPage, setSelectedPage] = useState<string>("employee-personal-info");
  const [config, setConfig] = useState<Record<string, any>>(initialConfig);
  const [isEditing, setIsEditing] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const currentPageConfig = config[selectedPage] || DEFAULT_PAGE_CONFIG;

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Validate JSON if in edit mode
      let configToSave = config;
      if (isEditing) {
        try {
          const parsed = JSON.parse(jsonText);
          configToSave = { ...config, [selectedPage]: parsed };
        } catch (err) {
          toast.error("Invalid JSON format. Please check your syntax.");
          return;
        }
      }

      // Save to database via API
      const response = await fetch("/api/admin/field-visibility-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantId,
          config: configToSave,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save configuration");
      }

      setConfig(configToSave);
      toast.success("Field visibility configuration saved successfully!");
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(initialConfig);
    setIsEditing(false);
    toast.info("Configuration reset to last saved state");
  };

  const handleGenerateTemplate = () => {
    const newConfig = {
      ...config,
      [selectedPage]: DEFAULT_PAGE_CONFIG,
    };
    setConfig(newConfig);
    toast.success("Template generated! Edit the configuration and save.");
  };

  const handleEditToggle = () => {
    if (!isEditing) {
      // Switching to edit mode - populate textarea
      setJsonText(JSON.stringify(currentPageConfig, null, 2));
    }
    setIsEditing(!isEditing);
  };

  return (
    <div className="space-y-6">
      {/* Page Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Page to Configure</CardTitle>
          <CardDescription>Choose which page's field visibility you want to configure</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="page-select">Page</Label>
            <Select
              id="page-select"
              value={selectedPage}
              onChange={(e) => {
                setSelectedPage(e.target.value);
                setIsEditing(false);
              }}
            >
              {AVAILABLE_PAGES.map((page) => (
                <option key={page.value} value={page.value}>
                  {page.label}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration for {AVAILABLE_PAGES.find((p) => p.value === selectedPage)?.label}</CardTitle>
          <CardDescription>
            Define which fields are visible and how they are grouped on the page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {isEditing ? "Editing JSON directly" : "Viewing configuration"}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleEditToggle}>
                {isEditing ? "View Mode" : "Edit JSON"}
              </Button>
              {!config[selectedPage] && (
                <Button variant="outline" size="sm" onClick={handleGenerateTemplate}>
                  Generate Template
                </Button>
              )}
            </div>
          </div>

          {/* Config Display/Editor */}
          {isEditing ? (
            <div className="space-y-2">
              <Label htmlFor="json-editor">JSON Configuration</Label>
              <textarea
                id="json-editor"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full h-96 p-4 font-mono text-sm border rounded-md bg-slate-950 text-slate-50"
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="border rounded-md p-4 bg-slate-950">
              {config[selectedPage] ? (
                <JsonView value={currentPageConfig} collapsed={1} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No configuration found for this page.</p>
                  <p className="text-sm mt-2">Click "Generate Template" to create a default configuration.</p>
                </div>
              )}
            </div>
          )}

          {/* Configuration Guide */}
          <div className="border rounded-md p-4 bg-muted/50 space-y-2">
            <h4 className="font-medium text-sm">Configuration Structure:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                <strong>visibleFields</strong>: Array of field names to display on the page
              </li>
              <li>
                <strong>fieldGroups</strong>: Group fields into sections with a groupName and fields array
              </li>
            </ul>
            <div className="mt-3">
              <p className="text-sm font-medium">Available Standard Fields:</p>
              <p className="text-xs text-muted-foreground mt-1">
                {STANDARD_FIELDS.join(", ")}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Custom fields defined in your tenant will also be available automatically.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Configuration"}
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={isSaving}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
