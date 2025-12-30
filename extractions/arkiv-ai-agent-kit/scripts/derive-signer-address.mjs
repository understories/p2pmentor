/**
 * Derive an EVM address from ARKIV_PRIVATE_KEY (manual ops helper).
 * This script prints the address only. It does NOT request funds or automate faucets.
 *
 * Usage:
 *   ARKIV_PRIVATE_KEY=0xabc... node scripts/derive-signer-address.mjs
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Ethers is common; if you want zero deps here, replace with a tiny secp256k1 pubkey->address derivation.
// For the AI kit, it's acceptable to keep this as a template placeholder.
let ethers;
try {
  ethers = require("ethers");
} catch (e) {
  console.error("ERROR: Missing dependency 'ethers'. Install it or replace this script with a no-deps version.");
  process.exit(1);
}

const pk = process.env.ARKIV_PRIVATE_KEY;
if (!pk) {
  console.error("ERROR: ARKIV_PRIVATE_KEY is not set. Refusing to continue.");
  process.exit(1);
}

try {
  const wallet = new ethers.Wallet(pk);
  console.log(wallet.address);
} catch (e) {
  console.error("ERROR: Failed to derive address. Is ARKIV_PRIVATE_KEY a valid hex private key?");
  process.exit(1);
}

