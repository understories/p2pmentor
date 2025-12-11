# Passkey Integration

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

## Status

**In progress**: Implementing Arkiv-native credential storage and recovery mechanisms.

See `refs/doc/passkey_levelup.md` for detailed engineering plan.
