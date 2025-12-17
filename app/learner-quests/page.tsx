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
  const [materialProgress, setMaterialProgress] = useState<Record<string, { status: string; readAt?: string; key?: string; txHash?: string }>>({});
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [overallCompletion, setOverallCompletion] = useState<{ percent: number; readCount: number; totalMaterials: number } | null>(null);
  const [questTypeFilter, setQuestTypeFilter] = useState<'all' | 'reading_list' | 'language_assessment'>('all');

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
      loadOverallCompletion();
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
            const res = await fetch(`/api/learner-quests/progress?questId=${quest.questId}&wallet=${wallet}`);
            const data = await res.json();

            if (data.ok && data.progress) {
              const readCount = Object.values(data.progress).filter((p: any) => p.status === 'read').length;
              const totalMaterials = quest.materials?.length || 0;
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
          } else if (quest.questType === 'language_assessment') {
            // Load assessment results for language assessments
            try {
              const resultRes = await fetch(`/api/learner-quests/assessment/result?questId=${quest.questId}&wallet=${wallet}`);
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
      // Calculate overall completion across all reading_list quests
      const readingListQuests = quests.filter(q => q.questType === 'reading_list');
      if (readingListQuests.length === 0) {
        setOverallCompletion(null);
        return;
      }

      const progressPromises = readingListQuests.map(async (quest) => {
        try {
          const res = await fetch(`/api/learner-quests/progress?questId=${quest.questId}&wallet=${wallet}`);
          const data = await res.json();

          if (data.ok && data.progress && quest.materials) {
            const readCount = Object.values(data.progress).filter((p: any) => p.status === 'read').length;
            const totalMaterials = quest.materials.length;
            return { readCount, totalMaterials };
          }
          return { readCount: 0, totalMaterials: quest.materials?.length || 0 };
        } catch (err) {
          console.error(`Error loading progress for quest ${quest.questId}:`, err);
          return { readCount: 0, totalMaterials: quest.materials?.length || 0 };
        }
      });

      const results = await Promise.all(progressPromises);
      const totalRead = results.reduce((sum, r) => sum + r.readCount, 0);
      const totalMaterials = results.reduce((sum, r) => sum + r.totalMaterials, 0);
      const percent = totalMaterials > 0 ? Math.round((totalRead / totalMaterials) * 100) : 0;

      setOverallCompletion({ percent, readCount: totalRead, totalMaterials });
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

  const handleQuestClick = (quest: LearnerQuest) => {
    if (quest.questType === 'language_assessment') {
      // Navigate to language assessment page
      router.push(`/learner-quests/${quest.questId}`);
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
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
          <div className="max-w-6xl mx-auto">
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
                  `- API supports ?questType=... for server-side filtering`
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

  // Show quest detail view if a quest is selected (only for reading_list quests)
  if (selectedQuest && selectedQuest.questType === 'reading_list') {
    const readCount = Object.values(materialProgress).filter(p => p.status === 'read').length;
    const totalMaterials = selectedQuest.materials?.length || 0;
    const progressPercent = totalMaterials > 0
      ? Math.round((readCount / totalMaterials) * 100)
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
                    Progress: {readCount} / {selectedQuest.materials?.length || 0} materials read
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
              {selectedQuest.materials?.map((material) => {
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
                  `Returns: All active quests (reading_list + language_assessment)`
                ]}
                label="Filter: All"
              >
                <button
                  onClick={() => setQuestTypeFilter('all')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    questTypeFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  All
                </button>
              </ArkivQueryTooltip>
            ) : (
              <button
                onClick={() => setQuestTypeFilter('all')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  questTypeFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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
                  `Returns: Reading list quests only (with materials array)`
                ]}
                label="Filter: Reading Lists"
              >
                <button
                  onClick={() => setQuestTypeFilter('reading_list')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    questTypeFilter === 'reading_list'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Reading Lists
                </button>
              </ArkivQueryTooltip>
            ) : (
              <button
                onClick={() => setQuestTypeFilter('reading_list')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  questTypeFilter === 'reading_list'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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
                  `Returns: Language assessment quests only (with sections/questions in payload)`
                ]}
                label="Filter: Language Assessments"
              >
                <button
                  onClick={() => setQuestTypeFilter('language_assessment')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    questTypeFilter === 'language_assessment'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Language Assessments
                </button>
              </ArkivQueryTooltip>
            ) : (
              <button
                onClick={() => setQuestTypeFilter('language_assessment')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  questTypeFilter === 'language_assessment'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Language Assessments
              </button>
            )}
          </div>

          {/* Overall Completion Rate (only for reading_list quests) */}
          {overallCompletion && questTypeFilter !== 'language_assessment' && (
            <div className="mb-6 p-4 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-900/30 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Overall Progress (Reading Lists)
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {overallCompletion.percent}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
                <div
                  className="bg-emerald-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${overallCompletion.percent}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {overallCompletion.readCount} / {overallCompletion.totalMaterials} materials completed across all reading list quests
              </p>
            </div>
          )}

          {/* Quests List */}
          {(() => {
            // Filter quests by questType
            const filteredQuests = questTypeFilter === 'all'
              ? quests
              : quests.filter(q => q.questType === questTypeFilter);

            if (filteredQuests.length === 0) {
              return (
                <EmptyState
                  title={`No ${questTypeFilter === 'all' ? 'learner quests' : questTypeFilter === 'reading_list' ? 'reading list quests' : 'language assessment quests'} available yet`}
                  description="Check back soon for curated learning materials."
                />
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
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

                    {/* Quest Type Badge */}
                    <div className="mb-2">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                        quest.questType === 'language_assessment'
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                      }`}>
                        {quest.questType === 'language_assessment' ? 'Language Assessment' : 'Reading List'}
                      </span>
                    </div>

                    {/* Progress (only for reading_list quests) */}
                    {quest.questType === 'reading_list' && (
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
                    )}

                    {/* Language Assessment Action */}
                    {quest.questType === 'language_assessment' && (
                      <div className="mb-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/learner-quests/${quest.questId}`);
                          }}
                          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
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
