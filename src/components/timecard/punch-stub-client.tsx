"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PunchRecord, TimecardEmployeeSummary } from "@/lib/timecard";

interface PunchStubClientProps {
  userOptions: TimecardEmployeeSummary[];
  initialUserId?: string;
}

interface PunchStubResponse {
  employee: TimecardEmployeeSummary;
  punchRecords: PunchRecord[];
}

export function PunchStubClient({
  userOptions,
  initialUserId,
}: PunchStubClientProps) {
  const [selectedUserId, setSelectedUserId] = useState(initialUserId || userOptions[0]?.userId || "");
  const [employee, setEmployee] = useState<TimecardEmployeeSummary | null>(null);
  const [punchRecords, setPunchRecords] = useState<PunchRecord[]>([]);
  const [punchedAt, setPunchedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecords() {
      if (!selectedUserId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/punch-stub?userId=${selectedUserId}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as PunchStubResponse | { error?: string };

        if (!response.ok || !("punchRecords" in data)) {
          throw new Error(
            "error" in data && typeof data.error === "string"
              ? data.error
              : "Unable to load punch records."
          );
        }

        setEmployee(data.employee);
        setPunchRecords(data.punchRecords);
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load punch records."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadRecords();

    return () => controller.abort();
  }, [selectedUserId]);

  const sortedRecords = useMemo(
    () => [...punchRecords].sort((left, right) => right.punchedAt.localeCompare(left.punchedAt)),
    [punchRecords]
  );

  const handleSend = async () => {
    if (!selectedUserId || !punchedAt) {
      setError("Select a user and enter a punch date/time.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/punch-stub", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedUserId,
          punchedAt,
        }),
      });

      const data = (await response.json()) as PunchStubResponse | { error?: string };

      if (!response.ok || !("punchRecords" in data)) {
        throw new Error(
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Unable to save punch record."
        );
      }

      setEmployee(data.employee);
      setPunchRecords(data.punchRecords);
      setNotice("Punch record sent.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save punch record."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/punch-stub", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedUserId,
          recordId,
        }),
      });

      const data = (await response.json()) as PunchStubResponse | { error?: string };

      if (!response.ok || !("punchRecords" in data)) {
        throw new Error(
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Unable to delete punch record."
        );
      }

      setEmployee(data.employee);
      setPunchRecords(data.punchRecords);
      setNotice("Punch record deleted.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete punch record."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Punch Event Simulator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert className="border-red-200 bg-red-50 text-red-700">{error}</Alert>}
          {notice && <Alert className="border-green-200 bg-green-50 text-green-700">{notice}</Alert>}

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_auto]">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {userOptions.map((user) => (
                    <SelectItem key={user.userId} value={user.userId}>
                      {user.fullName} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Date / Time</label>
              <Input
                type="datetime-local"
                value={punchedAt}
                onChange={(event) => setPunchedAt(event.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={handleSend} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send
              </Button>
            </div>
          </div>

          {employee && (
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              Sending simulated punches for <span className="font-semibold">{employee.fullName}</span>
              {employee.employeeNumber ? ` · ${employee.employeeNumber}` : ""}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sent Punch Records</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading records...
            </div>
          ) : sortedRecords.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No punch records for the selected user yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-3 text-left text-sm font-medium">#</th>
                    <th className="px-3 py-3 text-left text-sm font-medium">User</th>
                    <th className="px-3 py-3 text-left text-sm font-medium">Date / Time</th>
                    <th className="px-3 py-3 text-left text-sm font-medium">Stored Date</th>
                    <th className="px-3 py-3 text-right text-sm font-medium">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecords.map((record, index) => (
                    <tr key={record.id} className="border-b">
                      <td className="px-3 py-3 text-sm text-gray-600">{index + 1}</td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {employee?.fullName || "-"}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.punchedAt.replace("T", " ")}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {record.punchedAt.slice(0, 10)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-red-600"
                          onClick={() => handleDelete(record.id)}
                          disabled={saving}
                          aria-label="Delete punch record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
