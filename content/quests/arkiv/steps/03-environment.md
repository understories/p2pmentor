# Configure Environment Variables

## What Are Environment Variables?

Environment variables store configuration that shouldn't be committed to version control. For Arkiv apps, you need:
- **Space ID** - Which Arkiv space to use
- **Private Key** - For signing transactions (server-side)

## Step 1: Create `.env.local`

In your project root, create a file called `.env.local`:

```bash
touch .env.local
```

## Step 2: Add Your Configuration

Add these variables to `.env.local`:

```env
ARKIV_SPACE_ID=beta-launch
ARKIV_PRIVATE_KEY=your_private_key_here
```

### Getting Your Space ID

For testing, you can use:
- `beta-launch` - Public testnet space
- `local-dev` - Local development space (if running local node)

### Getting Your Private Key

**Important:** Never commit your private key to git!

1. Generate a new private key for testing:
   ```bash
   node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Or use an existing wallet's private key (for testing only)

3. **Never use a mainnet wallet's private key** - only use test keys

## Step 3: Update `.gitignore`

Make sure `.env.local` is in your `.gitignore`:

```gitignore
.env.local
.env*.local
```

## Step 4: Load Environment Variables

The starter should already be configured to load these. Check `lib/config.ts` or similar:

```typescript
export const SPACE_ID = process.env.ARKIV_SPACE_ID || 'beta-launch';
export const PRIVATE_KEY = process.env.ARKIV_PRIVATE_KEY as `0x${string}`;
```

## Security Best Practices

- ✅ Use `.env.local` (gitignored)
- ✅ Never commit private keys
- ✅ Use test keys for development
- ✅ Rotate keys if accidentally committed
- ❌ Don't hardcode keys in source code
- ❌ Don't share private keys

## Verify Configuration

Try running the app:

```bash
npm run dev
```

If you see errors about missing environment variables, double-check your `.env.local` file.

## Next Steps

Once your environment is configured, you're ready to run the app locally and see it in action!
