import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const locationId = searchParams.get('locationId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const viewMode = searchParams.get('viewMode') || 'job' // 'job' or 'skill'

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { error: 'fromDate and toDate are required' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('workload_requirements')
      .select('*')
      .gte('requirement_date', fromDate)
      .lte('requirement_date', toDate)
      .order('requirement_date', { ascending: true })

    if (locationId) {
      query = query.eq('location_id', locationId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching workload requirements:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { requirements, publish } = body

    if (!Array.isArray(requirements)) {
      return NextResponse.json(
        { error: 'requirements must be an array' },
        { status: 400 }
      )
    }

    // Get current user's tenant_id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: userRecord } = await supabase
      .from('users')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!userRecord || !['admin', 'manager'].includes(userRecord.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Upsert all requirements
    const requirementsWithTenant = requirements.map(req => ({
      ...req,
      tenant_id: userRecord.tenant_id,
      is_published: publish || req.is_published || false,
      updated_at: new Date().toISOString()
    }))

    const { data, error } = await supabase
      .from('workload_requirements')
      .upsert(requirementsWithTenant, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select()

    if (error) {
      console.error('Error upserting workload requirements:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      data,
      message: publish ? 'Workload published successfully' : 'Workload saved successfully'
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const ids = searchParams.get('ids')?.split(',')

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids parameter is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('workload_requirements')
      .delete()
      .in('id', ids)

    if (error) {
      console.error('Error deleting workload requirements:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
