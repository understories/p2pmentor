/**
 * Meta-Learning Quest Detail Page
 *
 * Full implementation with all 6 steps, concept cards, TTL controls, and artifact submission.
 *
 * Reference: refs/meta-learning-quest-implementation-plan.md
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { BetaGate } from '@/components/auth/BetaGate';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ConceptCard } from '@/components/learner-quests/ConceptCard';
import { TTLControl } from '@/components/learner-quests/TTLControl';

type MetaLearningQuest = {
  questId: string;
  title: string;
  description: string;
  steps?: Array<{
    stepId: string;
    title: string;
    description: string;
    estimatedDuration: string;
    minimumTimeGapSeconds?: number;
    conceptCard?: {
      title: string;
      body: string;
    } | null;
  }>;
  metadata?: {
    totalSteps?: number;
    estimatedTotalTime?: string;
    completionCriteria?: string;
  };
  ui?: {
    ttl?: {
      defaultTtlSeconds: number;
      presetsSeconds: number[];
      allowCustom: boolean;
      showAdvancedToggleByDefault: boolean;
      allowApplyToRemainingSteps: boolean;
    };
  };
};

type Progress = {
  status: 'not_started' | 'in_progress' | 'completed';
  progressPercent: number;
  completedSteps: number;
  totalSteps: number;
  targets: Array<{
    targetKey: string;
    status: 'not_started' | 'in_progress' | 'completed';
    progressPercent: number;
    artifacts: Record<string, any[]>;
  }>;
};

export default function MetaLearningQuestPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<string | null>(null);
  const [quest, setQuest] = useState<MetaLearningQuest | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  // TTL state (shared across steps if "apply to remaining" is checked)
  const [ttlSeconds, setTtlSeconds] = useState(31536000); // Default 1 year
  const [applyTtlToRemaining, setApplyTtlToRemaining] = useState(false);
  const [ttlAppliedToSteps, setTtlAppliedToSteps] = useState<Set<string>>(new Set());

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
    if (wallet) {
      loadQuest();
      loadProgress();
    }
  }, [wallet]);

  const loadQuest = async () => {
    try {
      const res = await fetch('/api/learner-quests?questId=meta_learning');
      const data = await res.json();

      if (data.ok && data.quest) {
        setQuest(data.quest);
        // Initialize TTL from quest definition
        if (data.quest.ui?.ttl?.defaultTtlSeconds) {
          setTtlSeconds(data.quest.ui.ttl.defaultTtlSeconds);
        }
      } else {
        setError('Quest not found');
      }
    } catch (err: any) {
      console.error('Error loading quest:', err);
      setError('Failed to load quest');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!wallet) return;

    try {
      const res = await fetch(
        `/api/learner-quests/meta-learning/progress?questId=meta_learning&wallet=${wallet}`
      );
      const data = await res.json();

      if (data.ok && data.progress) {
        setProgress(data.progress);
      }
    } catch (err: any) {
      console.error('Error loading progress:', err);
    }
  };

  const getStepStatus = (stepId: string): 'not_started' | 'in_progress' | 'completed' => {
    if (!progress || !progress.targets || progress.targets.length === 0) return 'not_started';

    // Check if any target has artifacts for this step
    const hasArtifacts = progress.targets.some((target) => {
      const stepArtifacts = target.artifacts[stepId];
      return stepArtifacts && stepArtifacts.length > 0;
    });

    return hasArtifacts ? 'completed' : 'not_started';
  };

  const handleSubmitArtifact = async (
    stepId: string,
    artifactType: string,
    data: Record<string, any>
  ) => {
    if (!wallet || !quest) return;

    setSubmitting(stepId);
    try {
      // Generate idempotency key (wallet + stepId + timestamp of first submission attempt)
      const idempotencyKey = `${wallet.toLowerCase()}_${stepId}_${Date.now()}`;

      // For step 1 (choose_target), use the target title as targetKey
      // For other steps, we need to reference the target from step 1
      let targetKey = 'default';
      if (stepId === 'choose_target') {
        targetKey = (data.title || 'default').toLowerCase().replace(/\s+/g, '_');
      } else {
        // Get target from step 1 artifacts
        if (progress?.targets && progress.targets.length > 0) {
          targetKey = progress.targets[0].targetKey;
        } else {
          setError('Please complete Step 1 (Choose a Learning Target) first');
          return;
        }
      }

      const res = await fetch('/api/learner-quests/meta-learning/artifact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          questId: 'meta_learning',
          stepId,
          artifactType,
          targetKey,
          ttlSeconds,
          idempotencyKey,
          data: {
            ...data,
            submittedAt: new Date().toISOString(),
          },
        }),
      });

      const result = await res.json();
      if (result.ok) {
        // Reload progress
        await loadProgress();

        // Apply TTL to remaining steps if checkbox is checked
        if (applyTtlToRemaining && !ttlAppliedToSteps.has(stepId)) {
          setTtlAppliedToSteps(new Set([...ttlAppliedToSteps, stepId]));
        }

        // Close active step
        setActiveStep(null);
      } else {
        setError(result.error || 'Failed to submit artifact');
      }
    } catch (err: any) {
      console.error('Error submitting artifact:', err);
      setError('Failed to submit artifact');
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <BetaGate>
        <div className="flex min-h-screen items-center justify-center">
          <LoadingSpinner />
        </div>
      </BetaGate>
    );
  }

  if (error && !quest) {
    return (
      <BetaGate>
        <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
          <div className="mx-auto max-w-4xl">
            <BackButton href="/learner-quests" />
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      </BetaGate>
    );
  }

  if (!quest) return null;

  const totalSteps = quest.steps?.length || 6;
  const completedSteps = progress?.completedSteps || 0;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <BetaGate>
      <div className="min-h-screen p-4 text-gray-900 dark:text-gray-100">
        <div className="mx-auto max-w-4xl">
          <BackButton href="/learner-quests" />

          {/* Quest Header */}
          <div className="mb-8 mt-6">
            <h1 className="mb-2 text-3xl font-bold">{quest.title}</h1>
            <p className="mb-4 text-gray-600 dark:text-gray-400">{quest.description}</p>

            {/* Progress Bar */}
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-700 dark:bg-emerald-900/30">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Progress
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {progressPercent}%
                </span>
              </div>
              <div className="mb-2 h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-3 rounded-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {completedSteps} / {totalSteps} steps completed
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-6">
            {quest.steps?.map((step, index) => {
              const stepStatus = getStepStatus(step.stepId);
              const isActive = activeStep === step.stepId;
              const isSubmitting = submitting === step.stepId;

              return (
                <div
                  key={step.stepId}
                  className={`rounded-lg border-2 p-6 ${
                    stepStatus === 'completed'
                      ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-900/20'
                      : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                  }`}
                >
                  {/* Step Header */}
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                          {index + 1}
                        </span>
                        <h2 className="text-xl font-semibold">{step.title}</h2>
                        {stepStatus === 'completed' && (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                            Completed
                          </span>
                        )}
                      </div>
                      <p className="ml-11 text-gray-600 dark:text-gray-400">{step.description}</p>
                      <p className="ml-11 mt-1 text-sm text-gray-500 dark:text-gray-500">
                        Estimated: {step.estimatedDuration}
                      </p>
                    </div>
                  </div>

                  {/* Concept Card */}
                  {step.conceptCard && (
                    <div className="mb-4 ml-11">
                      <ConceptCard
                        stepId={step.stepId}
                        title={step.conceptCard.title}
                        body={step.conceptCard.body}
                        wallet={wallet || undefined}
                      />
                    </div>
                  )}

                  {/* Step Form (when active) */}
                  {isActive && (
                    <div className="ml-11 mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
                      {step.stepId === 'choose_target' && (
                        <ChooseTargetForm
                          onSubmit={(data: Record<string, any>) =>
                            handleSubmitArtifact(step.stepId, 'learning_target', data)
                          }
                          isSubmitting={isSubmitting}
                          ttlSeconds={ttlSeconds}
                          onTtlChange={setTtlSeconds}
                          applyToRemaining={applyTtlToRemaining}
                          onApplyToRemainingChange={setApplyTtlToRemaining}
                          questUi={quest.ui}
                        />
                      )}
                      {step.stepId === 'focused_session' && (
                        <FocusedSessionForm
                          onSubmit={(data: Record<string, any>) =>
                            handleSubmitArtifact(step.stepId, 'learning_session', data)
                          }
                          isSubmitting={isSubmitting}
                          ttlSeconds={ttlSeconds}
                          onTtlChange={setTtlSeconds}
                          applyToRemaining={applyTtlToRemaining}
                          onApplyToRemainingChange={setApplyTtlToRemaining}
                          questUi={quest.ui}
                        />
                      )}
                      {step.stepId === 'diffuse_break' && (
                        <DiffuseBreakForm
                          onSubmit={(data: Record<string, any>) =>
                            handleSubmitArtifact(step.stepId, 'diffuse_interval', data)
                          }
                          isSubmitting={isSubmitting}
                          ttlSeconds={ttlSeconds}
                          onTtlChange={setTtlSeconds}
                          applyToRemaining={applyTtlToRemaining}
                          onApplyToRemainingChange={setApplyTtlToRemaining}
                          questUi={quest.ui}
                        />
                      )}
                      {step.stepId === 'retrieval_attempt' && (
                        <RetrievalAttemptForm
                          onSubmit={(data: Record<string, any>) =>
                            handleSubmitArtifact(step.stepId, 'retrieval_attempt', data)
                          }
                          isSubmitting={isSubmitting}
                          ttlSeconds={ttlSeconds}
                          onTtlChange={setTtlSeconds}
                          applyToRemaining={applyTtlToRemaining}
                          onApplyToRemainingChange={setApplyTtlToRemaining}
                          questUi={quest.ui}
                        />
                      )}
                      {step.stepId === 'reflection' && (
                        <ReflectionForm
                          onSubmit={(data: Record<string, any>) =>
                            handleSubmitArtifact(step.stepId, 'reflection', data)
                          }
                          isSubmitting={isSubmitting}
                          ttlSeconds={ttlSeconds}
                          onTtlChange={setTtlSeconds}
                          applyToRemaining={applyTtlToRemaining}
                          onApplyToRemainingChange={setApplyTtlToRemaining}
                          questUi={quest.ui}
                        />
                      )}
                      {step.stepId === 'spacing_check' && (
                        <SpacingCheckForm
                          onSubmit={(data: Record<string, any>) =>
                            handleSubmitArtifact(step.stepId, 'spacing_check', data)
                          }
                          isSubmitting={isSubmitting}
                          ttlSeconds={ttlSeconds}
                          onTtlChange={setTtlSeconds}
                          applyToRemaining={applyTtlToRemaining}
                          onApplyToRemainingChange={setApplyTtlToRemaining}
                          questUi={quest.ui}
                          minimumTimeGapSeconds={step.minimumTimeGapSeconds}
                          progress={progress}
                        />
                      )}
                    </div>
                  )}

                  {/* Step Actions */}
                  {!isActive && (
                    <div className="ml-11 mt-4">
                      {stepStatus === 'completed' ? (
                        <button
                          onClick={() => setActiveStep(step.stepId)}
                          className="px-4 py-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Update or Review
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveStep(step.stepId)}
                          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                        >
                          Start Step
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </BetaGate>
  );
}

// Form Components for each step
function ChooseTargetForm({
  onSubmit,
  isSubmitting,
  ttlSeconds,
  onTtlChange,
  applyToRemaining,
  onApplyToRemainingChange,
  questUi,
}: any) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      targetType: 'custom',
      title,
      description,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">Learning Target Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
      <TTLControl
        value={ttlSeconds}
        onChange={onTtlChange}
        applyToRemaining={applyToRemaining}
        onApplyToRemainingChange={onApplyToRemainingChange}
        showAdvanced={questUi?.ttl?.showAdvancedToggleByDefault}
      />
      <button
        type="submit"
        disabled={isSubmitting || !title}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}

function FocusedSessionForm({
  onSubmit,
  isSubmitting,
  ttlSeconds,
  onTtlChange,
  applyToRemaining,
  onApplyToRemainingChange,
  questUi,
}: any) {
  const [objective, setObjective] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [distractionLevel, setDistractionLevel] = useState<'low' | 'medium' | 'high'>('low');
  const [startedAt, setStartedAt] = useState(new Date().toISOString());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      durationMinutes,
      objective,
      startedAt,
      completedAt: new Date().toISOString(),
      distractionLevel,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">What did you focus on?</label>
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          required
          rows={3}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">Duration (minutes)</label>
        <input
          type="number"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
          min="1"
          max="120"
          required
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">Distraction Level</label>
        <select
          value={distractionLevel}
          onChange={(e) => setDistractionLevel(e.target.value as any)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <TTLControl
        value={ttlSeconds}
        onChange={onTtlChange}
        applyToRemaining={applyToRemaining}
        onApplyToRemainingChange={onApplyToRemainingChange}
        showAdvanced={questUi?.ttl?.showAdvancedToggleByDefault}
      />
      <button
        type="submit"
        disabled={isSubmitting || !objective}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}

function DiffuseBreakForm({
  onSubmit,
  isSubmitting,
  ttlSeconds,
  onTtlChange,
  applyToRemaining,
  onApplyToRemainingChange,
  questUi,
}: any) {
  const [activityType, setActivityType] = useState<'walk' | 'rest' | 'shower' | 'other'>('walk');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [startedAt, setStartedAt] = useState(new Date().toISOString());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      activityType,
      durationMinutes,
      startedAt,
      completedAt: new Date().toISOString(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">Activity Type</label>
        <select
          value={activityType}
          onChange={(e) => setActivityType(e.target.value as any)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="walk">Walk</option>
          <option value="rest">Rest</option>
          <option value="shower">Shower</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">Duration (minutes)</label>
        <input
          type="number"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
          min="1"
          max="120"
          required
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
      <TTLControl
        value={ttlSeconds}
        onChange={onTtlChange}
        applyToRemaining={applyToRemaining}
        onApplyToRemainingChange={onApplyToRemainingChange}
        showAdvanced={questUi?.ttl?.showAdvancedToggleByDefault}
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}

function RetrievalAttemptForm({
  onSubmit,
  isSubmitting,
  ttlSeconds,
  onTtlChange,
  applyToRemaining,
  onApplyToRemainingChange,
  questUi,
}: any) {
  const [content, setContent] = useState('');
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high'>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      content,
      confidence,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">
          What do you remember? (Write without notes)
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={6}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          placeholder="Try to recall what you learned..."
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">Confidence Level (optional)</label>
        <select
          value={confidence}
          onChange={(e) => setConfidence(e.target.value as any)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <TTLControl
        value={ttlSeconds}
        onChange={onTtlChange}
        applyToRemaining={applyToRemaining}
        onApplyToRemainingChange={onApplyToRemainingChange}
        showAdvanced={questUi?.ttl?.showAdvancedToggleByDefault}
      />
      <button
        type="submit"
        disabled={isSubmitting || !content}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}

function ReflectionForm({
  onSubmit,
  isSubmitting,
  ttlSeconds,
  onTtlChange,
  applyToRemaining,
  onApplyToRemainingChange,
  questUi,
}: any) {
  const [whatSurprised, setWhatSurprised] = useState('');
  const [whatFeltEasyButWasnt, setWhatFeltEasyButWasnt] = useState('');
  const [whatFeltHardButImproved, setWhatFeltHardButImproved] = useState('');
  const [insightAfterBreak, setInsightAfterBreak] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      responses: {
        whatSurprised,
        whatFeltEasyButWasnt,
        whatFeltHardButImproved,
        insightAfterBreak,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">What surprised you?</label>
        <textarea
          value={whatSurprised}
          onChange={(e) => setWhatSurprised(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">What felt easy but wasn't?</label>
        <textarea
          value={whatFeltEasyButWasnt}
          onChange={(e) => setWhatFeltEasyButWasnt(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">What felt hard but improved?</label>
        <textarea
          value={whatFeltHardButImproved}
          onChange={(e) => setWhatFeltHardButImproved(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">Did insight occur after the break?</label>
        <textarea
          value={insightAfterBreak}
          onChange={(e) => setInsightAfterBreak(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
      <TTLControl
        value={ttlSeconds}
        onChange={onTtlChange}
        applyToRemaining={applyToRemaining}
        onApplyToRemainingChange={onApplyToRemainingChange}
        showAdvanced={questUi?.ttl?.showAdvancedToggleByDefault}
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}

function SpacingCheckForm({
  onSubmit,
  isSubmitting,
  ttlSeconds,
  onTtlChange,
  applyToRemaining,
  onApplyToRemainingChange,
  questUi,
  minimumTimeGapSeconds,
  progress,
}: any) {
  const [whatPersisted, setWhatPersisted] = useState('');
  const [whatDecayed, setWhatDecayed] = useState('');
  const [whatReclicked, setWhatReclicked] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      responses: {
        whatPersisted,
        whatDecayed,
        whatReclicked,
      },
      completedAt: new Date().toISOString(),
    });
  };

  // Check if minimum time gap since focused_session is met
  const getFocusedSessionTime = (): number | null => {
    if (!progress?.targets || progress.targets.length === 0) return null;
    for (const target of progress.targets) {
      const sessionArtifacts = target.artifacts?.focused_session;
      if (sessionArtifacts && sessionArtifacts.length > 0) {
        const most_recent = sessionArtifacts[sessionArtifacts.length - 1];
        const timestamp = most_recent.createdAt || most_recent.data?.completedAt;
        if (timestamp) return new Date(timestamp).getTime();
      }
    }
    return null;
  };

  const focusedSessionTime = getFocusedSessionTime();
  const elapsedSeconds = focusedSessionTime
    ? Math.floor((Date.now() - focusedSessionTime) / 1000)
    : null;
  const canSubmit =
    !minimumTimeGapSeconds ||
    !focusedSessionTime ||
    (elapsedSeconds !== null && elapsedSeconds >= minimumTimeGapSeconds);
  const hoursRemaining =
    minimumTimeGapSeconds && elapsedSeconds !== null && elapsedSeconds < minimumTimeGapSeconds
      ? Math.ceil((minimumTimeGapSeconds - elapsedSeconds) / 3600)
      : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {minimumTimeGapSeconds && (
        <div
          className={`rounded-lg border p-3 ${canSubmit ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'}`}
        >
          <p
            className={`text-sm ${canSubmit ? 'text-green-800 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'}`}
          >
            {!focusedSessionTime
              ? `This step requires completing a focused session first, then waiting at least ${Math.floor(minimumTimeGapSeconds / 3600)} hours.`
              : canSubmit
                ? 'Time requirement met. You can submit this step.'
                : `Please wait ~${hoursRemaining} more hour${hoursRemaining !== 1 ? 's' : ''} before submitting (${Math.floor(minimumTimeGapSeconds / 3600)}-hour gap required after focused session).`}
          </p>
        </div>
      )}
      <div>
        <label className="mb-2 block text-sm font-medium">What persisted?</label>
        <textarea
          value={whatPersisted}
          onChange={(e) => setWhatPersisted(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">What decayed?</label>
        <textarea
          value={whatDecayed}
          onChange={(e) => setWhatDecayed(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">What re-clicked quickly?</label>
        <textarea
          value={whatReclicked}
          onChange={(e) => setWhatReclicked(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
      <TTLControl
        value={ttlSeconds}
        onChange={onTtlChange}
        applyToRemaining={applyToRemaining}
        onApplyToRemainingChange={onApplyToRemainingChange}
        showAdvanced={questUi?.ttl?.showAdvancedToggleByDefault}
      />
      <button
        type="submit"
        disabled={isSubmitting || !canSubmit}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
