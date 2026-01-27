'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Calendar, Plus, Save, Upload, Filter, Building2 } from 'lucide-react'
import SchedulePlanner from './SchedulePlanner'

interface Location {
  id: string
  name: string
}

interface WorkloadRequirement {
  id?: string
  location_id: string | null
  job_title: string | null
  skill_profile: string | null
  requirement_date: string
  span_start: string | null
  span_end: string | null
  required_headcount: number
  required_hours: number | null
  source_pattern_id: string | null
  is_override: boolean
  is_published: boolean
  notes: string | null
}

interface WorkloadPattern {
  id: string
  name: string
  location_id: string | null
  job_title: string | null
  skill_profile: string | null
  recurrence: string
  start_date: string
  end_date: string | null
  is_active: boolean
  details: Array<{
    day_of_week: number | null
    span_start: string | null
    span_end: string | null
    required_headcount: number
    required_hours: number | null
    notes: string | null
  }>
}

interface RosterManagerClientProps {
  locations: Location[]
}

export default function RosterManagerClient({ locations }: RosterManagerClientProps) {
  const [mode, setMode] = useState<'workload' | 'schedule'>('workload')

  // Filters
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [viewMode, setViewMode] = useState<'job' | 'skill'>('job')
  const [spanType, setSpanType] = useState<'daily' | 'hourly'>('daily')
  
  // Date range (default to current week)
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - today.getDay() + 1)
    return monday.toISOString().split('T')[0]
  })
  
  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date()
    const sunday = new Date(today)
    sunday.setDate(today.getDate() - today.getDay() + 7)
    return sunday.toISOString().split('T')[0]
  })

  // Data
  const [requirements, setRequirements] = useState<WorkloadRequirement[]>([])
  const [patterns, setPatterns] = useState<WorkloadPattern[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // UI state
  const [showPatternModal, setShowPatternModal] = useState(false)
  const [showPatternsListModal, setShowPatternsListModal] = useState(false)
  const [editingCell, setEditingCell] = useState<{ rowKey: string; date: string } | null>(null)
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [patternFormData, setPatternFormData] = useState({
    name: '',
    location_id: '',
    job_title: '',
    skill_profile: '',
    recurrence: 'weekly',
    start_date: startDate,
    end_date: '',
    apply_to_dates: false,
  })

  // Fetch workload requirements
  const fetchRequirements = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        fromDate: startDate,
        toDate: endDate,
        viewMode,
      })
      
      if (selectedLocation) {
        params.append('locationId', selectedLocation)
      }

      const response = await fetch(`/api/roster/workload?${params}`)
      if (!response.ok) throw new Error('Failed to fetch workload requirements')
      
      const data = await response.json()
      setRequirements(data)
    } catch (error) {
      console.error('Error fetching requirements:', error)
      toast.error('Failed to load workload data')
    } finally {
      setLoading(false)
    }
  }

  // Fetch patterns
  const fetchPatterns = async () => {
    try {
      const params = new URLSearchParams({ isActive: 'true' })

      // Fetch all active patterns so the modal always shows everything, regardless of the current location filter
      const response = await fetch(`/api/roster/patterns?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch patterns')
      
      const data = await response.json()
      setPatterns(data)
    } catch (error) {
      console.error('Error fetching patterns:', error)
    }
  }

  useEffect(() => {
    if (mode !== 'workload') return
    fetchRequirements()
    fetchPatterns()
  }, [mode, startDate, endDate, selectedLocation, viewMode])

  // Generate date columns
  const getDateColumns = () => {
    const dates: string[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0])
    }
    
    return dates
  }

  // Group requirements by job/skill (rows)
  const getRowKeys = () => {
    const keys = new Set<string>()
    requirements.forEach(req => {
      const key = viewMode === 'job' ? req.job_title : req.skill_profile
      if (key) keys.add(key)
    })
    return Array.from(keys).sort()
  }

  // Get requirement for specific row and date
  const getRequirement = (rowKey: string, date: string): WorkloadRequirement | undefined => {
    return requirements.find(req => {
      const key = viewMode === 'job' ? req.job_title : req.skill_profile
      return key === rowKey && req.requirement_date === date
    })
  }

  // Update or create requirement
  const updateRequirement = (rowKey: string, date: string, headcount: number) => {
    const existing = getRequirement(rowKey, date)
    
    if (existing) {
      const updated = requirements.map(req =>
        req.id === existing.id
          ? { ...req, required_headcount: headcount, is_override: true }
          : req
      )
      setRequirements(updated)
    } else {
      const newReq: WorkloadRequirement = {
        location_id: selectedLocation || null,
        job_title: viewMode === 'job' ? rowKey : null,
        skill_profile: viewMode === 'skill' ? rowKey : null,
        requirement_date: date,
        span_start: null,
        span_end: null,
        required_headcount: headcount,
        required_hours: null,
        source_pattern_id: null,
        is_override: true,
        is_published: false,
        notes: null,
      }
      setRequirements([...requirements, newReq])
    }
    
    setUnsavedChanges(true)
  }

  // Create pattern
  const createPattern = async () => {
    if (!patternFormData.name.trim()) {
      toast.error('Pattern name is required')
      return
    }
    if (!patternFormData.job_title && !patternFormData.skill_profile) {
      toast.error('Either job title or skill profile is required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/roster/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...patternFormData,
          location_id: patternFormData.location_id || null,
          job_title: patternFormData.job_title || null,
          skill_profile: patternFormData.skill_profile || null,
          end_date: patternFormData.end_date || null,
          apply_to_date_range: patternFormData.apply_to_dates ? {
            start_date: patternFormData.start_date,
            end_date: patternFormData.end_date || null,
          } : null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create pattern')
      }

      toast.success('Pattern created successfully')
      setShowPatternModal(false)
      setPatternFormData({
        name: '',
        location_id: '',
        job_title: '',
        skill_profile: '',
        recurrence: 'weekly',
        start_date: startDate,
        end_date: '',
        apply_to_dates: false,
      })
      await fetchPatterns()
    } catch (error) {
      console.error('Error creating pattern:', error)
      toast.error('Failed to create pattern')
    } finally {
      setSaving(false)
    }
  }

  // Save changes
  const saveChanges = async (publish = false) => {
    setSaving(true)
    try {
      const response = await fetch('/api/roster/workload', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirements, publish }),
      })

      if (!response.ok) throw new Error('Failed to save workload')
      
      const result = await response.json()
      toast.success(result.message)
      setUnsavedChanges(false)
      
      // Refresh data
      await fetchRequirements()
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Failed to save workload')
    } finally {
      setSaving(false)
    }
  }

  // Calculate row totals
  const getRowTotal = (rowKey: string) => {
    return requirements
      .filter(req => {
        const key = viewMode === 'job' ? req.job_title : req.skill_profile
        return key === rowKey
      })
      .reduce((sum, req) => sum + req.required_headcount, 0)
  }

  // Calculate column totals
  const getColumnTotal = (date: string) => {
    return requirements
      .filter(req => req.requirement_date === date)
      .reduce((sum, req) => sum + req.required_headcount, 0)
  }

  const dateColumns = getDateColumns()
  const rowKeys = getRowKeys()

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Roster Manager</h1>
            <p className="text-sm text-gray-600">
              {mode === 'workload'
                ? 'Define workload requirements and staffing patterns'
                : 'Schedule worked and non-worked hours'}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setMode('workload')}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  mode === 'workload'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Workload Planner
              </button>
              <button
                onClick={() => setMode('schedule')}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  mode === 'schedule'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Schedule Planner
              </button>
            </div>
          </div>
          
          {mode === 'workload' && (
            <div className="flex gap-2">
              <button
                onClick={() => saveChanges(false)}
                disabled={!unsavedChanges || saving}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                Save Draft
              </button>
              <button
                onClick={() => saveChanges(true)}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Publish
              </button>
              <button
                onClick={() => setShowPatternsListModal(true)}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                <Calendar className="h-4 w-4" />
                Manage Patterns
              </button>
              <button
                onClick={() => setShowPatternModal(true)}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                <Plus className="h-4 w-4" />
                Create Pattern
              </button>
            </div>
          )}
        </div>
      </div>

      {mode === 'workload' ? (
        <>
          {/* Toolbar */}
          <div className="border-b bg-white px-6 py-3">
            <div className="flex items-center gap-4">
              {/* Location Filter */}
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All Locations</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* View Mode */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as 'job' | 'skill')}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="job">By Job</option>
                  <option value="skill">By Skill Profile</option>
                </select>
              </div>

              {/* Span Type */}
              <div className="flex items-center gap-2">
                <select
                  value={spanType}
                  onChange={(e) => setSpanType(e.target.value as 'daily' | 'hourly')}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="daily">Daily</option>
                  <option value="hourly">Hourly (coming soon)</option>
                </select>
              </div>

              {unsavedChanges && (
                <div className="ml-auto flex items-center gap-2 text-sm text-amber-600">
                  <div className="h-2 w-2 rounded-full bg-amber-600"></div>
                  Unsaved changes
                </div>
              )}
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-auto p-6">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-gray-500">Loading workload data...</div>
              </div>
            ) : rowKeys.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-500">No workload data for this period</p>
                  <p className="text-sm text-gray-400 mt-2">Create a pattern to get started</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse bg-white shadow-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                        {viewMode === 'job' ? 'Job Title' : 'Skill Profile'}
                      </th>
                      {dateColumns.map((date) => (
                        <th
                          key={date}
                          className="border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-900"
                        >
                          <div>{new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                          <div className="text-xs font-normal text-gray-600">
                            {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </th>
                      ))}
                      <th className="border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-900">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowKeys.map((rowKey) => (
                      <tr key={rowKey} className="hover:bg-gray-50">
                        <td className="sticky left-0 z-10 bg-white border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900">
                          {rowKey}
                        </td>
                        {dateColumns.map((date) => {
                          const req = getRequirement(rowKey, date)
                          const isEditing = editingCell?.rowKey === rowKey && editingCell?.date === date

                          return (
                            <td
                              key={date}
                              className={`border border-gray-200 px-2 py-2 text-center ${
                                req?.is_override ? 'bg-blue-50' : ''
                              }`}
                              onClick={() => setEditingCell({ rowKey, date })}
                            >
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="0"
                                  autoFocus
                                  value={req?.required_headcount || 0}
                                  onChange={(e) => updateRequirement(rowKey, date, parseInt(e.target.value) || 0)}
                                  onBlur={() => setEditingCell(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === 'Tab') {
                                      setEditingCell(null)
                                    }
                                  }}
                                  className="w-full rounded border border-blue-500 px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              ) : (
                                <div className="cursor-pointer text-sm hover:bg-gray-100 rounded px-2 py-1">
                                  {req?.required_headcount || 0}
                                </div>
                              )}
                            </td>
                          )
                        })}
                        <td className="border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50">
                          {getRowTotal(rowKey)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-900">
                        Total
                      </td>
                      {dateColumns.map((date) => (
                        <td
                          key={date}
                          className="border border-gray-200 px-4 py-3 text-center text-sm text-gray-900"
                        >
                          {getColumnTotal(date)}
                        </td>
                      ))}
                      <td className="border border-gray-200 px-4 py-3 text-center text-sm text-gray-900">
                        {requirements.reduce((sum, req) => sum + req.required_headcount, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <SchedulePlanner
          locations={locations}
          selectedLocation={selectedLocation}
          onSelectedLocationChange={setSelectedLocation}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
      )}

      {/* Pattern Modal */}
      {mode === 'workload' && showPatternModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create Workload Pattern</h2>
            
            <div className="space-y-4">
              {/* Pattern Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Pattern Name *</label>
                <input
                  type="text"
                  value={patternFormData.name}
                  onChange={(e) => setPatternFormData({...patternFormData, name: e.target.value})}
                  placeholder="e.g., Summer Heavy Schedule"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <select
                  value={patternFormData.location_id}
                  onChange={(e) => setPatternFormData({...patternFormData, location_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Locations</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              {/* Job Title or Skill Profile */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Job Title</label>
                  <input
                    type="text"
                    value={patternFormData.job_title}
                    onChange={(e) => setPatternFormData({...patternFormData, job_title: e.target.value, skill_profile: e.target.value ? '' : patternFormData.skill_profile})}
                    placeholder="e.g., Engineer"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Skill Profile</label>
                  <input
                    type="text"
                    value={patternFormData.skill_profile}
                    onChange={(e) => setPatternFormData({...patternFormData, skill_profile: e.target.value, job_title: e.target.value ? '' : patternFormData.job_title})}
                    placeholder="e.g., Senior"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Recurrence */}
              <div>
                <label className="block text-sm font-medium mb-1">Recurrence</label>
                <select
                  value={patternFormData.recurrence}
                  onChange={(e) => setPatternFormData({...patternFormData, recurrence: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={patternFormData.start_date}
                    onChange={(e) => setPatternFormData({...patternFormData, start_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    value={patternFormData.end_date}
                    onChange={(e) => setPatternFormData({...patternFormData, end_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Apply to Dates */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="applyToDates"
                  checked={patternFormData.apply_to_dates}
                  onChange={(e) => setPatternFormData({...patternFormData, apply_to_dates: e.target.checked})}
                  className="w-4 h-4"
                />
                <label htmlFor="applyToDates" className="text-sm">Apply pattern to all dates in range</label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowPatternModal(false)}
                disabled={saving}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={createPattern}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Pattern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patterns List Modal */}
      {mode === 'workload' && showPatternsListModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Saved Patterns</h2>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {patterns.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No patterns saved yet. Create one to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {patterns.map((pattern) => (
                    <div
                      key={pattern.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{pattern.name}</h3>
                          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Location:</span>{' '}
                              {pattern.location_id
                                ? locations.find(l => l.id === pattern.location_id)?.name || 'Unknown'
                                : 'All Locations'
                              }
                            </div>
                            <div>
                              <span className="font-medium">Job/Skill:</span>{' '}
                              {pattern.job_title || pattern.skill_profile}
                            </div>
                            <div>
                              <span className="font-medium">Recurrence:</span>{' '}
                              {pattern.recurrence}
                            </div>
                            <div>
                              <span className="font-medium">Start:</span>{' '}
                              {new Date(pattern.start_date).toLocaleDateString()}
                            </div>
                            {pattern.end_date && (
                              <div>
                                <span className="font-medium">End:</span>{' '}
                                {new Date(pattern.end_date).toLocaleDateString()}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Status:</span>{' '}
                              <span className={pattern.is_active ? 'text-green-600' : 'text-gray-400'}>
                                {pattern.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={async () => {
                              setSaving(true)
                              try {
                                const response = await fetch('/api/roster/patterns', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    ...pattern,
                                    apply_to_date_range: {
                                      start_date: startDate,
                                      end_date: endDate,
                                    },
                                  }),
                                })
                                if (!response.ok) throw new Error('Failed to apply pattern')
                                toast.success('Pattern applied to date range')
                                await fetchRequirements()
                              } catch (error) {
                                console.error('Error applying pattern:', error)
                                toast.error('Failed to apply pattern')
                              } finally {
                                setSaving(false)
                              }
                            }}
                            disabled={saving}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            Apply to Current Range
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm('Are you sure you want to delete this pattern?')) return
                              try {
                                const response = await fetch(`/api/roster/patterns/${pattern.id}`, {
                                  method: 'DELETE',
                                })
                                if (!response.ok) throw new Error('Failed to delete pattern')
                                toast.success('Pattern deleted')
                                await fetchPatterns()
                              } catch (error) {
                                console.error('Error deleting pattern:', error)
                                toast.error('Failed to delete pattern')
                              }
                            }}
                            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end">
              <button
                onClick={() => setShowPatternsListModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
