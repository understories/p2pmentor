# Passkey Integration

For architectural rationale, see [Serverless and Trustless](/docs/philosophy/serverless-and-trustless).

Custom passkey-based authentication layer for beta while waiting for Mendoza to support EIP-7951 natively.

**Mental model:**
- Today: Passkey → authorizes → server signs → Arkiv
- Future: Passkey → signs → chain verifies → Arkiv

## Current Implementation (Beta)

This is an interim solution until Arkiv's Mendoza testnet supports EIP-7951 (Fusaka upgrade), which enables native P-256 signature verification on-chain.

**How it works (today):**
- WebAuthn passkey authenticates the user (Touch ID / Face ID / Windows Hello)
- The passkey signs a WebAuthn challenge (P-256) inside the OS authenticator
- The server verifies the assertion (WebAuthn standard verification)
- On success, the server signs Arkiv transactions using a funded secp256k1 Arkiv key
- Passkey credential metadata is stored on Arkiv as `auth_identity` entities

**Important:** In the current beta, passkeys authorize actions but do not directly sign Arkiv transactions. Arkiv writes are signed by a server-held secp256k1 key after successful passkey authentication.

- Wallet address remains the canonical identity (same model as MetaMask)
- Passkeys act as an authentication layer authorizing Arkiv writes

**Limitations (current beta):**
- Arkiv transactions are signed by a server-held key
- Passkeys are not yet verified on-chain
- Full trustless client-side signing is not yet enabled
- The server-held signing key is tightly scoped and cannot be used without successful passkey verification

## Identity Stability Plan

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

When Arkiv's Mendoza testnet supports EIP-7951 (Fusaka upgrade), passkey signatures (P-256 / secp256r1) can be verified directly on-chain.

This enables passkeys to become first-class cryptographic signers for blockchain actions, removing the need for a server-held signing key.

**What changes:**
- Passkey P-256 signatures are verified on-chain
- Server-held signing keys become unnecessary
- Native smart account / account abstraction patterns become possible
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

**In progress**: Hardening Arkiv-native credential storage and recovery mechanisms.

See `refs/doc/passkey_levelup.md` for detailed engineering plan.
