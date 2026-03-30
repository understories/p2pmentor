/**
 * Admin Authentication Middleware
 *
 * Validates that a request is from an authenticated admin user
 * by checking the session cookie or authorization header.
 *
 * Usage in API routes:
 *   const authError = authenticateAdmin(request);
 *   if (authError) return authError;
 */

import { NextRequest, NextResponse } from 'next/server';

export function authenticateAdmin(request: NextRequest): NextResponse | null {
  const sessionAuth = request.cookies.get('admin_authenticated')?.value === 'true';

  if (sessionAuth) return null;

  const authHeader = request.headers.get('authorization');
  if (authHeader) return null;

  return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
}
