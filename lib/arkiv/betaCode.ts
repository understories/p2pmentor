/**
 * Beta Code Tracking
 *
 * Tracks beta code usage on Arkiv to enforce limits.
 * Each beta code has a usage limit (e.g., 50 uses).
 */

import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { getPrivateKey, SERVER_SIGNER_ADDRESS, SPACE_ID } from '@/lib/config';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';

/**
 * Start a beta_code_usage query.
 * beta_code_usage entities are only written with the server key (getPrivateKey()),
 * so reads are scoped to the server signer when it is configured.
 */
function selectBetaCodeUsage(publicClient: ReturnType<typeof getPublicClient>) {
  const q = arkivSelect('beta_code_usage', publicClient);
  return SERVER_SIGNER_ADDRESS ? q.createdBy(SERVER_SIGNER_ADDRESS) : q;
}

/**
 * Write a beta_code_usage entity (new version) plus its txhash entity.
 * beta_code_usage is append-only: each change is a new entity.
 */
async function writeBetaCodeUsage(
  walletClient: ReturnType<typeof getWalletClientFromPrivateKey>,
  {
    code,
    usageCount,
    limit,
    spaceId,
    createdAt,
    payload,
    logPrefix,
  }: {
    code: string;
    usageCount: number;
    limit: number;
    spaceId: string;
    createdAt: string;
    payload: Record<string, unknown>;
    logPrefix: string;
  }
): Promise<{ key: string; txHash: string }> {
  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'beta_code_usage',
      attributes: {
        code,
        usage_count: String(usageCount),
        limit: String(limit),
        space_id: spaceId,
        created_at: createdAt,
      },
      payload,
    });
  });

  // Create txHash entity
  try {
    await createArkivEntity(walletClient, {
      type: 'beta_code_usage_txhash',
      attributes: {
        beta_code_key: entityKey,
        code,
        space_id: spaceId,
      },
      payload: { txHash },
    });
  } catch (error: any) {
    console.warn(`[${logPrefix}] Failed to create txhash entity:`, error);
  }

  return { key: entityKey, txHash };
}

export type BetaCodeUsage = {
  key: string;
  code: string;
  usageCount: number;
  limit: number;
  createdAt: string;
  txHash?: string;
};

/**
 * Create or update beta code usage tracking entity
 *
 * @param code - Beta code string
 * @param limit - Usage limit for this code
 * @returns Entity key and transaction hash
 */
export async function trackBetaCodeUsage(
  code: string,
  limit: number = 50
): Promise<{ key: string; txHash: string }> {
  const privateKey = getPrivateKey();
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const spaceId = SPACE_ID;
  const createdAt = new Date().toISOString();
  const normalizedCode = code.toLowerCase().trim();

  // Check if beta code entity already exists (use SPACE_ID from config)
  const existing = await getBetaCodeUsage(normalizedCode, SPACE_ID);

  if (existing) {
    // CRITICAL: Enforce limit before incrementing (Arkiv-native, prevents race conditions)
    if (existing.usageCount >= existing.limit) {
      console.error(
        `[trackBetaCodeUsage] Beta code "${normalizedCode}" limit exceeded: ${existing.usageCount}/${existing.limit}`
      );
      throw new Error(
        `Beta code "${normalizedCode}" has reached its usage limit (${existing.usageCount}/${existing.limit}). Cannot track additional usage.`
      );
    }

    // Update usage count
    const newUsageCount = existing.usageCount + 1;
    console.log(
      `[trackBetaCodeUsage] Incrementing beta code "${normalizedCode}": ${existing.usageCount} -> ${newUsageCount} (limit: ${existing.limit})`
    );
    const payload = {
      code: normalizedCode,
      usageCount: newUsageCount,
      limit,
      lastUsedAt: createdAt,
      createdAt: existing.createdAt,
    };

    return await writeBetaCodeUsage(walletClient, {
      code: normalizedCode,
      usageCount: newUsageCount,
      limit,
      spaceId,
      createdAt,
      payload,
      logPrefix: 'trackBetaCodeUsage',
    });
  } else {
    // Create new beta code usage entity
    const payload = {
      code: normalizedCode,
      usageCount: 1,
      limit,
      createdAt,
      lastUsedAt: createdAt,
    };

    return await writeBetaCodeUsage(walletClient, {
      code: normalizedCode,
      usageCount: 1,
      limit,
      spaceId,
      createdAt,
      payload,
      logPrefix: 'trackBetaCodeUsage',
    });
  }
}

/**
 * Get beta code usage tracking entity
 *
 * @param code - Beta code string
 * @returns Beta code usage entity or null
 */
export async function getBetaCodeUsage(
  code: string,
  spaceId?: string
): Promise<BetaCodeUsage | null> {
  const publicClient = getPublicClient();
  const normalizedCode = code.toLowerCase().trim();
  const finalSpaceId = spaceId || SPACE_ID;

  try {
    let queryBuilder = selectBetaCodeUsage(publicClient)
      .where(eqAttr('code', normalizedCode))
      .where(eqAttr('space_id', finalSpaceId));

    const result = await queryBuilder.limit(1).fetch();

    if (!result?.entities || result.entities.length === 0) {
      return null;
    }

    const entity = result.entities[0];
    let payload: any = {};
    try {
      if (entity.payload) {
        const decoded =
          entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
              ? entity.payload
              : JSON.stringify(entity.payload);
        payload = JSON.parse(decoded);
      }
    } catch (e) {
      console.error('Error decoding beta code payload:', e);
    }

    const getAttr = (key: string): string => readAttr(entity, key);

    // Get txHash
    const txHashResult = await arkivSelect('beta_code_usage_txhash', publicClient)
      .where(eqAttr('beta_code_key', entity.key))
      .where(eqAttr('space_id', finalSpaceId))
      .limit(1)
      .fetch();

    let txHash: string | undefined;
    if (txHashResult.entities.length > 0) {
      try {
        const txHashEntity = txHashResult.entities[0];
        const txHashPayload =
          txHashEntity.payload instanceof Uint8Array
            ? new TextDecoder().decode(txHashEntity.payload)
            : typeof txHashEntity.payload === 'string'
              ? txHashEntity.payload
              : JSON.stringify(txHashEntity.payload);
        const decoded = JSON.parse(txHashPayload);
        txHash = decoded.txHash;
      } catch (e) {
        console.error('Error decoding txHash:', e);
      }
    }

    return {
      key: entity.key,
      code: getAttr('code') || payload.code || normalizedCode,
      usageCount: parseInt(getAttr('usage_count') || payload.usageCount || '0', 10),
      limit: parseInt(getAttr('limit') || payload.limit || '50', 10),
      createdAt: getAttr('created_at') || payload.createdAt || new Date().toISOString(),
      txHash,
    };
  } catch (error: any) {
    console.error('[getBetaCodeUsage] Error:', error);
    return null;
  }
}

/**
 * Check if beta code can be used (hasn't exceeded limit)
 *
 * Uses actual unique wallet count from beta_access entities (Arkiv-native, accurate).
 * This ensures the limit is enforced based on real wallet usage, not just usageCount.
 *
 * @param code - Beta code string
 * @returns true if code can be used, false if limit exceeded
 */
export async function canUseBetaCode(code: string, spaceId?: string): Promise<boolean> {
  const usage = await getBetaCodeUsage(code, spaceId);
  const limit = usage?.limit || 50;

  // Check actual unique wallet count (source of truth)
  const { listBetaAccessByCode } = await import('./betaAccess');
  const accessRecords = await listBetaAccessByCode(code, spaceId);
  const uniqueWalletCount = new Set(accessRecords.map((a) => a.wallet.toLowerCase())).size;

  return uniqueWalletCount < limit;
}

/**
 * Sync usageCount with actual unique wallet count (Arkiv-native, accurate tracking)
 *
 * Ensures usageCount matches the actual number of unique wallets that have used the code.
 * This fixes any discrepancies from previous tracking logic.
 *
 * @param code - Beta code string
 * @param spaceId - Optional space ID
 * @returns Updated usageCount
 */
export async function syncBetaCodeUsageCount(code: string, spaceId?: string): Promise<number> {
  const normalizedCode = code.toLowerCase().trim();
  const finalSpaceId = spaceId || SPACE_ID;

  // Get actual unique wallet count from beta_access entities (source of truth)
  const { listBetaAccessByCode } = await import('./betaAccess');
  const accessRecords = await listBetaAccessByCode(normalizedCode, finalSpaceId);
  const actualWalletCount = new Set(accessRecords.map((a) => a.wallet.toLowerCase())).size;

  // Get current usage entity
  const existing = await getBetaCodeUsage(normalizedCode, finalSpaceId);
  const limit = existing?.limit || 50;

  // If usageCount doesn't match actual wallet count, update it
  if (!existing || existing.usageCount !== actualWalletCount) {
    console.log(
      `[syncBetaCodeUsageCount] Syncing "${normalizedCode}": usageCount ${existing?.usageCount || 0} -> ${actualWalletCount} (actual wallets)`
    );

    // Create new entity with correct usageCount
    const privateKey = getPrivateKey();
    const walletClient = getWalletClientFromPrivateKey(privateKey);
    const createdAt = new Date().toISOString();

    const payload = {
      code: normalizedCode,
      usageCount: actualWalletCount,
      limit,
      lastUsedAt: createdAt, // Update lastUsedAt to current time
      createdAt: existing?.createdAt || createdAt,
    };

    await writeBetaCodeUsage(walletClient, {
      code: normalizedCode,
      usageCount: actualWalletCount,
      limit,
      spaceId: finalSpaceId,
      createdAt,
      payload,
      logPrefix: 'syncBetaCodeUsageCount',
    });
  }

  return actualWalletCount;
}

/**
 * List all beta code usage entities (latest version of each code)
 *
 * Since entities are immutable, multiple entities may exist for the same code.
 * This function groups by code and returns the latest version (highest usageCount).
 *
 * @param spaceId - Optional space ID to filter by (defaults to SPACE_ID from config)
 * @returns Array of beta code usage entities (one per unique code, latest version)
 */
export async function listAllBetaCodeUsage(spaceId?: string): Promise<BetaCodeUsage[]> {
  const publicClient = getPublicClient();
  const finalSpaceId = spaceId || SPACE_ID;

  try {
    // Get all beta code usage entities
    const result = await fetchAll(
      selectBetaCodeUsage(publicClient).where(eqAttr('space_id', finalSpaceId)),
      1000,
      publicClient
    );

    if (!result?.entities || !Array.isArray(result.entities)) {
      return [];
    }

    // Parse entities
    const parsed = result.entities.map((entity: any) => {
      let payload: any = {};
      try {
        if (entity.payload) {
          const decoded =
            entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
                ? entity.payload
                : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('[listAllBetaCodeUsage] Error decoding payload:', e);
      }

      const getAttr = (key: string): string => readAttr(entity, key);

      return {
        key: entity.key,
        code: getAttr('code') || payload.code || '',
        usageCount: parseInt(getAttr('usage_count') || payload.usageCount || '0', 10),
        limit: parseInt(getAttr('limit') || payload.limit || '50', 10),
        createdAt: getAttr('created_at') || payload.createdAt || new Date().toISOString(),
        lastUsedAt: payload.lastUsedAt,
      };
    });

    // Group by code and get latest version (highest usageCount, then most recent createdAt)
    const codeMap = new Map<string, BetaCodeUsage>();

    for (const usage of parsed) {
      if (!usage.code) continue;

      const existing = codeMap.get(usage.code);
      if (!existing) {
        codeMap.set(usage.code, usage);
      } else {
        // Keep the one with higher usageCount, or if equal, most recent createdAt
        if (usage.usageCount > existing.usageCount) {
          codeMap.set(usage.code, usage);
        } else if (usage.usageCount === existing.usageCount) {
          const usageTime = new Date(usage.createdAt).getTime();
          const existingTime = new Date(existing.createdAt).getTime();
          if (usageTime > existingTime) {
            codeMap.set(usage.code, usage);
          }
        }
      }
    }

    // Get txHashes for all entities
    const allKeys = Array.from(codeMap.values()).map((u) => u.key);
    const txHashResults = await Promise.all(
      allKeys.map(async (key) => {
        try {
          const txHashResult = await arkivSelect('beta_code_usage_txhash', publicClient)
            .where(eqAttr('beta_code_key', key))
            .where(eqAttr('space_id', finalSpaceId))
            .limit(1)
            .fetch();

          if (txHashResult.entities.length > 0) {
            try {
              const txHashEntity = txHashResult.entities[0];
              const txHashPayload =
                txHashEntity.payload instanceof Uint8Array
                  ? new TextDecoder().decode(txHashEntity.payload)
                  : typeof txHashEntity.payload === 'string'
                    ? txHashEntity.payload
                    : JSON.stringify(txHashEntity.payload);
              const decoded = JSON.parse(txHashPayload);
              return { key, txHash: decoded.txHash };
            } catch (e) {
              console.error('[listAllBetaCodeUsage] Error decoding txHash:', e);
            }
          }
        } catch (e) {
          // Ignore errors fetching txHash
        }
        return { key, txHash: undefined };
      })
    );

    // Add txHashes to results
    const txHashMap = new Map(txHashResults.map((r) => [r.key, r.txHash]));
    return Array.from(codeMap.values()).map((usage) => ({
      ...usage,
      txHash: txHashMap.get(usage.key),
    }));
  } catch (error: any) {
    console.error('[listAllBetaCodeUsage] Arkiv query failed:', {
      message: error?.message,
      stack: error?.stack,
      error,
    });
    return [];
  }
}
