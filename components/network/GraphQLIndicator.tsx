/**
 * GraphQL Indicator Component
 * 
 * Shows which data source is being used (Arkiv JSON-RPC vs GraphQL API)
 */

'use client';

import { useEffect, useState } from 'react';

export function GraphQLIndicator() {
  const [isUsingGraphQL, setIsUsingGraphQL] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if GraphQL is enabled
    const checkGraphQL = () => {
      // Check localStorage for demo override
      const localStorageOverride = localStorage.getItem('USE_GRAPHQL');
      if (localStorageOverride !== null) {
        setIsUsingGraphQL(localStorageOverride === 'true');
        return;
      }
      
      // Check public env vars
      const useSubgraph = process.env.NEXT_PUBLIC_USE_SUBGRAPH_FOR_NETWORK === 'true';
      const hasSubgraphUrl = !!process.env.NEXT_PUBLIC_GRAPH_SUBGRAPH_URL;
      setIsUsingGraphQL(useSubgraph && hasSubgraphUrl);
    };
    checkGraphQL();
    
    // Listen for storage changes (when toggled in compare page)
    const handleStorageChange = () => {
      checkGraphQL();
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically (for same-window changes)
    const interval = setInterval(checkGraphQL, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute top-4 right-4 z-30 px-4 py-2.5 rounded-lg bg-gray-900/90 border-2 backdrop-blur-md text-sm shadow-lg" style={{ borderColor: isUsingGraphQL ? 'rgba(16, 185, 129, 0.5)' : 'rgba(59, 130, 246, 0.5)' }}>
      <div className="flex items-center gap-2.5">
        <div className={`w-3 h-3 rounded-full ${isUsingGraphQL ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]'}`} />
        <span className={`font-medium ${isUsingGraphQL ? 'text-emerald-300' : 'text-blue-300'}`}>
          {isUsingGraphQL ? 'GraphQL API' : 'Arkiv JSON-RPC'}
        </span>
      </div>
      {isUsingGraphQL && (
        <div className="mt-1.5 text-[10px] text-emerald-400/80 font-mono">
          → /api/graphql
        </div>
      )}
      {!isUsingGraphQL && (
        <div className="mt-1.5 text-[10px] text-blue-400/80 font-mono">
          → /api/network/graph
        </div>
      )}
    </div>
  );
}

