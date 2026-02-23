/**
 * Quest Step Renderer
 *
 * Renders a single quest step with markdown content, completion status,
 * and action buttons based on step type.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ConceptCard } from '@/components/learner-quests/ConceptCard';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { FlashcardPractice } from './FlashcardPractice';
import { HashGenerator } from './HashGenerator';
import { KeypairGenerator } from './KeypairGenerator';
import { SignVerifyDemo } from './SignVerifyDemo';
import { SpacedRepetitionScheduler } from './SpacedRepetitionScheduler';
import { DeliberativePracticePlanner } from './DeliberativePracticePlanner';
import { ActiveRecallCreator } from './ActiveRecallCreator';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { QuizRenderer } from './QuizRenderer';
import { ReflectionPrompt } from './ReflectionPrompt';
import { ThreatModelWorksheet } from './ThreatModelWorksheet';
import { PrivacyChecklist } from './PrivacyChecklist';
import { logClientTelemetry } from '@/lib/telemetry';
import type { QuizResultData } from './QuizRenderer';
import type { QuestStepDefinition, QuizRubric } from '@/lib/quests';
import type { ReconciliationStatus } from '@/lib/hooks/useProgressReconciliation';

interface QuestStepRendererProps {
  step: QuestStepDefinition;
  content: string;
  completed: boolean;
  pendingStatus?: ReconciliationStatus;
  txHash?: string;
  entityKey?: string;
  questId?: string;
  wallet?: string;
  rubric?: QuizRubric;
  onComplete: (evidenceData?: Record<string, unknown>) => void;
  onQuizComplete?: (result: QuizResultData) => void;
}

export function QuestStepRenderer({
  step,
  content,
  completed,
  pendingStatus,
  txHash,
  entityKey,
  questId,
  wallet,
  rubric,
  onComplete,
  onQuizComplete,
}: QuestStepRendererProps) {
  const arkivBuilderMode = useArkivBuilderMode();
  const [quizStarted, setQuizStarted] = useState(false);
  const [stepStartTime] = useState(() => Date.now());
  const [timeGateAcknowledged, setTimeGateAcknowledged] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const isLoading = pendingStatus === 'pending' || pendingStatus === 'submitted';
  const isError = pendingStatus === 'error';
  const isQuizStep = step.type === 'QUIZ' && rubric && wallet && questId;

  const minTimeRequired = step.duration ? Math.max(step.duration * 60 * 0.3, 30) : 0;
  const timeGateActive =
    minTimeRequired > 0 && elapsedSeconds < minTimeRequired && !timeGateAcknowledged && !completed;

  const stepViewLogged = useRef(false);
  useEffect(() => {
    if (questId && !stepViewLogged.current) {
      stepViewLogged.current = true;
      logClientTelemetry({ eventType: 'step_view', questId, stepId: step.stepId });
    }
  }, [questId, step.stepId]);

  useEffect(() => {
    if (minTimeRequired <= 0 || timeGateAcknowledged || completed) return;
    const interval = setInterval(() => {
      setElapsedSeconds((Date.now() - stepStartTime) / 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, [minTimeRequired, timeGateAcknowledged, completed, stepStartTime]);

  return (
    <div
      className={`rounded-lg border-2 p-6 transition-all ${
        completed
          ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20'
          : 'border-gray-200 bg-white hover:border-emerald-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-700'
      }`}
    >
      {/* Step Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-3">
            <span className="font-mono text-sm text-gray-500 dark:text-gray-400">
              Step {step.order}
            </span>
            <span
              className={`rounded px-2 py-1 text-xs font-medium ${
                step.type === 'READ'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : step.type === 'DO'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    : step.type === 'QUIZ'
                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              }`}
            >
              {step.type}
            </span>
            {completed && (
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                ✓ Completed
              </span>
            )}
            {isLoading && (
              <span className="text-sm text-blue-600 dark:text-blue-400">
                ⏳ {pendingStatus === 'submitted' ? 'Submitting...' : 'Processing...'}
              </span>
            )}
            {isError && <span className="text-sm text-red-600 dark:text-red-400">✗ Error</span>}
          </div>
          <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{step.description}</p>
          {step.duration && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Estimated time: {step.duration} minutes
            </p>
          )}
        </div>
      </div>

      {/* Concept Card */}
      {step.conceptCard && (
        <div className="mb-4">
          <ConceptCard
            stepId={step.stepId}
            title={step.conceptCard.title}
            body={step.conceptCard.body}
          />
        </div>
      )}

      {/* Step Content (Markdown) */}
      {content && (
        <div className="prose prose-sm mb-4 max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, href, children, ...props }) => {
                if (href?.startsWith('http')) {
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                      {...props}
                    >
                      {children}
                    </a>
                  );
                }
                return (
                  <a
                    href={href}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                    {...props}
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}

      {/* Flashcard Practice (for vocabulary steps) */}
      {step.vocabulary && step.vocabulary.length > 0 && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <FlashcardPractice
            vocabulary={step.vocabulary}
            minCards={step.minCards || step.vocabulary.length}
            stepId={step.stepId}
            onComplete={(stats) => {
              // Flashcard practice completion triggers step completion
              // User can then mark step as complete
            }}
          />
        </div>
      )}

      {/* Interactive Components (for cryptography and meta-learning steps) */}
      {step.actionConfig?.component === 'HashGenerator' && (
        <div className="mb-6">
          <HashGenerator
            onHashGenerated={(hash, input) => {
              // Hash generated - user can mark step as complete
            }}
            minHashes={step.actionConfig.minHashes || 1}
          />
        </div>
      )}

      {step.actionConfig?.component === 'KeypairGenerator' && (
        <div className="mb-6">
          <KeypairGenerator
            onKeypairGenerated={(publicKey) => {
              // Keypair generated - public key can be stored in evidence
            }}
            storePublicKey={step.actionConfig.storePublicKey}
          />
        </div>
      )}

      {step.actionConfig?.component === 'SignVerifyDemo' && (
        <div className="mb-6">
          <SignVerifyDemo
            onVerified={(message, signature, publicKey, explanation) => {
              onComplete({
                message,
                signature,
                publicKey,
                explanation,
                timeSpent: Math.floor((Date.now() - stepStartTime) / 1000),
              });
            }}
            requireVerification={step.actionConfig.requireVerification}
          />
        </div>
      )}

      {step.actionConfig?.component === 'SpacedRepetitionScheduler' && (
        <div className="mb-6">
          <SpacedRepetitionScheduler
            onScheduleCreated={(schedule) => {
              // Schedule created - user can mark step as complete
            }}
            requireSchedule={step.actionConfig.requireSchedule}
          />
        </div>
      )}

      {step.actionConfig?.component === 'DeliberativePracticePlanner' && (
        <div className="mb-6">
          <DeliberativePracticePlanner
            onPlanCreated={(plan) => {
              // Practice plan created - user can mark step as complete
            }}
            requirePlan={step.actionConfig.requirePlan}
          />
        </div>
      )}

      {step.actionConfig?.component === 'ActiveRecallCreator' && (
        <div className="mb-6">
          <ActiveRecallCreator
            onQuestionsCreated={(data) => {
              // Questions created - user can mark step as complete
            }}
            minQuestions={step.actionConfig.minQuestions || 5}
          />
        </div>
      )}

      {step.actionConfig?.component === 'ThreatModelWorksheet' && (
        <div className="mb-6">
          <ThreatModelWorksheet
            onComplete={(model) => {
              onComplete({
                threatModel: model,
                timeSpent: Math.floor((Date.now() - stepStartTime) / 1000),
              });
            }}
          />
        </div>
      )}

      {step.actionConfig?.component === 'PrivacyChecklist' && (
        <div className="mb-6">
          <PrivacyChecklist
            onComplete={(completed) => {
              onComplete({
                checklistItems: completed,
                timeSpent: Math.floor((Date.now() - stepStartTime) / 1000),
              });
            }}
          />
        </div>
      )}

      {/* Reflection Prompt (shown for READ steps after content) */}
      {step.type === 'READ' && completed && wallet && questId && (
        <div className="mb-6">
          <ReflectionPrompt
            stepId={step.stepId}
            questId={questId}
            wallet={wallet}
            progressEntityKey={entityKey}
            prompt={step.reflectionPrompt}
          />
        </div>
      )}

      {/* Quiz Renderer (for QUIZ steps with rubric data) */}
      {isQuizStep && !completed && (
        <div className="mb-6">
          {quizStarted ? (
            <QuizRenderer
              rubric={rubric}
              questId={questId}
              stepId={step.stepId}
              wallet={wallet}
              onQuizComplete={(result) => {
                if (onQuizComplete) {
                  onQuizComplete(result);
                }
              }}
            />
          ) : (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
              <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
                This step includes a {rubric.questions.length}-question quiz. You need{' '}
                {Math.round(rubric.passingScore * 100)}% to pass.
              </p>
              <button
                onClick={() => setQuizStarted(true)}
                className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-700"
              >
                Start Quiz
              </button>
            </div>
          )}
        </div>
      )}

      {/* Show quiz results for completed quiz steps */}
      {isQuizStep && completed && (
        <div className="mb-6">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Quiz completed. Your results have been recorded on Arkiv.
            </p>
          </div>
        </div>
      )}

      {/* Arkiv Builder Mode: Transaction & Entity Info */}
      {arkivBuilderMode && (txHash || entityKey || completed || pendingStatus === 'submitted') && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
            Arkiv Entity Created
          </div>
          {entityKey && (
            <div className="mb-2">
              <div className="mb-1 text-xs text-emerald-700 dark:text-emerald-300">Entity Key:</div>
              <div className="break-all font-mono text-xs text-emerald-900 dark:text-emerald-100">
                {entityKey}
              </div>
            </div>
          )}
          {txHash && (
            <div className="mb-2">
              <div className="mb-1 text-xs text-emerald-700 dark:text-emerald-300">
                Transaction Hash:
              </div>
              <div className="break-all font-mono text-xs text-emerald-900 dark:text-emerald-100">
                {txHash}
              </div>
            </div>
          )}
          {(entityKey || txHash) && (
            <div className="mt-2">
              <ViewOnArkivLink
                entityKey={entityKey}
                txHash={txHash}
                label="View on Mendoza Explorer"
                className="text-sm"
              />
            </div>
          )}
        </div>
      )}

      {/* Time Gate (soft friction) */}
      {timeGateActive && !isQuizStep && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="mb-2 text-sm text-amber-800 dark:text-amber-200">
            We recommend spending at least {Math.ceil(minTimeRequired / 60)} minute
            {Math.ceil(minTimeRequired / 60) !== 1 ? 's' : ''} on this step to get the most out of
            it.
          </p>
          <button
            onClick={() => setTimeGateAcknowledged(true)}
            className="text-xs text-amber-700 underline dark:text-amber-300"
          >
            I&apos;ve reviewed the content, continue anyway
          </button>
        </div>
      )}

      {/* Completion Button (not shown for quiz steps with rubric - quiz handles its own completion) */}
      {!completed && !isQuizStep && (
        <div className="mt-4">
          {step.vocabulary && step.vocabulary.length > 0 && (
            <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              💡 Complete the flashcard practice above, then mark this step as done.
            </div>
          )}
          {arkivBuilderMode ? (
            <ArkivQueryTooltip
              query={[
                `handleStepComplete("${step.stepId}", "${step.type}")`,
                `Action:`,
                `POST /api/quests/progress { wallet, questId, stepId, stepType }`,
                ``,
                `Creates: type='quest_step_progress' entity`,
                `Attributes:`,
                `- wallet (normalized to lowercase)`,
                `- questId: "${questId || 'quest_id'}"`,
                `- stepId: "${step.stepId}"`,
                `- stepType: "${step.type}"`,
                `- spaceId: SPACE_ID`,
                `- createdAt: ISO timestamp`,
                ``,
                `Payload:`,
                `- evidence: { stepId, completedAt, evidenceType: 'completion' }`,
                `- questVersion: '1'`,
                ``,
                `TTL: 1 year (31536000 seconds)`,
                ``,
                `Returns: { key, txHash, status: 'submitted' }`,
                `→ Entity key and transaction hash for verification`,
                `→ View on Mendoza Explorer: ${entityKey ? `https://explorer.mendoza.hoodi.arkiv.network/entity/${entityKey}` : 'Available after submission'}`,
              ]}
              label={
                isLoading
                  ? pendingStatus === 'submitted'
                    ? 'Submitting...'
                    : 'Processing...'
                  : step.type === 'READ'
                    ? 'Mark as Read'
                    : step.type === 'DO'
                      ? 'Mark as Complete'
                      : step.type === 'QUIZ'
                        ? 'Start Quiz'
                        : 'Complete Step'
              }
            >
              <button
                onClick={() =>
                  onComplete({ timeSpent: Math.floor((Date.now() - stepStartTime) / 1000) })
                }
                disabled={isLoading}
                className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                  isLoading
                    ? 'cursor-not-allowed bg-gray-400 text-white dark:bg-gray-600'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isLoading
                  ? pendingStatus === 'submitted'
                    ? 'Submitting...'
                    : 'Processing...'
                  : step.type === 'READ'
                    ? 'Mark as Read'
                    : step.type === 'DO'
                      ? 'Mark as Complete'
                      : step.type === 'QUIZ'
                        ? 'Start Quiz'
                        : 'Complete Step'}
              </button>
            </ArkivQueryTooltip>
          ) : (
            <button
              onClick={() =>
                onComplete({ timeSpent: Math.floor((Date.now() - stepStartTime) / 1000) })
              }
              disabled={isLoading}
              className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                isLoading
                  ? 'cursor-not-allowed bg-gray-400 text-white dark:bg-gray-600'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isLoading
                ? pendingStatus === 'submitted'
                  ? 'Submitting...'
                  : 'Processing...'
                : step.type === 'READ'
                  ? 'Mark as Read'
                  : step.type === 'DO'
                    ? 'Mark as Complete'
                    : step.type === 'QUIZ'
                      ? 'Start Quiz'
                      : 'Complete Step'}
            </button>
          )}
        </div>
      )}

      {/* Re-complete button for completed steps */}
      {completed && (
        <div className="mt-4">
          <button
            onClick={() =>
              onComplete({ timeSpent: Math.floor((Date.now() - stepStartTime) / 1000) })
            }
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Mark as Complete Again
          </button>
        </div>
      )}
    </div>
  );
}
