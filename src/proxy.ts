import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  console.log("=== PROXY MIDDLEWARE ===");
  console.log("Path:", pathname);
  console.log("Has session:", !!session);
  if (session) {
    console.log("User ID:", session.user.id);
    console.log("User metadata:", session.user.user_metadata);
  }

  // Public routes
  const isLoginPage = pathname === '/login';
  const isPublicRoute = pathname === '/' || isLoginPage;

  // Internal API endpoints (server-to-server only, no auth required)
  const isInternalEndpoint = pathname === '/api/admin/hr-import/process';

  // If no session and trying to access protected route, redirect to login
  // (but allow internal endpoints to pass through)
  if (!session && !isPublicRoute && !isInternalEndpoint) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Validate JWT claims for authenticated users accessing protected routes
  // (skip validation for internal endpoints)
  if (session && !isPublicRoute && !isInternalEndpoint) {
    const tenantId = session.user.user_metadata?.tenant_id;
    const role = session.user.user_metadata?.role;

    // Ensure tenant_id exists in JWT claims
    if (!tenantId) {
      console.error('Missing tenant_id in JWT claims for user:', session.user.id);
      // Clear session and redirect to login
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL('/login?error=invalid_session', request.url));
    }

    // Ensure role exists in JWT claims
    if (!role) {
      console.error('Missing role in JWT claims for user:', session.user.id);
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL('/login?error=invalid_session', request.url));
    }
  }

  // If has session and trying to access login, redirect to appropriate dashboard
  if (session && isLoginPage) {
    console.log("User on login page with session, fetching role...");
    // Fetch user role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    console.log("User data query result:", userData);
    console.log("User data query error:", userError);

    if (userData?.role === 'admin') {
      console.log("Redirecting admin to /admin/dashboard");
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    } else {
      console.log("Redirecting to /employee/dashboard");
      return NextResponse.redirect(new URL('/employee/dashboard', request.url));
    }
  }

  // Check role-based access for protected routes
  // (skip for internal endpoints)
  if (session && !isPublicRoute && !isInternalEndpoint) {
    console.log("Checking role-based access for protected route...");
    const { data: userData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    console.log("Role check result:", userData);
    console.log("Role check error:", roleError);

    // Admin routes
    if (pathname.startsWith('/admin') && userData?.role !== 'admin') {
      console.log("Non-admin trying to access admin route, redirecting");
      return NextResponse.redirect(new URL('/employee/dashboard', request.url));
    }

    // Employee routes (also accessible to admins)
    if (pathname.startsWith('/employee') && !userData?.role) {
      console.log("User without role trying to access employee route, redirecting to login");
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
