# p2pmentor

Planting the first beta seed of peer to peer mentorship.

Teach, learn, and mentor without intermediaries.  
Own your data.  
Let knowledge and growth light the path through the dark forest.

## Serverless, No Central Database

p2pmentor is a serverless application with no central database. All user data lives on Arkiv, a decentralized blockchain network. When you create a profile, it's stored as an entity on Arkiv. When you view your profile, we read it from Arkiv. We're just a client that helps you interact with the blockchain. The data lives on Arkiv, not on our servers.

**What this means:**
- Users own their data. It's stored on the blockchain with their wallet address.
- No trust required. The blockchain provides cryptographic proof that data exists and hasn't been tampered with.
- No single point of failure. Even if we disappear, your data remains accessible on Arkiv.
- Verifiable. Anyone can verify data independently using the Arkiv explorer.

**What we still need servers for:**
- Serving the web app (Next.js frontend)
- API routes that help format data (GraphQL wrapper)
- Video calls (Jitsi integration)

**What we don't need servers for:**
- Storing user data (Arkiv does this)
- Storing profiles, sessions, asks, offers (all on Arkiv)
- Data backups (Arkiv network handles this)
- Data verification (blockchain provides this)

## What this project is

A small, focused beta of a peer to peer mentorship network.  
Built on Arkiv so users can own their data.  
Designed with the dark forest and hidden garden aesthetics from our earlier work.

## Core Principles

**Data sovereignty**
Users own and control their data. The application is a client of a shared data layer, not the owner of data.

**No intermediaries in the core value flow**
The platform helps people find each other and coordinate. It does not sit in the middle as the primary owner of identity, content or relationships.

**Trustless infrastructure, trustworthy UX**
Infrastructure should not require trust to protect user data. UX and community norms should encourage good behavior and mutual respect.

## What this project is not

Production ready.  
A place to use wallets with real funds.  
A full version of a mentorship platform.

## Setup

### Prerequisites

- Node.js 22+ (LTS recommended, required for Arkiv SDK). Bun is also supported.
- pnpm (recommended), npm, or Bun

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/understories/p2pmentor.git
   cd p2pmentor
   ```

2. **Install dependencies:**
   
   With pnpm (recommended):
   ```bash
   pnpm install
   ```
   
   Or with npm:
   ```bash
   npm install
   ```
   
   Or with Bun:
   ```bash
   bun install
   ```

3. **Set up environment variables:**
   
   Create a `.env.local` file in the root directory:
   ```bash
   cp .env.example .env.local
   ```
   
   Then edit `.env.local` and add your Arkiv private key (see instructions below).

   **Required environment variables:**
   - `ARKIV_PRIVATE_KEY` - Private key (0x...) for server-side entity creation. Required for API routes that create entities.

   **Getting an Arkiv Private Key and Testnet Tokens:**

   p2pmentor uses the Arkiv network (Mendoza testnet) for data storage. You'll need a private key to interact with the network.

   1. **Create your Arkiv account and get your private key:**
      
      Follow the [Arkiv TypeScript Getting Started Guide](https://arkiv.network/getting-started/typescript) to create your account. The guide will help you:
      - Create an account that allows you to interact with Arkiv Testnet
      - Get your private key (starts with `0x`)
      
      **⚠️ Security Warning:** Never share your private key or commit it to version control. The account you create is for **Arkiv Testnet/sandbox use only**. Never use it on any Mainnet.

   2. **Add Mendoza testnet to MetaMask (optional, for testing):**
      
      - Network Name: `Mendoza DB-Chain`
      - RPC URL: `https://mendoza.hoodi.arkiv.network/rpc`
      - Chain ID: `60138453056`
      - Currency Symbol: `ETH`
      - Block Explorer: [Mendoza Explorer](https://mendoza-explorer.hoodi.arkiv.network)
      
      Or use the [Add Network to Wallet](https://arkiv.network/dev) link from the Arkiv dev portal.

   3. **Get testnet tokens:**
      
      Visit the [Arkiv Dev Portal](https://arkiv.network/dev) and use the "Get Test Tokens" feature (faucet) to receive testnet tokens for your wallet address. The faucet provides all the tokens you need to pay for gas when creating entities; no additional ETH required.

   4. **Set your private key in `.env.local`:**
      ```bash
      ARKIV_PRIVATE_KEY=0x...your_private_key_from_arkiv...
      ```

   For more information, see the [Arkiv Dev Portal](https://arkiv.network/dev) and the [Arkiv TypeScript Getting Started Guide](https://arkiv.network/getting-started/typescript).
   
   Learn more about Arkiv and our Arkiv-native implementation in our [Arkiv documentation](docs/betadocs/arkiv/overview.md).

   **Optional environment variables:**
   - `BETA_SPACE_ID` - Space ID for data isolation (defaults to `'beta-launch'` in production, `'local-dev'` in development)
   - `JITSI_BASE_URL` - Jitsi video call base URL (defaults to `'https://meet.jit.si'`)
   - `NEXT_PUBLIC_BETA_INVITE_CODE` - Beta invite code for access control
   - `ADMIN_PASSWORD` - Password for admin routes
   - `NEXT_PUBLIC_WALLETCONNECT_ENABLED` - Enable WalletConnect (set to `'true'` to enable)
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - WalletConnect project ID (required if WalletConnect is enabled)
   - `GRAPH_SUBGRAPH_URL` - The Graph subgraph URL (optional, for future use)
   - `USE_SUBGRAPH_FOR_NETWORK` - Use subgraph for network queries (set to `'true'` to enable)

   Example `.env.local`:
   ```bash
   ARKIV_PRIVATE_KEY=0x...
   BETA_SPACE_ID=local-dev
   ```

4. **Run the development server:**
   
   With pnpm:
   ```bash
   pnpm dev
   ```
   
   Or with npm:
   ```bash
   npm run dev
   ```
   
   Or with Bun:
   ```bash
   bun dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Build for production:**
   
   With pnpm:
   ```bash
   pnpm build
   pnpm start
   ```
   
   Or with npm:
   ```bash
   npm run build
   npm start
   ```
   
   Or with Bun:
   ```bash
   bun run build
   bun start
   ```

### Package Manager

This project uses **pnpm** (you can see `pnpm-lock.yaml` in the repository). While npm or Bun will work, pnpm is recommended for exact dependency version matching.

**Lockfile compatibility:**
- **pnpm**: Uses `pnpm-lock.yaml` (recommended for exact versions)
- **npm**: Will ignore `pnpm-lock.yaml` and create `package-lock.json` (may install different dependency versions)
- **Bun**: Can read `pnpm-lock.yaml` but may also create `bun.lockb` (generally compatible)

**Will it still work with different versions?**
- **Usually yes** - `package.json` uses semver ranges (e.g., `^15.5.9`), so npm will install compatible versions within those ranges
- **Possible issues**: Breaking changes in minor versions, bugs, or security vulnerabilities (we've had [security patches that required specific versions](docs/SECURITY_UPDATE_2025-12-13.md))
- **Recommendation**: Use pnpm for exact version matching to avoid potential issues. npm/Bun are fine for development, but pnpm ensures everyone gets the same tested versions.

**If you don't have pnpm installed:**

Check if pnpm is installed:
```bash
pnpm --version
```

If not installed, install it globally:
```bash
npm install -g pnpm
```

Or install Bun (which also works with this project):
```bash
curl -fsSL https://bun.sh/install | bash
```

## Development notes

Developer experience updates for Arkiv live in `/docs/dx_arkiv_runbook.md`.  
This beta is intentionally small so we can ship quickly and learn from real usage.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
