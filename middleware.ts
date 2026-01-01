/**
 * Next.js Middleware for Beta Code Gating
 * 
 * Protects all routes (except public ones) by checking for beta access.
 * Server-side enforcement of beta code requirement.
 * 
 * Reference: refs/docs/beta_code_gating_plan.md Phase 2
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't require beta access
const PUBLIC_ROUTES = [
  '/',
  '/beta',
  '/docs', // Documentation is public
  '/explorer', // Data explorer is public
];

// API routes that don't require beta access
const PUBLIC_API_ROUTES = [
  '/api/beta-code', // Beta code validation itself
  '/api/docs', // Documentation API routes (list, content, git-history)
  '/api/explorer', // Explorer API routes (all /api/explorer/* routes)
];

// Admin API routes require beta access (same as admin dashboard)
// These are protected by admin password authentication in the route handlers
const ADMIN_API_ROUTES = [
  '/api/admin', // All admin API routes
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next();
  }

  // Allow public API routes
  if (pathname.startsWith('/api/') && 
      PUBLIC_API_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next();
  }

  // Admin API routes require beta access (same as admin dashboard)
  // They also require admin password authentication (handled in route handlers)
  if (pathname.startsWith('/api/admin')) {
    // Continue to beta access check below
  }

  // Check for beta access in cookies
  const betaCode = request.cookies.get('beta_access_code')?.value;
  const betaAccessKey = request.cookies.get('beta_access_key')?.value;

  // If no beta access in cookies, redirect to /beta
  if (!betaCode && !betaAccessKey) {
    // For API routes, return 403 instead of redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { ok: false, error: 'Beta access required. Please enter invite code at /beta' },
        { status: 403 }
      );
    }
    
    // For pages, redirect to /beta with return URL
    const url = request.nextUrl.clone();
    url.pathname = '/beta';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Beta access found - allow request
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     * - .svg, .png, .jpg, .jpeg, .gif, .webp files
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
