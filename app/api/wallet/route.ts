/**
 * Example wallet API route
 * 
 * Returns the example wallet address derived from ARKIV_PRIVATE_KEY.
 * This allows users to log in without MetaMask for demo purposes.
 * 
 * Reference: refs/mentor-graph/pages/api/wallet.ts
 */

import { CURRENT_WALLET } from '@/lib/config';
import { NextResponse } from 'next/server';

export async function GET() {
  // Return the example wallet address (from ARKIV_PRIVATE_KEY)
  // This allows users to log in without MetaMask for demo purposes
  if (!CURRENT_WALLET) {
    return NextResponse.json(
      { error: 'Example wallet not available' },
      { status: 503 }
    );
  }

  return NextResponse.json({
    address: CURRENT_WALLET,
  });
}

