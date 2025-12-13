/**
 * Beta Access Hook
 * 
 * Client-side hook to check beta access status.
 * Fast UX feedback before server-side validation.
 * 
 * Reference: refs/docs/beta_code_gating_plan.md Phase 4
 */

import { useState, useEffect } from 'react';

export function useBetaAccess() {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // Check both localStorage and cookies for beta access
    const betaCode = localStorage.getItem('beta_invite_code');
    const betaAccessKey = localStorage.getItem('beta_access_key');
    
    // Also check cookies (for server-side compatibility)
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    const cookieCode = cookies['beta_access_code'];
    const cookieKey = cookies['beta_access_key'];

    if (betaCode || betaAccessKey || cookieCode || cookieKey) {
      setHasAccess(true);
    } else {
      setHasAccess(false);
    }

    setLoading(false);
  }, []);

  return { hasAccess, loading };
}
