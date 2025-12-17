# Passkey Integration

For architectural rationale, see [Serverless and Trustless](/docs/philosophy/serverless-and-trustless).

Custom passkey implementation for beta while waiting for Mendoza to support EIP-7951 natively.

## Current Implementation

We built a local secp256k1 wallet gated by WebAuthn passkeys. This is an interim solution until Arkiv's Mendoza testnet supports EIP-7951 (Fusaka upgrade), which enables native P-256 signature verification on-chain.

**How it works:**
- WebAuthn passkey authenticates the user
- Unlocks a local secp256k1 private key stored in IndexedDB (encrypted)
- Wallet address is the canonical identity (same as MetaMask)
- All data stored on Arkiv (no server-side storage)

**Limitations:**
- Credentials currently stored in server memory (ephemeral, lost on restart)
- Local wallet only (not on-chain)
- Requires browser storage (IndexedDB)

## Stability Plan

We're upgrading to make passkey identities as stable as MetaMask identities:

1. **Arkiv-native credential storage**: Store WebAuthn credential metadata as Arkiv entities (replaces server memory)
2. **Multi-device support**: Register passkeys on multiple devices, all link to same wallet
3. **Recovery mechanism**: Backup signer (MetaMask or seed phrase) for device loss scenarios
4. **Regrow integration**: Query Arkiv to restore passkey linkage when browser storage is cleared

**Architecture:**
- Wallet address = identity (same as MetaMask pattern)
- Profile entity links wallet to user data (same as MetaMask)
- `auth_identity` entity stores passkey credential metadata (MetaMask doesn't need this)

## Future: EIP-7951 / Fusaka

When Mendoza supports EIP-7951:
- Passkey P-256 key signs directly on-chain (no local wallet needed)
- Native smart account support
- No credential storage needed (WebAuthn handles it)
- Same wallet address model (compatible with current implementation)

**Migration path:**
- Current wallet address remains the identity
- Profile entity unchanged
- `auth_identity` entity becomes optional

## Known Issues & Solutions

### Stable User IDs (No More `user_${Date.now()}`)

**Issue**: Previous implementation generated throwaway user IDs (`user_${Date.now()}`) on each registration, creating multiple passkeys in Safari's keychain even for the same wallet. This was a developer problem during testing/deployment, but also affected production if localStorage was cleared.

**Solution**: Use stable wallet-based user IDs:
- Format: `wallet_${walletAddress.slice(2, 10)}` (e.g., `wallet_12345678` for `0x12345678...`)
- User display name: Shortened wallet address (e.g., `0x1234...5678`)
- Only generate temporary IDs as last resort for truly new users (then immediately update to wallet-based ID)

**Implementation**:
- `PasskeyLoginButton` now generates stable userId from wallet address
- Server-side `getRegistrationOptions()` uses meaningful `userName` for browser display
- After wallet creation, temporary IDs are immediately replaced with wallet-based stable IDs

**Why this works**: Safari shows meaningful names in the passkey picker, and the same wallet always uses the same userId, preventing duplicate registrations even across deployments.

### Arkiv-First Check (Default to Login, Not Registration)

**Issue**: App would register new passkeys even when Arkiv already had an identity for the wallet, because it only checked localStorage/IndexedDB.

**Solution**: Always check Arkiv FIRST before any registration attempt:
1. Query Arkiv for existing passkey identities (using wallet address from localStorage or previous session)
2. If Arkiv has identity → attempt LOGIN (not registration)
3. Only register if truly no identity exists anywhere

**Implementation**:
- `PasskeyLoginButton` queries Arkiv at the start of `handlePasskeyAuth()`
- If Arkiv identity found, attempts authentication with existing credential
- Registration flow only reached if no Arkiv identity exists
- Server-side `excludeCredentials` provides additional protection

**Why this works**: Arkiv is the source of truth. Even after deployment/restart, the app knows "this wallet already has passkeys" and defaults to login, preventing duplicate registrations.

### Duplicate Passkey Prevention

**Issue**: The WebAuthn API (`navigator.credentials.create()`) is called client-side immediately when the user clicks the passkey button, before Arkiv can be queried for existing credentials. This can result in multiple passkeys being registered for the same wallet.

**Solution**: Following WebAuthn best practices, we query Arkiv for existing passkey identities **on the server side** before generating registration options. The server populates `excludeCredentials` with existing credential IDs from Arkiv, which prevents the WebAuthn API itself from creating duplicate passkeys.

**Implementation**:
- `getRegistrationOptions()` now accepts `walletAddress` parameter
- Server queries Arkiv for existing `auth_identity::passkey` entities
- Existing credential IDs are converted to `PublicKeyCredentialDescriptor` format
- `excludeCredentials` is populated in registration options
- If a duplicate credential exists, `navigator.credentials.create()` will reject with `InvalidStateError`

**Why this works**: Even if client-side checks miss something (e.g., localStorage cleared but Arkiv has identity), the WebAuthn API itself enforces uniqueness through `excludeCredentials`. This is the standard WebAuthn pattern for preventing duplicate registrations.

**Limitation**: This requires the `walletAddress` to be known before registration. For truly new users, this is not an issue. For recovery scenarios, we check Arkiv client-side first and attempt authentication instead of registration.

### Credential Recovery & Local State Sync

**Issue**: When multiple passkeys exist in the OS keychain (from previous registrations), users may select a passkey that doesn't match what's stored in localStorage. This causes "Credential not found" errors even though the credential exists on Arkiv.

**Solution**: When authentication fails with "Credential not found", we:
1. Extract the `credentialID` from the WebAuthn response (the credential the user actually selected)
2. Query Arkiv using `findPasskeyIdentityByCredentialID()` to find which wallet this credential belongs to
3. If found on Arkiv, automatically recover the wallet and sync localStorage
4. If not found, provide a clear error message suggesting the user try a different passkey or reset

**Implementation**:
- `loginWithPasskey()` now returns `credentialID` from the WebAuthn response
- API route `/api/passkey/login/complete` queries Arkiv when verification fails and returns recovery info
- Client-side recovery logic in `PasskeyLoginButton` automatically syncs localStorage when credential is found on Arkiv
- User-friendly error messages guide users to select the correct passkey or reset if needed

**Why this works**: Arkiv is the source of truth for credential-to-wallet mappings. Even if localStorage is out of sync, we can recover by querying Arkiv with the credentialID from the WebAuthn response. This is a local-only issue (localStorage/IndexedDB out of sync with Arkiv), not a fundamental limitation.

**User Experience**: Instead of forcing users to reset, the system now automatically recovers when possible, or provides clear guidance when manual intervention is needed.

## Status

**In progress**: Implementing Arkiv-native credential storage and recovery mechanisms.

See `refs/doc/passkey_levelup.md` for detailed engineering plan.
