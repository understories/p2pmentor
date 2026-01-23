/**
 * Quest Step Renderer
 *
 * Renders a single quest step with markdown content, completion status,
 * and action buttons based on step type.
 */

'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ConceptCard } from '@/components/learner-quests/ConceptCard';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { FlashcardPractice } from './FlashcardPractice';
import { HashGenerator } from './HashGenerator';
import { KeypairGenerator } from './KeypairGenerator';
import { SignVerifyDemo } from './SignVerifyDemo';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import type { QuestStepDefinition } from '@/lib/quests';
import type { ReconciliationStatus } from '@/lib/hooks/useProgressReconciliation';

interface QuestStepRendererProps {
  step: QuestStepDefinition;
  content: string;
  completed: boolean;
  pendingStatus?: ReconciliationStatus;
  txHash?: string;
  entityKey?: string;
  questId?: string;
  onComplete: () => void;
}

export function QuestStepRenderer({
  step,
  content,
  completed,
  pendingStatus,
  txHash,
  entityKey,
  questId,
  onComplete,
}: QuestStepRendererProps) {
  const arkivBuilderMode = useArkivBuilderMode();
  const isLoading = pendingStatus === 'pending' || pendingStatus === 'submitted';
  const isError = pendingStatus === 'error';

  return (
    <div
      className={`p-6 rounded-lg border-2 transition-all ${
        completed
          ? 'border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700'
      }`}
    >
      {/* Step Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
              Step {step.order}
            </span>
            <span
              className={`px-2 py-1 text-xs font-medium rounded ${
                step.type === 'READ'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                  : step.type === 'DO'
                  ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                  : step.type === 'QUIZ'
                  ? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}
            >
              {step.type}
            </span>
            {completed && (
              <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                ✓ Completed
              </span>
            )}
            {isLoading && (
              <span className="text-blue-600 dark:text-blue-400 text-sm">
                ⏳ {pendingStatus === 'submitted' ? 'Submitting...' : 'Processing...'}
              </span>
            )}
            {isError && (
              <span className="text-red-600 dark:text-red-400 text-sm">
                ✗ Error
              </span>
            )}
          </div>
          <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {step.description}
          </p>
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
        <div className="mb-4 prose prose-sm dark:prose-invert max-w-none">
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
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                      {...props}
                    >
                      {children}
                    </a>
                  );
                }
                return <a href={href} className="text-blue-600 dark:text-blue-400 hover:underline" {...props}>{children}</a>;
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}

      {/* Flashcard Practice (for vocabulary steps) */}
      {step.vocabulary && step.vocabulary.length > 0 && (
        <div className="mb-6 p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
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
            onVerified={(message, signature, publicKey) => {
              // Signature verified - user can mark step as complete
            }}
            requireVerification={step.actionConfig.requireVerification}
          />
        </div>
      )}

      {/* Arkiv Builder Mode: Transaction & Entity Info */}
      {arkivBuilderMode && (txHash || entityKey || completed || pendingStatus === 'submitted') && (
        <div className="mt-4 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
          <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 mb-2 uppercase tracking-wide">
            Arkiv Entity Created
          </div>
          {entityKey && (
            <div className="mb-2">
              <div className="text-xs text-emerald-700 dark:text-emerald-300 mb-1">
                Entity Key:
              </div>
              <div className="font-mono text-xs text-emerald-900 dark:text-emerald-100 break-all">
                {entityKey}
              </div>
            </div>
          )}
          {txHash && (
            <div className="mb-2">
              <div className="text-xs text-emerald-700 dark:text-emerald-300 mb-1">
                Transaction Hash:
              </div>
              <div className="font-mono text-xs text-emerald-900 dark:text-emerald-100 break-all">
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

      {/* Completion Button */}
      {!completed && (
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
                onClick={onComplete}
                disabled={isLoading}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isLoading
                    ? 'bg-gray-400 dark:bg-gray-600 text-white cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
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
              onClick={onComplete}
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isLoading
                  ? 'bg-gray-400 dark:bg-gray-600 text-white cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
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
            onClick={onComplete}
            className="px-4 py-2 rounded-lg font-medium transition-colors bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Mark as Complete Again
          </button>
        </div>
      )}
    </div>
  );
}
