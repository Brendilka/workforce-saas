/**
 * Explanation Drawer Component
 *
 * Shows human-readable reasoning for an allocation decision.
 * Displays via drawer on the right side with full explanation details.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ChevronRight, Copy, Download, X } from 'lucide-react';
import { explainAllocation } from '@/lib/allocation-explainability';
import type { Shift, RosterPatternSettings } from '@/lib/shift-allocation';

interface AllocationMetrics {
  minutesPerDay?: Record<string, number>;
  majorityWinner?: string;
  majorityWinnerMinutes?: number;
  runnerUpMinutes?: number;
  weeklyBalancing?: {
    currentWeekStartDate: string;
    currentWeekRemainingMinutes: number;
    nextWeekRemainingMinutes: number;
    strategy: string;
    tieBreaker?: string;
    weeksInAnalysis: number;
  };
  payPeriod?: {
    definitionType: string;
    startDay?: number;
    startDate?: string;
  };
}

interface ExplanationResult {
  allocationDate: string | string[];
  mode: string;
  ruleVersion: string;
  reasoningSteps: string[];
  metrics?: AllocationMetrics;
  systemContext?: {
    shiftIsOvernight: boolean;
    shiftDurationMinutes: number;
    shiftStartDate: string;
    shiftEndDate: string;
  };
}

interface AllocationExplanationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift;
  allocationSettings: RosterPatternSettings;
}

export function AllocationExplanationDrawer({
  isOpen,
  onClose,
  shift,
  allocationSettings,
}: AllocationExplanationDrawerProps) {
  const [explanation, setExplanation] = useState<ExplanationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Load explanation when drawer opens
  useEffect(() => {
    if (!isOpen || !shift) {
      setExplanation(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = explainAllocation(shift, allocationSettings);
      setExplanation(result as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate explanation');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, shift, allocationSettings]);

  useEffect(() => {
    if (copiedIndex !== null) {
      const timer = setTimeout(() => setCopiedIndex(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedIndex]);

  if (!isOpen) return null;

  const handleCopyStep = (step: string, index: number) => {
    navigator.clipboard.writeText(step);
    setCopiedIndex(index);
  };

  const handleDownloadExplanation = () => {
    if (!explanation) return;

    const content = `
Allocation Decision Report
===========================

Mode: ${explanation.mode}
Rule Version: ${explanation.ruleVersion}

Allocated Date(s): ${Array.isArray(explanation.allocationDate) ? explanation.allocationDate.join(', ') : explanation.allocationDate}

Shift Context:
- Start Date: ${explanation.systemContext?.shiftStartDate}
- End Date: ${explanation.systemContext?.shiftEndDate}
- Duration: ${formatDurationMinutes(explanation.systemContext?.shiftDurationMinutes || 0)}
- Cross-midnight: ${explanation.systemContext?.shiftIsOvernight ? 'Yes' : 'No'}

Reasoning Steps:
${explanation.reasoningSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

${explanation.metrics ? `Metrics:
${JSON.stringify(explanation.metrics, null, 2)}` : ''}

Generated: ${new Date().toISOString()}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `allocation-explanation-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    // Drawer overlay
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-xl overflow-y-auto rounded-l-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Why This Allocation?</h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                {explanation?.mode || 'Loading...'}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Loading state */}
          {isLoading && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>Loading explanation...</AlertDescription>
            </Alert>
          )}

          {/* Error state */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Content */}
          {explanation && !isLoading && (
            <>
              {/* Allocation Result */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Allocation Result</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-sm text-green-700">Allocated to:</div>
                    <div className="text-2xl font-bold text-green-900 mt-2">
                      {Array.isArray(explanation.allocationDate)
                        ? explanation.allocationDate.join(', ')
                        : explanation.allocationDate}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">Shift Duration</div>
                      <div className="font-semibold">
                        {formatDurationMinutes(explanation.systemContext?.shiftDurationMinutes || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600">Cross-midnight</div>
                      <div className="font-semibold">
                        {explanation.systemContext?.shiftIsOvernight ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Reasoning Steps */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Reasoning Steps</CardTitle>
                  <CardDescription>How this decision was made</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {explanation.reasoningSteps.map((step, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 break-words">{step}</p>
                      </div>
                      <button
                        onClick={() => handleCopyStep(step, index)}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
                        title="Copy step"
                      >
                        <Copy className="w-4 h-4 text-gray-500" />
                      </button>
                      {copiedIndex === index && (
                        <span className="text-xs text-green-600 font-medium">Copied!</span>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Metrics */}
              {explanation.metrics && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Decision Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Minutes per day */}
                    {explanation.metrics.minutesPerDay && (
                      <div className="border-b pb-4">
                        <div className="text-sm font-semibold text-gray-700 mb-2">Minutes per Calendar Day</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(explanation.metrics.minutesPerDay).map(([date, minutes]) => (
                            <div key={date} className="flex justify-between p-2 bg-gray-50 rounded">
                              <span className="text-gray-600">{date}</span>
                              <span className="font-semibold">{minutes} min</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Majority Hours */}
                    {explanation.metrics.majorityWinner && (
                      <div className="border-b pb-4">
                        <div className="text-sm font-semibold text-gray-700 mb-2">Majority Hours Analysis</div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Winner:</span>
                            <span className="font-semibold text-green-700">{explanation.metrics.majorityWinner}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Minutes:</span>
                            <span className="font-semibold">{explanation.metrics.majorityWinnerMinutes} min</span>
                          </div>
                          {explanation.metrics.runnerUpMinutes !== undefined && (
                            <div className="flex justify-between">
                              <span>Runner-up:</span>
                              <span className="font-semibold">{explanation.metrics.runnerUpMinutes} min</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Weekly Balancing */}
                    {explanation.metrics.weeklyBalancing && (
                      <div className="border-b pb-4">
                        <div className="text-sm font-semibold text-gray-700 mb-2">Weekly Balancing Context</div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Current Week Start:</span>
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                              {explanation.metrics.weeklyBalancing.currentWeekStartDate}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Current Week Remaining:</span>
                            <span className="font-semibold">
                              {formatDurationMinutes(explanation.metrics.weeklyBalancing.currentWeekRemainingMinutes)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Next Week Remaining:</span>
                            <span className="font-semibold">
                              {formatDurationMinutes(explanation.metrics.weeklyBalancing.nextWeekRemainingMinutes)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Strategy:</span>
                            <span className="text-blue-700">{explanation.metrics.weeklyBalancing.strategy}</span>
                          </div>
                          {explanation.metrics.weeklyBalancing.tieBreaker && (
                            <div className="flex justify-between">
                              <span>Tie-breaker:</span>
                              <span className="text-blue-700">{explanation.metrics.weeklyBalancing.tieBreaker}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Pay Period */}
                    {explanation.metrics.payPeriod && (
                      <div>
                        <div className="text-sm font-semibold text-gray-700 mb-2">Pay Period Definition</div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Type:</span>
                            <span className="font-semibold">{explanation.metrics.payPeriod.definitionType}</span>
                          </div>
                          {explanation.metrics.payPeriod.startDay && (
                            <div className="flex justify-between">
                              <span>Start Day:</span>
                              <span>Day {explanation.metrics.payPeriod.startDay} of month</span>
                            </div>
                          )}
                          {explanation.metrics.payPeriod.startDate && (
                            <div className="flex justify-between">
                              <span>Start Date:</span>
                              <span className="font-mono">{explanation.metrics.payPeriod.startDate}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Footer actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" size="sm" onClick={handleDownloadExplanation}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>

              {/* Metadata */}
              <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Rule Version: {explanation.ruleVersion}</span>
                  <span>Generated: {new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Format minutes as human-readable duration.
 */
function formatDurationMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
