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
  {
    value: 'FIXED_ROSTER_DAY',
    label: 'Fixed Anchor Date',
    description: 'Use a fixed date (e.g., always end day, always previous day)',
  },
  {
    value: 'WEEKLY_BALANCING',
    label: 'Weekly Balancing',
    description: 'Allocate based on weekly hour balancing and pay period rules',
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
        {mode === 'FIXED_ROSTER_DAY' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-sm">Fixed Anchor Configuration</h3>
            <div>
              <Label htmlFor="fixed-anchor" className="text-sm font-medium">
                Anchor Date
              </Label>
              <Select
                value={params.fixedAllocationAnchor || ''}
                onValueChange={(value) => updateParam('fixedAllocationAnchor', value as FixedAnchor)}
              >
                <option value="" disabled>
                  Select anchor date...
                </option>
                {FIXED_ANCHORS.map((anchor) => (
                  <option key={anchor.value} value={anchor.value}>
                    {anchor.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}
        
        {mode === 'WEEKLY_BALANCING' && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-sm text-blue-900">
              Weekly Balancing Configuration
            </h3>
            <p className="text-xs text-blue-800">
              Configure parameters for intelligent weekly hour balancing.
            </p>
            
            {/* Step 1: Week Start Day */}
            <div>
              <Label htmlFor="week-start" className="text-sm font-medium block">
                Week Starts On
              </Label>
              <Select
                value={params.weekStartDay || ''}
                onValueChange={(value) => updateParam('weekStartDay', value as WeekStartDay)}
              >
                <option value="" disabled>
                  Select week start day...
                </option>
                {WEEK_START_DAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </Select>
            </div>
            
            {params.weekStartDay && (
              <>
                {/* Step 2: Weekly Hours Threshold */}
                <div>
                  <Label htmlFor="weekly-hours" className="text-sm font-medium block">
                    Weekly Ordinary Hours Threshold (minutes)
                  </Label>
                  <p className="text-xs text-gray-600 mb-1">
                    Default: 2280 (38 hours), 2400 (40 hours)
                  </p>
                  <Input
                    id="weekly-hours"
                    type="number"
                    min={1}
                    step={15}
                    value={params.weeklyOrdinaryHoursThresholdMinutes || ''}
                    onChange={(e) =>
                      updateParam('weeklyOrdinaryHoursThresholdMinutes', parseInt(e.target.value) || 0)
                    }
                    placeholder="e.g. 2280"
                  />
                </div>
              </>
            )}
            
            {params.weeklyOrdinaryHoursThresholdMinutes && (
              <>
                {/* Step 3: Balancing Strategy */}
                <div>
                  <Label className="text-sm font-medium block">Balancing Strategy</Label>
                  <div className="space-y-2">
                    {BALANCING_STRATEGIES.map((strategy) => (
                      <div key={strategy.value} className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="balancing-strategy"
                          value={strategy.value}
                          checked={params.balancingStrategy === strategy.value}
                          onChange={() => updateParam('balancingStrategy', strategy.value)}
                          className="mt-1"
                        />
                        <div>
                          <p className="text-sm font-medium">{strategy.label}</p>
                          <p className="text-xs text-gray-600">{strategy.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            
            {params.balancingStrategy && (
              <>
                {/* Step 4: Eligibility Rule */}
                <div>
                  <Label className="text-sm font-medium block">Shift Eligibility</Label>
                  <div className="space-y-2">
                    {ELIGIBILITY_RULES.map((rule) => (
                      <div key={rule.value} className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="eligibility-rule"
                          value={rule.value}
                          checked={params.eligibilityRule === rule.value || (!params.eligibilityRule && rule.value === 'CROSS_MIDNIGHT_ONLY')}
                          onChange={() => updateParam('eligibilityRule', rule.value)}
                          className="mt-1"
                        />
                        <div>
                          <p className="text-sm font-medium">{rule.label}</p>
                          <p className="text-xs text-gray-600">{rule.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            
            {params.eligibilityRule !== undefined && (
              <>
                {/* Step 5: Tie Breaker Rule */}
                <div>
                  <Label className="text-sm font-medium block">Tie-Breaker</Label>
                  <div className="space-y-2">
                    {TIE_BREAKER_RULES.map((rule) => (
                      <div key={rule.value} className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="tie-breaker"
                          value={rule.value}
                          checked={params.tieBreakerRule === rule.value}
                          onChange={() => updateParam('tieBreakerRule', rule.value)}
                          className="mt-1"
                        />
                        <p className="text-sm font-medium">{rule.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            
            {params.tieBreakerRule && (
              <>
                {/* Step 6: Pay Period Definition */}
                <div>
                  <Label className="text-sm font-medium block">Pay Period Definition</Label>
                  <div className="space-y-3">
                    {PAY_PERIOD_TYPES.map((type) => {
                      // Disable INHERIT_PAYROLL_CALENDAR if no calendar configured
                      const isDisabled = type.value === 'INHERIT_PAYROLL_CALENDAR' && !hasPayrollCalendarConfigured;
                      
                      return (
                        <div key={type.value} className="relative">
                          <label className={`flex items-start gap-2 p-2 rounded cursor-pointer ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <input
                              type="radio"
                              name="pay-period-type"
                              value={type.value}
                              checked={params.payPeriodDefinitionType === type.value}
                              onChange={() => updateParam('payPeriodDefinitionType', type.value)}
                              disabled={isDisabled}
                              className="mt-1"
                            />
                            <div>
                              <p className="text-sm font-medium">{type.label}</p>
                              <p className="text-xs text-gray-600">{type.description}</p>
                            </div>
                          </label>
                          {isDisabled && (
                            <p className="text-xs text-red-600 ml-6 mt-1">
                              (Requires payroll calendar configuration)
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
            
            {/* Pay Period Specific Fields */}
            {params.payPeriodDefinitionType === 'PAY_PERIOD_START_DAY' && (
              <div>
                <Label htmlFor="pay-period-day" className="text-sm font-medium block">
                  Pay Period Starts On
                </Label>
                <Select
                  value={params.payPeriodStartDay || ''}
                  onValueChange={(value) => updateParam('payPeriodStartDay', value as WeekStartDay)}
                >
                  <option value="" disabled>
                    Select day...
                  </option>
                  {WEEK_START_DAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            
            {params.payPeriodDefinitionType === 'PAY_PERIOD_START_DATE' && (
              <div>
                <Label htmlFor="pay-period-date" className="text-sm font-medium block">
                  Pay Period Starts On (Calendar Date)
                </Label>
                <Input
                  id="pay-period-date"
                  type="date"
                  value={params.payPeriodStartDate || ''}
                  onChange={(e) => updateParam('payPeriodStartDate', e.target.value)}
                />
              </div>
            )}
            
            {!isComplete && (
              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <p className="text-xs text-amber-800 ml-2">
                  Complete all required fields above to enable saving. ({Object.values(params).filter(Boolean).length} of {5} configured)
                </p>
              </Alert>
            )}
          </div>
        )}
        
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
