/**
 * Passkey Feature Flag API
 * 
 * Exposes passkey login feature flag status for client-side pages.
 * 
 * GET /api/passkey/feature-flag
 */

import { NextResponse } from 'next/server';
import { isPasskeyLoginEnabled } from '@/lib/auth/passkeyFeatureFlags';

export async function GET() {
  return NextResponse.json({
    enabled: isPasskeyLoginEnabled(),
  });
}

