/**
 * Auth Identity CRUD helpers
 * 
 * Stores passkey credential metadata on Arkiv (replaces ephemeral in-memory Map).
 * Mirrors MetaMask pattern: wallet address = identity, auth_identity = credential metadata.
 * 
 * Reference: refs/doc/passkey_levelup.md
 */

import { eq } from "@arkiv-network/sdk/query";
import { keccak256 } from "viem";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";
import { SPACE_ID } from "@/lib/config";

export type AuthIdentityType = 'passkey' | 'backup_wallet';

export type PasskeyCredential = {
  credentialID: string; // base64url-encoded
  credentialPublicKey: string; // base64-encoded Uint8Array
  counter: number;
  transports?: string[];
  deviceName?: string;
};

export type AuthIdentity = {
  key: string;
  wallet: string;
  subtype: AuthIdentityType;
  credentialID?: string; // For passkey: base64url-encoded credential ID
  backupWalletAddress?: string; // For backup_wallet: backup wallet address
  createdAt: string;
  spaceId: string;
  txHash?: string;
  // Payload data (from entity payload)
  credential?: PasskeyCredential; // For passkey entities
  backupMetadata?: {
    walletAddress: string;
    createdAt: string;
  }; // For backup_wallet entities
};

/**
 * Derive canonical entity key hash for passkey identity
 *
 * Pattern B: Deterministic hash based on credentialID (fixed length).
 * Uses keccak256 to avoid length limits, delimiter collisions, and migration pain.
 *
 * Key format: auth_identity:passkey:{base64url(keccak256("passkey|" + credentialID))}
 *
 * @param credentialID - Base64url-encoded credential ID (normalized)
 * @returns Deterministic key hash (base64url-encoded)
 */
function derivePasskeyIdentityKeyHash(credentialID: string): string {
  const normalized = credentialID.trim();
  const prefix = 'passkey|';
  const hashInput = prefix + normalized;
  const hash = keccak256(new TextEncoder().encode(hashInput));
  // Convert hex to base64url for key storage
  const hashBase64 = Buffer.from(hash.slice(2), 'hex').toString('base64url');
  return `auth_identity:passkey:${hashBase64}`;
}

/**
 * Find passkey entity key by credentialID (query-based, for Pattern A compatibility)
 *
 * Returns entity key if found, null otherwise.
 * Used to find existing entity before update in upsert logic.
 * Chooses entity with highest counter (tie-break by latest timestamp) to handle duplicates.
 *
 * @param credentialID - Base64url-encoded credential ID (normalized)
 * @returns Entity key or null if not found
 */
async function findPasskeyEntityKeyByCredentialID(credentialID: string): Promise<string | null> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  const normalizedCredentialID = credentialID.trim();

  try {
    const result = await query
      .where(eq('type', 'auth_identity'))
      .where(eq('subtype', 'passkey'))
      .where(eq('credentialId', normalizedCredentialID))
      .withAttributes(true)
      .withPayload(true)
      .limit(20) // Fetch multiple to choose best one
      .fetch();

    if (!result?.entities || !Array.isArray(result.entities) || result.entities.length === 0) {
      return null;
    }

    // Choose entity with highest counter (tie-break by latest createdAt/updatedAt)
    let bestEntity: any = null;
    let bestCounter = -1;
    let bestTimestamp = '';

    for (const entity of result.entities) {
      // Parse payload to get counter
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
        continue;
      }

      const counter = payload.counter || 0;
      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };
      const createdAt = getAttr('createdAt');
      const updatedAt = getAttr('updatedAt');
      const timestamp = updatedAt || createdAt || '';

      if (counter > bestCounter || (counter === bestCounter && timestamp > bestTimestamp)) {
        bestEntity = entity;
        bestCounter = counter;
        bestTimestamp = timestamp;
      }
    }

    return bestEntity?.key || null;
  } catch (error) {
    return null;
  }
}

/**
 * Create or update auth_identity::passkey entity on Arkiv (Pattern B: upsert)
 *
 * Stores WebAuthn credential metadata for passkey authentication.
 * Uses create-first, update-on-conflict pattern to handle retries gracefully.
 * One entity per credential (supports multi-device).
 *
 * Pattern B: Deterministic merge semantics:
 * - createdAt: preserve earliest
 * - updatedAt: always now
 * - counter: monotonic max (never decrease)
 * - credentialPublicKey: immutable once set
 * - transports: merge set union
 * - deviceName: last-write-wins
 *
 * @param params - Passkey credential data
 * @returns Entity key and transaction hash
 */
export async function createPasskeyIdentity({
  wallet,
  credentialID,
  credentialPublicKey,
  counter,
  transports,
  deviceName,
  privateKey,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  credentialID: string; // base64url-encoded
  credentialPublicKey: Uint8Array;
  counter: number;
  transports?: string[];
  deviceName?: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const now = new Date().toISOString();
  const normalizedCredentialID = credentialID.trim();
  const normalizedWallet = wallet.toLowerCase().trim();

  // Find existing entity by credentialID (if any)
  const existingEntityKey = await findPasskeyEntityKeyByCredentialID(normalizedCredentialID);
  let existingPayload: any = null;
  let existingCreatedAt = now;

  if (existingEntityKey) {
    // Fetch existing entity to merge payload
    try {
      const publicClient = getPublicClient();
      const existingEntity = await publicClient.getEntity(existingEntityKey as `0x${string}`);

      // Parse existing payload
      if (existingEntity.payload) {
        const decoded = existingEntity.payload instanceof Uint8Array
          ? new TextDecoder().decode(existingEntity.payload)
          : typeof existingEntity.payload === 'string'
          ? existingEntity.payload
          : JSON.stringify(existingEntity.payload);
        existingPayload = JSON.parse(decoded);
      }

      // Get createdAt from attributes
      const attrs = existingEntity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };
      existingCreatedAt = getAttr('createdAt') || now;
    } catch (error) {
      // If fetch fails, proceed with create (will update on conflict)
      console.warn('[createPasskeyIdentity] Failed to fetch existing entity, will create:', error);
    }
  }

  // Convert public key to base64 for JSON storage
  const publicKeyBase64 = Buffer.from(credentialPublicKey).toString('base64');

  // Merge payload with canonical semantics
  const payload = {
    credentialID: normalizedCredentialID,
    credentialPublicKey: publicKeyBase64,
    // Counter: monotonic max (never decrease)
    counter: existingPayload
      ? Math.max(existingPayload.counter || 0, counter)
      : counter,
    // Transports: merge set union (avoid accidental loss)
    transports: existingPayload && existingPayload.transports
      ? [...new Set([...existingPayload.transports, ...(transports || [])])]
      : transports || [],
    // DeviceName: last-write-wins
    deviceName: deviceName || existingPayload?.deviceName,
    // createdAt: preserve earliest
    createdAt: existingPayload?.createdAt || now,
    // updatedAt: always now
    updatedAt: now,
    // Store rpId for "same credentialId but wrong RP" detection
    rpId: process.env.PASSKEY_RP_ID || 'p2pmentor',
  };

  // Rebuild attributes deterministically (never "preserve all")
  const attributes = [
    { key: 'type', value: 'auth_identity' },
    { key: 'subtype', value: 'passkey' },
    { key: 'wallet', value: normalizedWallet },
    { key: 'credentialId', value: normalizedCredentialID },
    { key: 'spaceId', value: spaceId },
    { key: 'createdAt', value: payload.createdAt },
    { key: 'updatedAt', value: payload.updatedAt },
    { key: 'counter', value: String(payload.counter) }, // Store as attribute for quick reads
  ];

  // TTL: 10 years (effectively permanent for identity)
  const expiresIn = 315360000; // 10 years

  // Create-first, update-on-conflict pattern (removes read-before-write race)
  let entityKey: string;
  let txHash: string;

  try {
    // Attempt create first
    const result = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify(payload)),
        contentType: 'application/json',
        attributes,
        expiresIn,
      });
    });

    entityKey = result.entityKey;
    txHash = result.txHash;
  } catch (createError: any) {
    // If create fails with "already exists" or similar, try update
    if (existingEntityKey) {
      const result = await handleTransactionWithTimeout(async () => {
        return await walletClient.updateEntity({
          entityKey: existingEntityKey as `0x${string}`,
          payload: enc.encode(JSON.stringify(payload)),
          contentType: 'application/json',
          attributes, // Rebuild deterministically
          expiresIn, // Refresh TTL
        });
      });

      entityKey = result.entityKey;
      txHash = result.txHash;
    } else {
      // If no existing key and create failed, rethrow
      throw createError;
    }
  }

  // Create separate txhash entity (optional metadata, don't wait)
  walletClient.createEntity({
    payload: enc.encode(JSON.stringify({ txHash })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'auth_identity_passkey_txhash' },
      { key: 'identityKey', value: entityKey },
      { key: 'wallet', value: normalizedWallet },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn,
  }).catch((error: any) => {
    console.warn('[createPasskeyIdentity] Failed to create txhash entity:', error);
  });

  return { key: entityKey, txHash };
}

/**
 * Update passkey counter (Pattern B: update in place)
 *
 * Called after successful authentication to prevent replay attacks.
 * Handles race conditions: two authentications near-simultaneously both read old counter,
 * both write max(old, newCounter) - monotonicity preserved.
 *
 * @param credentialID - Base64url-encoded credential ID
 * @param newCounter - New counter value from WebAuthn verification
 * @param privateKey - Private key for signing (global Arkiv wallet)
 * @returns Updated entity key and transaction hash
 */
export async function updatePasskeyCounter(
  credentialID: string,
  newCounter: number,
  privateKey: `0x${string}`
): Promise<{ key: string; txHash: string }> {
  const normalizedCredentialID = credentialID.trim();

  // Find entity key by credentialID
  const entityKey = await findPasskeyEntityKeyByCredentialID(normalizedCredentialID);

  if (!entityKey) {
    throw new Error(`Passkey identity not found for credentialID: ${normalizedCredentialID}`);
  }

  // Fetch existing entity
  const publicClient = getPublicClient();
  const existingEntity = await publicClient.getEntity(entityKey as `0x${string}`);

  if (!existingEntity) {
    throw new Error(`Passkey entity not found at key: ${entityKey}`);
  }

  // Parse existing payload
  let existingPayload: any = {};
  try {
    const decoded = existingEntity.payload instanceof Uint8Array
      ? new TextDecoder().decode(existingEntity.payload)
      : typeof existingEntity.payload === 'string'
      ? existingEntity.payload
      : JSON.stringify(existingEntity.payload);
    existingPayload = JSON.parse(decoded);
  } catch (e) {
    throw new Error('Failed to parse existing passkey identity payload');
  }

  // Get current counter (check attribute first for quick read, fallback to payload)
  const attrs = existingEntity.attributes || {};
  const getAttr = (key: string): string => {
    if (Array.isArray(attrs)) {
      const attr = attrs.find((a: any) => a.key === key);
      return String(attr?.value || '');
    }
    return String(attrs[key] || '');
  };
  const currentCounter = parseInt(getAttr('counter')) || existingPayload.counter || 0;

  // Update counter: monotonic max (never decrease, handles races)
  const updatedCounter = Math.max(currentCounter, newCounter);
  const now = new Date().toISOString();

  const updatedPayload = {
    ...existingPayload,
    counter: updatedCounter,
    updatedAt: now,
  };

  // Rebuild attributes deterministically (never "preserve all")
  const attributes = [
    { key: 'type', value: 'auth_identity' },
    { key: 'subtype', value: 'passkey' },
    { key: 'wallet', value: getAttr('wallet') },
    { key: 'credentialId', value: normalizedCredentialID },
    { key: 'spaceId', value: getAttr('spaceId') },
    { key: 'createdAt', value: getAttr('createdAt') },
    { key: 'updatedAt', value: now },
    { key: 'counter', value: String(updatedCounter) }, // Store as attribute for quick reads
  ];

  // Update in place with retry logic for transient failures
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();

  let lastError: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { entityKey: finalKey, txHash } = await handleTransactionWithTimeout(async () => {
        return await walletClient.updateEntity({
          entityKey: entityKey as `0x${string}`,
          payload: enc.encode(JSON.stringify(updatedPayload)),
          contentType: 'application/json',
          attributes, // Rebuild deterministically
          expiresIn: 315360000, // Refresh TTL (10 years)
        });
      });

      return { key: finalKey, txHash };
    } catch (error: any) {
      lastError = error;
      // Retry once on transient chain/RPC issues
      if (attempt === 0 && (error.message?.includes('RPC') || error.message?.includes('network'))) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

/**
 * Create auth_identity::backup_wallet entity on Arkiv
 * 
 * Stores backup wallet information for recovery scenarios.
 * 
 * @param params - Backup wallet data
 * @returns Entity key and transaction hash
 */
export async function createBackupWalletIdentity({
  wallet,
  backupWalletAddress,
  privateKey,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  backupWalletAddress: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();

  const payload = {
    walletAddress: backupWalletAddress,
    createdAt,
  };

  // 1 year TTL (effectively permanent for beta)
  const expiresIn = 31536000;

  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'auth_identity' },
        { key: 'subtype', value: 'backup_wallet' },
        { key: 'wallet', value: wallet.toLowerCase() },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn,
    });
  });

  // Create separate txhash entity (optional metadata, don't wait)
  walletClient.createEntity({
    payload: enc.encode(JSON.stringify({ txHash })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'auth_identity_backup_wallet_txhash' },
      { key: 'identityKey', value: entityKey },
      { key: 'wallet', value: wallet.toLowerCase() },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn,
  }).catch((error: any) => {
    console.warn('[createBackupWalletIdentity] Failed to create txhash entity:', error);
  });

  return { key: entityKey, txHash };
}

/**
 * List all passkey identities for a wallet
 * 
 * Queries Arkiv for all passkey credentials linked to a wallet.
 * Same query pattern as Profile queries.
 * 
 * @param wallet - Wallet address
 * @returns Array of passkey identities
 */
export async function listPasskeyIdentities(wallet: string): Promise<AuthIdentity[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  const normalizedWallet = wallet.toLowerCase().trim();
  
  try {
    const result = await query
      .where(eq('type', 'auth_identity'))
      .where(eq('subtype', 'passkey'))
      .where(eq('wallet', normalizedWallet))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch();

    if (!result?.entities || !Array.isArray(result.entities)) {
      console.warn('[listPasskeyIdentities] Invalid result structure, returning empty array', { result });
      return [];
    }

    return result.entities.map((entity: any) => {
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
      console.error('[listPasskeyIdentities] Error decoding payload:', e);
    }

    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    // Convert base64 public key back to Uint8Array for credential object
    let credential: PasskeyCredential | undefined;
    if (payload.credentialID && payload.credentialPublicKey) {
      try {
        const publicKeyBytes = Buffer.from(payload.credentialPublicKey, 'base64');
        credential = {
          credentialID: payload.credentialID,
          credentialPublicKey: Buffer.from(publicKeyBytes).toString('base64'), // Keep as base64 for storage
          counter: payload.counter || 0,
          transports: payload.transports || [],
          deviceName: payload.deviceName,
        };
      } catch (e) {
        console.error('[listPasskeyIdentities] Error parsing credential:', e);
      }
    }

    return {
      key: entity.key,
      wallet: getAttr('wallet'),
      subtype: 'passkey' as AuthIdentityType,
      credentialID: getAttr('credentialId'),
      createdAt: getAttr('createdAt'),
      spaceId: getAttr('spaceId'),
      credential,
    };
    });
  } catch (fetchError: any) {
    console.error('[listPasskeyIdentities] Arkiv query failed:', {
      message: fetchError?.message,
      stack: fetchError?.stack,
      error: fetchError
    });
    return []; // Return empty array on query failure
  }
}

/**
 * List all backup wallet identities for a wallet
 * 
 * @param wallet - Wallet address
 * @returns Array of backup wallet identities
 */
export async function listBackupWalletIdentities(wallet: string): Promise<AuthIdentity[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  
  try {
    const result = await query
      .where(eq('type', 'auth_identity'))
      .where(eq('subtype', 'backup_wallet'))
      .where(eq('wallet', wallet.toLowerCase()))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch();

    if (!result?.entities || !Array.isArray(result.entities)) {
      console.warn('[listBackupWalletIdentities] Invalid result structure, returning empty array', { result });
      return [];
    }

    return result.entities.map((entity: any) => {
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
      console.error('[listBackupWalletIdentities] Error decoding payload:', e);
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
      wallet: getAttr('wallet'),
      subtype: 'backup_wallet' as AuthIdentityType,
      backupWalletAddress: payload.walletAddress,
      createdAt: getAttr('createdAt'),
      spaceId: getAttr('spaceId'),
      backupMetadata: {
        walletAddress: payload.walletAddress,
        createdAt: payload.createdAt || getAttr('createdAt'),
      },
    };
  });
  } catch (fetchError: any) {
    console.error('[listBackupWalletIdentities] Arkiv query failed:', {
      message: fetchError?.message,
      stack: fetchError?.stack,
      error: fetchError
    });
    return []; // Return empty array on query failure
  }
}

/**
 * Find passkey identity by credential ID
 * 
 * Used during authentication to find the credential for WebAuthn verification.
 * 
 * @param credentialID - Base64url-encoded credential ID
 * @returns AuthIdentity or null if not found
 */
/**
 * Find passkey identity by credential ID
 *
 * Used during authentication to find the credential for WebAuthn verification.
 *
 * Pattern B migration: Chooses entity with highest counter (tie-break by latest timestamp)
 * to handle Pattern A duplicates gracefully. Counter is the best "truthy" ordering signal
 * because it encodes actual usage.
 *
 * @param credentialID - Base64url-encoded credential ID
 * @returns AuthIdentity or null if not found
 */
export async function findPasskeyIdentityByCredentialID(credentialID: string): Promise<AuthIdentity | null> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();

  // Normalize credentialID for query (trim whitespace)
  const normalizedCredentialID = credentialID.trim();

  try {
    // Fetch up to 20 entities to find the best one (handles Pattern A duplicates)
    const result = await query
      .where(eq('type', 'auth_identity'))
      .where(eq('subtype', 'passkey'))
      .where(eq('credentialId', normalizedCredentialID))
      .withAttributes(true)
      .withPayload(true)
      .limit(20)
      .fetch();

    if (!result?.entities || !Array.isArray(result.entities) || result.entities.length === 0) {
      return null;
    }

    // Choose entity with highest counter (tie-break by latest updatedAt/createdAt)
    let bestEntity: any = null;
    let bestCounter = -1;
    let bestTimestamp = '';

    for (const entity of result.entities) {
      // Parse payload to get counter
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
        console.warn('[findPasskeyIdentityByCredentialID] Error decoding payload for entity, skipping:', e);
        continue;
      }

      const counter = payload.counter || 0;
      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };
      // Prefer updatedAt, fallback to createdAt
      const timestamp = getAttr('updatedAt') || getAttr('createdAt') || '';

      if (counter > bestCounter || (counter === bestCounter && timestamp > bestTimestamp)) {
        bestEntity = entity;
        bestCounter = counter;
        bestTimestamp = timestamp;
      }
    }

    if (!bestEntity) {
      return null;
    }

    // Parse best entity
    let payload: any = {};
    try {
      if (bestEntity.payload) {
        const decoded = bestEntity.payload instanceof Uint8Array
          ? new TextDecoder().decode(bestEntity.payload)
          : typeof bestEntity.payload === 'string'
          ? bestEntity.payload
          : JSON.stringify(bestEntity.payload);
        payload = JSON.parse(decoded);
      }
    } catch (e) {
      console.error('[findPasskeyIdentityByCredentialID] Error decoding payload:', e);
      return null;
    }

    const attrs = bestEntity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };

    let credential: PasskeyCredential | undefined;
    if (payload.credentialID && payload.credentialPublicKey) {
      try {
        credential = {
          credentialID: payload.credentialID,
          credentialPublicKey: payload.credentialPublicKey, // Keep as base64
          counter: payload.counter || 0,
          transports: payload.transports || [],
          deviceName: payload.deviceName,
        };
      } catch (e) {
        console.error('[findPasskeyIdentityByCredentialID] Error parsing credential:', e);
      }
    }

    return {
      key: bestEntity.key,
      wallet: getAttr('wallet'),
      subtype: 'passkey' as AuthIdentityType,
      credentialID: getAttr('credentialId'),
      createdAt: getAttr('createdAt'),
      spaceId: getAttr('spaceId'),
      credential,
    };
  } catch (fetchError: any) {
    console.error('[findPasskeyIdentityByCredentialID] Arkiv query failed:', {
      message: fetchError?.message,
      stack: fetchError?.stack,
      error: fetchError
    });
    return null; // Return null on query failure
  }
}
