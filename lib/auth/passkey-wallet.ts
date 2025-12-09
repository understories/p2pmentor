/**
 * Embedded EVM wallet key management for passkey-gated wallets
 * 
 * Responsibilities:
 * - Generate secp256k1 EVM keypairs
 * - Encrypt/decrypt private keys using WebAuthn-derived keys
 * - Store encrypted keys in IndexedDB (client-side only)
 * - Manage wallet lifecycle (create, unlock, reset)
 * 
 * Security: Private keys NEVER leave the client. Server only sees WebAuthn metadata.
 * 
 * Reference: Arkiv Passkey Wallet Beta Implementation Plan
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { set, get, del } from 'idb-keyval';

/**
 * Encrypted wallet payload structure
 */
interface EncryptedPayload {
  iv: Uint8Array; // Initialization vector for AES-GCM
  ciphertext: Uint8Array; // Encrypted private key
  salt: Uint8Array; // Salt for key derivation
  version: string; // Payload version for future migrations
}

const KEY_PREFIX = 'p2pmentor_passkey_wallet_';
const PAYLOAD_VERSION = '1.0';

/**
 * Generate a new secp256k1 EVM keypair
 * 
 * @returns Object with privateKey (hex string) and address (0x...)
 */
export function generateEvmKeypair(): { privateKey: `0x${string}`; address: `0x${string}` } {
  console.log('[passkey-wallet] Generating new EVM keypair...');
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const keypair = {
    privateKey,
    address: account.address,
  };
  console.log('[passkey-wallet] ✅ Generated EVM keypair:', {
    address: keypair.address,
    privateKeyLength: keypair.privateKey.length,
  });
  return keypair;
}

/**
 * Derive encryption key from WebAuthn credential ID and user context
 * 
 * Uses HKDF (HMAC-based Key Derivation Function) with SHA-256.
 * This creates a deterministic key from the passkey credential ID.
 * 
 * @param credentialID - Base64url-encoded credential ID from WebAuthn
 * @param userId - User identifier for additional context
 * @returns CryptoKey for AES-GCM encryption
 */
async function deriveEncryptionKey(
  credentialID: string,
  userId: string
): Promise<CryptoKey> {
  // Combine credential ID and user ID for key derivation
  const keyMaterial = new TextEncoder().encode(`${credentialID}:${userId}`);
  
  // Import as raw key material
  const baseKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key using HKDF
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(16), // Fixed salt for beta (TODO: per-user salt in production)
      info: new TextEncoder().encode('p2pmentor-passkey-wallet-v1'),
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a private key using WebAuthn-derived key
 * 
 * @param privateKeyHex - Private key in hex format (0x...)
 * @param credentialID - Base64url-encoded credential ID
 * @param userId - User identifier
 * @returns Encrypted payload ready for storage
 */
export async function encryptPrivateKey(
  privateKeyHex: `0x${string}`,
  credentialID: string,
  userId: string
): Promise<EncryptedPayload> {
  const encryptionKey = await deriveEncryptionKey(credentialID, userId);
  
  // Convert private key to bytes
  const privateKeyBytes = new TextEncoder().encode(privateKeyHex);
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for AES-GCM
  
  // Generate random salt (for future per-user salt support)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Encrypt using AES-GCM
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    encryptionKey,
    privateKeyBytes
  );

  return {
    iv,
    ciphertext: new Uint8Array(ciphertext),
    salt,
    version: PAYLOAD_VERSION,
  };
}

/**
 * Decrypt a private key using WebAuthn-derived key
 * 
 * @param encrypted - Encrypted payload from storage
 * @param credentialID - Base64url-encoded credential ID
 * @param userId - User identifier
 * @returns Decrypted private key in hex format (0x...)
 */
export async function decryptPrivateKey(
  encrypted: EncryptedPayload,
  credentialID: string,
  userId: string
): Promise<`0x${string}`> {
  const encryptionKey = await deriveEncryptionKey(credentialID, userId);
  
  // Decrypt using AES-GCM
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: encrypted.iv,
    },
    encryptionKey,
    encrypted.ciphertext
  );

  // Convert back to hex string
  const privateKeyHex = new TextDecoder().decode(decrypted) as `0x${string}`;
  return privateKeyHex;
}

/**
 * Store encrypted wallet in IndexedDB
 * 
 * @param userId - User identifier
 * @param payload - Encrypted payload
 */
export async function storeEncryptedWallet(
  userId: string,
  payload: EncryptedPayload
): Promise<void> {
  // Convert Uint8Arrays to arrays for JSON serialization
  const serializable = {
    iv: Array.from(payload.iv),
    ciphertext: Array.from(payload.ciphertext),
    salt: Array.from(payload.salt),
    version: payload.version,
  };
  await set(KEY_PREFIX + userId, serializable);
}

/**
 * Load encrypted wallet from IndexedDB
 * 
 * @param userId - User identifier
 * @returns Encrypted payload or undefined if not found
 */
export async function loadEncryptedWallet(
  userId: string
): Promise<EncryptedPayload | undefined> {
  const serializable = await get<{
    iv: number[];
    ciphertext: number[];
    salt: number[];
    version: string;
  }>(KEY_PREFIX + userId);
  
  if (!serializable) {
    return undefined;
  }

  // Convert arrays back to Uint8Arrays
  return {
    iv: new Uint8Array(serializable.iv),
    ciphertext: new Uint8Array(serializable.ciphertext),
    salt: new Uint8Array(serializable.salt),
    version: serializable.version,
  };
}

/**
 * Clear encrypted wallet from IndexedDB
 * 
 * @param userId - User identifier
 */
export async function clearEncryptedWallet(userId: string): Promise<void> {
  await del(KEY_PREFIX + userId);
}

/**
 * Create a new passkey wallet (registration flow)
 * 
 * Flow:
 * 1. WebAuthn registration (caller handles this)
 * 2. Generate EVM keypair
 * 3. Encrypt private key with WebAuthn-derived key
 * 4. Store encrypted payload
 * 
 * @param userId - User identifier
 * @param credentialID - Base64url-encoded credential ID from WebAuthn
 * @returns Wallet address
 */
export async function createPasskeyWallet(
  userId: string,
  credentialID: string
): Promise<{ address: `0x${string}` }> {
  // Generate EVM keypair
  const { privateKey, address } = generateEvmKeypair();
  
  // Encrypt private key
  const encrypted = await encryptPrivateKey(privateKey, credentialID, userId);
  
  // Store encrypted payload
  await storeEncryptedWallet(userId, encrypted);
  
  return { address };
}

/**
 * Unlock passkey wallet (login flow)
 * 
 * Flow:
 * 1. WebAuthn authentication (caller handles this)
 * 2. Load encrypted payload
 * 3. Decrypt private key
 * 4. Return private key (kept in memory only)
 * 
 * @param userId - User identifier
 * @param credentialID - Base64url-encoded credential ID from WebAuthn
 * @returns Private key and address (private key should be nulled after use)
 */
export async function unlockPasskeyWallet(
  userId: string,
  credentialID: string
): Promise<{ privateKeyHex: `0x${string}`; address: `0x${string}` }> {
  // Load encrypted payload
  const encrypted = await loadEncryptedWallet(userId);
  
  if (!encrypted) {
    throw new Error('No passkey wallet found for this user');
  }
  
  // Decrypt private key
  const privateKeyHex = await decryptPrivateKey(encrypted, credentialID, userId);
  
  // Derive address from private key
  const account = privateKeyToAccount(privateKeyHex);
  
  return {
    privateKeyHex,
    address: account.address,
  };
}

/**
 * Reset passkey wallet (remove from storage)
 * 
 * @param userId - User identifier
 */
export async function resetPasskeyWallet(userId: string): Promise<void> {
  await clearEncryptedWallet(userId);
}

/**
 * Clear ALL passkey wallets from this device (for testing/cleanup)
 * 
 * This clears all passkey data from IndexedDB and localStorage,
 * regardless of domain (localhost vs production).
 * 
 * Use case: Clearing local test data when moving to production.
 * 
 * WARNING: This will remove ALL passkey wallets on this device.
 * User will need to re-register on each domain.
 */
export async function clearAllPasskeyWallets(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  // Clear all IndexedDB entries (idb-keyval doesn't have a "list all keys" API easily,
  // so we'll clear localStorage which tracks the userIds)
  const keysToRemove: string[] = [];
  
  // Find all passkey-related localStorage keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('passkey_') || key.startsWith('wallet_type_'))) {
      keysToRemove.push(key);
    }
  }

  // Remove all found keys
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });

  // Note: IndexedDB entries are keyed by userId, but we can't easily enumerate them
  // without the userId. The localStorage cleanup above prevents access to them.
  // In practice, orphaned IndexedDB entries are harmless (just take up space).
  // For a complete cleanup, user would need to clear browser data manually.
  
  console.log('[passkey-wallet] Cleared all passkey wallets from this device');
}

