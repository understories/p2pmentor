/**
 * Learner Quests Page
 *
 * Lists all learner quests with user progress, similar to skills/profiles pages.
 * Shows progress for each quest and allows viewing detailed materials.
 *
 * Reference: refs/learner-quests-implementation-plan.md
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { BackButton } from '@/components/BackButton';
import { BetaGate } from '@/components/auth/BetaGate';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { GardenBoard } from '@/components/garden/GardenBoard';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import type { UserProfile } from '@/lib/arkiv/profile';

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
  key: string;
  questId: string;
  title: string;
  description: string;
  source: string;
  questType: 'reading_list' | 'language_assessment';
  materials: LearnerQuestMaterial[];
  metadata: {
    totalMaterials: number;
    categories: string[];
    lastUpdated: string;
  };
  createdAt: string;
  status: 'active' | 'archived';
  txHash?: string;
};

type QuestProgress = {
  readCount: number;
  totalMaterials: number;
  progressPercent: number;
};

export default function LearnerQuestsPage() {
  const router = useRouter();
  const arkivBuilderMode = useArkivBuilderMode();
  const [wallet, setWallet] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [quests, setQuests] = useState<LearnerQuest[]>([]);
  const [questProgress, setQuestProgress] = useState<Record<string, QuestProgress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<LearnerQuest | null>(null);
  const [materialProgress, setMaterialProgress] = useState<Record<string, { status: string; readAt?: string; key?: string; txHash?: string }>>({});
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');
        return;
      }
      setWallet(address);
      loadUserProfile(address);
    }
  }, [router]);

  useEffect(() => {
    loadQuests();
  }, []);

  useEffect(() => {
    if (wallet && quests.length > 0) {
      loadAllProgress();
    }
  }, [wallet, quests]);

  useEffect(() => {
    if (selectedQuestId) {
      const quest = quests.find(q => q.questId === selectedQuestId);
      setSelectedQuest(quest || null);
      if (wallet && quest) {
        loadQuestProgress(quest.questId);
      }
    }
  }, [selectedQuestId, quests, wallet]);

  const loadUserProfile = async (walletAddress: string) => {
    try {
      const profile = await getProfileByWallet(walletAddress);
      setUserProfile(profile);
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  };

  const loadQuests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/learner-quests');
      const data = await res.json();

      if (data.ok && data.quests) {
        setQuests(data.quests);
      } else {
        setError(data.error || 'Failed to load quests');
      }
    } catch (err: any) {
      console.error('Error loading quests:', err);
      setError('Failed to load quests');
    } finally {
      setLoading(false);
    }
  };

  const loadAllProgress = async () => {
    if (!wallet) return;

    try {
      // Load progress for all quests in parallel
      const progressPromises = quests.map(async (quest) => {
        try {
          const res = await fetch(`/api/learner-quests/progress?questId=${quest.questId}&wallet=${wallet}`);
          const data = await res.json();

          if (data.ok && data.progress) {
            const readCount = Object.values(data.progress).filter((p: any) => p.status === 'read').length;
            const totalMaterials = quest.materials.length;
            const progressPercent = totalMaterials > 0 ? Math.round((readCount / totalMaterials) * 100) : 0;

            return {
              questId: quest.questId,
              progress: {
                readCount,
                totalMaterials,
                progressPercent,
              },
            };
          }
          return null;
        } catch (err) {
          console.error(`Error loading progress for quest ${quest.questId}:`, err);
          return null;
        }
      });

      const results = await Promise.all(progressPromises);
      const progressMap: Record<string, QuestProgress> = {};
      results.forEach((result) => {
        if (result) {
          progressMap[result.questId] = result.progress;
        }
      });
      setQuestProgress(progressMap);
    } catch (err: any) {
      console.error('Error loading all progress:', err);
    }
  };

  const loadQuestProgress = async (questId: string) => {
    if (!wallet || !questId) return;

    try {
      const res = await fetch(`/api/learner-quests/progress?questId=${questId}&wallet=${wallet}`);
      const data = await res.json();

      if (data.ok && data.progress) {
        const progressMap: Record<string, { status: string; readAt?: string; key?: string; txHash?: string }> = {};
        Object.values(data.progress).forEach((p: any) => {
          progressMap[p.materialId] = {
            status: p.status,
            readAt: p.readAt,
            key: p.key,
            txHash: p.txHash,
          };
        });
        setMaterialProgress(progressMap);
      }
    } catch (err: any) {
      console.error('Error loading quest progress:', err);
    }
  };

  const handleMaterialClick = async (material: LearnerQuestMaterial) => {
    if (!wallet || !selectedQuestId) return;

    // Open link in new tab
    window.open(material.url, '_blank', 'noopener,noreferrer');

    // Mark as read (fire and forget)
    setMarkingRead(material.id);
    try {
      await fetch('/api/learner-quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markRead',
          wallet,
          questId: selectedQuestId,
          materialId: material.id,
          sourceUrl: material.url,
        }),
      });

      // Update local state optimistically
      setMaterialProgress(prev => ({
        ...prev,
        [material.id]: {
          status: 'read',
          readAt: new Date().toISOString(),
          key: prev[material.id]?.key,
          txHash: prev[material.id]?.txHash,
        },
      }));

      // Reload progress after a delay (to ensure Arkiv indexing)
      setTimeout(() => {
        loadQuestProgress(selectedQuestId);
        loadAllProgress(); // Also refresh the quest list progress
      }, 2000);
    } catch (err: any) {
      console.error('Error marking material as read:', err);
    } finally {
      setMarkingRead(null);
    }
  };

  const handleQuestClick = (questId: string) => {
    setSelectedQuestId(questId);
  };

  const handleBackToList = () => {
    setSelectedQuestId(null);
    setSelectedQuest(null);
    setMaterialProgress({});
  };

  if (loading) {
    return (
      <BetaGate>
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
          <div className="max-w-6xl mx-auto">
            <BackButton href="/me" />
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `GET /api/learner-quests`,
                  `Query: listLearnerQuests()`,
                  `→ type='learner_quest', status='active'`,
                  `Returns: LearnerQuest[] (all active quests, deduplicated by questId)`
                ]}
                label="Loading Learner Quests"
              >
                <LoadingSpinner text="Loading learner quests..." className="py-12" />
              </ArkivQueryTooltip>
            ) : (
              <LoadingSpinner text="Loading learner quests..." className="py-12" />
            )}
          </div>
        </div>
      </BetaGate>
    );
  }

  if (error) {
    return (
      <BetaGate>
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
          <div className="max-w-6xl mx-auto">
            <BackButton href="/me" />
            <EmptyState
              title="Error loading quests"
              description={error}
            />
          </div>
        </div>
      </BetaGate>
    );
  }

  // Show quest detail view if a quest is selected
  if (selectedQuest) {
    const readCount = Object.values(materialProgress).filter(p => p.status === 'read').length;
    const progressPercent = selectedQuest.materials.length > 0
      ? Math.round((readCount / selectedQuest.materials.length) * 100)
      : 0;

    return (
      <BetaGate>
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
          <div className="max-w-4xl mx-auto">
            <BackButton />

            <div className="mb-8">
              <h1 className="text-3xl font-semibold mb-2">{selectedQuest.title}</h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{selectedQuest.description}</p>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Progress: {readCount} / {selectedQuest.materials.length} materials read
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
                  href={selectedQuest.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-emerald-600 dark:hover:text-emerald-400"
                >
                  {selectedQuest.source}
                </a>
              </p>
            </div>

            {/* Materials List */}
            <div className="space-y-4">
              {selectedQuest.materials.map((material) => {
                const materialProgressData = materialProgress[material.id];
                const isRead = materialProgressData?.status === 'read';
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
                              `   → Attributes: wallet='${wallet?.toLowerCase().slice(0, 8) || '...'}...', questId='${selectedQuestId}', materialId='${material.id}', status='read'`,
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
                      {arkivBuilderMode && materialProgressData && materialProgressData.key && (
                        <ViewOnArkivLink
                          entityKey={materialProgressData.key}
                          txHash={materialProgressData.txHash}
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

  // Show quest list view
  return (
    <BetaGate>
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-6xl mx-auto">
          <BackButton href="/me" />

          <PageHeader
            title="Learning Quests"
            description="Curated reading materials and learning paths. Track your progress through each quest."
          />

          {/* Quests List */}
          {quests.length === 0 ? (
            <EmptyState
              title="No learner quests available yet"
              description="Check back soon for curated learning materials."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {quests.map((quest) => {
                const progress = questProgress[quest.questId] || {
                  readCount: 0,
                  totalMaterials: quest.materials.length,
                  progressPercent: 0,
                };

                return (
                  <div
                    key={quest.questId}
                    onClick={() => handleQuestClick(quest.questId)}
                    className="p-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-md transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          {quest.title}
                        </h3>
                        {arkivBuilderMode && quest.key && (
                          <div className="mt-1 flex items-center gap-2">
                            <ViewOnArkivLink
                              entityKey={quest.key}
                              txHash={quest.txHash}
                              label="View Quest Entity"
                              className="text-xs"
                            />
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                              Key: {quest.key.slice(0, 12)}...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                      {quest.description}
                    </p>

                    {/* Progress */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {progress.readCount} / {progress.totalMaterials} materials
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {progress.progressPercent}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Source */}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Source:{' '}
                      <a
                        href={quest.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-emerald-600 dark:hover:text-emerald-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {quest.source.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Garden Board - Suggest Learning Quests */}
          <GardenBoard
            channel="public_garden_board"
            title="Suggest Learning Quests"
            description="Share ideas for new learning quests or reading materials."
            showCompose={!!wallet}
            userWallet={wallet}
            userProfile={userProfile}
          />
        </div>
      </div>
    </BetaGate>
  );
}
