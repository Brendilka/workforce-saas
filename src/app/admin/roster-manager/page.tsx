import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RosterManagerClient from './RosterManagerClient'

export const metadata: Metadata = {
  title: 'Roster Manager | BDK',
  description: 'Manage workload requirements and staffing patterns',
}

export default async function RosterManagerPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single()

  if (!userRecord || !['admin', 'manager'].includes(userRecord.role)) {
    redirect('/employee/dashboard')
  }

  // Fetch locations (departments) for the filter
  const { data: locations } = await supabase
    .from('departments')
    .select('id, name')
    .eq('tenant_id', userRecord.tenant_id)
    .order('name')

  return <RosterManagerClient locations={locations || []} />
}
