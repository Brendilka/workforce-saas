/**
 * Allocation Simulation Modal Component
 *
 * Shows the impact of new allocation settings on existing shifts
 * with summary, per-shift changes, and warnings.
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader,
} from 'lucide-react';

interface ShiftAllocationChange {
  shiftId: string;
  shiftDescription: string;
  oldAllocationDate: string | string[];
  newAllocationDate: string | string[];
  reason: string;
  durationMinutes: number;
  crossesMidnight: boolean;
}

interface SimulationSummary {
  affectedShifts: number;
  allocationChanges: number;
  allocationUnchanged: number;
  overtimeImpactMinutes: number;
  warningsCount: number;
  processedAt: string;
}

interface SimulationResult {
  summary: SimulationSummary;
  perShiftChanges: ShiftAllocationChange[];
  warnings: string[];
  ruleVersion: string;
}

interface AllocationSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  simulation?: SimulationResult;
  isLoading?: boolean;
  error?: string;
  newModeName?: string;
}

export function AllocationSimulationModal({
  isOpen,
  onClose,
  onConfirm,
  simulation,
  isLoading = false,
  error,
  newModeName = 'New Settings',
}: AllocationSimulationModalProps) {
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const toggleChangeExpanded = (shiftId: string) => {
    const newSet = new Set(expandedChanges);
    if (newSet.has(shiftId)) {
      newSet.delete(shiftId);
    } else {
      newSet.add(shiftId);
    }
    setExpandedChanges(newSet);
  };

  const formatDurationMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const getChangeDirection = (oldDate: string | string[], newDate: string | string[]): 'forward' | 'backward' | 'none' => {
    const oldStr = Array.isArray(oldDate) ? oldDate[0] : oldDate;
    const newStr = Array.isArray(newDate) ? newDate[0] : newDate;

    if (oldStr === newStr) return 'none';

    const oldD = new Date(oldStr);
    const newD = new Date(newStr);

    return newD > oldD ? 'forward' : 'backward';
  };

  return (
    // Modal overlay
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      {/* Modal content */}
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Simulation Results</h2>
              <p className="text-sm text-gray-600">Impact of switching to {newModeName}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              ✕
            </Button>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-6 h-6 animate-spin text-blue-500 mr-3" />
              <span className="text-gray-600">Running simulation...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Content */}
          {simulation && !isLoading && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-gray-600 text-sm">Affected Shifts</div>
                    <div className="text-3xl font-bold text-gray-900 mt-2">
                      {simulation.summary.affectedShifts}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Total shifts</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-gray-600 text-sm">Changes</div>
                    <div className="text-3xl font-bold text-orange-600 mt-2">
                      {simulation.summary.allocationChanges}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {Math.round((simulation.summary.allocationChanges / simulation.summary.affectedShifts) * 100)}%
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-gray-600 text-sm">Unchanged</div>
                    <div className="text-3xl font-bold text-green-600 mt-2">
                      {simulation.summary.allocationUnchanged}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">No change</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-gray-600 text-sm">Overtime Impact</div>
                    <div className="text-3xl font-bold text-blue-600 mt-2">
                      {formatDurationMinutes(simulation.summary.overtimeImpactMinutes)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Estimated</div>
                  </CardContent>
                </Card>
              </div>

              {/* Warnings Section */}
              {simulation.warnings.length > 0 && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      Important Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {simulation.warnings.map((warning, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-yellow-600 font-bold mt-0.5">•</span>
                          <span className="text-gray-700">{warning}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Per-Shift Changes */}
              {simulation.perShiftChanges.length > 0 && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Affected Shifts ({simulation.perShiftChanges.length})</CardTitle>
                    <CardDescription>Detailed changes per shift</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {simulation.perShiftChanges.map((change) => {
                        const isExpanded = expandedChanges.has(change.shiftId);
                        const direction = getChangeDirection(change.oldAllocationDate, change.newAllocationDate);
                        const oldDates = Array.isArray(change.oldAllocationDate)
                          ? change.oldAllocationDate.join(', ')
                          : change.oldAllocationDate;
                        const newDates = Array.isArray(change.newAllocationDate)
                          ? change.newAllocationDate.join(', ')
                          : change.newAllocationDate;

                        return (
                          <div key={change.shiftId} className="border rounded-lg overflow-hidden">
                            {/* Header */}
                            <button
                              onClick={() => toggleChangeExpanded(change.shiftId)}
                              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900">{change.shiftDescription}</div>
                                <div className="text-sm text-gray-600 mt-1">
                                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                                    {formatDurationMinutes(change.durationMinutes)}
                                  </span>
                                  {change.crossesMidnight && (
                                    <span className="ml-2 bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs">
                                      Cross-midnight
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex-1 mx-4 flex items-center justify-end gap-2 min-w-0">
                                <div className="text-right min-w-0">
                                  <div className="text-sm text-gray-500 truncate">{oldDates}</div>
                                </div>

                                {direction === 'forward' && <TrendingUp className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                                {direction === 'backward' && (
                                  <TrendingDown className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                )}

                                <div className="text-right min-w-0">
                                  <div className="text-sm font-semibold text-gray-900 truncate">{newDates}</div>
                                </div>
                              </div>

                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                              )}
                            </button>

                            {/* Expanded details */}
                            {isExpanded && (
                              <div className="px-4 py-3 bg-white border-t text-sm">
                                <div className="space-y-2">
                                  <div>
                                    <span className="text-gray-600">Reason: </span>
                                    <span className="text-gray-900 font-medium">{change.reason}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-gray-50 p-2 rounded">
                                      <div className="text-gray-600 text-xs">Old Allocation</div>
                                      <div className="font-mono text-sm mt-1">{oldDates}</div>
                                    </div>
                                    <div className="bg-blue-50 p-2 rounded">
                                      <div className="text-blue-700 text-xs">New Allocation</div>
                                      <div className="font-mono text-sm mt-1">{newDates}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* No changes info */}
              {simulation.perShiftChanges.length === 0 && simulation.summary.allocationChanges === 0 && (
                <Card className="mb-6 bg-green-50 border-green-200">
                  <CardContent className="pt-6 flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-green-900">No changes detected</div>
                      <div className="text-sm text-green-700">All shifts would remain allocated to the same dates</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Metadata */}
              <div className="mb-6 p-3 bg-gray-50 rounded text-xs text-gray-600 flex justify-between">
                <span>Rule Version: {simulation.ruleVersion}</span>
                <span>Simulated: {new Date(simulation.summary.processedAt).toLocaleTimeString()}</span>
              </div>

              {/* Footer actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <div className="flex-1" />
                {onConfirm && (
                  <Button
                    onClick={onConfirm}
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={simulation.summary.warningsCount > 0 && simulation.summary.allocationChanges > 0}
                  >
                    {simulation.summary.allocationChanges === 0
                      ? 'Apply Settings'
                      : `Apply Settings (${simulation.summary.allocationChanges} changes)`}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
