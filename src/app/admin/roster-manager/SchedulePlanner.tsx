'use client'

import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { toast } from 'sonner'
import { Calendar, Building2, Copy, ClipboardPaste, Trash2, Plus, Lock, LayoutGrid, GanttChartSquare } from 'lucide-react'

async function readErrorPayload(res: Response): Promise<string> {
  try {
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const json = await res.json().catch(() => null)
      const msg = json?.error || json?.message || JSON.stringify(json)
      return typeof msg === 'string' ? msg : JSON.stringify(msg)
    }
    return await res.text()
  } catch {
    return ''
  }
}

interface Employee {
  id: string
  first_name: string
  last_name: string
  department_id: string | null
}

interface ShiftTemplate {
  id: string
  name: string
  start_time: string
  end_time: string
  spans_midnight: boolean
}

interface ScheduleShift {
  id?: string
  profile_id: string
  department_id: string | null
  work_date: string
  start_time: string | null
  end_time: string | null
  spans_midnight: boolean
  shift_template_id: string | null
  source_pattern_template_id: string | null
  is_locked: boolean
  comment: string | null
  employee?: Employee
  template?: ShiftTemplate
}

interface SchedulePlannerProps {
  locations: Array<{ id: string; name: string }>
  selectedLocation: string
  onSelectedLocationChange: (value: string) => void
  startDate: string
  endDate: string
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
}

function toYMD(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function minutesFromHHMM(t: string) {
  const [h, m] = t.split(':').map((x) => Number(x))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return h * 60 + m
}

export default function SchedulePlanner({
  locations,
  selectedLocation,
  onSelectedLocationChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: SchedulePlannerProps) {
  const [loading, setLoading] = useState(false)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set())

  const [shifts, setShifts] = useState<ScheduleShift[]>([])
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([])

  const [viewBy, setViewBy] = useState<'employee' | 'job'>('employee')
  const [viewType, setViewType] = useState<'tabular' | 'gantt'>('tabular')

  const [quickAction, setQuickAction] = useState<'none' | 'insertTemplate' | 'copy' | 'paste' | 'delete' | 'lock'>('none')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [copiedShift, setCopiedShift] = useState<ScheduleShift | null>(null)

  const [showTemplateCreate, setShowTemplateCreate] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ name: '', start_time: '08:00', end_time: '16:00', spans_midnight: false })

  const [editingCell, setEditingCell] = useState<{ profileId: string; date: string } | null>(null)
  const editingKey = editingCell ? `${editingCell.profileId}|${editingCell.date}` : null

  const [columnVisibility, setColumnVisibility] = useState({ showTime: true, showTemplateName: true, showLock: true })
  const [showColumnMenu, setShowColumnMenu] = useState(false)

  const dateColumns = useMemo(() => {
    const dates: string[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0])
    }
    return dates
  }, [startDate, endDate])

  const fetchEmployees = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedLocation) params.set('locationId', selectedLocation)
      const res = await fetch(`/api/roster/schedule/employees?${params.toString()}`)
      if (!res.ok) {
        const msg = await readErrorPayload(res)
        throw new Error(msg || `Failed to fetch employees (${res.status})`)
      }
      const data = await res.json()
      setEmployees(data)
      setSelectedEmployeeIds(new Set(data.map((e: Employee) => e.id)))
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Failed to load employees')
    }
  }

  const fetchShiftTemplates = async () => {
    try {
      const res = await fetch('/api/roster/schedule/shift-templates')
      if (!res.ok) {
        const msg = await readErrorPayload(res)
        throw new Error(msg || `Failed to fetch shift templates (${res.status})`)
      }
      setShiftTemplates(await res.json())
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Failed to load shift templates')
    }
  }

  const fetchShifts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ fromDate: startDate, toDate: endDate })
      if (selectedLocation) params.set('locationId', selectedLocation)
      const res = await fetch(`/api/roster/schedule/shifts?${params.toString()}`)
      if (!res.ok) {
        const msg = await readErrorPayload(res)
        throw new Error(msg || `Failed to fetch shifts (${res.status})`)
      }
      setShifts(await res.json())
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Failed to load schedule shifts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
    fetchShiftTemplates()
  }, [selectedLocation])

  useEffect(() => {
    fetchShifts()
  }, [selectedLocation, startDate, endDate])

  const employeeName = (e: Employee) => `${e.last_name}, ${e.first_name}`

  const getShift = (profileId: string, date: string) => {
    return shifts.find((s) => s.profile_id === profileId && s.work_date === date)
  }

  const upsertShift = async (draft: ScheduleShift) => {
    try {
      const res = await fetch('/api/roster/schedule/shifts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shifts: [draft] }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to save shift')

      const saved = (json.data?.[0] || null) as ScheduleShift | null
      if (saved) {
        setShifts((prev) => {
          const others = prev.filter((p) => !(p.profile_id === saved.profile_id && p.work_date === saved.work_date))
          return [...others, saved]
        })
      }
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Failed to save shift')
      throw e
    }
  }

  const deleteShift = async (shift: ScheduleShift) => {
    if (!shift.id) return
    try {
      const res = await fetch(`/api/roster/schedule/shifts?ids=${encodeURIComponent(shift.id)}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to delete shift')
      setShifts((prev) => prev.filter((p) => p.id !== shift.id))
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Failed to delete shift')
    }
  }

  const applyTemplateToCell = async (profileId: string, date: string, templateId: string) => {
    const template = shiftTemplates.find((t) => t.id === templateId)
    if (!template) {
      toast.error('Select a shift template first')
      return
    }

    const existing = getShift(profileId, date)
    if (existing?.is_locked) {
      toast.error('Shift is locked')
      return
    }

    await upsertShift({
      id: existing?.id,
      profile_id: profileId,
      department_id: selectedLocation || existing?.department_id || null,
      work_date: date,
      shift_template_id: template.id,
      start_time: template.start_time,
      end_time: template.end_time,
      spans_midnight: template.spans_midnight,
      source_pattern_template_id: existing?.source_pattern_template_id || null,
      is_locked: existing?.is_locked || false,
      comment: existing?.comment || null,
    })
  }

  const handleCellClick = async (profileId: string, date: string) => {
    const existing = getShift(profileId, date)

    if (quickAction === 'insertTemplate') {
      if (!selectedTemplateId) {
        toast.error('Select a shift template')
        return
      }
      await applyTemplateToCell(profileId, date, selectedTemplateId)
      return
    }

    if (quickAction === 'copy') {
      if (!existing) {
        toast.error('Nothing to copy')
        return
      }
      setCopiedShift(existing)
      setQuickAction('paste')
      toast.message('Copied. Select a target cell to paste.')
      return
    }

    if (quickAction === 'paste') {
      if (!copiedShift) {
        toast.error('Nothing copied')
        setQuickAction('none')
        return
      }
      if (existing?.is_locked) {
        toast.error('Shift is locked')
        return
      }
      await upsertShift({
        id: existing?.id,
        profile_id: profileId,
        department_id: selectedLocation || existing?.department_id || null,
        work_date: date,
        shift_template_id: copiedShift.shift_template_id,
        start_time: copiedShift.start_time,
        end_time: copiedShift.end_time,
        spans_midnight: copiedShift.spans_midnight,
        source_pattern_template_id: copiedShift.source_pattern_template_id,
        is_locked: existing?.is_locked || false,
        comment: copiedShift.comment,
      })
      setQuickAction('none')
      return
    }

    if (quickAction === 'delete') {
      if (!existing) return
      if (existing.is_locked) {
        toast.error('Shift is locked')
        return
      }
      await deleteShift(existing)
      return
    }

    if (quickAction === 'lock') {
      if (!existing) return
      await upsertShift({
        id: existing.id,
        profile_id: existing.profile_id,
        department_id: existing.department_id,
        work_date: existing.work_date,
        shift_template_id: existing.shift_template_id,
        start_time: existing.start_time,
        end_time: existing.end_time,
        spans_midnight: existing.spans_midnight,
        source_pattern_template_id: existing.source_pattern_template_id,
        is_locked: !existing.is_locked,
        comment: existing.comment,
      })
      return
    }

    // default: select
  }

  const openEdit = (profileId: string, date: string) => {
    setEditingCell({ profileId, date })
  }

  const closeEdit = () => {
    setEditingCell(null)
  }

  const setPreset = (preset: 'thisWeek' | 'twoWeeks' | 'month') => {
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay() + 1)

    if (preset === 'thisWeek') {
      onStartDateChange(toYMD(weekStart))
      onEndDateChange(toYMD(addDays(weekStart, 6)))
      return
    }

    if (preset === 'twoWeeks') {
      onStartDateChange(toYMD(weekStart))
      onEndDateChange(toYMD(addDays(weekStart, 13)))
      return
    }

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    onStartDateChange(toYMD(monthStart))
    onEndDateChange(toYMD(monthEnd))
  }

  const toggleSelectAll = () => {
    if (selectedEmployeeIds.size === employees.length) {
      setSelectedEmployeeIds(new Set())
    } else {
      setSelectedEmployeeIds(new Set(employees.map((e) => e.id)))
    }
  }

  const toggleSelectEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const createShiftTemplate = async () => {
    const name = newTemplate.name.trim()
    if (!name) {
      toast.error('Template name is required')
      return
    }

    try {
      const res = await fetch('/api/roster/schedule/shift-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to create template')

      toast.success('Shift template created')
      setShowTemplateCreate(false)
      setNewTemplate({ name: '', start_time: '08:00', end_time: '16:00', spans_midnight: false })
      await fetchShiftTemplates()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Failed to create template')
    }
  }

  const renderShiftText = (shift: ScheduleShift) => {
    const parts: string[] = []
    if (columnVisibility.showTemplateName) {
      if (shift.template?.name) parts.push(shift.template.name)
      else if (shift.shift_template_id) parts.push('Template')
    }

    if (columnVisibility.showTime) {
      const st = shift.start_time || shift.template?.start_time
      const en = shift.end_time || shift.template?.end_time
      if (st && en) parts.push(`${st} - ${en}${shift.spans_midnight ? ' (+1)' : ''}`)
    }

    return parts.join(' • ')
  }

  const renderGanttBar = (shift: ScheduleShift) => {
    const st = shift.start_time || shift.template?.start_time
    const en = shift.end_time || shift.template?.end_time
    if (!st || !en) return null

    const startMin = minutesFromHHMM(st)
    let endMin = minutesFromHHMM(en)
    if (shift.spans_midnight) endMin += 24 * 60

    const leftPct = Math.max(0, Math.min(100, (startMin / (24 * 60)) * 100))
    const widthPct = Math.max(1, Math.min(100 - leftPct, ((endMin - startMin) / (24 * 60)) * 100))

    return (
      <div className="relative h-5 w-full rounded bg-gray-100">
        <div
          className="absolute top-0 h-5 rounded bg-blue-600"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          title={renderShiftText(shift)}
        />
      </div>
    )
  }

  const sortedEmployees = useMemo(() => {
    if (viewBy === 'employee') {
      return [...employees].sort((a, b) => employeeName(a).localeCompare(employeeName(b)))
    }

    // By Job is not yet modeled; fallback to employee order
    return [...employees].sort((a, b) => employeeName(a).localeCompare(employeeName(b)))
  }, [employees, viewBy])

  const navigateFromCell = (profileId: string, date: string, dRow: number, dCol: number) => {
    const rowIndex = sortedEmployees.findIndex((e) => e.id === profileId)
    const colIndex = dateColumns.findIndex((d) => d === date)
    if (rowIndex === -1 || colIndex === -1) return

    const nextRow = rowIndex + dRow
    const nextCol = colIndex + dCol
    if (nextRow < 0 || nextRow >= sortedEmployees.length) return
    if (nextCol < 0 || nextCol >= dateColumns.length) return

    const nextEmployee = sortedEmployees[nextRow]
    const nextDate = dateColumns[nextCol]
    if (!selectedEmployeeIds.has(nextEmployee.id)) return

    setEditingCell({ profileId: nextEmployee.id, date: nextDate })
  }

  const cellClass = (shift?: ScheduleShift) => {
    if (shift?.is_locked) return 'bg-gray-50'
    return ''
  }

  return (
    <div className="flex-1 overflow-hidden">
      {/* Schedule Planner Toolbar */}
      <div className="border-b bg-white px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-500" />
            <select
              value={selectedLocation}
              onChange={(e) => onSelectedLocationChange(e.target.value)}
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

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <select
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              onChange={(e) => setPreset(e.target.value as any)}
              defaultValue=""
            >
              <option value="" disabled>
                Time period
              </option>
              <option value="thisWeek">This week</option>
              <option value="twoWeeks">Two weeks</option>
              <option value="month">This month</option>
            </select>

            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">View:</span>
            <select
              value={viewBy}
              onChange={(e) => setViewBy(e.target.value as any)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="employee">By Employee</option>
              <option value="job">By Job</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewType('tabular')}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium border ${
                viewType === 'tabular'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Tabular
            </button>
            <button
              onClick={() => setViewType('gantt')}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium border ${
                viewType === 'gantt'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <GanttChartSquare className="h-4 w-4" />
              Gantt
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowColumnMenu((v) => !v)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Column Selection
            </button>
            {showColumnMenu && (
              <div className="absolute left-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-lg z-10">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={columnVisibility.showTemplateName}
                    onChange={(e) =>
                      setColumnVisibility((prev) => ({ ...prev, showTemplateName: e.target.checked }))
                    }
                  />
                  Template name
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={columnVisibility.showTime}
                    onChange={(e) => setColumnVisibility((prev) => ({ ...prev, showTime: e.target.checked }))}
                  />
                  Shift time
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={columnVisibility.showLock}
                    onChange={(e) => setColumnVisibility((prev) => ({ ...prev, showLock: e.target.checked }))}
                  />
                  Lock indicator
                </label>
              </div>
            )}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Shift Template</option>
                {shiftTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.start_time}-{t.end_time}{t.spans_midnight ? '+1' : ''})
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowTemplateCreate(true)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => setQuickAction((a) => (a === 'insertTemplate' ? 'none' : 'insertTemplate'))}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border ${
                quickAction === 'insertTemplate'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Insert Shift Template"
            >
              Insert Shift Template
            </button>

            <button
              onClick={() => {
                setQuickAction('copy')
                setCopiedShift(null)
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium border ${
                quickAction === 'copy'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Copy"
            >
              <Copy className="h-4 w-4" />
              Copy
            </button>

            <button
              onClick={() => {
                if (!copiedShift) {
                  toast.error('Copy a shift first')
                  return
                }
                setQuickAction('paste')
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium border ${
                quickAction === 'paste'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Paste"
            >
              <ClipboardPaste className="h-4 w-4" />
              Paste
            </button>

            <button
              onClick={() => setQuickAction((a) => (a === 'delete' ? 'none' : 'delete'))}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium border ${
                quickAction === 'delete'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>

            <button
              onClick={() => setQuickAction((a) => (a === 'lock' ? 'none' : 'lock'))}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium border ${
                quickAction === 'lock'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Lock / Unlock"
            >
              <Lock className="h-4 w-4" />
              Lock/Unlock
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-gray-500">Loading schedule...</div>
          </div>
        ) : employees.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500">No employees found</p>
              <p className="text-sm text-gray-400 mt-2">Check your location filter</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse bg-white shadow-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 z-20 bg-gray-50 border border-gray-200 px-3 py-3 text-left text-sm font-semibold text-gray-900">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.size === employees.length}
                        onChange={toggleSelectAll}
                      />
                      <span>Employee</span>
                    </div>
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
                </tr>
              </thead>
              <tbody>
                {sortedEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white border border-gray-200 px-3 py-3 text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedEmployeeIds.has(emp.id)}
                          onChange={() => toggleSelectEmployee(emp.id)}
                        />
                        <span>{employeeName(emp)}</span>
                      </div>
                    </td>
                    {dateColumns.map((date) => {
                      const shift = getShift(emp.id, date)
                      const isEditing = editingKey === `${emp.id}|${date}`

                      return (
                        <td
                          key={date}
                          className={`border border-gray-200 px-2 py-2 align-top ${cellClass(shift)}`}
                          onClick={async () => {
                            if (!selectedEmployeeIds.has(emp.id)) return
                            await handleCellClick(emp.id, date)
                          }}
                          onDoubleClick={() => {
                            if (!selectedEmployeeIds.has(emp.id)) return
                            if (shift?.is_locked) return
                            openEdit(emp.id, date)
                          }}
                        >
                          {isEditing ? (
                            <CellEditor
                              employee={emp}
                              date={date}
                              existingShift={shift || null}
                              templates={shiftTemplates}
                              selectedLocation={selectedLocation}
                              onCancel={closeEdit}
                              onSave={async (draft) => {
                                await upsertShift(draft)
                                closeEdit()
                              }}
                                onSaveAndNavigate={async (draft, dRow, dCol) => {
                                  await upsertShift(draft)
                                  navigateFromCell(emp.id, date, dRow, dCol)
                                }}
                            />
                          ) : viewType === 'gantt' ? (
                            shift ? (
                              <div className="space-y-1">
                                {renderGanttBar(shift)}
                                <div className="text-xs text-gray-700 truncate">
                                  {columnVisibility.showLock && shift.is_locked ? 'Locked • ' : ''}
                                  {renderShiftText(shift) || '—'}
                                </div>
                              </div>
                            ) : (
                              <div className="h-10"></div>
                            )
                          ) : (
                            <div className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-gray-100">
                              {shift ? (
                                <>
                                  {columnVisibility.showLock && shift.is_locked && (
                                    <span className="mr-2 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
                                      Locked
                                    </span>
                                  )}
                                  <span className="text-gray-800">{renderShiftText(shift) || '—'}</span>
                                </>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create template modal */}
      {showTemplateCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6">
            <h2 className="text-xl font-bold mb-4">Create Shift Template</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start</label>
                  <input
                    type="time"
                    value={newTemplate.start_time}
                    onChange={(e) => setNewTemplate((p) => ({ ...p, start_time: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End</label>
                  <input
                    type="time"
                    value={newTemplate.end_time}
                    onChange={(e) => setNewTemplate((p) => ({ ...p, end_time: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newTemplate.spans_midnight}
                  onChange={(e) => setNewTemplate((p) => ({ ...p, spans_midnight: e.target.checked }))}
                />
                Spans midnight
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowTemplateCreate(false)
                  setNewTemplate({ name: '', start_time: '08:00', end_time: '16:00', spans_midnight: false })
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button onClick={createShiftTemplate} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CellEditor({
  employee,
  date,
  existingShift,
  templates,
  selectedLocation,
  onCancel,
  onSave,
  onSaveAndNavigate,
}: {
  employee: Employee
  date: string
  existingShift: ScheduleShift | null
  templates: ShiftTemplate[]
  selectedLocation: string
  onCancel: () => void
  onSave: (draft: ScheduleShift) => Promise<void>
  onSaveAndNavigate: (draft: ScheduleShift, dRow: number, dCol: number) => Promise<void>
}) {
  const [templateId, setTemplateId] = useState<string>(existingShift?.shift_template_id || '')
  const [startTime, setStartTime] = useState<string>(existingShift?.start_time || existingShift?.template?.start_time || '08:00')
  const [endTime, setEndTime] = useState<string>(existingShift?.end_time || existingShift?.template?.end_time || '16:00')
  const [spansMidnight, setSpansMidnight] = useState<boolean>(existingShift?.spans_midnight || false)
  const [comment, setComment] = useState<string>(existingShift?.comment || '')

  useEffect(() => {
    const t = templates.find((x) => x.id === templateId)
    if (!t) return
    setStartTime(t.start_time)
    setEndTime(t.end_time)
    setSpansMidnight(Boolean(t.spans_midnight))
  }, [templateId, templates])

  const buildDraft = (): ScheduleShift => ({
    id: existingShift?.id,
    profile_id: employee.id,
    department_id: selectedLocation || existingShift?.department_id || employee.department_id || null,
    work_date: date,
    shift_template_id: templateId || null,
    start_time: startTime || null,
    end_time: endTime || null,
    spans_midnight: spansMidnight,
    source_pattern_template_id: existingShift?.source_pattern_template_id || null,
    is_locked: existingShift?.is_locked || false,
    comment: comment || null,
  })

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
      return
    }

    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault()
      await onSaveAndNavigate(buildDraft(), 0, 1)
      return
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      await onSaveAndNavigate(buildDraft(), 0, 1)
      return
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      await onSaveAndNavigate(buildDraft(), 0, -1)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      await onSaveAndNavigate(buildDraft(), 1, 0)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      await onSaveAndNavigate(buildDraft(), -1, 0)
      return
    }
  }

  return (
    <div className="rounded border border-blue-500 bg-white p-2" onKeyDown={handleKeyDown}>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="col-span-2 rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">(No template)</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </div>

      <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
        <input type="checkbox" checked={spansMidnight} onChange={(e) => setSpansMidnight(e.target.checked)} />
        Spans midnight
      </label>

      <input
        type="text"
        placeholder="Comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-sm"
      />

      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onCancel} className="px-2 py-1 text-sm rounded bg-gray-200 hover:bg-gray-300">
          Cancel
        </button>
        <button
          onClick={async () => {
            await onSave(buildDraft())
          }}
          className="px-2 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Save
        </button>
      </div>
    </div>
  )
}
