# Onboarding and Authentication

## Beta invite

Invite-only, small cohort. Focus on people we can support directly.

## Wallet connection

MetaMask connection flow with Mendoza testnet detection. Wallet address stored in session/cookies for state management.

## Passkey authentication

WebAuthn-based passkey login implemented. Embedded EVM keypairs unlocked via passkey authentication. Wallet client adapter (`lib/wallet/getWalletClientFromPasskey.ts`) produces Arkiv-compatible wallet client. No central database - credential mapping stored in Arkiv profile entities.

## Safety

All UI includes warnings about testnet-only usage. Testnet wallets should not hold real funds.
