import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const locationId = searchParams.get('locationId')
    const isActive = searchParams.get('isActive')

    let query = supabase
      .from('workload_patterns')
      .select(`
        *,
        details:workload_pattern_details(*)
      `)
      .order('created_at', { ascending: false })

    if (locationId) {
      query = query.eq('location_id', locationId)
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching workload patterns:', error)
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { 
      name, 
      location_id, 
      job_title, 
      skill_profile,
      recurrence, 
      start_date, 
      end_date,
      details,
      apply_to_date_range
    } = body

    // Normalize empty strings to nulls for optional fields
    const normalizedLocationId = location_id || null
    const normalizedJobTitle = job_title || null
    const normalizedSkillProfile = skill_profile || null
    const normalizedEndDate = end_date || null

    // Validation
    if (!name || !recurrence || !start_date) {
      return NextResponse.json(
        { error: 'name, recurrence, and start_date are required' },
        { status: 400 }
      )
    }

    if (!job_title && !skill_profile) {
      return NextResponse.json(
        { error: 'Either job_title or skill_profile is required' },
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

    // Create pattern
    const { data: pattern, error: patternError } = await supabase
      .from('workload_patterns')
      .insert({
        tenant_id: userRecord.tenant_id,
        name,
        location_id: normalizedLocationId,
        job_title: normalizedJobTitle,
        skill_profile: normalizedSkillProfile,
        recurrence,
        start_date,
        end_date: normalizedEndDate
      })
      .select()
      .single()

    if (patternError) {
      console.error('Error creating pattern:', patternError)
      return NextResponse.json(
        { error: patternError.message },
        { status: 500 }
      )
    }

    // Create pattern details
    if (details && Array.isArray(details) && details.length > 0) {
      const detailsWithPatternId = details.map(detail => ({
        ...detail,
        pattern_id: pattern.id
      }))

      const { error: detailsError } = await supabase
        .from('workload_pattern_details')
        .insert(detailsWithPatternId)

      if (detailsError) {
        console.error('Error creating pattern details:', detailsError)
        // Rollback pattern creation
        await supabase
          .from('workload_patterns')
          .delete()
          .eq('id', pattern.id)

        return NextResponse.json(
          { error: detailsError.message },
          { status: 500 }
        )
      }
    }

    // Apply pattern to date range if requested
    if (apply_to_date_range) {
      const applyEndDate = end_date || apply_to_date_range.end_date
      
      if (applyEndDate) {
        const { error: applyError } = await supabase
          .rpc('apply_workload_pattern', {
            p_pattern_id: pattern.id,
            p_start_date: start_date,
            p_end_date: applyEndDate
          })

        if (applyError) {
          console.error('Error applying pattern:', applyError)
          // Don't fail the request, pattern is still created
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: pattern,
      message: 'Pattern created successfully'
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
