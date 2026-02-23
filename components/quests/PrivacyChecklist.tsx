/**
 * Privacy Checklist Component
 *
 * Operational checklist with "completed" stamps for privacy best practices.
 * User opt-in only — privacy-sensitive data is never stored without consent.
 *
 * Week 3 (Feb 15-21) - Web3 privacy track
 */

'use client';

import { useState } from 'react';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  category: 'wallet' | 'transactions' | 'identity' | 'operational';
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  {
    id: 'hardware-wallet',
    label: 'Use a hardware wallet for significant holdings',
    description: 'Hardware wallets keep private keys offline, reducing theft risk.',
    category: 'wallet',
  },
  {
    id: 'separate-wallets',
    label: 'Separate wallets for different purposes',
    description: 'Use distinct wallets for DeFi, NFTs, payments, and identity to prevent linking.',
    category: 'wallet',
  },
  {
    id: 'no-ens-main',
    label: 'Avoid ENS on your main holding wallet',
    description: 'ENS names publicly link your on-chain identity to a human-readable name.',
    category: 'identity',
  },
  {
    id: 'vpn-rpc',
    label: 'Use a VPN or private RPC endpoint',
    description: 'Default RPC endpoints can log your IP address alongside transactions.',
    category: 'operational',
  },
  {
    id: 'review-approvals',
    label: 'Regularly review and revoke token approvals',
    description: 'Unlimited approvals are a common attack vector. Use revoke.cash to audit.',
    category: 'transactions',
  },
  {
    id: 'verify-contracts',
    label: 'Verify contract addresses before interacting',
    description:
      'Phishing sites use similar-looking addresses. Always verify on the official source.',
    category: 'transactions',
  },
  {
    id: 'backup-seedphrase',
    label: 'Secure seed phrase backup (offline, never digital)',
    description: 'Never store seed phrases in cloud storage, email, or screenshots.',
    category: 'wallet',
  },
  {
    id: 'two-factor',
    label: 'Enable 2FA on all exchange accounts',
    description: 'Use authenticator apps, not SMS (which is vulnerable to SIM swapping).',
    category: 'operational',
  },
];

interface PrivacyChecklistProps {
  checklist?: ChecklistItem[];
  onComplete?: (completed: { item: string; completedAt: string }[]) => void;
  minRequired?: number;
}

export function PrivacyChecklist({
  checklist = DEFAULT_CHECKLIST,
  onComplete,
  minRequired = 5,
}: PrivacyChecklistProps) {
  const arkivBuilderMode = useArkivBuilderMode();
  const [completedItems, setCompletedItems] = useState<Map<string, string>>(new Map());
  const [submitted, setSubmitted] = useState(false);

  const toggleItem = (id: string) => {
    const next = new Map(completedItems);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.set(id, new Date().toISOString());
    }
    setCompletedItems(next);
  };

  const handleSubmit = () => {
    if (completedItems.size < minRequired) return;
    setSubmitted(true);
    const items = Array.from(completedItems.entries()).map(([item, completedAt]) => ({
      item,
      completedAt,
    }));
    onComplete?.(items);
  };

  const categories = Array.from(new Set(checklist.map((item) => item.category)));
  const categoryLabels: Record<string, string> = {
    wallet: 'Wallet Security',
    transactions: 'Transaction Safety',
    identity: 'Identity Protection',
    operational: 'Operational Security',
  };

  if (submitted) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-900/20">
        <h3 className="mb-2 text-lg font-semibold text-emerald-800 dark:text-emerald-200">
          Privacy Checklist Complete
        </h3>
        <p className="mb-3 text-sm text-emerald-700 dark:text-emerald-300">
          You completed {completedItems.size} of {checklist.length} privacy best practices.
        </p>
        <div className="space-y-1">
          {checklist.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              <span
                className={
                  completedItems.has(item.id)
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-400 dark:text-gray-500'
                }
              >
                {completedItems.has(item.id) ? '✓' : '✗'}
              </span>
              <span
                className={`${completedItems.has(item.id) ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'}`}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 p-6 dark:border-sky-800 dark:bg-sky-900/20">
      <h3 className="mb-2 text-lg font-semibold text-sky-900 dark:text-sky-100">
        Privacy &amp; Security Checklist
      </h3>
      <p className="mb-4 text-sm text-sky-800 dark:text-sky-200">
        Review these privacy best practices and check off the ones you&apos;ve implemented. Complete
        at least {minRequired} to finish this step.
      </p>

      {arkivBuilderMode && (
        <ArkivQueryTooltip
          query={[
            `Evidence stored in quest_step_progress payload:`,
            `{ evidenceType: 'checklist_completion',`,
            `  checklistItems: [{ item, completed, completedAt }] }`,
          ]}
          label="Checklist Evidence"
        >
          <div className="mb-3 text-xs text-sky-600">Arkiv Builder Mode: hover for details</div>
        </ArkivQueryTooltip>
      )}

      {categories.map((category) => (
        <div key={category} className="mb-4">
          <h4 className="mb-2 text-sm font-semibold text-sky-800 dark:text-sky-200">
            {categoryLabels[category] || category}
          </h4>
          <div className="space-y-2">
            {checklist
              .filter((item) => item.category === category)
              .map((item) => (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    completedItems.has(item.id)
                      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/30'
                      : 'border-gray-200 bg-white hover:border-sky-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-sky-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={completedItems.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                    className="mt-0.5 rounded"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.label}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {item.description}
                    </div>
                  </div>
                </label>
              ))}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <span className="text-sm text-sky-700 dark:text-sky-300">
          {completedItems.size}/{minRequired} minimum completed
        </span>
        <button
          onClick={handleSubmit}
          disabled={completedItems.size < minRequired}
          className={`rounded-lg px-4 py-2 font-medium transition-colors ${
            completedItems.size < minRequired
              ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
              : 'bg-sky-600 text-white hover:bg-sky-700'
          }`}
        >
          Complete Checklist
        </button>
      </div>
    </div>
  );
}
