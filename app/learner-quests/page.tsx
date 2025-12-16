/**
 * Learner Quests Page
 *
 * Displays curated reading materials from Web3Privacy Academy Library
 * and tracks user progress through quests.
 *
 * Reference: refs/learner-quests-implementation-plan.md
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { BackButton } from '@/components/BackButton';
import { BetaGate } from '@/components/auth/BetaGate';

type LearnerQuestMaterial = {
  id: string;
  title: string;
  author: string;
  year?: number;
  url: string;
  category: 'foundational' | 'recent' | 'book';
  description: string;
};

type LearnerQuest = {
  questId: string;
  title: string;
  description: string;
  source: string;
  materials: LearnerQuestMaterial[];
  metadata: {
    totalMaterials: number;
    categories: string[];
    lastUpdated: string;
  };
};

type MaterialProgress = {
  key: string;
  status: 'read' | 'in_progress' | 'not_started';
  readAt?: string;
  txHash?: string;
};

export default function LearnerQuestsPage() {
  const router = useRouter();
  const arkivBuilderMode = useArkivBuilderMode();
  const [wallet, setWallet] = useState<string | null>(null);
  const [quest, setQuest] = useState<LearnerQuest | null>(null);
  const [progress, setProgress] = useState<Record<string, MaterialProgress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');
        return;
      }
      setWallet(address);
    }
  }, [router]);

  useEffect(() => {
    loadQuest();
  }, []);

  useEffect(() => {
    if (wallet && quest) {
      loadProgress();
    }
  }, [wallet, quest]);

  const loadQuest = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/learner-quests?questId=web3privacy_foundations');
      const data = await res.json();

      if (data.ok && data.quest) {
        setQuest(data.quest);
      } else {
        setError(data.error || 'Failed to load quest');
      }
    } catch (err: any) {
      console.error('Error loading quest:', err);
      setError('Failed to load quest');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!wallet || !quest) return;

    try {
      const res = await fetch(`/api/learner-quests/progress?questId=${quest.questId}&wallet=${wallet}`);
      const data = await res.json();

      if (data.ok && data.progress) {
        const progressMap: Record<string, MaterialProgress> = {};
        Object.values(data.progress).forEach((p: any) => {
          progressMap[p.materialId] = {
            key: p.key,
            status: p.status,
            readAt: p.readAt,
            txHash: p.txHash,
          };
        });
        setProgress(progressMap);
      }
    } catch (err: any) {
      console.error('Error loading progress:', err);
    }
  };

  const handleMaterialClick = async (material: LearnerQuestMaterial) => {
    // Open link in new tab
    window.open(material.url, '_blank', 'noopener,noreferrer');

    // Mark as read (fire and forget)
    if (wallet && quest) {
      setMarkingRead(material.id);
      try {
        await fetch('/api/learner-quests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'markRead',
            wallet,
            questId: quest.questId,
            materialId: material.id,
            sourceUrl: material.url,
          }),
        });

        // Update local state optimistically
        setProgress(prev => ({
          ...prev,
          [material.id]: {
            key: prev[material.id]?.key || '',
            status: 'read',
            readAt: new Date().toISOString(),
            txHash: prev[material.id]?.txHash,
          },
        }));

        // Reload progress after a delay (to ensure Arkiv indexing)
        setTimeout(() => {
          loadProgress();
        }, 2000);
      } catch (err: any) {
        console.error('Error marking material as read:', err);
      } finally {
        setMarkingRead(null);
      }
    }
  };

  const getReadCount = () => {
    return Object.values(progress).filter(p => p.status === 'read').length;
  };

  if (loading) {
    return (
      <BetaGate>
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
          <div className="max-w-4xl mx-auto">
            <BackButton href="/me" />
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `loadQuest()`,
                  `Queries:`,
                  `GET /api/learner-quests?questId=web3privacy_foundations`,
                  `→ type='learner_quest', questId='web3privacy_foundations', status='active'`,
                  `Returns: LearnerQuest (most recent version)`
                ]}
                label="Loading Learner Quest"
              >
                <LoadingSpinner text="Loading learner quest..." className="py-12" />
              </ArkivQueryTooltip>
            ) : (
              <LoadingSpinner text="Loading learner quest..." className="py-12" />
            )}
          </div>
        </div>
      </BetaGate>
    );
  }

  if (error || !quest) {
    return (
      <BetaGate>
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
          <div className="max-w-4xl mx-auto">
            <BackButton href="/me" />
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400">{error || 'Quest not found'}</p>
            </div>
          </div>
        </div>
      </BetaGate>
    );
  }

  const readCount = getReadCount();
  const progressPercent = quest.materials.length > 0
    ? Math.round((readCount / quest.materials.length) * 100)
    : 0;

  return (
    <BetaGate>
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <BackButton href="/me" />

          <div className="mb-8">
            <h1 className="text-3xl font-semibold mb-2">{quest.title}</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{quest.description}</p>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  Progress: {readCount} / {quest.materials.length} materials read
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Source Attribution */}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Source:{' '}
              <a
                href={quest.source}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                Web3Privacy Academy Library
              </a>
            </p>
          </div>

          {/* Materials List */}
          <div className="space-y-4">
            {quest.materials.map((material) => {
              const materialProgress = progress[material.id];
              const isRead = materialProgress?.status === 'read';
              const isMarking = markingRead === material.id;

              return (
                <div
                  key={material.id}
                  className={`p-6 rounded-lg border-2 transition-all ${
                    isRead
                      ? 'border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{material.title}</h3>
                        {isRead && (
                          <span className="text-emerald-600 dark:text-emerald-400 text-sm">✓ Read</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {material.author}{material.year && ` (${material.year})`}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                        {material.description}
                      </p>
                      {arkivBuilderMode ? (
                        <ArkivQueryTooltip
                          query={[
                            `handleMaterialClick("${material.id}")`,
                            `Actions:`,
                            `1. Opens: ${material.url} (new tab)`,
                            `2. POST /api/learner-quests { action: 'markRead', ... }`,
                            `   → Creates: type='learner_quest_progress' entity`,
                            `   → Attributes: wallet='${wallet?.toLowerCase().slice(0, 8) || '...'}...', questId='${quest.questId}', materialId='${material.id}', status='read'`,
                            `   → Payload: Full progress data with readAt timestamp`,
                            `   → TTL: 1 year (31536000 seconds)`
                          ]}
                          label="Read Material"
                        >
                          <button
                            onClick={() => handleMaterialClick(material)}
                            disabled={isMarking}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              isRead
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            } ${isMarking ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isMarking ? 'Marking...' : isRead ? 'Re-read Material' : 'Read Material'}
                          </button>
                        </ArkivQueryTooltip>
                      ) : (
                        <button
                          onClick={() => handleMaterialClick(material)}
                          disabled={isMarking}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            isRead
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          } ${isMarking ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isMarking ? 'Marking...' : isRead ? 'Re-read Material' : 'Read Material'}
                        </button>
                      )}
                    </div>
                    {arkivBuilderMode && materialProgress && materialProgress.key && (
                      <ViewOnArkivLink
                        entityKey={materialProgress.key}
                        txHash={materialProgress.txHash}
                        label="View Progress on Arkiv"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </BetaGate>
  );
}

