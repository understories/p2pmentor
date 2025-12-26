/**
 * Meta-Learning Quest Detail Page
 *
 * Placeholder - full implementation in progress
 */

'use client';

import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { BetaGate } from '@/components/auth/BetaGate';
import { EmptyState } from '@/components/EmptyState';

export default function MetaLearningQuestPage() {
  const router = useRouter();

  return (
    <BetaGate>
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <BackButton href="/learner-quests" />
          <EmptyState
            title="Meta-Learning Quest"
            description="Full implementation coming soon. Backend API and components are ready."
          />
        </div>
      </div>
    </BetaGate>
  );
}

