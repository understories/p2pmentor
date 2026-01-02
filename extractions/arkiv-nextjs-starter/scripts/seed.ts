/**
 * Seed script for creating demo records
 *
 * **Prerequisites:**
 * 1. Install dependencies: `npm install` or `pnpm install`
 * 2. Set SPACE_ID in .env file (required, no fallback)
 * 3. Set ARKIV_PRIVATE_KEY in .env file (required for creating entities)
 * 4. Ensure signing wallet has funds for transaction fees
 *
 * **Usage:**
 *   npm run seed
 *   # Or with explicit target:
 *   ARKIV_TARGET=mendoza npm run seed
 *
 * **Safety Features:**
 * - Verifies SPACE_ID is set before proceeding
 * - Checks for existing entities before creating (prevents duplicates)
 * - Rate limiting (400ms delay between entity creation)
 * - Graceful error handling (continues on error)
 * - User-friendly error messages for common blockchain errors
 *
 * **Common Errors:**
 * - "replacement transaction underpriced": A previous transaction is still pending. Wait a moment and try again.
 * - "rate limit exceeded": Too many requests. Wait a moment and try again.
 * - "insufficient funds": Signing wallet needs funds for transaction fees.
 *
 * Supports ARKIV_TARGET=local (CI default) or ARKIV_TARGET=mendoza (human workflows).
 * CI uses local for determinism; Mendoza is for ecosystem validation.
 */

import { createRecord } from '../src/lib/arkiv/writes';
import { listRecords } from '../src/lib/arkiv/queries';
import { getSpaceId } from '../../arkiv-app-kit/src/space';
import { requireEnv } from '../../arkiv-app-kit/src/env';

// Rate limiting delay (ms)
const DELAY_MS = 400;

// Simple delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Verify prerequisites before proceeding
 */
function verifyPrerequisites() {
  try {
    const spaceId = getSpaceId();
    console.log(`[seed] Space ID: ${spaceId}`);
  } catch (error: any) {
    console.error('[seed] ❌ ERROR: SPACE_ID is not set');
    console.error('[seed]    Set SPACE_ID in your .env file (required, no fallback)');
    console.error('[seed]    Example: SPACE_ID=local-dev');
    process.exit(1);
  }

  try {
    requireEnv('ARKIV_PRIVATE_KEY');
    console.log('[seed] ✓ ARKIV_PRIVATE_KEY is set');
  } catch (error: any) {
    console.error('[seed] ❌ ERROR: ARKIV_PRIVATE_KEY is not set');
    console.error('[seed]    Set ARKIV_PRIVATE_KEY in your .env file');
    console.error('[seed]    Example: ARKIV_PRIVATE_KEY=0x...');
    process.exit(1);
  }
}

/**
 * Check if a record already exists
 */
async function recordExists(title: string): Promise<boolean> {
  try {
    const existing = await listRecords('record', { limit: 100, withPayload: true });
    // listRecords returns an array of entities
    if (!Array.isArray(existing)) {
      return false;
    }
    return existing.some((r: any) => {
      try {
        // Decode payload if it's a Uint8Array
        let payload: any = {};
        if (r.payload) {
          if (r.payload instanceof Uint8Array) {
            const decoded = new TextDecoder().decode(r.payload);
            payload = JSON.parse(decoded);
          } else if (typeof r.payload === 'string') {
            payload = JSON.parse(r.payload);
          } else {
            payload = r.payload;
          }
        }
        return payload.title === title;
      } catch {
        return false;
      }
    });
  } catch (error) {
    // If query fails, assume record doesn't exist (safer to try creating)
    return false;
  }
}

/**
 * Get user-friendly error message
 */
function getFriendlyError(error: any): string {
  const errorMsg = error?.message || String(error || 'Unknown error');

  if (errorMsg.includes('replacement transaction underpriced') || errorMsg.includes('nonce')) {
    return 'Transaction conflict (nonce issue). Wait a moment and try again.';
  } else if (errorMsg.includes('rate limit') || errorMsg.includes('too many requests')) {
    return 'Rate limit exceeded. Please wait a moment and try again.';
  } else if (errorMsg.includes('insufficient funds') || errorMsg.includes('balance')) {
    return 'Insufficient funds. Make sure the signing wallet has enough funds for transaction fees.';
  }

  return errorMsg;
}

async function seed() {
  const target = process.env.ARKIV_TARGET || 'mendoza';
  console.log(`[seed] Targeting: ${target}`);
  console.log('[seed] Verifying prerequisites...\n');

  // Verify prerequisites
  verifyPrerequisites();

  // Demo wallet addresses (testnet)
  const demoWallets = [
    '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    '0x8ba1f109551bD432803012645Hac136c22C929',
  ];

  const records = [
    { title: 'Getting Started with Arkiv', description: 'Learn the basics of building on Arkiv' },
    { title: 'Query Patterns', description: 'Best practices for querying Arkiv entities' },
    { title: 'Transaction Handling', description: 'How to handle timeouts and errors gracefully' },
  ];

  console.log(`[seed] Creating ${records.length} demo records...\n`);

  const results = [];
  for (let i = 0; i < records.length; i++) {
    const wallet = demoWallets[i % demoWallets.length];
    const record = records[i];

    // Rate limiting: delay before each entity creation
    if (i > 0) {
      await delay(DELAY_MS);
    }

    try {
      // Check if record already exists
      const exists = await recordExists(record.title);
      if (exists) {
        console.log(`[seed] ⏭️  Skipping "${record.title}" (already exists)`);
        results.push({ record: record.title, status: 'skipped' });
        continue;
      }

      const result = await createRecord('record', {
        ...record,
        createdAt: new Date().toISOString(),
      }, {
        wallet,
        status: 'active',
      });

      console.log(`[seed] ✅ Created record: ${record.title}`);
      console.log(`[seed]   Entity Key: ${result.entityKey}`);
      console.log(`[seed]   Tx Hash: ${result.txHash}\n`);
      results.push({ record: record.title, status: 'created', key: result.entityKey, txHash: result.txHash });
    } catch (error: any) {
      const friendlyError = getFriendlyError(error);
      console.error(`[seed] ❌ Failed to create record "${record.title}": ${friendlyError}\n`);
      results.push({ record: record.title, status: 'error', error: friendlyError });
    }
  }

  // Summary
  const created = results.filter(r => r.status === 'created').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const errors = results.filter(r => r.status === 'error').length;

  console.log('[seed] Summary:');
  console.log(`[seed]   ✅ Created: ${created}`);
  console.log(`[seed]   ⏭️  Skipped: ${skipped}`);
  console.log(`[seed]   ❌ Errors: ${errors}`);

  if (errors > 0) {
    console.log('\n[seed] 💡 Tips for resolving errors:');
    console.log('[seed]   - "Transaction conflict": Wait 30-60 seconds and run the script again');
    console.log('[seed]   - "Rate limit": Wait a few minutes between runs');
    console.log('[seed]   - "Insufficient funds": Fund the signing wallet on Mendoza testnet');
  }

  console.log('\n[seed] Done!');
}

seed().catch(console.error);

