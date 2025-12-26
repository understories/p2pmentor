/**
 * WalletConnect authentication utilities
 * 
 * Provides WalletConnect connection flow for profile wallet (identity wallet).
 * WalletConnect provider is EIP-1193 compliant and works with viem custom transport.
 * 
 * Phase 0: Additive connector - does not modify MetaMask flows.
 * 
 * Reference: WalletConnect Phase 0 Plan
 */

'use client';

import { EthereumProvider } from '@walletconnect/ethereum-provider';
import { mendoza } from '@arkiv-network/sdk/chains';
import { isMobileBrowser } from './mobile-detection';

/**
 * Connect to WalletConnect and return the connected wallet address
 * 
 * Initializes WalletConnect EthereumProvider singleton and starts connection flow.
 * Handles QR code display (desktop) and deep linking (mobile).
 * 
 * @returns Wallet address (0x... format)
 * @throws Error if WalletConnect connection fails
 */
export async function connectWalletConnect(): Promise<`0x${string}`> {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  
  if (!projectId) {
    throw new Error('WalletConnect project ID not configured. Please set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID environment variable.');
  }

  try {
    // Clean up any existing WalletConnect provider first
    // This prevents conflicts when switching from MetaMask to WalletConnect for the same address
    try {
      const { getWalletConnectProvider, disconnectWalletConnect } = await import('@/lib/wallet/walletconnectProvider');
      const existingProvider = getWalletConnectProvider();
      if (existingProvider) {
        console.log('[WalletConnect] Cleaning up existing provider before new connection');
        await disconnectWalletConnect();
      }
    } catch (cleanupError) {
      // Non-critical - continue with new connection even if cleanup fails
      console.warn('[WalletConnect] Failed to cleanup existing provider (non-critical):', cleanupError);
    }

    // Initialize WalletConnect provider with Mendoza chain only
    // Reuse mendoza config from SDK for consistency
    console.log('[WalletConnect] Initializing provider', {
      projectId: projectId ? `${projectId.substring(0, 8)}...` : 'missing',
      chainId: mendoza.id,
      chainName: mendoza.name,
      rpcUrl: mendoza.rpcUrls.default.http[0],
    });
    
    // Include Ethereum mainnet (1) as a fallback chain so wallets can connect
    // Mendoza is a custom chain not in WalletConnect registry, so wallets may not recognize it
    // We'll add Mendoza after connection using wallet_addEthereumChain
    const provider = await EthereumProvider.init({
      projectId,
      chains: [1, mendoza.id], // Ethereum mainnet (1) + Mendoza
      rpcMap: {
        1: 'https://eth.llamarpc.com', // Public Ethereum RPC
        [mendoza.id]: mendoza.rpcUrls.default.http[0],
      },
      showQrModal: true, // Use built-in QR modal for Phase 0
      metadata: {
        name: 'p2pmentor',
        description: 'Peer-to-peer learning platform',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://p2pmentor.com',
        icons: [],
      },
    });
    
    console.log('[WalletConnect] Provider initialized successfully');

    // Enable provider (starts connection flow)
    console.log('[WalletConnect] Enabling provider (starting connection flow)');
    await provider.enable();
    console.log('[WalletConnect] Provider enabled, checking accounts...');

    // Get accounts from provider
    const accounts = provider.accounts;
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from WalletConnect');
    }

    const address = accounts[0] as `0x${string}`;

    // Store provider reference (will be accessed via getWalletConnectProvider)
    // Import here to avoid circular dependency
    const { setWalletConnectProvider } = await import('@/lib/wallet/walletconnectProvider');
    setWalletConnectProvider(provider);

    // Register lifecycle listeners for cleanup
    provider.on('disconnect', () => {
      console.log('[WalletConnect] Disconnected');
      setWalletConnectProvider(null);
      // Clear wallet_type from localStorage if this address was using WalletConnect
      if (typeof window !== 'undefined' && address) {
        const walletType = localStorage.getItem(`wallet_type_${address.toLowerCase()}`);
        if (walletType === 'walletconnect') {
          localStorage.removeItem(`wallet_type_${address.toLowerCase()}`);
        }
      }
    });

    provider.on('session_delete', () => {
      console.log('[WalletConnect] Session deleted');
      setWalletConnectProvider(null);
    });

    // After connection, add Mendoza to wallet and switch to it
    // This ensures wallets can add Mendoza even if they don't recognize it during connection
    // We include Ethereum mainnet (1) in chains array so wallets can connect, then add Mendoza
    try {
      const chainId = await provider.request({ method: 'eth_chainId' });
      const expectedChainId = `0x${mendoza.id.toString(16)}`;
      
      if (chainId !== expectedChainId) {
        console.log('[WalletConnect] Not on Mendoza, attempting to add/switch to Mendoza');
        const chainIdHex = expectedChainId;
        
        try {
          // First try to switch (if chain already exists in wallet)
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }],
          });
          console.log('[WalletConnect] Successfully switched to Mendoza');
        } catch (switchError: any) {
          // If switch fails (chain doesn't exist), try to add it
          // This will prompt the wallet to add Mendoza network
          console.log('[WalletConnect] Switch failed, attempting to add Mendoza chain to wallet');
          try {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: chainIdHex,
                  chainName: mendoza.name,
                  nativeCurrency: mendoza.nativeCurrency,
                  rpcUrls: mendoza.rpcUrls.default.http,
                  blockExplorerUrls: mendoza.blockExplorers?.default?.url ? [mendoza.blockExplorers.default.url] : [],
                },
              ],
            });
            console.log('[WalletConnect] Successfully added Mendoza chain to wallet');
          } catch (addError: any) {
            // Non-critical - user may have rejected or wallet doesn't support adding chains
            console.warn('[WalletConnect] Failed to add/switch to Mendoza (non-critical):', {
              switchError: switchError?.message || switchError,
              addError: addError?.message || addError,
            });
            // Connection still succeeds, user can manually switch to Mendoza later
          }
        }
      } else {
        console.log('[WalletConnect] Already on Mendoza chain');
      }
    } catch (chainError) {
      // Non-critical - continue even if chain check fails
      console.warn('[WalletConnect] Failed to check/add chain (non-critical):', chainError);
    }

    // Telemetry: log successful connection
    const isMobile = isMobileBrowser();
    console.log('[WalletConnect] Connection successful', {
      connector: 'walletconnect',
      address: `${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
      isMobile,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
    });

    return address;
  } catch (error: any) {
    console.error('[WalletConnect] Connection failed:', {
      error,
      message: error?.message,
      code: error?.code,
      data: error?.data,
      stack: error?.stack,
    });
    
    // Handle user rejection
    if (error?.code === 4001 || error?.message?.includes('User rejected') || error?.message?.includes('User closed')) {
      throw new Error('Connection cancelled by user');
    }
    
    // Handle session settlement errors (common with WalletConnect v2)
    if (error?.message?.includes('Invalid session settle request') || 
        error?.message?.includes('session settle') ||
        error?.message?.includes('namespaces')) {
      throw new Error('WalletConnect session error. Please try again. If the issue persists, your wallet may not support the Mendoza testnet. Try using MetaMask instead.');
    }
    
    // Handle namespace errors
    if (error?.message?.includes('No accounts found in approved namespaces') ||
        error?.message?.includes('approved namespaces')) {
      throw new Error('Wallet connection failed: No accounts found. Please ensure your wallet has accounts and try again. If using Rainbow or another mobile wallet, make sure you have at least one account set up.');
    }
    
    throw new Error(error?.message || 'Failed to connect with WalletConnect');
  }
}

