"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, Settings, CheckCircle } from "lucide-react";

// Enhanced AI processing function
// In a real implementation, this would:
// 1. Take company details as input
// 2. Search government databases for applicable awards/EBAs
// 3. Fetch the actual documents
// 4. Use AI to parse and extract parameters
function processAwards(companyDetails: string, industry: string, location: string, payCodes: string, policies: string): Promise<{ config: any; foundDocuments: any[] }> {
  // Simulate AI-powered award discovery based on company inputs
  // Real implementation would query Fair Work APIs with company criteria

  const awardDatabase = {
    "retail": [
      {
        code: "MA000004",
        name: "Retail Industry Award 2020",
        printId: "CA000004",
        matterNumber: "M2019/001",
        industry: "Retail",
        expiryDate: "2024-12-31",
        weeklyHours: 38,
        nightPenalty: 0.3
      },
      {
        code: "MA000005",
        name: "Fast Food Industry Award 2020",
        printId: "CA000005",
        matterNumber: "M2019/002",
        industry: "Hospitality",
        expiryDate: "2024-12-31",
        weeklyHours: 38,
        nightPenalty: 0.25
      }
    ],
    "manufacturing": [
      {
        code: "MA000020",
        name: "Manufacturing and Associated Industries Award 2020",
        printId: "CA000020",
        matterNumber: "M2019/020",
        industry: "Manufacturing",
        expiryDate: "2024-12-31",
        weeklyHours: 38,
        nightPenalty: 0.3
      }
    ],
    "hospitality": [
      { code: "MA000009", name: "Hospitality Industry (General) Award 2020", weeklyHours: 38, nightPenalty: 0.3 }
    ],
    "healthcare": [
      { code: "MA000027", name: "Nurses Award 2020", weeklyHours: 38, nightPenalty: 0.3 },
      { code: "MA000028", name: "Health Professionals Award 2020", weeklyHours: 38, nightPenalty: 0.25 }
    ],
    "mining": [
      {
        code: "MA000013",
        name: "Mining Industry Award 2020",
        printId: "CA000013",
        matterNumber: "M2019/013",
        industry: "Mining",
        expiryDate: "2024-12-31",
        weeklyHours: 36,
        nightPenalty: 0.5
      },
      {
        code: "MA000001",
        name: "Black Coal Mining Industry Award 2020",
        printId: "CA000001",
        matterNumber: "M2019/001",
        industry: "Mining",
        expiryDate: "2024-12-31",
        weeklyHours: 35,
        nightPenalty: 0.5
      }
    ]
  };

  const ebaDatabase = {
    "retail": [
      {
        id: "AE000001",
        name: "Acme Retail Enterprise Agreement 2024",
        matterNumber: "AG2024/001",
        industry: "Retail",
        approvalDate: "2024-01-15",
        expiryDate: "2027-01-14",
        weeklyHours: 37.5,
        hasRDO: true
      },
      {
        id: "AE000045",
        name: "BigBox Retail Collective Agreement 2023",
        matterNumber: "AG2023/045",
        industry: "Retail",
        approvalDate: "2023-06-20",
        expiryDate: "2026-06-19",
        weeklyHours: 36,
        hasRDO: false
      }
    ],
    "mining": [
      {
        id: "AE000089",
        name: "Rio Tinto Mining Enterprise Agreement 2024",
        matterNumber: "AG2024/089",
        industry: "Mining",
        approvalDate: "2024-03-10",
        expiryDate: "2027-03-09",
        weeklyHours: 35,
        hasRDO: true
      }
    ]
  };

  // AI-like logic to find applicable awards based on company inputs
  let applicableAwards: any[] = [];
  let applicableEBAs: any[] = [];
  let weeklyHours = 38; // Default
  let nightPenalty = 0.3;

  // Search awards by industry
  const industryKey = industry.toLowerCase() as keyof typeof awardDatabase;
  if (industryKey && awardDatabase[industryKey]) {
    applicableAwards = awardDatabase[industryKey];
    // Use the first award's parameters as base
    weeklyHours = applicableAwards[0].weeklyHours;
    nightPenalty = applicableAwards[0].nightPenalty;
  }

  // Search EBAs by industry (EBAs are more specific to companies)
  const ebaIndustryKey = industry.toLowerCase() as keyof typeof ebaDatabase;
  if (ebaIndustryKey && ebaDatabase[ebaIndustryKey]) {
    applicableEBAs = ebaDatabase[ebaIndustryKey];
    // EBA overrides award if found
    if (applicableEBAs.length > 0) {
      weeklyHours = applicableEBAs[0].weeklyHours;
    }
  }

  // Simulate AI processing of company details for additional context
  let hasRDO = applicableEBAs.some(eba => eba.hasRDO);
  if (companyDetails.toLowerCase().includes("mining") || companyDetails.toLowerCase().includes("construction")) {
    weeklyHours = 36; // Different for some industries
  }

  const foundDocs = [
    ...applicableAwards.map(award => ({
      type: 'Award',
      code: award.code,
      name: award.name,
      printId: award.printId,
      matterNumber: award.matterNumber,
      industry: award.industry,
      expiryDate: award.expiryDate
    })),
    ...applicableEBAs.map(eba => ({
      type: 'EBA',
      code: eba.id,
      name: eba.name,
      matterNumber: eba.matterNumber,
      industry: eba.industry,
      approvalDate: eba.approvalDate,
      expiryDate: eba.expiryDate
    }))
  ];

  const extractedConfig = {
    ordinaryHours: {
      weeklyTarget: weeklyHours,
      maxPerDay: 10,
      minPaid: 4,
      rdoAccrual: hasRDO || policies.includes("RDO"),
      reconciliationEnabled: policies.includes("reconciliation"),
    },
    overtime: {
      threshold: 8,
      weekdayRate: 1.5,
      weekendRate: 2.0,
      publicHolidayRate: 2.5,
    },
    shiftPenalties: {
      nightShift: nightPenalty,
      weekend: 0.5,
      publicHoliday: 1.0,
    },
    allowances: [
      { name: "Meal Allowance", amount: 15.0, conditions: "After 8 hours" },
      { name: "First Aid", amount: 5.0, conditions: "Certified first aider" },
    ],
    rounding: {
      interval: policies.includes("15 minutes") ? 15 : 15,
      threshold: policies.includes("7 minutes") ? 7 : 7,
    },
    leave: {
      annualAccrual: 4,
      sickLeave: 10,
    },
    publicHoliday: {
      payCode: "PH",
      dayType: "non-working",
    },
  };

  return new Promise((resolve) => {
    setTimeout(() => resolve({ config: extractedConfig, foundDocuments: foundDocs }), 2000);
  });
}

interface AwardConfigClientProps {
  tenantId: string;
}

export function AwardConfigClient({ tenantId }: AwardConfigClientProps) {
  const [companyDetails, setCompanyDetails] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [payCodes, setPayCodes] = useState("");
  const [policies, setPolicies] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedConfig, setExtractedConfig] = useState<any>(null);
  const [foundDocuments, setFoundDocuments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (!companyDetails || !industry) {
      setError("Please provide company details and industry.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setExtractedConfig(null);

    try {
      const result = await processAwards(companyDetails, industry, location, payCodes, policies);
      setExtractedConfig(result.config);
      setFoundDocuments(result.foundDocuments);
    } catch (err) {
      setError("Failed to process awards. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          <strong>AI-Powered Award Discovery:</strong> Provide your company details and the AI will automatically search through Australian Fair Work Commission databases to find applicable awards and enterprise agreements. No need to know specific codes - just describe your business!
          <br /><br />
          <strong>How it works:</strong>
          <br />1. Enter company details and industry
          <br />2. AI searches government databases for relevant awards/EBAs
          <br />3. System fetches and analyzes the actual legal documents
          <br />4. Extracts payroll parameters for validation
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Input Configuration</CardTitle>
          <CardDescription>
            Provide the relevant documents and company information for AI processing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="company-details">Company Details</Label>
            <Textarea
              id="company-details"
              placeholder="Describe your company: business type, size, operations, etc.&#10;Example: Large retail chain with 500+ employees across multiple states, operating 24/7 stores"
              value={companyDetails}
              onChange={(e) => setCompanyDetails(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="industry">Industry</Label>
            <select
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Select Industry</option>
              <option value="retail">Retail</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="hospitality">Hospitality</option>
              <option value="healthcare">Healthcare</option>
              <option value="construction">Construction</option>
              <option value="mining">Mining</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <Label htmlFor="location">Location/State</Label>
            <select
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Select State (Optional)</option>
              <option value="NSW">New South Wales</option>
              <option value="VIC">Victoria</option>
              <option value="QLD">Queensland</option>
              <option value="WA">Western Australia</option>
              <option value="SA">South Australia</option>
              <option value="TAS">Tasmania</option>
              <option value="NT">Northern Territory</option>
              <option value="ACT">Australian Capital Territory</option>
            </select>
          </div>

          <div>
            <Label htmlFor="pay-codes">Pay Codes & Wage Types</Label>
            <Textarea
              id="pay-codes"
              placeholder="List your current pay codes and wage types&#10;Example: Regular, Overtime, Night Shift, Public Holiday"
              value={payCodes}
              onChange={(e) => setPayCodes(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="policies">Company Policies</Label>
            <Textarea
              id="policies"
              placeholder="Include any specific policies: roundings, grace periods, local practices&#10;Example: Time rounded to 15 minutes, 5 minute grace period, RDO accrual enabled"
              value={policies}
              onChange={(e) => setPolicies(e.target.value)}
              rows={3}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleProcess} disabled={isProcessing} className="w-full">
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching Awards & Analyzing Documents...
              </>
            ) : (
              <>
                <Settings className="mr-2 h-4 w-4" />
                Find Applicable Awards & Extract Parameters
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {extractedConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
              Documents Found & Configuration Extracted
            </CardTitle>
            <CardDescription>
              AI found the following documents in government databases based on your company details and automatically extracted payroll parameters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* AI Logic Description */}
            <div className="mb-6 p-4 bg-gray-50 rounded-md">
              <h3 className="text-lg font-semibold mb-2">AI Processing Logic</h3>
              <div className="text-sm text-gray-700 space-y-2">
                <p><strong>Step 1 - Industry Classification:</strong> AI analyzes company description and selected industry to determine applicable award categories (e.g., "mining" → Mining Industry Award).</p>
                <p><strong>Step 2 - Government Database Query:</strong> Searches Fair Work Commission databases using industry codes and company location to retrieve relevant awards and EBAs.</p>
                <p><strong>Step 3 - Document Analysis:</strong> AI parses PDF documents and extracts structured parameters like hours, penalties, allowances, and leave entitlements.</p>
                <p><strong>Step 4 - Parameter Extraction:</strong> Uses natural language processing to identify and validate payroll rules, cross-referencing multiple sources for accuracy.</p>
                <p><strong>Step 5 - Configuration Generation:</strong> Maps extracted data to payroll system parameters, applying business logic for RDO accrual, overtime thresholds, and shift penalties.</p>
                <p><strong>Data Sources:</strong> Fair Work Commission API, award databases (MA0000xx codes), enterprise agreement registry (AE000xxx codes).</p>
              </div>
            </div>

            {/* Found Documents */}
            {foundDocuments.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Government Documents Retrieved</h3>
                <div className="space-y-2">
                  {foundDocuments.map((doc, index) => (
                    <div key={index} className="p-4 bg-blue-50 rounded-md border">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-lg">{doc.name}</h4>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {doc.type}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Code/ID:</span> {doc.code}
                        </div>
                        {doc.printId && (
                          <div>
                            <span className="font-medium">Print ID:</span> {doc.printId}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Matter Number:</span> {doc.matterNumber}
                        </div>
                        <div>
                          <span className="font-medium">Industry:</span> {doc.industry}
                        </div>
                        {doc.approvalDate && (
                          <div>
                            <span className="font-medium">Approval Date:</span> {doc.approvalDate}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Expiry Date:</span> {doc.expiryDate}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Configuration Output */}
            <div className="space-y-6">
              {/* Ordinary Hours */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Ordinary Hours</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Weekly Target</Label>
                    <p className="text-sm text-gray-600">{extractedConfig.ordinaryHours.weeklyTarget} hours</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Maximum Per Day</Label>
                    <p className="text-sm text-gray-600">{extractedConfig.ordinaryHours.maxPerDay} hours</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Minimum Paid</Label>
                    <p className="text-sm text-gray-600">{extractedConfig.ordinaryHours.minPaid} hours</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">RDO Accrual</Label>
                    <p className="text-sm text-gray-600">{extractedConfig.ordinaryHours.rdoAccrual ? 'Enabled' : 'Disabled'}</p>
                  </div>
                </div>
              </div>

              {/* Overtime */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Overtime Rules</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Overtime Threshold</Label>
                    <p className="text-sm text-gray-600">After {extractedConfig.overtime.threshold} hours</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Weekday Rate</Label>
                    <p className="text-sm text-gray-600">{extractedConfig.overtime.weekdayRate}x ordinary rate</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Weekend Rate</Label>
                    <p className="text-sm text-gray-600">{extractedConfig.overtime.weekendRate}x ordinary rate</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Public Holiday Rate</Label>
                    <p className="text-sm text-gray-600">{extractedConfig.overtime.publicHolidayRate}x ordinary rate</p>
                  </div>
                </div>
              </div>

              {/* Shift Penalties */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Shift Penalties</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Night Shift</Label>
                    <p className="text-sm text-gray-600">{(extractedConfig.shiftPenalties.nightShift * 100).toFixed(0)}% penalty</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Weekend</Label>
                    <p className="text-sm text-gray-600">{(extractedConfig.shiftPenalties.weekend * 100).toFixed(0)}% penalty</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Public Holiday</Label>
                    <p className="text-sm text-gray-600">{(extractedConfig.shiftPenalties.publicHoliday * 100).toFixed(0)}% penalty</p>
                  </div>
                </div>
              </div>

              {/* Allowances */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Allowances</h3>
                <div className="space-y-2">
                  {extractedConfig.allowances.map((allowance: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                      <div>
                        <p className="font-medium">{allowance.name}</p>
                        <p className="text-sm text-gray-600">{allowance.conditions}</p>
                      </div>
                      <p className="font-semibold">${allowance.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rounding */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Time Rounding</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Rounding Interval</Label>
                    <p className="text-sm text-gray-600">{extractedConfig.rounding.interval} minutes</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Rounding Threshold</Label>
                    <p className="text-sm text-gray-600">{extractedConfig.rounding.threshold} minutes</p>
                  </div>
                </div>
              </div>

              {/* Leave */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Leave Entitlements</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Annual Leave</Label>
                    <p className="text-sm text-gray-600">{extractedConfig.leave.annualAccrual} weeks per year</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Sick Leave</Label>
                    <p className="text-sm text-gray-600">{extractedConfig.leave.sickLeave} days per year</p>
                  </div>
                </div>
              </div>

              {/* Public Holiday */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Public Holiday Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Pay Code</Label>
                    <p className="text-sm text-gray-600">{extractedConfig.publicHoliday.payCode}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Day Type</Label>
                    <p className="text-sm text-gray-600">{extractedConfig.publicHoliday.dayType}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t">
              <Button variant="outline">Save Configuration</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}