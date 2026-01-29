"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Check, AlertCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SettingsClient() {
  const [minHoursBetweenShifts, setMinHoursBetweenShifts] = useState<number>(8);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const supabase = createClient();

  // Auto-dismiss notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      // Get current user's tenant_id
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;

      const tenantId = user?.user_metadata?.tenant_id;
      if (!tenantId) {
        console.warn("Unable to determine tenant");
        return;
      }

      const { data, error } = await supabase
        .from("tenant_config")
        .select("min_hours_between_shifts")
        .eq("tenant_id", tenantId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading settings:", error);
      } else if (data) {
        const minHours = (data as unknown as {min_hours_between_shifts: number | null}).min_hours_between_shifts;
        if (minHours != null) {
          setMinHoursBetweenShifts(minHours);
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Get current user's tenant_id
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;

      // Get the tenant_id from the user's custom claims
      const tenantId = user?.user_metadata?.tenant_id;
      if (!tenantId) {
        throw new Error("Unable to determine tenant. Please log in again.");
      }

      const { error } = await supabase.from("tenant_config").upsert(
        {
          tenant_id: tenantId,
          min_hours_between_shifts: minHoursBetweenShifts,
        },
        {
          onConflict: "tenant_id",
        }
      );

      if (error) throw error;
      setNotification({
        type: "success",
        message: "Settings saved successfully!",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save settings.";
      setNotification({
        type: "error",
        message: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleIncrement = () => {
    setMinHoursBetweenShifts((prev) => Math.min(23, prev + 0.25));
  };

  const handleDecrement = () => {
    setMinHoursBetweenShifts((prev) => Math.max(0, prev - 0.25));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 23) {
      setMinHoursBetweenShifts(value);
    } else if (e.target.value === "") {
      setMinHoursBetweenShifts(0);
    }
  };

  const handleInputBlur = () => {
    // Round to nearest 0.25
    const rounded = Math.round(minHoursBetweenShifts * 4) / 4;
    const clamped = Math.max(0, Math.min(23, rounded));
    setMinHoursBetweenShifts(clamped);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Configure system settings" />

      <Card className="p-6 max-w-2xl">
        {isLoading ? (
          <div className="text-sm text-gray-500">Loading settings...</div>
        ) : (
          <div className="space-y-6">
            <div>
              <Label htmlFor="minHoursBetweenShifts" className="text-base font-semibold mb-3 block">
                Min allowed number of hours between shifts
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleDecrement}
                  disabled={minHoursBetweenShifts <= 0}
                  className="h-10 w-10"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id="minHoursBetweenShifts"
                  type="number"
                  step="0.25"
                  min="0"
                  max="23"
                  value={minHoursBetweenShifts}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  className="w-32 text-center"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleIncrement}
                  disabled={minHoursBetweenShifts >= 23}
                  className="h-10 w-10"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600">hours</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Minimum rest time required between consecutive shifts (0 - 23 hours, in 0.25 hour increments)
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={saveSettings} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed bottom-4 right-4 max-w-sm rounded-lg shadow-lg border p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4 fade-in ${
            notification.type === "success"
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div className="flex-shrink-0">
            {notification.type === "success" ? (
              <Check className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
          </div>
          <div className="flex-1">
            <p
              className={`text-sm font-medium ${
                notification.type === "success"
                  ? "text-green-800"
                  : "text-red-800"
              }`}
            >
              {notification.message}
            </p>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}    </div>
  );
}
