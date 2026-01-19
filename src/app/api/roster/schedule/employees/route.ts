import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const locationId = searchParams.get('locationId') || null

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

    let query = supabase
      .from('profiles')
      .select('id, first_name, last_name, department_id, employment_status')
      .eq('tenant_id', userRecord.tenant_id)
      .eq('employment_status', 'active')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })

    if (locationId) {
      query = query.eq('department_id', locationId)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error fetching employees:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
