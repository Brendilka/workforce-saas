import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('pattern_templates')
      .select(`*, details:pattern_template_details(*)`)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching pattern templates:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const name = (body?.name || '').toString().trim()
    const description = (body?.description || '').toString().trim() || null
    const details = Array.isArray(body?.details) ? body.details : []

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
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
      .insert({ tenant_id: userRecord.tenant_id, name, description })
      .select()
      .single()

    if (templateError) {
      console.error('Error creating pattern template:', templateError)
      return NextResponse.json({ error: templateError.message }, { status: 500 })
    }

    if (details.length > 0) {
      const rows = details.map((d: any) => ({
        pattern_template_id: template.id,
        day_of_week: d.day_of_week,
        shift_template_id: d.shift_template_id || null,
        start_time: d.start_time || null,
        end_time: d.end_time || null,
        spans_midnight: Boolean(d.spans_midnight),
        label: d.label || null,
      }))

      const { error: detailsError } = await supabase
        .from('pattern_template_details')
        .insert(rows)

      if (detailsError) {
        console.error('Error creating pattern template details:', detailsError)
        await supabase.from('pattern_templates').delete().eq('id', template.id)
        return NextResponse.json({ error: detailsError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, data: template })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
