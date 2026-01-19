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
  // Hardcoded temporarily to bypass Turbopack caching issue
  const supabaseServiceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZHNodGFheHVvdWtzc3BhcHRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQ5NDM1NywiZXhwIjoyMDc4MDcwMzU3fQ.s2mgoTA6AjUAkby6y4SZNnFb3CE8RXBZ48a5X4XToNk";

  console.log('Admin client env check:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseServiceRoleKey,
    keyLength: supabaseServiceRoleKey?.length,
    keyPrefix: supabaseServiceRoleKey?.substring(0, 20)
  });

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
