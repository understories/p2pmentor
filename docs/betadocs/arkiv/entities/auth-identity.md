# Auth Identity Entity

## Overview

Stores passkey credential metadata and backup wallet information on Arkiv. Replaces ephemeral in-memory storage with persistent, on-chain credential tracking. Supports multi-device passkey authentication.

**Entity Type:** `auth_identity` (with subtypes)
**Subtypes:** `auth_identity::passkey`, `auth_identity::backup_wallet`
**TTL:** 365 days (`auth_identity` lifetime in `lib/arkiv/schema.ts`; no `permanent()`)
**Update Pattern:** Pattern B (update in place with stable entity keys)

## Attributes

### Passkey Identity

- `type`: `'auth_identity'` (required)
- `subtype`: `'passkey'` (required)
- `wallet`: Wallet address (required, `addr`)
- `credential_id`: Base64url-encoded credential ID (required, stored as attribute `credential_id`)
- `space_id`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `created_at`: `u64` epoch milliseconds (required, preserved on updates)
- `updated_at`: `u64` epoch milliseconds (required, set to now on every update)
- `counter`: Signature counter as string (required, stored as attribute for quick reads)
- `last_used_at`: `u64` epoch milliseconds (set on counter updates, used for tie-breaking)

### Backup Wallet Identity

- `type`: `'auth_identity'` (required)
- `subtype`: `'backup_wallet'` (required)
- `wallet`: Primary wallet address (required, `addr`)
- `space_id`: Space ID (from `SPACE_ID` config, defaults to `'beta-launch'` in production, `'local-dev'` in development) (required)
- `created_at`: `u64` epoch milliseconds (required)
- The backup wallet address is stored in the payload (`backupWalletAddress`)

All `auth_identity` entities also carry `project` and `schema_version` (added by `entityAttributes`).

## Payload

### Passkey Identity

```typescript
{
  credentialID: string;           // Base64url-encoded credential ID
  credentialPublicKey: string;    // Base64-encoded public key (immutable once set)
  counter: number;                 // Signature counter (monotonic max on updates)
  transports?: string[];           // Transport methods (e.g., ["usb", "nfc"]) - merged set union on updates
  deviceName?: string;             // Human-readable device name (last-write-wins)
  createdAt: string;              // ISO timestamp (preserved earliest on updates)
  updatedAt: string;              // ISO timestamp (always set to now on updates)
  rpId?: string;                  // Relying Party ID for RP mismatch detection
}
```

### Backup Wallet Identity

```typescript
{
  backupWalletAddress: string; // Backup wallet address
  createdAt: string; // ISO timestamp
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
import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, attrsToRecord, parsePayload } from '@/lib/arkiv/read';

const result = await arkivSelect('auth_identity')
  .where(eqAttr('subtype', 'passkey'))
  .where(eqAttr('wallet', walletAddress.toLowerCase()))
  .limit(10)
  .fetch();

const passkeys = result.entities.map((e) => ({
  ...attrsToRecord(e),
  ...parsePayload(e),
  credential: parsePayload(e), // Full credential data
}));
```

### Get Backup Wallet

```typescript
const result = await arkivSelect('auth_identity')
  .where(eqAttr('subtype', 'backup_wallet'))
  .where(eqAttr('wallet', walletAddress.toLowerCase()))
  .limit(1)
  .fetch();

const backupWallet = result.entities[0]
  ? { ...attrsToRecord(result.entities[0]), ...parsePayload(result.entities[0]) }
  : null;
```

## Creation

### Create Passkey Identity

```typescript
import { createPasskeyIdentity } from '@/lib/arkiv/authIdentity';

const { key, txHash } = await createPasskeyIdentity({
  wallet: '0x1234...',
  credentialID: 'base64url-encoded-credential-id',
  credentialPublicKey: 'base64-encoded-public-key',
  counter: 0,
  transports: ['usb', 'nfc'],
  deviceName: 'iPhone 15 Pro',
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

### Create Backup Wallet Identity

```typescript
import { createBackupWalletIdentity } from '@/lib/arkiv/authIdentity';

const { key, txHash } = await createBackupWalletIdentity({
  wallet: '0x1234...', // Primary wallet
  backupWalletAddress: '0x5678...', // Backup wallet
  privateKey: getPrivateKey(),
  spaceId: 'local-dev', // Default in library functions; API routes use SPACE_ID from config
});
```

## Transaction Hash Tracking

- `auth_identity_passkey_txhash`: Transaction hash tracking for passkey identities, linked via `identity_key` attribute
- `auth_identity_backup_wallet_txhash`: Transaction hash tracking for backup wallet identities, linked via `identity_key` attribute

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
    rp: { name: 'p2pmentor' },
    user: { id: new Uint8Array(16), name: wallet },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
  },
});

// Store on Arkiv
await createPasskeyIdentity({
  wallet: walletAddress,
  credentialID: base64urlEncode(credential.rawId),
  credentialPublicKey: base64Encode(credential.response.getPublicKey()),
  counter: 0,
  deviceName: 'MacBook Pro',
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

## Pattern B Update Semantics

Passkey identities use Pattern B (update in place) with deterministic merge rules:

- **createdAt**: Preserved earliest (never changed)
- **updatedAt**: Always set to now on updates
- **counter**: Monotonic max (never decrease, handles race conditions)
- **credentialPublicKey**: Immutable once set (if changed, treat as suspicious)
- **transports**: Merged set union (avoid accidental loss)
- **deviceName**: Last-write-wins
- **Attributes**: Rebuilt deterministically on every write (never "preserve all")

### Counter Updates

Counter updates use `updatePasskeyCounter()` function which:

- Updates counter in-place (no duplicate entities)
- Handles race conditions with `Math.max()` for monotonicity
- Stores counter as attribute for quick reads
- Retries on transient chain/RPC failures

## Notes

- **Multi-Device Support**: Each device gets its own passkey entity (deduplicated by credentialID)
- **Recovery**: Backup wallet provides account recovery mechanism
- **Pattern B**: Updates use `replaceArkivEntity()` (Arkiv 0.8 `patchEntity`) with stable entity keys (no duplicates). Patches do not extend expiry.
- **TTL**: 365 days. Long-lived types are meant to be renewed with `extendEntity` (a planned follow-up), not given a huge lifetime
- **Migration**: Legacy Pattern A duplicates are handled gracefully (choose highest counter)
