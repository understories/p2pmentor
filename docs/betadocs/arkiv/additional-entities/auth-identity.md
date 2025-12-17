# Auth Identity Entity

## Overview

Stores passkey credential metadata and backup wallet information on Arkiv. Replaces ephemeral in-memory storage with persistent, on-chain credential tracking. Supports multi-device passkey authentication.

**Entity Type:** `auth_identity` (with subtypes)  
**Subtypes:** `auth_identity::passkey`, `auth_identity::backup_wallet`  
**TTL:** 1 year (31536000 seconds)  
**Immutability:** Immutable - updates create new entities

## Attributes

### Passkey Identity

- `type`: `'auth_identity'` (required)
- `subtype`: `'passkey'` (required)
- `wallet`: Wallet address (required, lowercase)
- `credentialId`: Base64url-encoded credential ID (required, stored as attribute `credentialId`)
- `spaceId`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `createdAt`: ISO timestamp (required)

### Backup Wallet Identity

- `type`: `'auth_identity'` (required)
- `subtype`: `'backup_wallet'` (required)
- `wallet`: Primary wallet address (required, lowercase)
- `backupWalletAddress`: Backup wallet address (required, lowercase)
- `spaceId`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `createdAt`: ISO timestamp (required)

## Payload

### Passkey Identity

```typescript
{
  credentialID: string;           // Base64url-encoded credential ID
  credentialPublicKey: string;    // Base64-encoded public key
  counter: number;                 // Signature counter
  transports?: string[];           // Transport methods (e.g., ["usb", "nfc"])
  deviceName?: string;             // Human-readable device name
  createdAt: string;              // ISO timestamp
}
```

### Backup Wallet Identity

```typescript
{
  backupWalletAddress: string;     // Backup wallet address
  createdAt: string;              // ISO timestamp
}
```

## Key Fields

### Passkey

- **wallet**: Primary wallet address
- **credentialID**: Unique credential identifier (base64url-encoded)
- **credentialPublicKey**: Public key for signature verification
- **counter**: Signature counter (prevents replay attacks)
- **transports**: Supported transport methods
- **deviceName**: User-friendly device name

### Backup Wallet

- **wallet**: Primary wallet address
- **backupWalletAddress**: Backup wallet for recovery

## Query Patterns

### Get All Passkeys for Wallet

```typescript
import { eq, and } from "@arkiv-network/sdk/query";
import { getPublicClient } from "@/lib/arkiv/client";

const publicClient = getPublicClient();
const result = await publicClient.buildQuery()
  .where(eq('type', 'auth_identity'))
  .where(eq('subtype', 'passkey'))
  .where(eq('wallet', walletAddress.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(10)
  .fetch();

const passkeys = result.entities.map(e => ({
  ...e.attributes,
  ...JSON.parse(e.payload),
  credential: JSON.parse(e.payload) // Full credential data
}));
```

### Get Backup Wallet

```typescript
const result = await publicClient.buildQuery()
  .where(eq('type', 'auth_identity'))
  .where(eq('subtype', 'backup_wallet'))
  .where(eq('wallet', walletAddress.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(1)
  .fetch();

const backupWallet = result.entities[0] 
  ? { ...result.entities[0].attributes, ...JSON.parse(result.entities[0].payload) }
  : null;
```

## Creation

### Create Passkey Identity

```typescript
import { createPasskeyIdentity } from "@/lib/arkiv/authIdentity";

const { key, txHash } = await createPasskeyIdentity({
  wallet: "0x1234...",
  credentialID: "base64url-encoded-credential-id",
  credentialPublicKey: "base64-encoded-public-key",
  counter: 0,
  transports: ["usb", "nfc"],
  deviceName: "iPhone 15 Pro",
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

### Create Backup Wallet Identity

```typescript
import { createBackupWalletIdentity } from "@/lib/arkiv/authIdentity";

const { key, txHash } = await createBackupWalletIdentity({
  wallet: "0x1234...", // Primary wallet
  backupWalletAddress: "0x5678...", // Backup wallet
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

## Transaction Hash Tracking

- `auth_identity_passkey_txhash`: Transaction hash tracking for passkey identities, linked via `identityKey` attribute
- `auth_identity_backup_wallet_txhash`: Transaction hash tracking for backup wallet identities, linked via `identityKey` attribute

## Security Considerations

- **Credential Storage**: Only metadata stored on-chain, not private keys
- **Multi-Device**: Multiple passkey entities per wallet (one per device)
- **Backup Recovery**: Backup wallet provides recovery mechanism
- **Counter**: Signature counter prevents replay attacks
- **Privacy**: Wallet addresses are public on-chain

## Related Entities

- `user_profile`: User profile linked via wallet address

## Example Use Cases

### Register New Passkey Device

```typescript
// After WebAuthn registration
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: new Uint8Array(32),
    rp: { name: "p2pmentor" },
    user: { id: new Uint8Array(16), name: wallet },
    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
  }
});

// Store on Arkiv
await createPasskeyIdentity({
  wallet: walletAddress,
  credentialID: base64urlEncode(credential.rawId),
  credentialPublicKey: base64Encode(credential.response.getPublicKey()),
  counter: 0,
  deviceName: "MacBook Pro",
  privateKey: userPrivateKey,
});
```

### Set Backup Wallet

```typescript
await createBackupWalletIdentity({
  wallet: primaryWallet,
  backupWalletAddress: backupWallet,
  privateKey: primaryPrivateKey,
});
```

## Notes

- **Multi-Device Support**: Each device gets its own passkey entity
- **Recovery**: Backup wallet provides account recovery mechanism
- **Immutability**: Cannot update credentials - create new entity to replace
- **TTL**: 1 year expiration (effectively permanent for beta)

