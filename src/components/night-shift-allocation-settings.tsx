/**
 * Night Shift Allocation Settings Component
 * 
 * UI for configuring night shift allocation rules for a roster pattern
 */

import { useState, useMemo, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type {
  AllocationMode,
  WeekStartDay,
  BalancingStrategy,
  EligibilityRule,
  TieBreakerRule,
  FixedAnchor,
  PayPeriodDefinitionType,
  FixedRosterDayParams,
  WeeklyBalancingParams,
  AllocationParams,
} from '@/lib/shift-allocation';

export interface NightShiftAllocationSettings {
  nightShiftAllocationMode: AllocationMode;
  nightShiftAllocationParams: AllocationParams;
}

interface NightShiftAllocationSettingsProps {
  settings: NightShiftAllocationSettings;
  onSettingsChange: (settings: NightShiftAllocationSettings) => void;
  hasPayrollCalendarConfigured?: boolean;
  isValidating?: boolean;
}

const ALLOCATION_MODES: { value: AllocationMode; label: string; description: string }[] = [
  {
    value: 'START_DAY',
    label: 'Start Day',
    description: 'Allocate shift to calendar date when shift begins',
  },
  {
    value: 'MAJORITY_HOURS',
    label: 'Majority of Hours',
    description: 'Allocate to the day containing the most shift hours',
  },
  {
    value: 'SPLIT_BY_DAY',
    label: 'Split by Calendar Day',
    description: 'Create separate allocations for each calendar date touched by the shift',
  },
];

const FIXED_ANCHORS: { value: FixedAnchor; label: string }[] = [
  { value: 'START_DAY', label: 'Shift Start Day' },
  { value: 'END_DAY', label: 'Shift End Day' },
  { value: 'PREVIOUS_DAY', label: 'Day Before Start' },
  { value: 'NEXT_DAY', label: 'Day After Start' },
];

const WEEK_START_DAYS: { value: WeekStartDay; label: string }[] = [
  { value: 'MON', label: 'Monday' },
  { value: 'TUE', label: 'Tuesday' },
  { value: 'WED', label: 'Wednesday' },
  { value: 'THU', label: 'Thursday' },
  { value: 'FRI', label: 'Friday' },
  { value: 'SAT', label: 'Saturday' },
  { value: 'SUN', label: 'Sunday' },
];

const BALANCING_STRATEGIES: { value: BalancingStrategy; label: string; description: string }[] = [
  {
    value: 'FILL_CURRENT_WEEK_FIRST',
    label: 'Fill Current Week First',
    description: 'Prefer allocating to the week containing the shift start date',
  },
  {
    value: 'FILL_NEXT_WEEK_FIRST',
    label: 'Fill Next Week First',
    description: 'Prefer allocating to the week containing the shift end date',
  },
];

const ELIGIBILITY_RULES: { value: EligibilityRule; label: string; description: string }[] = [
  {
    value: 'CROSS_MIDNIGHT_ONLY',
    label: 'Cross-Midnight Shifts Only',
    description: 'Only count cross-midnight shifts when computing weekly hours',
  },
  {
    value: 'ALL_SHIFTS',
    label: 'All Shifts',
    description: 'Count all shifts (including same-day shifts) when computing weekly hours',
  },
];

const TIE_BREAKER_RULES: { value: TieBreakerRule; label: string }[] = [
  { value: 'PREFER_START_DAY', label: 'Prefer Shift Start Day' },
  { value: 'PREFER_END_DAY', label: 'Prefer Shift End Day' },
];

const PAY_PERIOD_TYPES: { value: PayPeriodDefinitionType; label: string; description: string }[] = [
  {
    value: 'INHERIT_PAYROLL_CALENDAR',
    label: 'Use Payroll Calendar',
    description: 'Inherit pay period boundaries from organization payroll calendar',
  },
  {
    value: 'PAY_PERIOD_START_DAY',
    label: 'Fixed Day of Week',
    description: 'Pay period always starts on a specific day of week',
  },
  {
    value: 'PAY_PERIOD_START_DATE',
    label: 'Fixed Calendar Date',
    description: 'Pay period starts on a specific calendar date each week',
  },
];

/**
 * Check if all required params for current mode are present
 */
function areRequiredParamsComplete(mode: AllocationMode, params: AllocationParams): boolean {
  switch (mode) {
    case 'START_DAY':
    case 'MAJORITY_HOURS':
    case 'SPLIT_BY_DAY':
      return true;
    
    case 'FIXED_ROSTER_DAY':
      return !!params.fixedAllocationAnchor;
    
    case 'WEEKLY_BALANCING': {
      const hasBasic = params.weekStartDay &&
        params.weeklyOrdinaryHoursThresholdMinutes &&
        params.balancingStrategy &&
        params.tieBreakerRule &&
        params.payPeriodDefinitionType;
      
      if (!hasBasic) return false;
      
      // Check pay period specific fields
      if (params.payPeriodDefinitionType === 'PAY_PERIOD_START_DAY') {
        return !!params.payPeriodStartDay;
      }
      if (params.payPeriodDefinitionType === 'PAY_PERIOD_START_DATE') {
        return !!params.payPeriodStartDate;
      }
      
      return true;
    }
    
    default:
      return false;
  }
}

export function NightShiftAllocationSettings({
  settings,
  onSettingsChange,
  hasPayrollCalendarConfigured = false,
  isValidating = false,
}: NightShiftAllocationSettingsProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const mode = settings.nightShiftAllocationMode;
  const params = settings.nightShiftAllocationParams || {};
  
  const isComplete = useMemo(
    () => areRequiredParamsComplete(mode, params),
    [mode, params]
  );
  
  const updateParam = (key: string, value: any) => {
    const newParams = { ...params, [key]: value };
    onSettingsChange({
      nightShiftAllocationMode: mode,
      nightShiftAllocationParams: newParams,
    });
  };
  
  const handleModeChange = (newMode: AllocationMode) => {
    onSettingsChange({
      nightShiftAllocationMode: newMode,
      nightShiftAllocationParams: {}, // Reset params on mode change
    });
    setExpandedSection(null);
  };
  
  return (
    <Card className="p-6 border-2 border-gray-200">
      <div className="space-y-6">
        {/* Mode Selection */}
        <div>
          <Label className="text-base font-semibold mb-3 block">
            Night Shift Allocation Mode
          </Label>
          <p className="text-xs text-gray-500 mb-4">
            Select how cross-midnight shifts should be assigned to calendar dates for payroll and scheduling purposes.
          </p>
          
          <div className="space-y-2">
            {ALLOCATION_MODES.map((modeOption) => (
              <div
                key={modeOption.value}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  mode === modeOption.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                onClick={() => handleModeChange(modeOption.value)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="allocation-mode"
                    value={modeOption.value}
                    checked={mode === modeOption.value}
                    onChange={() => handleModeChange(modeOption.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{modeOption.label}</p>
                    <p className="text-xs text-gray-600">{modeOption.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Mode-Specific Parameters */}
        
        {/* Completion Status */}
        {mode !== 'START_DAY' && mode !== 'MAJORITY_HOURS' && mode !== 'SPLIT_BY_DAY' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50">
            <div
              className={`w-2 h-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-yellow-500'}`}
            />
            <span className="text-xs font-medium text-gray-700">
              {isComplete ? '✓ Configuration Complete' : '⚠ Incomplete Configuration'}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
