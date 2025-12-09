/**
 * Admin password verification API
 * 
 * Verifies admin password against ADMIN_PASSWORD environment variable.
 * Server-side only for security.
 */

import { NextResponse } from 'next/server';
import { ADMIN_PASSWORD } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!ADMIN_PASSWORD) {
      return NextResponse.json(
        { valid: false, error: 'Admin access is not configured' },
        { status: 500 }
      );
    }

    // Compare passwords (case-sensitive)
    const isValid = password === ADMIN_PASSWORD;

    return NextResponse.json({ valid: isValid });
  } catch (error) {
    console.error('[admin/verify] Error:', error);
    return NextResponse.json(
      { valid: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}

