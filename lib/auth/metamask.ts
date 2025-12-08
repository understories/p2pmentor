/**
 * MetaMask authentication utilities
 * 
 * Based on mentor-graph implementation with improvements.
 * 
 * Reference: refs/mentor-graph/src/wallet.ts
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
} from "@arkiv-network/sdk";
import { mendoza } from "@arkiv-network/sdk/chains";
import "viem/window";

/**
 * Switch to Mendoza chain in MetaMask
 * 
 * If the chain doesn't exist in MetaMask, it will be added automatically.
 * 
 * @throws Error if MetaMask is not installed
 */
async function switchToMendozaChain() {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  const chainIdHex = `0x${mendoza.id.toString(16)}`;

  try {
    // Try to switch to the chain
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (error: unknown) {
    // Chain doesn't exist, add it
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 4902
    ) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: mendoza.name,
            nativeCurrency: mendoza.nativeCurrency,
            rpcUrls: mendoza.rpcUrls.default.http,
            blockExplorerUrls: [mendoza.blockExplorers.default.url],
          },
        ],
      });
    } else {
      throw error;
    }
  }
}

/**
 * Connect to MetaMask and return the connected wallet address
 * 
 * Automatically switches to Mendoza testnet chain.
 * 
 * @returns Wallet address (0x... format)
 * @throws Error if MetaMask is not installed
 * 
 * Reference: refs/mentor-graph/src/wallet.ts
 */
export async function connectWallet(): Promise<`0x${string}`> {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  // First switch to the correct chain
  await switchToMendozaChain();

  // Then request accounts
  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  }) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts returned from MetaMask");
  }

  return accounts[0] as `0x${string}`;
}

/**
 * Create Arkiv clients (public and wallet) from MetaMask
 * 
 * @param account - Wallet address from MetaMask
 * @returns Object with publicClient and walletClient
 * @throws Error if MetaMask is not installed
 * 
 * Reference: refs/mentor-graph/src/wallet.ts
 */
export function createArkivClients(account?: `0x${string}`) {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  const publicClient = createPublicClient({
    chain: mendoza,
    transport: http(),
  });

  const walletClient = createWalletClient({
    chain: mendoza,
    transport: custom(window.ethereum),
    account,
  });

  return { publicClient, walletClient };
}

