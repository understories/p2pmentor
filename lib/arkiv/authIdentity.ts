/**
 * Auth Identity CRUD helpers
 * 
 * Stores passkey credential metadata on Arkiv (replaces ephemeral in-memory Map).
 * Mirrors MetaMask pattern: wallet address = identity, auth_identity = credential metadata.
 * 
 * Reference: refs/doc/passkey_levelup.md
 */

import { eq } from "@arkiv-network/sdk/query";
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
 * Create auth_identity::passkey entity on Arkiv
 * 
 * Stores WebAuthn credential metadata for passkey authentication.
 * One entity per credential (supports multi-device).
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
  const createdAt = new Date().toISOString();

  // Convert public key to base64 for JSON storage
  const publicKeyBase64 = Buffer.from(credentialPublicKey).toString('base64');

  const payload = {
    credentialID,
    credentialPublicKey: publicKeyBase64,
    counter,
    transports: transports || [],
    deviceName,
    createdAt,
  };

  // 1 year TTL (effectively permanent for beta)
  const expiresIn = 31536000;

  // Normalize credentialID to ensure consistent encoding (base64url)
  const normalizedCredentialID = credentialID.trim();

  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'auth_identity' },
        { key: 'subtype', value: 'passkey' },
        { key: 'wallet', value: wallet.toLowerCase() },
        { key: 'credentialId', value: normalizedCredentialID }, // Store normalized credentialID
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
      { key: 'type', value: 'auth_identity_passkey_txhash' },
      { key: 'identityKey', value: entityKey },
      { key: 'wallet', value: wallet.toLowerCase() },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn,
  }).catch((error: any) => {
    console.warn('[createPasskeyIdentity] Failed to create txhash entity:', error);
  });

  return { key: entityKey, txHash };
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
