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
  questType: 'reading_list' | 'language_assessment' | 'meta_learning';
  materials?: LearnerQuestMaterial[];
  metadata?: {
    totalMaterials?: number;
    categories?: string[];
    lastUpdated?: string;
  };
  createdAt: string;
  status: 'active' | 'archived';
  txHash?: string;
};

type QuestProgress = {
  readCount?: number;
  totalMaterials?: number;
  progressPercent: number;
  assessmentResult?: any; // Optional assessment result for language assessments
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
  const [materialProgress, setMaterialProgress] = useState<
    Record<string, { status: string; readAt?: string; key?: string; txHash?: string }>
  >({});
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [overallCompletion, setOverallCompletion] = useState<{
    percent: number;
    readCount: number;
    totalMaterials: number;
  } | null>(null);
  const [questTypeFilter, setQuestTypeFilter] = useState<
    'all' | 'reading_list' | 'language_assessment' | 'meta_learning'
  >('all');
  const [newQuests, setNewQuests] = useState<any[]>([]);
  const [newQuestsLoading, setNewQuestsLoading] = useState(false);
  const [featuredQuests, setFeaturedQuests] = useState<any[]>([]);

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
    loadNewQuests();
    loadFeaturedQuests();
  }, []);

  const loadNewQuests = async () => {
    try {
      setNewQuestsLoading(true);
      const res = await fetch('/api/quests');
      const data = await res.json();
      if (data.ok && data.quests) {
        setNewQuests(data.quests);
      }
    } catch (err: any) {
      console.error('Error loading new quests:', err);
    } finally {
      setNewQuestsLoading(false);
    }
  };

  const loadFeaturedQuests = async () => {
    try {
      const res = await fetch('/api/quests/featured');
      const data = await res.json();
      if (data.ok && data.featured) {
        setFeaturedQuests(data.featured);
      }
    } catch (err: any) {
      console.error('Error loading featured quests:', err);
    }
  };

  useEffect(() => {
    if (wallet && quests.length > 0) {
      loadAllProgress();
      loadOverallCompletion();
    }
  }, [wallet, quests]);

  useEffect(() => {
    if (selectedQuestId) {
      const quest = quests.find((q) => q.questId === selectedQuestId);
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
      // Load all quests (filtering is done client-side for better UX)
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
          if (quest.questType === 'reading_list') {
            const res = await fetch(
              `/api/learner-quests/progress?questId=${quest.questId}&wallet=${wallet}`
            );
            const data = await res.json();

            if (data.ok && data.progress) {
              const readCount = Object.values(data.progress).filter(
                (p: any) => p.status === 'read'
              ).length;
              const totalMaterials = quest.materials?.length || 0;
              const progressPercent =
                totalMaterials > 0 ? Math.round((readCount / totalMaterials) * 100) : 0;

              return {
                questId: quest.questId,
                progress: {
                  readCount,
                  totalMaterials,
                  progressPercent,
                },
              };
            }
          } else if (quest.questType === 'meta_learning') {
            // Load meta-learning quest progress
            try {
              const res = await fetch(
                `/api/learner-quests/meta-learning/progress?questId=meta_learning&wallet=${wallet}`
              );
              const data = await res.json();

              if (data.ok && data.progress) {
                const progress = data.progress;
                const completedSteps = progress.completedSteps || 0;
                const totalSteps = progress.totalSteps || 6;
                const progressPercent =
                  totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                return {
                  questId: quest.questId,
                  progress: {
                    completedSteps,
                    totalSteps,
                    progressPercent,
                  },
                };
              }
            } catch (err) {
              console.error(
                `Error loading meta-learning progress for quest ${quest.questId}:`,
                err
              );
            }
            // Return 0 progress if API fails or returns error
            return {
              questId: quest.questId,
              progress: {
                completedSteps: 0,
                totalSteps: 6,
                progressPercent: 0,
              },
            };
          } else if (quest.questType === 'language_assessment') {
            // Load assessment results for language assessments
            try {
              const resultRes = await fetch(
                `/api/learner-quests/assessment/result?questId=${quest.questId}&wallet=${wallet}`
              );
              const resultData = await resultRes.json();

              if (resultData.ok && resultData.result) {
                const result = resultData.result;
                return {
                  questId: quest.questId,
                  progress: {
                    progressPercent: result.percentage || 0,
                    assessmentResult: result,
                  },
                };
              }
            } catch (err) {
              console.error(`Error loading assessment result for quest ${quest.questId}:`, err);
            }
            // Fallback if no result found
            return {
              questId: quest.questId,
              progress: {
                progressPercent: 0,
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

  const loadOverallCompletion = async () => {
    if (!wallet) return;

    try {
      // Show ONLY meta-learning quest progress to nudge users to learn how to learn first
      const metaLearningQuest = quests.find((q) => q.questType === 'meta_learning');
      if (!metaLearningQuest) {
        setOverallCompletion(null);
        return;
      }

      // Load meta-learning quest progress
      try {
        const res = await fetch(
          `/api/learner-quests/meta-learning/progress?questId=meta_learning&wallet=${wallet}`
        );
        const data = await res.json();

        if (data.ok && data.progress) {
          const progress = data.progress;
          const completedSteps = progress.completedSteps || 0;
          const totalSteps = progress.totalSteps || 6; // Default to 6 steps for meta-learning
          const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

          setOverallCompletion({
            percent,
            readCount: completedSteps,
            totalMaterials: totalSteps,
          });
        } else {
          // If API returns error, show 0% progress (quest exists but no progress yet)
          setOverallCompletion({ percent: 0, readCount: 0, totalMaterials: 6 });
        }
      } catch (fetchErr: any) {
        // If fetch fails, don't show progress bar (quest might not be seeded yet)
        console.error('Error fetching meta-learning progress:', fetchErr);
        setOverallCompletion(null);
      }
    } catch (err: any) {
      console.error('Error loading overall completion:', err);
      setOverallCompletion(null);
    }
  };

  const loadQuestProgress = async (questId: string) => {
    if (!wallet || !questId) return;

    try {
      const res = await fetch(`/api/learner-quests/progress?questId=${questId}&wallet=${wallet}`);
      const data = await res.json();

      if (data.ok && data.progress) {
        const progressMap: Record<
          string,
          { status: string; readAt?: string; key?: string; txHash?: string }
        > = {};
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
      setMaterialProgress((prev) => ({
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

  const handleQuestClick = (quest: LearnerQuest) => {
    if (quest.questType === 'language_assessment') {
      // Navigate to language assessment page
      router.push(`/learner-quests/${quest.questId}`);
    } else if (quest.questType === 'meta_learning') {
      // Navigate to meta-learning quest page
      router.push(`/learner-quests/meta_learning`);
    } else {
      // Show reading list detail view
      setSelectedQuestId(quest.questId);
    }
  };

  const handleBackToList = () => {
    setSelectedQuestId(null);
    setSelectedQuest(null);
    setMaterialProgress({});
  };

  if (loading) {
    return (
      <BetaGate>
        <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
          <div className="mx-auto max-w-6xl">
            <BackButton href="/me" />
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `GET /api/learner-quests`,
                  `Query: listLearnerQuests()`,
                  `→ type='learner_quest', status='active'`,
                  `Returns: LearnerQuest[] (all active quests, deduplicated by questId)`,
                  ``,
                  `Filtering:`,
                  `- Client-side filter by questType (reading_list | language_assessment)`,
                  `- Arkiv-native: questType attribute on learner_quest entities`,
                  `- API supports ?questType=... for server-side filtering`,
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
        <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
          <div className="mx-auto max-w-6xl">
            <BackButton href="/me" />
            <EmptyState title="Error loading quests" description={error} />
          </div>
        </div>
      </BetaGate>
    );
  }

  // Show quest detail view if a quest is selected (only for reading_list quests)
  if (selectedQuest && selectedQuest.questType === 'reading_list') {
    const readCount = Object.values(materialProgress).filter((p) => p.status === 'read').length;
    const totalMaterials = selectedQuest.materials?.length || 0;
    const progressPercent = totalMaterials > 0 ? Math.round((readCount / totalMaterials) * 100) : 0;

    return (
      <BetaGate>
        <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
          <div className="mx-auto max-w-4xl">
            <BackButton />

            <div className="mb-8">
              <h1 className="mb-2 text-3xl font-semibold">{selectedQuest.title}</h1>
              <p className="mb-4 text-gray-600 dark:text-gray-400">{selectedQuest.description}</p>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Progress: {readCount} / {selectedQuest.materials?.length || 0} materials read
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {progressPercent}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2 rounded-full bg-emerald-600 transition-all duration-300"
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
              {selectedQuest.materials?.map((material) => {
                const materialProgressData = materialProgress[material.id];
                const isRead = materialProgressData?.status === 'read';
                const isMarking = markingRead === material.id;

                return (
                  <div
                    key={material.id}
                    className={`rounded-lg border-2 p-6 transition-all ${
                      isRead
                        ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20'
                        : 'border-gray-200 bg-white hover:border-emerald-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{material.title}</h3>
                          {isRead && (
                            <span className="text-sm text-emerald-600 dark:text-emerald-400">
                              ✓ Read
                            </span>
                          )}
                        </div>
                        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                          {material.author}
                          {material.year && ` (${material.year})`}
                        </p>
                        <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
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
                              `   → TTL: 1 year (31536000 seconds)`,
                            ]}
                            label="Read Material"
                          >
                            <button
                              onClick={() => handleMaterialClick(material)}
                              disabled={isMarking}
                              className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                                isRead
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              } ${isMarking ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              {isMarking
                                ? 'Marking...'
                                : isRead
                                  ? 'Re-read Material'
                                  : 'Read Material'}
                            </button>
                          </ArkivQueryTooltip>
                        ) : (
                          <button
                            onClick={() => handleMaterialClick(material)}
                            disabled={isMarking}
                            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                              isRead
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            } ${isMarking ? 'cursor-not-allowed opacity-50' : ''}`}
                          >
                            {isMarking
                              ? 'Marking...'
                              : isRead
                                ? 'Re-read Material'
                                : 'Read Material'}
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
      <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
        <div className="mx-auto max-w-6xl">
          <BackButton href="/me" />

          {/* Level Up In Progress Banner */}
          <div className="mb-6 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-4 dark:border-amber-500 dark:bg-amber-900/20">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚧</span>
              <div className="flex-1">
                <h3 className="text-sm font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  Level Up In Progress
                </h3>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Quest engine hardening underway. New quest tracks and proof primitives coming
                  soon.
                </p>
              </div>
              <span className="text-2xl">⚡</span>
            </div>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <PageHeader
              title="Learning Quests"
              description="Curated reading materials and learning paths. Track your progress through each quest."
            />
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `Navigates to /learner-quests/create page`,
                  `POST /api/learner-quests/create { action: 'createQuest', ... }`,
                  `Creates: type='learner_quest' entity`,
                  `Attributes: questId, title, description, questType, status='active'`,
                  `Payload: Full quest data (materials array, metadata, etc.)`,
                  `TTL: 1 year (31536000 seconds)`,
                ]}
                label="Create Quest"
              >
                <Link
                  href="/learner-quests/create"
                  className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Create Quest
                </Link>
              </ArkivQueryTooltip>
            ) : (
              <Link
                href="/learner-quests/create"
                className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
              >
                Create Quest
              </Link>
            )}
          </div>

          {/* Filter Buttons */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `Filter: Show all quest types`,
                  `Query: GET /api/learner-quests`,
                  `→ listLearnerQuests() (no questType filter)`,
                  `→ type='learner_quest', status='active'`,
                  `Returns: All active quests (reading_list + language_assessment)`,
                ]}
                label="Filter: All"
              >
                <button
                  onClick={() => setQuestTypeFilter('all')}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    questTypeFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  All
                </button>
              </ArkivQueryTooltip>
            ) : (
              <button
                onClick={() => setQuestTypeFilter('all')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  questTypeFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                All
              </button>
            )}
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `Filter: Show reading_list quests only`,
                  `Query: GET /api/learner-quests?questType=reading_list`,
                  `→ listLearnerQuests({ questType: 'reading_list' })`,
                  `→ type='learner_quest', status='active', questType='reading_list'`,
                  `Returns: Reading list quests only (with materials array)`,
                ]}
                label="Filter: Reading Lists"
              >
                <button
                  onClick={() => setQuestTypeFilter('reading_list')}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    questTypeFilter === 'reading_list'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Reading Lists
                </button>
              </ArkivQueryTooltip>
            ) : (
              <button
                onClick={() => setQuestTypeFilter('reading_list')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  questTypeFilter === 'reading_list'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Reading Lists
              </button>
            )}
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `Filter: Show language_assessment quests only`,
                  `Query: GET /api/learner-quests?questType=language_assessment`,
                  `→ listLearnerQuests({ questType: 'language_assessment' })`,
                  `→ type='learner_quest', status='active', questType='language_assessment'`,
                  `Returns: Language assessment quests only (with sections/questions in payload)`,
                ]}
                label="Filter: Language Assessments"
              >
                <button
                  onClick={() => setQuestTypeFilter('language_assessment')}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    questTypeFilter === 'language_assessment'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Language Assessments
                </button>
              </ArkivQueryTooltip>
            ) : (
              <button
                onClick={() => setQuestTypeFilter('language_assessment')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  questTypeFilter === 'language_assessment'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Language Assessments
              </button>
            )}
          </div>

          {/* Overall Completion Rate (Meta-Learning Quest) */}
          {overallCompletion && questTypeFilter !== 'language_assessment' && (
            <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 backdrop-blur-sm dark:border-emerald-700 dark:bg-emerald-900/30">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Meta-Learning Quest Progress
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {overallCompletion.percent}%
                </span>
              </div>
              <div className="mb-2 h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-3 rounded-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${overallCompletion.percent}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {overallCompletion.readCount} / {overallCompletion.totalMaterials} steps completed
              </p>
            </div>
          )}

          {/* Quests List */}
          {(() => {
            // Filter quests by questType
            const filteredQuests =
              questTypeFilter === 'all'
                ? quests
                : quests.filter((q) => q.questType === questTypeFilter);

            if (filteredQuests.length === 0) {
              return (
                <EmptyState
                  title={`No ${questTypeFilter === 'all' ? 'learner quests' : questTypeFilter === 'reading_list' ? 'reading list quests' : questTypeFilter === 'language_assessment' ? 'language assessment quests' : 'meta-learning quests'} available yet`}
                  description="Check back soon for curated learning materials."
                />
              );
            }

            return (
              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredQuests.map((quest) => {
                  const progress = questProgress[quest.questId] || {
                    readCount: 0,
                    totalMaterials: quest.materials?.length || 0,
                    progressPercent: 0,
                  };

                  return (
                    <div
                      key={quest.questId}
                      onClick={() => handleQuestClick(quest)}
                      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-6 transition-all duration-200 hover:border-emerald-500 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-400"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
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
                              <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                                Key: {quest.key.slice(0, 12)}...
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="mb-4 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                        {quest.description}
                      </p>

                      {/* Quest Type Badge */}
                      <div className="mb-2">
                        <span
                          className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                            quest.questType === 'language_assessment'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : quest.questType === 'meta_learning'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                          }`}
                        >
                          {quest.questType === 'language_assessment'
                            ? 'Language Assessment'
                            : quest.questType === 'meta_learning'
                              ? 'Activity Quest'
                              : 'Reading List'}
                        </span>
                      </div>

                      {/* Progress (for reading_list and meta_learning quests) */}
                      {(quest.questType === 'reading_list' ||
                        quest.questType === 'meta_learning') && (
                        <div className="mb-4">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {quest.questType === 'meta_learning'
                                ? `${progress.readCount || 0} / ${progress.totalMaterials || 6} steps`
                                : `${progress.readCount} / ${progress.totalMaterials} materials`}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {progress.progressPercent}%
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                quest.questType === 'meta_learning'
                                  ? 'bg-purple-600 dark:bg-purple-500'
                                  : 'bg-emerald-600'
                              }`}
                              style={{ width: `${progress.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Language Assessment Action */}
                      {quest.questType === 'language_assessment' && (
                        <div className="mb-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/learner-quests/${quest.questId}`);
                            }}
                            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                          >
                            Start Assessment
                          </button>
                        </div>
                      )}

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
            );
          })()}

          {/* Featured Quests */}
          {featuredQuests.length > 0 && (
            <div className="mb-8 mt-12">
              <div className="mb-6">
                <h2 className="mb-2 text-2xl font-semibold">Featured Quests</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Recommended quest tracks highlighted by the network.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {featuredQuests.map((quest: any) => (
                  <Link
                    key={quest.questId}
                    href={`/quests/${quest.track || quest.questId}`}
                    className="relative rounded-lg border-2 border-amber-300 bg-amber-50 p-6 transition-all duration-200 hover:border-amber-400 hover:shadow-md dark:border-amber-600 dark:bg-amber-900/20 dark:hover:border-amber-500"
                  >
                    <span className="absolute -top-2.5 left-4 rounded-full bg-amber-500 px-3 py-0.5 text-xs font-semibold text-white">
                      Featured
                    </span>
                    <h3 className="mb-2 mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {quest.title}
                    </h3>
                    <p className="mb-4 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                      {quest.description}
                    </p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        {quest.track}
                      </span>
                      {quest.difficulty && (
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          {quest.difficulty}
                        </span>
                      )}
                      {quest.hasBadge && (
                        <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                          Badge
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {quest.stepCount} steps
                      {quest.featuredUntil && (
                        <span>
                          {' '}
                          · Featured until {new Date(quest.featuredUntil).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* New Quest Engine Quests */}
          {newQuests.length > 0 && (
            <div className="mb-8 mt-12">
              <div className="mb-6">
                <h2 className="mb-2 text-2xl font-semibold">New Quest Engine</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Quest tracks with step-by-step learning and verifiable proof artifacts.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {newQuests.map((quest) => (
                  <Link
                    key={quest.questId}
                    href={`/quests/${quest.trackId || quest.questId}`}
                    className="rounded-lg border border-gray-200 bg-white p-6 transition-all duration-200 hover:border-emerald-500 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-400"
                  >
                    <div className="mb-3">
                      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {quest.title}
                      </h3>
                      <p className="mb-4 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                        {quest.description}
                      </p>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      <span className="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        {quest.track}
                      </span>
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        {quest.difficulty}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {quest.stepCount} steps • {quest.estimatedDuration}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Garden Board - Learner Quests Board */}
          <GardenBoard
            channel="learner_quests_garden_board"
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
