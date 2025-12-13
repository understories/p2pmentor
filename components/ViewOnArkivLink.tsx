/**
 * View on Arkiv Link Component
 * 
 * Reusable component for displaying "View on Arkiv" links for all entities.
 * Always visible (no dev mode) to teach users about blockchain.
 */

import { getArkivExplorerUrl } from '@/lib/arkiv/explorer';

interface ViewOnArkivLinkProps {
  txHash?: string;
  entityKey?: string;
  label?: string;
  className?: string;
  icon?: string;
}

export function ViewOnArkivLink({ 
  txHash, 
  entityKey, 
  label = 'View on Arkiv',
  className = '',
  icon = '🔗'
}: ViewOnArkivLinkProps) {
  const url = getArkivExplorerUrl(txHash, entityKey);
  
  if (!url) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline text-sm font-medium ${className}`}
      title="View this entity on Arkiv Explorer"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </a>
  );
}
