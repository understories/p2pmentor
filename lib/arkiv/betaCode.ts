/**
 * Beta Code Tracking
 * 
 * Tracks beta code usage on Arkiv to enforce limits.
 * Each beta code has a usage limit (e.g., 50 uses).
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { getPrivateKey } from "@/lib/config";
import { handleTransactionWithTimeout } from "./transaction-utils";

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
  const enc = new TextEncoder();
  const spaceId = 'local-dev';
  const createdAt = new Date().toISOString();
  const normalizedCode = code.toLowerCase().trim();

  // Check if beta code entity already exists
  const existing = await getBetaCodeUsage(normalizedCode);
  
  if (existing) {
    // Update usage count
    const newUsageCount = existing.usageCount + 1;
    const payload = {
      code: normalizedCode,
      usageCount: newUsageCount,
      limit,
      lastUsedAt: createdAt,
      createdAt: existing.createdAt,
    };

    const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify(payload)),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'beta_code_usage' },
          { key: 'code', value: normalizedCode },
          { key: 'usageCount', value: String(newUsageCount) },
          { key: 'limit', value: String(limit) },
          { key: 'spaceId', value: spaceId },
          { key: 'createdAt', value: createdAt },
        ],
        expiresIn: 31536000, // 1 year
      });
    });

    // Create txHash entity
    try {
      await walletClient.createEntity({
        payload: enc.encode(JSON.stringify({ txHash })),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'beta_code_usage_txhash' },
          { key: 'betaCodeKey', value: entityKey },
          { key: 'code', value: normalizedCode },
          { key: 'spaceId', value: spaceId },
        ],
        expiresIn: 31536000,
      });
    } catch (error: any) {
      console.warn('[trackBetaCodeUsage] Failed to create txhash entity:', error);
    }

    return { key: entityKey, txHash };
  } else {
    // Create new beta code usage entity
    const payload = {
      code: normalizedCode,
      usageCount: 1,
      limit,
      createdAt,
      lastUsedAt: createdAt,
    };

    const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify(payload)),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'beta_code_usage' },
          { key: 'code', value: normalizedCode },
          { key: 'usageCount', value: '1' },
          { key: 'limit', value: String(limit) },
          { key: 'spaceId', value: spaceId },
          { key: 'createdAt', value: createdAt },
        ],
        expiresIn: 31536000, // 1 year
      });
    });

    // Create txHash entity
    try {
      await walletClient.createEntity({
        payload: enc.encode(JSON.stringify({ txHash })),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'beta_code_usage_txhash' },
          { key: 'betaCodeKey', value: entityKey },
          { key: 'code', value: normalizedCode },
          { key: 'spaceId', value: spaceId },
        ],
        expiresIn: 31536000,
      });
    } catch (error: any) {
      console.warn('[trackBetaCodeUsage] Failed to create txhash entity:', error);
    }

    return { key: entityKey, txHash };
  }
}

/**
 * Get beta code usage tracking entity
 * 
 * @param code - Beta code string
 * @returns Beta code usage entity or null
 */
export async function getBetaCodeUsage(code: string): Promise<BetaCodeUsage | null> {
  const publicClient = getPublicClient();
  const normalizedCode = code.toLowerCase().trim();

  try {
    const result = await publicClient.buildQuery()
      .where(eq('type', 'beta_code_usage'))
      .where(eq('code', normalizedCode))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();

    if (!result?.entities || result.entities.length === 0) {
      return null;
    }

    const entity = result.entities[0];
    let payload: any = {};
    try {
      if (entity.payload) {
        const decoded = entity.payload instanceof Uint8Array
          ? new TextDecoder().decode(entity.payload)
          : typeof entity.payload === 'string'
          ? entity.payload
          : JSON.stringify(entity.payload);
        payload = JSON.parse(decoded);
      }
    } catch (e) {
      console.error('Error decoding beta code payload:', e);
    }

    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    // Get txHash
    const txHashResult = await publicClient.buildQuery()
      .where(eq('type', 'beta_code_usage_txhash'))
      .where(eq('betaCodeKey', entity.key))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();

    let txHash: string | undefined;
    if (txHashResult.entities.length > 0) {
      try {
        const txHashEntity = txHashResult.entities[0];
        const txHashPayload = txHashEntity.payload instanceof Uint8Array
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
      usageCount: parseInt(getAttr('usageCount') || payload.usageCount || '0', 10),
      limit: parseInt(getAttr('limit') || payload.limit || '50', 10),
      createdAt: getAttr('createdAt') || payload.createdAt || new Date().toISOString(),
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
 * @param code - Beta code string
 * @returns true if code can be used, false if limit exceeded
 */
export async function canUseBetaCode(code: string): Promise<boolean> {
  const usage = await getBetaCodeUsage(code);
  if (!usage) {
    return true; // New code, can be used
  }
  return usage.usageCount < usage.limit;
}

/**
 * List all beta code usage entities (latest version of each code)
 * 
 * Since entities are immutable, multiple entities may exist for the same code.
 * This function groups by code and returns the latest version (highest usageCount).
 * 
 * @returns Array of beta code usage entities (one per unique code, latest version)
 */
export async function listAllBetaCodeUsage(): Promise<BetaCodeUsage[]> {
  const publicClient = getPublicClient();

  try {
    const result = await publicClient.buildQuery()
      .where(eq('type', 'beta_code_usage'))
      .withAttributes(true)
      .withPayload(true)
      .limit(1000) // Get all beta code usage entities
      .fetch();

    if (!result?.entities || !Array.isArray(result.entities)) {
      return [];
    }

    // Parse entities
    const parsed = result.entities.map((entity: any) => {
      let payload: any = {};
      try {
        if (entity.payload) {
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('[listAllBetaCodeUsage] Error decoding payload:', e);
      }

      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };

      return {
        key: entity.key,
        code: getAttr('code') || payload.code || '',
        usageCount: parseInt(getAttr('usageCount') || payload.usageCount || '0', 10),
        limit: parseInt(getAttr('limit') || payload.limit || '50', 10),
        createdAt: getAttr('createdAt') || payload.createdAt || new Date().toISOString(),
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
    const allKeys = Array.from(codeMap.values()).map(u => u.key);
    const txHashResults = await Promise.all(
      allKeys.map(async (key) => {
        try {
          const txHashResult = await publicClient.buildQuery()
            .where(eq('type', 'beta_code_usage_txhash'))
            .where(eq('betaCodeKey', key))
            .withAttributes(true)
            .withPayload(true)
            .limit(1)
            .fetch();

          if (txHashResult.entities.length > 0) {
            try {
              const txHashEntity = txHashResult.entities[0];
              const txHashPayload = txHashEntity.payload instanceof Uint8Array
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
    const txHashMap = new Map(txHashResults.map(r => [r.key, r.txHash]));
    return Array.from(codeMap.values()).map(usage => ({
      ...usage,
      txHash: txHashMap.get(usage.key),
    }));
  } catch (error: any) {
    console.error('[listAllBetaCodeUsage] Arkiv query failed:', {
      message: error?.message,
      stack: error?.stack,
      error
    });
    return [];
  }
}
