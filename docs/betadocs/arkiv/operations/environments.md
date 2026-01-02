# Environments and Data Seeds

## Overview

p2pmentor uses a single signing wallet (configured via `ARKIV_PRIVATE_KEY`) to sign all server-side entity creation transactions. For data isolation between environments, use `spaceId` attributes on entities, not different signing wallets.

## How It Works

### Signing Wallet

The signing wallet is derived from `ARKIV_PRIVATE_KEY`:

```typescript
// lib/config.ts
export const ARKIV_PRIVATE_KEY = process.env.ARKIV_PRIVATE_KEY;
export const CURRENT_WALLET = ARKIV_PRIVATE_KEY
  ? privateKeyToAccount(ARKIV_PRIVATE_KEY).address
  : undefined;
```

Each private key corresponds to a unique wallet address. Different private keys produce different signing wallets.

### Entity Creation

All server-side entity creation uses the signing wallet:

```typescript
// Example: Creating a profile
const walletClient = getWalletClientFromPrivateKey(privateKey);
await walletClient.createEntity({
  attributes: [
    { key: 'type', value: 'user_profile' },
    { key: 'wallet', value: userWallet }, // User's profile wallet
    // ...
  ],
  // ...
});
```

The transaction is signed by the signing wallet (from `ARKIV_PRIVATE_KEY`), but entity attributes reference the user's profile wallet.

### Querying

Queries filter by user wallet addresses, not signing wallet:

```typescript
// Query by user's profile wallet
const query = publicClient.buildQuery()
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', userWallet.toLowerCase()))
  .fetch();
```

The signing wallet address is not used in queries. All queries filter by the `wallet` attribute, which contains the user's profile wallet address.

## Creating Different Environments

### Use SpaceId for Data Isolation

**Important:** Changing the signing wallet does NOT provide data isolation. Queries filter by entity attributes (like `spaceId` and `wallet`), not by which wallet signed the transaction.

To create separate data environments, use different `spaceId` values:

**Default Space ID:**
The default `spaceId` is determined by `SPACE_ID` in `lib/config.ts`:
- If `BETA_SPACE_ID` environment variable is set, use that value
- Otherwise: `'beta-launch'` in production (`NODE_ENV === 'production'`), `'local-dev'` in development

**Development Environment:**
```bash
# Uses 'local-dev' by default (or set explicitly)
BETA_SPACE_ID=local-dev npm run dev
```

**Production Environment:**
```bash
# Uses 'beta-launch' by default (or set explicitly)
BETA_SPACE_ID=beta-launch npm run build
```

**Seed/Example Data:**
```bash
# Use custom spaceId for seed data
BETA_SPACE_ID=local-dev-seed npm run seed
```

Each environment uses a different `spaceId`, and queries filter by `spaceId` to show only relevant data. API routes use `SPACE_ID` from config when creating entities.

### Why SpaceId, Not Signing Wallet?

**Signing Wallet:**
- Only used to sign transactions (technical detail)
- Not stored in entity attributes
- Not used in queries
- Changing it doesn't hide old data

**SpaceId:**
- Stored as an attribute on every entity
- Can be filtered in queries
- Provides real data isolation
- Changing it effectively creates separate environments

### Example: The Difference

**Scenario:** You want to separate development data from production data.

**❌ Wrong Approach (Changing Signing Wallet):**
```bash
# Development
ARKIV_PRIVATE_KEY=0xdev123... npm run dev
# Creates entities signed by wallet 0xdev123...

# Production
ARKIV_PRIVATE_KEY=0xprod789... npm run build
# Creates entities signed by wallet 0xprod789...
```

**Problem:** Queries still return ALL entities because they don't filter by signing wallet:
```typescript
const profiles = await listUserProfiles();
// Returns ALL profiles (dev + prod), regardless of signing wallet
```

**✅ Correct Approach (Using SpaceId):**
```bash
# Development
BETA_SPACE_ID=local-dev npm run dev
# Creates entities with spaceId: 'local-dev'

# Production
BETA_SPACE_ID=beta-launch npm run build
# Creates entities with spaceId: 'beta-launch'
```

**Solution:** Queries filter by `spaceId`:
```typescript
const profiles = await listUserProfiles({ spaceId: 'beta-launch' });
// Returns ONLY profiles with spaceId: 'beta-launch'
```

### Changing the Signing Wallet

Changing `ARKIV_PRIVATE_KEY` creates a different signing wallet, but this does NOT provide data isolation:

1. Different signing wallets create separate transaction histories on Arkiv
2. Queries still return all entities (they filter by `spaceId` and `wallet`, not signing wallet)
3. Old entities remain visible because queries don't filter by signing wallet
4. Use `spaceId` instead for data isolation

**When to change signing wallet:**
- Security rotation (mainnet)
- Separate transaction cost tracking
- Auditing which wallet signed specific transactions

**Not for:**
- Data isolation (use `spaceId`)
- Environment separation (use `spaceId`)
- Hiding development data (use `spaceId`)

## Seeding Data

### Seed Scripts

Seed scripts use the signing wallet to create initial data, but use `spaceId` to separate seeds. This section covers best practices for writing safe, reliable seed scripts.

#### Prerequisites

Before running a seed script:

1. **Install dependencies:** `npm install` or `pnpm install`
2. **Set environment variables:** Create a `.env` file in the project root with:
   - `ARKIV_PRIVATE_KEY=0x...` (required for creating entities)
   - `BETA_SPACE_ID=...` (optional, defaults based on `NODE_ENV`)
3. **Fund the signing wallet:** The wallet derived from `ARKIV_PRIVATE_KEY` must have funds for transaction fees (on Mendoza testnet, use the faucet)

#### SpaceId Safety Verification

**Critical Finding:** Not all entity creation functions accept `spaceId` as a parameter:

- `createAsk()`, `createOffer()`, `createUserProfile()` use `SPACE_ID` from config (not a parameter)
- `createSkill()` and some other functions accept `spaceId` parameter (defaults to `SPACE_ID`)

**Best Practice:** Always verify `SPACE_ID` matches your target before creating entities:

```typescript
import { SPACE_ID } from '@/lib/config';

const TARGET_SPACE_ID = 'local-dev-seed';

// Verify spaceId before proceeding
if (SPACE_ID !== TARGET_SPACE_ID) {
  console.error(`❌ ERROR: SPACE_ID is "${SPACE_ID}", expected "${TARGET_SPACE_ID}"`);
  console.error(`   Set BETA_SPACE_ID=${TARGET_SPACE_ID} environment variable`);
  process.exit(1);
}
```

This prevents accidentally seeding to the wrong space.

#### Rate Limiting

Arkiv has rate limits on transaction submission. To avoid errors:

- Add 300-500ms delay between each entity creation
- Use sequential execution (not parallel)
- Handle rate limit errors gracefully

```typescript
const DELAY_MS = 400;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

for (const entity of entitiesToCreate) {
  await delay(DELAY_MS);
  // Create entity...
}
```

#### Existing Entity Checks

Prevent duplicate entities by checking if they already exist:

```typescript
const existing = await listEntities({
  spaceId: TARGET_SPACE_ID,
  // ... other filters
  limit: 1
});

if (existing.length > 0) {
  console.log(`⏭️  Skipping (already exists)`);
  continue;
}
```

#### Error Handling

Handle blockchain errors gracefully with user-friendly messages:

```typescript
try {
  const result = await createEntity(...);
  console.log(`✅ Created: ${result.key}`);
} catch (error: any) {
  const errorMsg = error?.message || String(error || 'Unknown error');
  let friendlyError = errorMsg;

  // Provide user-friendly error messages
  if (errorMsg.includes('replacement transaction underpriced') || errorMsg.includes('nonce')) {
    friendlyError = 'Transaction conflict (nonce issue). Wait a moment and try again.';
  } else if (errorMsg.includes('rate limit')) {
    friendlyError = 'Rate limit exceeded. Please wait a moment and try again.';
  } else if (errorMsg.includes('insufficient funds')) {
    friendlyError = 'Insufficient funds. Make sure the signing wallet has enough funds.';
  }

  console.error(`❌ Failed: ${friendlyError}`);
  // Continue with next entity, don't fail entire script
}
```

#### Complete Example

Here's a complete seed script pattern with all safety checks:

```typescript
/**
 * Seed script example with safety patterns
 *
 * Prerequisites:
 * 1. Install dependencies: npm install
 * 2. Set ARKIV_PRIVATE_KEY in .env file
 * 3. Set BETA_SPACE_ID=target-space-id
 *
 * Usage:
 *   BETA_SPACE_ID=local-dev-seed npx tsx scripts/seed-example.ts
 */

import 'dotenv/config';
import { createSkill } from '../lib/arkiv/skill';
import { getPrivateKey, SPACE_ID } from '../lib/config';
import { listSkills } from '../lib/arkiv/skill';

const TARGET_SPACE_ID = 'local-dev-seed';
const DELAY_MS = 400;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Verify spaceId safety
function verifySpaceIdSafety() {
  if (SPACE_ID !== TARGET_SPACE_ID) {
    console.error(`❌ ERROR: SPACE_ID is "${SPACE_ID}", expected "${TARGET_SPACE_ID}"`);
    console.error(`   Set BETA_SPACE_ID=${TARGET_SPACE_ID} environment variable`);
    process.exit(1);
  }
}

async function seedSkills() {
  verifySpaceIdSafety();

  if (!process.env.ARKIV_PRIVATE_KEY) {
    console.error('❌ ERROR: ARKIV_PRIVATE_KEY is not set');
    process.exit(1);
  }

  const privateKey = getPrivateKey();
  const skillsToSeed = [
    { name: 'React', description: 'React framework' },
    { name: 'TypeScript', description: 'TypeScript language' },
  ];

  for (const skill of skillsToSeed) {
    await delay(DELAY_MS);

    try {
      // Check if exists
      const existing = await listSkills({
        slug: skill.name.toLowerCase().replace(/\s+/g, '-'),
        spaceId: TARGET_SPACE_ID,
        limit: 1,
      });

      if (existing.length > 0) {
        console.log(`⏭️  Skipping "${skill.name}" (already exists)`);
        continue;
      }

      // Create with explicit spaceId
      const { key, txHash } = await createSkill({
        name_canonical: skill.name,
        description: skill.description,
        privateKey,
        spaceId: TARGET_SPACE_ID, // Explicit parameter
      });

      console.log(`✅ Created "${skill.name}" (key: ${key.slice(0, 16)}...)`);
    } catch (error: any) {
      const errorMsg = error?.message || String(error || 'Unknown error');
      let friendlyError = errorMsg;

      if (errorMsg.includes('replacement transaction underpriced') || errorMsg.includes('nonce')) {
        friendlyError = 'Transaction conflict. Wait a moment and try again.';
      } else if (errorMsg.includes('rate limit')) {
        friendlyError = 'Rate limit exceeded. Please wait and try again.';
      }

      console.error(`❌ Failed to create "${skill.name}": ${friendlyError}`);
    }
  }
}

seedSkills().catch(console.error);
```

#### Seed Script Safety Checklist

Before running a seed script, verify:

- [ ] `BETA_SPACE_ID` environment variable is set correctly
- [ ] Script verifies `SPACE_ID` matches target before proceeding
- [ ] Script checks for existing entities before creating
- [ ] Script has rate limiting (300-500ms delays)
- [ ] Script handles errors gracefully (continues on error)
- [ ] Script logs all operations clearly
- [ ] `ARKIV_PRIVATE_KEY` is set and valid
- [ ] Signing wallet has sufficient funds for transaction fees

#### Common Errors and Solutions

**"replacement transaction underpriced":**
- A previous transaction with the same nonce is still pending
- Solution: Wait 30-60 seconds for pending transaction to confirm, then try again

**"rate limit exceeded":**
- Too many requests in a short time
- Solution: Wait a few minutes between runs, or increase delays between entity creation

**"insufficient funds":**
- Signing wallet doesn't have enough funds for transaction fees
- Solution: Fund the signing wallet on Mendoza testnet (use faucet)

**"SPACE_ID mismatch":**
- Script is trying to seed to wrong space
- Solution: Set `BETA_SPACE_ID` environment variable correctly before running

### Multiple Seeds

You can maintain multiple data seeds using different `spaceId` values:

1. **Seed A**: `BETA_SPACE_ID=seed-a` → Creates entities with `spaceId: 'seed-a'`
2. **Seed B**: `BETA_SPACE_ID=seed-b` → Creates entities with `spaceId: 'seed-b'`
3. **Production**: `BETA_SPACE_ID=beta-launch` → Creates entities with `spaceId: 'beta-launch'`

All seeds coexist on Arkiv. Queries filter by `spaceId` to show only the relevant seed data.

**Note:** Library functions (like `createLearnerQuest`) default to `'local-dev'` if no `spaceId` is provided. API routes use `SPACE_ID` from config (which respects `BETA_SPACE_ID` env var).

## Important Considerations

### Space ID

All entities include a `spaceId` attribute. This is the primary mechanism for data isolation:

- `spaceId` is stored as an attribute on every entity
- Queries can filter by `spaceId` to show only relevant data
- Different environments should use different `spaceId` values
- The signing wallet is independent of `spaceId` (just signs transactions)

### User Wallet Addresses

User wallet addresses (profile wallets) are independent of the signing wallet:

- Users connect with their own wallets (MetaMask, Passkey)
- User wallet addresses are stored in entity attributes
- Queries filter by user wallet addresses
- Changing the signing wallet does not affect user wallet addresses

### Transaction Costs

Each signing wallet must have funds on the Arkiv network:

- Testnet: Use Mendoza testnet faucet for funds
- Mainnet: Signing wallet needs mainnet funds for transaction fees
- Different signing wallets require separate funding

## Verification

### Arkiv Explorer

View entities by signing wallet on Arkiv Explorer:

1. Navigate to [Arkiv Explorer](https://explorer.mendoza.hoodi.arkiv.network)
2. Search by transaction hash or entity key
3. View which wallet signed each transaction
4. Verify entities are signed by the expected wallet

### Query Verification

Verify queries return correct data:

```typescript
// Query should return entities regardless of signing wallet
const profiles = await listProfiles();
// Returns all profiles, signed by any wallet
```

Queries filter by entity attributes (user wallet, type, etc.), not by signing wallet.

## Summary

### For Data Isolation: Use SpaceId

- Different `BETA_SPACE_ID` values create separate data environments
- Queries filter by `spaceId` attribute to show only relevant data
- Changing `spaceId` effectively creates a new data environment
- All entity sets coexist on Arkiv, but queries filter them by `spaceId`

### Signing Wallet: Technical Detail Only

- Different `ARKIV_PRIVATE_KEY` values create different signing wallets
- Signing wallet is used to sign transactions (technical detail)
- Signing wallet is NOT used in queries
- Changing signing wallet does NOT provide data isolation
- Use `spaceId` instead for environment separation

### Best Practice

**For environment separation:**
- ✅ Use `BETA_SPACE_ID` environment variable
- ✅ Set different `spaceId` values per environment
- ✅ Queries filter by `spaceId` automatically

**For signing transactions:**
- Use `ARKIV_PRIVATE_KEY` (one wallet is sufficient)
- Only change if needed for security rotation or cost tracking
- Does not affect data visibility or isolation

## Related Documentation

- [Wallet Architecture](wallet-architecture.md) - Profile wallet vs signing wallet
- [Arkiv Overview](overview.md) - Core Arkiv concepts
- [Entity Versioning](patterns/entity-versioning.md) - Immutability patterns

