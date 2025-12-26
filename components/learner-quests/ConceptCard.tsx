/**
 * Concept Card Component
 *
 * Displays a learning concept card that appears once per step.
 * Cards are collapsible and dismissible, with state persisted in localStorage.
 *
 * Reference: refs/meta-learning-quest-implementation-plan.md
 */

'use client';

import { useState, useEffect } from 'react';

export interface ConceptCardProps {
  stepId: string;
  title: string;
  body: string;
  wallet?: string; // Optional: for per-user dismissal state
  className?: string;
}

export function ConceptCard({ stepId, title, body, wallet, className = '' }: ConceptCardProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storageKey = wallet
      ? `concept_card_${stepId}_${wallet.toLowerCase()}`
      : `concept_card_${stepId}`;

    const dismissed = localStorage.getItem(storageKey) === 'dismissed';
    setIsDismissed(dismissed);

    // Show card if not dismissed
    if (!dismissed) {
      setHasShown(true);
    }
  }, [stepId, wallet]);

  const handleDismiss = () => {
    if (typeof window === 'undefined') return;

    const storageKey = wallet
      ? `concept_card_${stepId}_${wallet.toLowerCase()}`
      : `concept_card_${stepId}`;

    localStorage.setItem(storageKey, 'dismissed');
    setIsDismissed(true);
  };

  const handleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Don't render if dismissed
  if (isDismissed || !hasShown) {
    return null;
  }

  return (
    <div
      className={`mb-4 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 ${className}`}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">{title}</h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCollapse}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isCollapsed ? 'Expand' : 'Collapse'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-line">
          {body}
        </div>
      )}
    </div>
  );
}

