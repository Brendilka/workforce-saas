import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Check if user has permission
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: userRecord } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userRecord || !['admin', 'manager'].includes(userRecord.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Delete pattern (cascade will delete details and set requirements' source_pattern_id to NULL)
    const { error } = await supabase
      .from('workload_patterns')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting pattern:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Pattern deleted successfully'
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const body = await request.json()
    
    const { 
      name, 
      location_id, 
      job_title, 
      skill_profile,
      recurrence, 
      start_date, 
      end_date,
      is_active,
      details
    } = body

    // Check if user has permission
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: userRecord } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userRecord || !['admin', 'manager'].includes(userRecord.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Update pattern
    const { data: pattern, error: patternError } = await supabase
      .from('workload_patterns')
      .update({
        name,
        location_id,
        job_title,
        skill_profile,
        recurrence,
        start_date,
        end_date,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (patternError) {
      console.error('Error updating pattern:', patternError)
      return NextResponse.json(
        { error: patternError.message },
        { status: 500 }
      )
    }

    // Update pattern details if provided
    if (details && Array.isArray(details)) {
      // Delete existing details
      await supabase
        .from('workload_pattern_details')
        .delete()
        .eq('pattern_id', id)

      // Insert new details
      if (details.length > 0) {
        const detailsWithPatternId = details.map(detail => ({
          ...detail,
          pattern_id: id
        }))

        const { error: detailsError } = await supabase
          .from('workload_pattern_details')
          .insert(detailsWithPatternId)

        if (detailsError) {
          console.error('Error updating pattern details:', detailsError)
          return NextResponse.json(
            { error: detailsError.message },
            { status: 500 }
          )
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: pattern,
      message: 'Pattern updated successfully'
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
