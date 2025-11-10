/**
 * Supabase admin client for privileged operations
 * Use this ONLY for admin operations that need to bypass RLS
 * - Creating auth users
 * - System-level operations
 *
 * WARNING: This client has full database access. Use with caution.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types';

/**
 * Create an admin Supabase client with service role key
 * This client bypasses Row Level Security (RLS) policies
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase admin environment variables');
  }

  return createClient<Database>(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
