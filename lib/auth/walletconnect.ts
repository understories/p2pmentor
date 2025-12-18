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
    // Initialize WalletConnect provider with Mendoza chain only
    // Reuse mendoza config from SDK for consistency
    console.log('[WalletConnect] Initializing provider', {
      projectId: projectId ? `${projectId.substring(0, 8)}...` : 'missing',
      chainId: mendoza.id,
      chainName: mendoza.name,
      rpcUrl: mendoza.rpcUrls.default.http[0],
    });
    
    const provider = await EthereumProvider.init({
      projectId,
      chains: [mendoza.id],
      rpcMap: {
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

    // Check chain ID and attempt to switch if needed (non-critical)
    try {
      const chainId = await provider.request({ method: 'eth_chainId' });
      const expectedChainId = `0x${mendoza.id.toString(16)}`;
      
      if (chainId !== expectedChainId) {
        console.log('[WalletConnect] Chain mismatch, attempting to switch to Mendoza');
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: expectedChainId }],
          });
        } catch (switchError: any) {
          // Non-critical - show non-blocking prompt
          console.warn('[WalletConnect] Failed to switch chain (non-critical):', switchError);
          // Could show a toast/notification here: "Please switch to Mendoza in your wallet"
        }
      }
    } catch (chainError) {
      // Non-critical - continue even if chain check fails
      console.warn('[WalletConnect] Failed to check chain (non-critical):', chainError);
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

