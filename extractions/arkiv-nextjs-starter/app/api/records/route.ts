/**
 * Records API route
 * 
 * Handles record creation via server-signed writes (Phase 0).
 * Follows PAT-TIMEOUT-001 (Transaction Timeouts) and PAT-ERROR-001 (Error Handling).
 * 
 * This demonstrates the canonical server-signed write pattern for Arkiv.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRecord } from '../../../src/lib/arkiv/writes';
import { isTransactionTimeoutError, isRateLimitError } from '../../../../../../arkiv-app-kit/src/transactions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, wallet } = body;
    
    // Validate required fields
    if (!title || !wallet) {
      return NextResponse.json(
        { ok: false, error: 'title and wallet are required' },
        { status: 400 }
      );
    }
    
    // Create record using app-kit helpers
    // Wallet is automatically normalized by makeAttributes
    const result = await createRecord('record', {
      title,
      description: description || '',
      createdAt: new Date().toISOString(),
    }, {
      wallet, // Will be normalized to lowercase
      status: 'active',
    });
    
    // Return submitted status (never claim "indexed" - indexer lag is normal)
    return NextResponse.json({
      ok: true,
      status: 'submitted',
      entityKey: result.entityKey,
      txHash: result.txHash,
      message: 'Record created. It may take a moment to appear in queries.',
    });
    
  } catch (error: any) {
    // Handle transaction timeouts gracefully (common on testnets)
    if (isTransactionTimeoutError(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Transaction submitted but confirmation pending. Please wait a moment and refresh.',
          status: 'submitted_or_pending',
        },
        { status: 202 } // Accepted but not yet confirmed
      );
    }
    
    // Handle rate limits
    if (isRateLimitError(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Rate limit exceeded. Please wait a moment and try again.',
        },
        { status: 429 }
      );
    }
    
    // Log full error for debugging
    console.error('[records/route] Error creating record:', {
      message: error?.message,
      error,
    });
    
    // Return user-friendly error
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Failed to create record. Please try again.',
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler for listing records
 * 
 * Queries all records using app-kit query helpers.
 */
export async function GET() {
  try {
    const { listRecords } = await import('../../../src/lib/arkiv/queries');
    const records = await listRecords('record', { withPayload: true });
    
    return NextResponse.json({
      ok: true,
      records,
    });
  } catch (error: any) {
    console.error('[records/route] Error listing records:', {
      message: error?.message,
      error,
    });
    
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Failed to list records',
        records: [], // Return empty array on failure (graceful degradation)
      },
      { status: 500 }
    );
  }
}
