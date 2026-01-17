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
import type { QuestStepDefinition } from '@/lib/quests';
import type { ReconciliationStatus } from '@/lib/hooks/useProgressReconciliation';

interface QuestStepRendererProps {
  step: QuestStepDefinition;
  content: string;
  completed: boolean;
  pendingStatus?: ReconciliationStatus;
  onComplete: () => void;
}

export function QuestStepRenderer({
  step,
  content,
  completed,
  pendingStatus,
  onComplete,
}: QuestStepRendererProps) {
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

      {/* Completion Button */}
      {!completed && (
        <div className="mt-4">
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
