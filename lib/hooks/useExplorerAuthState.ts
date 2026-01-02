/**
 * Explorer Auth State Hook
 * 
 * Thin adapter for UI state detection. Does not confer authorization.
 * Reflects current client auth state for UI adaptation only.
 * 
 * This hook is read-only and non-authoritative. It adapts existing auth
 * sources (cookies, localStorage) for UI purposes only.
 * 
 * Listens for wallet changes via storage events to update UI when user
 * logs in/out from other tabs or same tab.
 * 
 * Reference: refs/docs/explorer-adaptive-sidebar-plan.md
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface ExplorerSidebarState {
  hasBetaAccess: boolean;
  isLoggedIn: boolean;
  wallet: string | null;
}

export function useExplorerAuthState() {
  const [state, setState] = useState<ExplorerSidebarState>({
    hasBetaAccess: false,
    isLoggedIn: false,
    wallet: null,
  });
  const [loading, setLoading] = useState(true);

  // Helper to update state from current auth sources
  const updateState = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Use centralized beta access helper (exported from betaAccess.ts)
    const { hasBetaAccessFromCookieString } = await import('@/lib/auth/betaAccess');
    const hasBetaAccess = hasBetaAccessFromCookieString(document.cookie);
    
    // Check login state from localStorage
    // TODO: If canonical useWallet() or useAuth() hook exists, use that instead
    const walletRaw = localStorage.getItem('wallet_address');
    const wallet = walletRaw?.toLowerCase() ?? null;
    const isLoggedIn = !!wallet;

    setState({
      hasBetaAccess,
      isLoggedIn,
      wallet,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Initial state check
    (async () => {
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      await updateState();
    })();

    // Listen for storage changes (wallet login/logout from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'wallet_address' && !cancelled) {
        updateState();
      }
    };

    // Listen for custom wallet change events (same tab)
    const handleWalletChange = () => {
      if (!cancelled) {
        updateState();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('wallet-changed', handleWalletChange);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('wallet-changed', handleWalletChange);
    };
  }, [updateState]);

  return { ...state, loading };
}

