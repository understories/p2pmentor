# Set Up Your Environment

## Prerequisites

Before you can start building with Arkiv, you'll need:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **A code editor** - VS Code is recommended
- **npm or pnpm** - Comes with Node.js

## Installation Steps

1. **Verify Node.js installation:**
   ```bash
   node --version
   ```
   Should show v18.x.x or higher.

2. **Create a new project directory:**
   ```bash
   mkdir my-arkiv-app
   cd my-arkiv-app
   ```

3. **Initialize a new Node.js project:**
   ```bash
   npm init -y
   ```

4. **Install Arkiv SDK:**
   ```bash
   npm install @arkiv-network/sdk
   ```

5. **Install TypeScript (optional but recommended):**
   ```bash
   npm install -D typescript @types/node
   npx tsc --init
   ```

## Environment Setup

Create a `.env` file in your project root:

```env
ARKIV_SPACE_ID=your-space-id
ARKIV_PRIVATE_KEY=your-private-key
```

**Note:** For testing, you can use the public testnet space. Never commit your private keys to version control!

## Verify Setup

Create a simple test file `test-setup.ts`:

```typescript
import { getPublicClient } from '@arkiv-network/sdk/client';

async function test() {
  const client = getPublicClient();
  console.log('Arkiv client initialized successfully!');
}

test();
```

Run it:
```bash
npx tsx test-setup.ts
```

If you see "Arkiv client initialized successfully!", you're ready to go!

## Next Steps

Once your environment is set up, you're ready to create your first entity. Click "Mark as Complete" below to continue.
