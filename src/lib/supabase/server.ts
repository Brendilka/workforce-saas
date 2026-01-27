/**
 * Supabase client for server-side usage
 * Use this in Server Components, API Routes, and Server Actions
 */

import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@/lib/types';

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        async get(name: string) {
          return cookieStore.get(name)?.value;
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * Get the current session from the server
 */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Get the current user from the server
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Get the user's role from the users table
 */
export async function getUserRole(): Promise<"employee" | "manager" | "admin" | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: "employee" | "manager" | "admin" }>();

  return userData?.role || "employee"; // Default to employee if no role is set
}

/**
 * Get the user's tenant ID from JWT claims
 */
export async function getTenantId(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  // Tenant ID should be in JWT custom claims
  const tenantId = session.user.user_metadata?.tenant_id as string | undefined;
  return tenantId || null;
}
