/**
 * Quest Detail Page
 *
 * Displays a quest track with all steps, progress tracking, and completion.
 * Uses the new quest engine with QuestStep types and evidence tracking.
 *
 * Route: /quests/[trackId]
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { BetaGate } from '@/components/auth/BetaGate';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { useProgressReconciliation } from '@/lib/hooks/useProgressReconciliation';
import type { LoadedQuest } from '@/lib/quests';
import type { QuestProgress } from '@/lib/arkiv/questProgress';
import { QuestStepRenderer } from '@/components/quests/QuestStepRenderer';

export default function QuestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const trackId = params.trackId as string;

  const [wallet, setWallet] = useState<string | null>(null);
  const [quest, setQuest] = useState<LoadedQuest | null>(null);
  const [progress, setProgress] = useState<QuestProgress[]>([]);
  const [completion, setCompletion] = useState<{
    completedSteps: number;
    totalSteps: number;
    progressPercent: number;
    requiredComplete: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reconciliation = useProgressReconciliation();
  const arkivBuilderMode = useArkivBuilderMode();
  const [badgeIssued, setBadgeIssued] = useState(false);
  const [badgeError, setBadgeError] = useState<string | null>(null);

  // Check and issue badge if eligible
  const checkAndIssueBadge = async () => {
    if (!wallet || !quest || !quest.badge) return;

    try {
      // Check eligibility
      const eligibilityRes = await fetch('/api/badges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check-eligibility',
          wallet,
          questId: quest.questId,
          trackId,
        }),
      });

      const eligibilityData = await eligibilityRes.json();

      if (eligibilityData.ok && eligibilityData.eligibility.eligible) {
        // Issue badge
        const issueRes = await fetch('/api/badges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'issue',
            wallet,
            badgeType: quest.badge.id,
            questId: quest.questId,
            evidenceRefs: eligibilityData.eligibility.evidenceRefs,
          }),
        });

        const issueData = await issueRes.json();

        if (issueData.ok) {
          setBadgeIssued(true);
          setBadgeError(null);
        } else {
          setBadgeError(issueData.error || 'Failed to issue badge');
        }
      }
    } catch (err: any) {
      console.error('Error checking/issuing badge:', err);
      setBadgeError(err.message || 'Failed to process badge');
    }
  };

  // Load wallet
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

  // Load quest
  useEffect(() => {
    if (!trackId) return;

    const loadQuest = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/quests?trackId=${trackId}`);
        const data = await res.json();

        if (!data.ok || !data.quest) {
          setError(data.error || 'Quest not found');
          return;
        }

        setQuest(data.quest);
      } catch (err: any) {
        console.error('Error loading quest:', err);
        setError('Failed to load quest');
      } finally {
        setLoading(false);
      }
    };

    loadQuest();
  }, [trackId]);

  // Load progress
  useEffect(() => {
    if (!wallet || !quest) return;

    const loadProgress = async () => {
      try {
        const res = await fetch(
          `/api/quests/progress?wallet=${wallet}&questId=${quest.questId}&trackId=${trackId}`
        );
        const data = await res.json();

        if (data.ok) {
          setProgress(data.progress || []);
          setCompletion(data.completion || null);

          // Check if badge already issued
          if (quest.badge) {
            const badgeRes = await fetch(
              `/api/badges?wallet=${wallet}&badgeType=${quest.badge.id}`
            );
            const badgeData = await badgeRes.json();
            if (badgeData.ok && badgeData.badge) {
              setBadgeIssued(true);
            } else if (data.completion && data.completion.requiredComplete) {
              // Quest complete but badge not issued yet - check eligibility
              checkAndIssueBadge();
            }
          }
        }
      } catch (err: any) {
        console.error('Error loading progress:', err);
      }
    };

    loadProgress();

    // Poll for progress updates (to catch indexer confirmations)
    const interval = setInterval(loadProgress, 5000);
    return () => clearInterval(interval);
  }, [wallet, quest, trackId]);

  // Check if step is completed and get progress data
  const getStepProgressData = (stepId: string): {
    completed: boolean;
    txHash?: string;
    entityKey?: string;
  } => {
    // First check indexed progress
    const stepProgress = progress.find((p) => p.stepId === stepId);
    if (stepProgress) {
      return {
        completed: true,
        txHash: stepProgress.txHash,
        entityKey: stepProgress.key,
      };
    }

    // Check reconciliation state (for pending/submitted steps)
    const pending = reconciliation.getStepStatus(stepId);
    if (pending && (pending.status === 'indexed' || pending.status === 'submitted')) {
      return {
        completed: true,
        txHash: pending.txHash,
        entityKey: pending.entityKey,
      };
    }

    return { completed: false };
  };

  // Handle step completion
  const handleStepComplete = async (stepId: string, stepType: string) => {
    if (!wallet || !quest) return;

    // Mark as pending (optimistic)
    reconciliation.markPending(stepId, {
      stepId,
      completedAt: new Date().toISOString(),
      evidenceType: 'completion',
    });

    try {
      // Record progress
      const res = await fetch('/api/quests/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          questId: quest.questId,
          stepId,
          stepType,
          evidenceData: {},
        }),
      });

      const data = await res.json();

      if (data.ok && data.txHash) {
        // Update reconciliation with txHash and entityKey immediately
        reconciliation.markSubmitted(
          stepId,
          data.txHash,
          data.key,
          async () => {
            // Check function for polling
            const checkRes = await fetch(
              `/api/quests/progress?wallet=${wallet}&questId=${quest.questId}&trackId=${trackId}`
            );
            const checkData = await checkRes.json();
            if (checkData.ok) {
              const stepProgress = checkData.progress.find(
                (p: QuestProgress) => p.stepId === stepId
              );
              if (stepProgress) {
                // Mark as indexed when found
                reconciliation.markIndexed(stepId);
                return true;
              }
            }
            return false;
          }
        );

        // Reload progress after a delay
        setTimeout(() => {
          fetch(
            `/api/quests/progress?wallet=${wallet}&questId=${quest.questId}&trackId=${trackId}`
          )
            .then((r) => r.json())
            .then((d) => {
              if (d.ok) {
                setProgress(d.progress || []);
                setCompletion(d.completion || null);

                // Check for badge eligibility if quest is complete
                if (d.completion && d.completion.requiredComplete && quest.badge) {
                  checkAndIssueBadge();
                }
              }
            });
        }, 2000);
      } else {
        reconciliation.markError(stepId, data.error || 'Failed to record progress');
      }
    } catch (err: any) {
      console.error('Error completing step:', err);
      reconciliation.markError(stepId, err.message || 'Failed to complete step');
    }
  };

  if (loading) {
    return (
      <BetaGate>
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
          <div className="max-w-4xl mx-auto">
            <BackButton href="/learner-quests" />
            <LoadingSpinner text="Loading quest..." className="py-12" />
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
            <BackButton href="/learner-quests" />
            <EmptyState
              title={error || 'Quest not found'}
              description="The quest you're looking for doesn't exist or couldn't be loaded."
            />
          </div>
        </div>
      </BetaGate>
    );
  }

  const sortedSteps = [...quest.steps].sort((a, b) => a.order - b.order);

  return (
    <BetaGate>
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <BackButton href="/learner-quests" />

          {/* Quest Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold mb-2">{quest.title}</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {quest.description}
            </p>

            {/* Progress Bar */}
            {completion && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Progress: {completion.completedSteps} / {completion.totalSteps} steps
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {completion.progressPercent}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-emerald-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${completion.progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Quest Metadata */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>Duration: {quest.estimatedDuration}</span>
              <span>Difficulty: {quest.difficulty}</span>
              <span>Steps: {quest.steps.length}</span>
            </div>

            {/* Badge Status */}
            {quest.badge && (
              <div className={`mt-4 p-3 rounded-lg border ${
                badgeIssued
                  ? 'border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                  : completion?.requiredComplete
                  ? 'border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏆</span>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">
                      {badgeIssued
                        ? `Badge Earned: ${quest.badge.name}`
                        : completion?.requiredComplete
                        ? `Eligible for: ${quest.badge.name}`
                        : `Complete all steps to earn: ${quest.badge.name}`}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {quest.badge.description}
                    </div>
                  </div>
                  {badgeError && (
                    <div className="text-xs text-red-600 dark:text-red-400">
                      {badgeError}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Steps List */}
          <div className="space-y-6">
            {sortedSteps.map((step) => {
              const progressData = getStepProgressData(step.stepId);
              const pending = reconciliation.getStepStatus(step.stepId);
              const stepContent = quest.stepContent[step.stepId] || '';

              return (
                <QuestStepRenderer
                  key={step.stepId}
                  step={step}
                  content={stepContent}
                  completed={progressData.completed}
                  pendingStatus={pending?.status}
                  txHash={progressData.txHash}
                  entityKey={progressData.entityKey}
                  questId={quest.questId}
                  onComplete={() => handleStepComplete(step.stepId, step.type)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </BetaGate>
  );
}
