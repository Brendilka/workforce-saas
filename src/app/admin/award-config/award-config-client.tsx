"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, Settings, CheckCircle } from "lucide-react";

interface AwardConfigClientProps {
  tenantId: string;
}

export function AwardConfigClient({ tenantId }: AwardConfigClientProps) {
  const [companyDetails, setCompanyDetails] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [payCodes, setPayCodes] = useState("");
  const [policies, setPolicies] = useState("");
  const [awardTable, setAwardTable] = useState<any[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedConfig, setExtractedConfig] = useState<any>(null);
  const [foundDocuments, setFoundDocuments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const parseAwardTableFile = (file: File | null) => {
    if (!file) {
      setAwardTable(null);
      setUploadMessage(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadMessage("Only CSV uploads are supported currently. Please upload an awards table in CSV format.");
      setAwardTable(null);
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setAwardTable(results.data as any[]);
        setUploadMessage(`Loaded ${results.data.length} award table rows from ${file.name}.`);
      },
      error: (error) => {
        setAwardTable(null);
        setUploadMessage(`Failed to parse award table CSV: ${error.message}`);
      },
    });
  };

  const handleProcess = async () => {
    if (!companyDetails || !industry) {
      setError("Please provide company details and industry.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setExtractedConfig(null);

    try {
      const response = await fetch("/api/admin/award-config/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyDetails,
          industry,
          location,
          payCodes,
          policies,
          awardTable,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to process awards. Please try again.");
      } else {
        const config = data.extractedConfig || {};
        // Normalise allowances: AI may return an object instead of an array
        if (config.allowances && !Array.isArray(config.allowances)) {
          config.allowances = Object.entries(config.allowances).map(([name, amount]) => ({ name, amount }));
        }
        setExtractedConfig(config);
        setFoundDocuments(data.foundDocuments || []);
      }
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

          <div>
            <Label htmlFor="award-table">Award / EBA Table Upload (Optional)</Label>
            <input
              id="award-table"
              type="file"
              accept=".csv"
              onChange={(e) => parseAwardTableFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-700 file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-blue-700"
            />
            {uploadMessage && <p className="mt-2 text-sm text-gray-600">{uploadMessage}</p>}
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
                      <p className="font-semibold">{typeof allowance.amount === 'number' ? `$${allowance.amount.toFixed(2)}` : String(allowance.amount)}</p>
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