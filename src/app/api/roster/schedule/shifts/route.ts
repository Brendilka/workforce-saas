import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const normalizeTimeOrNull = (value: unknown) => {
  const v = (value ?? '').toString().trim()
  return v ? v : null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const locationId = searchParams.get('locationId')

    if (!fromDate || !toDate) {
      return NextResponse.json({ error: 'fromDate and toDate are required' }, { status: 400 })
    }

    let query = supabase
      .from('schedule_shifts')
      .select(
        `
        *,
        employee:profiles(id, first_name, last_name, department_id),
        template:shift_templates(id, name, start_time, end_time, spans_midnight)
        `
      )
      .gte('work_date', fromDate)
      .lte('work_date', toDate)
      .order('work_date', { ascending: true })

    if (locationId) {
      query = query.eq('department_id', locationId)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error fetching schedule shifts:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const shifts = body?.shifts
    if (!Array.isArray(shifts)) {
      return NextResponse.json({ error: 'shifts must be an array' }, { status: 400 })
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

    const normalized = shifts.map((s: any) => ({
      id: s.id || undefined,
      tenant_id: userRecord.tenant_id,
      profile_id: s.profile_id,
      department_id: s.department_id || null,
      work_date: s.work_date,
      start_time: normalizeTimeOrNull(s.start_time),
      end_time: normalizeTimeOrNull(s.end_time),
      spans_midnight: Boolean(s.spans_midnight),
      shift_template_id: s.shift_template_id || null,
      source_pattern_template_id: s.source_pattern_template_id || null,
      is_locked: Boolean(s.is_locked),
      comment: (s.comment ?? null) as string | null,
      updated_at: new Date().toISOString(),
    }))

    const { data, error } = await supabase
      .from('schedule_shifts')
      .upsert(normalized, { onConflict: 'profile_id,work_date' })
      .select(
        `
        *,
        employee:profiles(id, first_name, last_name, department_id),
        template:shift_templates(id, name, start_time, end_time, spans_midnight)
        `
      )

    if (error) {
      console.error('Error upserting schedule shifts:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const ids = searchParams.get('ids')?.split(',').filter(Boolean)
    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: 'ids parameter is required' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRecord } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userRecord || !['admin', 'manager'].includes(userRecord.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase.from('schedule_shifts').delete().in('id', ids)
    if (error) {
      console.error('Error deleting schedule shifts:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
