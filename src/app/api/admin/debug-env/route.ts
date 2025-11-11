import { NextResponse } from 'next/server';
import { getUser, getUserRole } from '@/lib/supabase/server';

/**
 * Debug endpoint to check environment configuration
 * DELETE THIS FILE after debugging!
 */
export async function GET() {
  try {
    const user = await getUser();
    const role = await getUserRole();

    if (!user || role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_URL: process.env.VERCEL_URL || 'NOT SET',
      processEndpoint: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/hr-import/process`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    );
  }
}
