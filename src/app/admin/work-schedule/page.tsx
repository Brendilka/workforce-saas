"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";

export default function WorkSchedulePage() {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddSchedule = () => {
    setIsAdding(true);
    // TODO: Implement add schedule functionality
    console.log("Add schedule clicked");
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Work Schedule"
        description="Manage employee work schedules"
      />

      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900">
              No schedules yet
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Create your first work schedule to get started
            </p>
          </div>

          <Button
            onClick={handleAddSchedule}
            disabled={isAdding}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {isAdding ? "Adding..." : "Add Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
