# 06_seed_scripts.md — Seed Script Patterns (Safety-First)

## Critical Safety Rules

When creating seed scripts for Arkiv applications:

1. **Verify SPACE_ID before creating any entities** - Fail immediately if incorrect
2. **Some create functions use SPACE_ID from config (not parameters)** - Critical finding
3. **Always check for existing entities before creating** - Prevent duplicates
4. **Add rate limiting delays (300-500ms)** - Avoid rate limit errors
5. **Handle blockchain errors gracefully** - Provide user-friendly messages
6. **Document prerequisites clearly** - Dependencies, env vars, wallet funding

## SpaceId Safety Pattern

**Critical Finding:** Not all entity creation functions accept `spaceId` as a parameter:

- `createAsk()`, `createOffer()`, `createUserProfile()` use `SPACE_ID` from config (not a parameter)
- `createSkill()` and some other functions accept `spaceId` parameter (defaults to `SPACE_ID`)

**Required Pattern:** Always verify `SPACE_ID` matches your target before creating entities:

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

**Why:** This prevents accidentally seeding to the wrong space (e.g., production instead of dev).

## Rate Limiting Pattern

Arkiv has rate limits on transaction submission. Always add delays between entity creation:

```typescript
const DELAY_MS = 400; // 300-500ms is recommended
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

for (const entity of entitiesToCreate) {
  await delay(DELAY_MS); // Sequential execution, not parallel
  // Create entity...
}
```

**Why:** Too many rapid transactions can fail with rate limit errors. Delays ensure reliable creation.

## Existing Entity Checks

Prevent duplicate entities by checking if they already exist:

```typescript
const existing = await listEntities({
  spaceId: TARGET_SPACE_ID,
  // ... other filters (slug, title, etc.)
  limit: 1,
});

if (existing.length > 0) {
  console.log(`⏭️  Skipping (already exists)`);
  continue;
}
```

**Why:** Prevents duplicate entities and allows safe re-running of seed scripts.

## Error Handling Pattern

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

**Why:** Blockchain errors are technical. User-friendly messages help builders understand and resolve issues.

## Prerequisites Documentation

Always document prerequisites in script header:

```typescript
/**
 * **Prerequisites:**
 * 1. Install dependencies: `npm install` or `pnpm install`
 * 2. Set ARKIV_PRIVATE_KEY in .env file (required for creating entities)
 * 3. Set BETA_SPACE_ID in .env file (or pass as env var when running)
 * 4. Ensure signing wallet has funds for transaction fees
 *
 * **Usage:**
 *   BETA_SPACE_ID=local-dev-seed npx tsx scripts/seed-example.ts
 *
 * **Common Errors:**
 * - "replacement transaction underpriced": Wait a moment and try again
 * - "rate limit exceeded": Wait a few minutes between runs
 * - "insufficient funds": Fund the signing wallet
 */
```

**Why:** Makes scripts work "out of the box" for anyone following instructions.

## Complete Seed Script Pattern

Here's a complete pattern combining all safety checks:

```typescript
/**
 * Seed script example with all safety patterns
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

      // Create with explicit spaceId (if function supports it)
      const { key, txHash } = await createSkill({
        name_canonical: skill.name,
        description: skill.description,
        privateKey,
        spaceId: TARGET_SPACE_ID, // Explicit parameter
      });

      console.log(`✅ Created "${skill.name}"`);
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

## Anti-Patterns (What NOT to Do)

**❌ Don't assume all create functions accept spaceId parameter:**
```typescript
// WRONG: createAsk doesn't accept spaceId parameter
await createAsk({
  wallet,
  skill: 'React',
  message: 'I want to learn React',
  spaceId: 'local-dev-seed', // This won't work!
  privateKey,
});
```

**✅ Correct: Verify SPACE_ID from config matches target:**
```typescript
// Verify SPACE_ID matches target before calling createAsk
if (SPACE_ID !== TARGET_SPACE_ID) {
  process.exit(1);
}
// createAsk uses SPACE_ID from config automatically
await createAsk({
  wallet,
  skill: 'React',
  message: 'I want to learn React',
  privateKey,
});
```

**❌ Don't skip spaceId verification:**
```typescript
// WRONG: No verification, could seed to wrong space
async function seed() {
  await createEntity(...); // Might use wrong SPACE_ID!
}
```

**✅ Correct: Always verify SPACE_ID:**
```typescript
// RIGHT: Verify before creating
async function seed() {
  if (SPACE_ID !== TARGET_SPACE_ID) {
    process.exit(1);
  }
  await createEntity(...);
}
```

**❌ Don't create entities without rate limiting:**
```typescript
// WRONG: Too fast, will hit rate limits
for (const entity of entities) {
  await createEntity(entity); // No delay!
}
```

**✅ Correct: Add delays between entity creation:**
```typescript
// RIGHT: Rate limiting prevents errors
for (const entity of entities) {
  await delay(400);
  await createEntity(entity);
}
```

**❌ Don't skip existing entity checks:**
```typescript
// WRONG: Will create duplicates on re-run
for (const entity of entities) {
  await createEntity(entity); // No check!
}
```

**✅ Correct: Check for existing entities first:**
```typescript
// RIGHT: Prevents duplicates
const existing = await listEntities({ ... });
if (existing.length > 0) {
  continue; // Skip if exists
}
await createEntity(entity);
```

## Agent Compliance Footer

If you propose seed scripts, you must:

1. Verify `SPACE_ID` matches target before creating any entities
2. Add rate limiting delays (300-500ms) between entity creation
3. Check for existing entities before creating (prevent duplicates)
4. Handle errors gracefully with user-friendly messages
5. Document prerequisites clearly in script header
6. Use sequential execution (not parallel) to avoid rate limits
7. Continue on error (don't fail entire script if one entity fails)

## Common Errors and Solutions

**"replacement transaction underpriced":**
- Cause: Previous transaction with same nonce is still pending
- Solution: Wait 30-60 seconds for pending transaction to confirm, then try again

**"rate limit exceeded":**
- Cause: Too many requests in short time
- Solution: Increase delays between entity creation, wait between runs

**"insufficient funds":**
- Cause: Signing wallet doesn't have enough funds for transaction fees
- Solution: Fund the signing wallet on Mendoza testnet (use faucet)

**"SPACE_ID mismatch":**
- Cause: Script trying to seed to wrong space
- Solution: Set `BETA_SPACE_ID` environment variable correctly before running

