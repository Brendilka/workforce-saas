"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import { Edit, Save } from "lucide-react";
import type { Profile, CustomFieldDefinition, PageConfig } from "@/lib/types/database";

interface PersonalInfoFormProps {
  profile: Profile & { department?: { id: string; name: string } | null };
  pageConfig: PageConfig;
  customFieldDefinitions: CustomFieldDefinition[];
  departments: Array<{ id: string; name: string }>;
}

// Field label mapping for display
const FIELD_LABELS: Record<string, string> = {
  first_name: "First Name",
  last_name: "Last Name",
  email: "Email Address",
  employee_number: "Employee Number",
  hire_date: "Hire Date",
  employment_status: "Employment Status",
  department_id: "Department",
};

// Employment status options
const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "terminated", label: "Terminated" },
];

export function PersonalInfoForm({
  profile,
  pageConfig,
  customFieldDefinitions,
  departments,
}: PersonalInfoFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Build dynamic Zod schema based on visible fields
  const buildSchema = () => {
    const schemaFields: Record<string, z.ZodTypeAny> = {};

    // Add standard fields to schema
    pageConfig.visibleFields.forEach((field) => {
      if (field === "first_name" || field === "last_name") {
        schemaFields[field] = z.string().min(1, `${FIELD_LABELS[field]} is required`);
      } else if (field === "email") {
        schemaFields[field] = z.string().min(1, "Email is required").email("Invalid email address");
      } else if (field === "employee_number") {
        schemaFields[field] = z.string().nullable();
      } else if (field === "hire_date") {
        schemaFields[field] = z.string().nullable();
      } else if (field === "employment_status") {
        schemaFields[field] = z.enum(["active", "on_leave", "terminated"]);
      } else if (field === "department_id") {
        schemaFields[field] = z.string().nullable();
      }
    });

    // Add custom fields to schema
    customFieldDefinitions.forEach((customField) => {
      if (pageConfig.visibleFields.includes(customField.field_name)) {
        if (customField.required) {
          if (customField.field_type === "number") {
            schemaFields[customField.field_name] = z.number().or(z.string());
          } else if (customField.field_type === "boolean") {
            schemaFields[customField.field_name] = z.boolean();
          } else {
            schemaFields[customField.field_name] = z.string().min(1, `${customField.field_name} is required`);
          }
        } else {
          schemaFields[customField.field_name] = z.any().nullable().optional();
        }
      }
    });

    return z.object(schemaFields);
  };

  const schema = buildSchema();
  type FormData = z.infer<typeof schema>;

  // Prepare default values from profile
  const getDefaultValues = (): any => {
    const defaults: Record<string, any> = {};

    // Standard fields
    pageConfig.visibleFields.forEach((field) => {
      if (field === "department_id") {
        defaults[field] = profile.department_id || "";
      } else if (field in profile) {
        defaults[field] = (profile as any)[field] || "";
      }
    });

    // Custom fields from JSONB
    customFieldDefinitions.forEach((customField) => {
      if (pageConfig.visibleFields.includes(customField.field_name)) {
        defaults[customField.field_name] = profile.custom_fields?.[customField.field_name] || "";
      }
    });

    return defaults;
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: getDefaultValues(),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setIsSaving(true);

      // Separate standard fields from custom fields
      const standardFields: Record<string, any> = {};
      const customFields: Record<string, any> = {};

      Object.keys(data).forEach((key) => {
        if (["first_name", "last_name", "email", "employee_number", "hire_date", "employment_status", "department_id"].includes(key)) {
          standardFields[key] = data[key];
        } else {
          customFields[key] = data[key];
        }
      });

      // Call API to update profile
      const response = await fetch("/api/employee/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          standardFields,
          customFields,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save changes");
      }

      toast.success("Profile updated successfully!");
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    reset();
    setIsEditing(false);
  };

  // Check if field is a custom field
  const isCustomField = (fieldName: string) => {
    return customFieldDefinitions.some((def) => def.field_name === fieldName);
  };

  // Get custom field definition
  const getCustomFieldDef = (fieldName: string) => {
    return customFieldDefinitions.find((def) => def.field_name === fieldName);
  };

  // Render a single field based on its type
  const renderField = (fieldName: string) => {
    const error = errors[fieldName];
    const isCustom = isCustomField(fieldName);
    const customFieldDef = isCustom ? getCustomFieldDef(fieldName) : null;

    // Get field label
    const label = isCustom
      ? fieldName
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      : FIELD_LABELS[fieldName] || fieldName;

    // Handle department dropdown
    if (fieldName === "department_id") {
      return (
        <div key={fieldName} className="space-y-2">
          <Label htmlFor={fieldName}>{label}</Label>
          <Select id={fieldName} {...register(fieldName)} disabled={!isEditing}>
            <option value="">Select Department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </Select>
          {error && <p className="text-sm text-red-500">{error.message as string}</p>}
        </div>
      );
    }

    // Handle employment status dropdown
    if (fieldName === "employment_status") {
      return (
        <div key={fieldName} className="space-y-2">
          <Label htmlFor={fieldName}>{label}</Label>
          <Select id={fieldName} {...register(fieldName)} disabled={!isEditing}>
            {EMPLOYMENT_STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </Select>
          {error && <p className="text-sm text-red-500">{error.message as string}</p>}
        </div>
      );
    }

    // Handle custom select fields
    if (customFieldDef && customFieldDef.field_type === "select") {
      const options = customFieldDef.field_options?.options || [];
      return (
        <div key={fieldName} className="space-y-2">
          <Label htmlFor={fieldName}>{label}</Label>
          <Select id={fieldName} {...register(fieldName)} disabled={!isEditing}>
            <option value="">Select...</option>
            {options.map((option: string) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          {error && <p className="text-sm text-red-500">{error.message as string}</p>}
        </div>
      );
    }

    // Handle date fields
    if (fieldName === "hire_date" || (customFieldDef && customFieldDef.field_type === "date")) {
      return (
        <div key={fieldName} className="space-y-2">
          <Label htmlFor={fieldName}>{label}</Label>
          <Input id={fieldName} type="date" {...register(fieldName)} disabled={!isEditing} />
          {error && <p className="text-sm text-red-500">{error.message as string}</p>}
        </div>
      );
    }

    // Handle number fields
    if (customFieldDef && customFieldDef.field_type === "number") {
      return (
        <div key={fieldName} className="space-y-2">
          <Label htmlFor={fieldName}>{label}</Label>
          <Input id={fieldName} type="number" {...register(fieldName)} disabled={!isEditing} />
          {error && <p className="text-sm text-red-500">{error.message as string}</p>}
        </div>
      );
    }

    // Handle boolean fields (checkbox)
    if (customFieldDef && customFieldDef.field_type === "boolean") {
      return (
        <div key={fieldName} className="flex items-center space-x-2">
          <input
            id={fieldName}
            type="checkbox"
            {...register(fieldName)}
            disabled={!isEditing}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor={fieldName}>{label}</Label>
          {error && <p className="text-sm text-red-500">{error.message as string}</p>}
        </div>
      );
    }

    // Default: text input
    return (
      <div key={fieldName} className="space-y-2">
        <Label htmlFor={fieldName}>{label}</Label>
        <Input
          id={fieldName}
          type="text"
          {...register(fieldName)}
          disabled={!isEditing || fieldName === "email"} // Email is typically read-only
        />
        {error && <p className="text-sm text-red-500">{error.message as string}</p>}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {pageConfig.fieldGroups.map((group) => (
        <Card key={group.groupName}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{group.groupName}</CardTitle>
              {!isEditing && group === pageConfig.fieldGroups[0] && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {group.fields
                .filter((field) => pageConfig.visibleFields.includes(field))
                .map((field) => renderField(field))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Action Buttons */}
      {isEditing && (
        <div className="flex gap-2">
          <Button type="submit" disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      )}
    </form>
  );
}
