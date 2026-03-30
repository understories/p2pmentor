/**
 * Admin password verification API
 *
 * Verifies admin password against ADMIN_PASSWORD environment variable.
 * Uses constant-time comparison and per-IP attempt limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { ADMIN_PASSWORD } from '@/lib/config';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
}

const attemptStore = new Map<string, AttemptRecord>();

function getIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  try {
    const ip = getIP(request);

    // Check lockout
    const record = attemptStore.get(ip);
    if (record && record.count >= MAX_ATTEMPTS) {
      const elapsed = Date.now() - record.firstAttemptAt;
      if (elapsed < LOCKOUT_MS) {
        const retryAfter = Math.ceil((LOCKOUT_MS - elapsed) / 1000);
        return NextResponse.json(
          { valid: false, error: 'Too many attempts. Try again later.' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        );
      }
      attemptStore.delete(ip);
    }

    const { password } = await request.json();

    if (!ADMIN_PASSWORD) {
      return NextResponse.json(
        { valid: false, error: 'Admin access is not configured' },
        { status: 500 }
      );
    }

    const isValid = safeCompare(password || '', ADMIN_PASSWORD);

    if (!isValid) {
      const existing = attemptStore.get(ip);
      if (existing) {
        existing.count += 1;
      } else {
        attemptStore.set(ip, { count: 1, firstAttemptAt: Date.now() });
      }
    } else {
      attemptStore.delete(ip);
    }

    return NextResponse.json({ valid: isValid });
  } catch (error) {
    console.error('[admin/verify] Error:', error);
    return NextResponse.json({ valid: false, error: 'Verification failed' }, { status: 500 });
  }
}
