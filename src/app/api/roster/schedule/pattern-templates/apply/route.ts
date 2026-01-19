import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function toDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const pattern_template_id = body?.pattern_template_id as string | undefined
    const profile_ids = Array.isArray(body?.profile_ids) ? (body.profile_ids as string[]) : []
    const start_date = body?.start_date as string | undefined
    const end_date = body?.end_date as string | undefined

    if (!pattern_template_id || profile_ids.length === 0 || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'pattern_template_id, profile_ids, start_date and end_date are required' },
        { status: 400 }
      )
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRecord } = await supabase
      .from('users')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!userRecord || !['admin', 'manager'].includes(userRecord.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: template, error: templateError } = await supabase
      .from('pattern_templates')
      .select(`id, details:pattern_template_details(*)`)
      .eq('id', pattern_template_id)
      .single()

    if (templateError || !template) {
      console.error('Error loading pattern template:', templateError)
      return NextResponse.json({ error: templateError?.message || 'Template not found' }, { status: 404 })
    }

    const details = (template as any).details as any[]
    const detailsByDow = new Map<number, any>()
    for (const d of details || []) {
      if (typeof d.day_of_week === 'number') detailsByDow.set(d.day_of_week, d)
    }

    const start = new Date(start_date)
    const end = new Date(end_date)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    const upserts: any[] = []

    for (const profile_id of profile_ids) {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay() // 0=Sun
        const detail = detailsByDow.get(dow)
        const work_date = toDate(d)

        if (!detail) continue

        upserts.push({
          tenant_id: userRecord.tenant_id,
          profile_id,
          department_id: body?.department_id || null,
          work_date,
          shift_template_id: detail.shift_template_id || null,
          start_time: detail.start_time || null,
          end_time: detail.end_time || null,
          spans_midnight: Boolean(detail.spans_midnight),
          source_pattern_template_id: pattern_template_id,
          is_locked: false,
          comment: null,
        })
      }
    }

    if (upserts.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const { data, error } = await supabase
      .from('schedule_shifts')
      .upsert(upserts, { onConflict: 'profile_id,work_date' })
      .select('id')

    if (error) {
      console.error('Error applying pattern template:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
