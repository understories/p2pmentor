/**
 * Quiz Renderer
 *
 * Renders quiz questions, collects answers, submits to the quiz API,
 * and displays results with score and explanations.
 *
 * Supports question types: multiple_choice, true_false, fill_blank, matching
 *
 * Week 2 (Feb 8-14) - Quiz engine v1
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { logClientTelemetry } from '@/lib/telemetry';
import type { QuizRubric, QuizQuestion } from '@/lib/quests/questFormat';

interface QuizRendererProps {
  rubric: QuizRubric;
  questId: string;
  stepId: string;
  wallet: string;
  onQuizComplete: (result: QuizResultData) => void;
}

export interface QuizResultData {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  pending?: boolean;
  progress?: { key: string | null; txHash: string | null };
  quizResult?: { key: string | null; txHash: string | null };
}

type QuizPhase = 'taking' | 'submitting' | 'results';

export function QuizRenderer({
  rubric,
  questId,
  stepId,
  wallet,
  onQuizComplete,
}: QuizRendererProps) {
  const arkivBuilderMode = useArkivBuilderMode();
  const [phase, setPhase] = useState<QuizPhase>('taking');
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [result, setResult] = useState<QuizResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showExplanations, setShowExplanations] = useState(false);
  const [shuffled, setShuffled] = useState(true);

  const questions = useMemo(() => {
    if (!shuffled) return rubric.questions;
    const arr = [...rubric.questions];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // Only shuffle once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffled]);
  const questionIds = questions.map((q) => q.id);

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  const setAnswer = useCallback((questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleSubmit = async () => {
    if (!allAnswered) return;

    setPhase('submitting');
    setError(null);

    try {
      const res = await fetch('/api/quests/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          questId,
          stepId,
          rubricVersion: rubric.version,
          questionIds,
          answers,
          rubric,
          passingScore: rubric.passingScore,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error || 'Failed to submit quiz');
        setPhase('taking');
        return;
      }

      const resultData: QuizResultData = {
        score: data.score,
        maxScore: data.maxScore,
        percentage: data.percentage,
        passed: data.passed,
        pending: data.pending,
        progress: data.progress,
        quizResult: data.quizResult,
      };

      setResult(resultData);
      setPhase('results');
      onQuizComplete(resultData);

      if (!resultData.passed) {
        logClientTelemetry({
          eventType: 'quiz_failure',
          questId,
          stepId,
          errorType: 'quiz_not_passed',
          errorMessage: `Score ${Math.round(resultData.percentage * 100)}% below ${Math.round(rubric.passingScore * 100)}% threshold`,
        });
      }
    } catch (err: any) {
      console.error('[QuizRenderer] Submit error:', err);
      setError(err.message || 'Failed to submit quiz');
      setPhase('taking');
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setResult(null);
    setError(null);
    setShowExplanations(false);
    setShuffled((prev) => !prev); // toggle to re-shuffle
    setPhase('taking');
  };

  // Check if a specific answer is correct (for results display)
  const isAnswerCorrect = (
    question: QuizQuestion,
    userAnswer: string | string[] | undefined
  ): boolean => {
    if (userAnswer === undefined) return false;
    const correct = question.correctAnswer;
    if (question.type === 'multiple_choice' || question.type === 'true_false') {
      return String(userAnswer) === String(correct);
    }
    if (question.type === 'fill_blank') {
      return String(userAnswer).toLowerCase().trim() === String(correct).toLowerCase().trim();
    }
    if (question.type === 'matching') {
      if (Array.isArray(userAnswer) && Array.isArray(correct)) {
        return JSON.stringify([...userAnswer].sort()) === JSON.stringify([...correct].sort());
      }
    }
    return false;
  };

  // Results phase
  if (phase === 'results' && result) {
    const percentDisplay = Math.round(result.percentage * 100);
    return (
      <div className="space-y-4">
        {/* Score summary */}
        <div
          className={`rounded-lg border-2 p-4 ${
            result.passed
              ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20'
              : 'border-orange-500 bg-orange-50 dark:border-orange-600 dark:bg-orange-900/20'
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {result.passed ? 'Quiz Passed' : 'Quiz Not Passed'}
            </h3>
            <span
              className={`text-2xl font-bold ${
                result.passed
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-orange-600 dark:text-orange-400'
              }`}
            >
              {percentDisplay}%
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Score: {result.score} / {result.maxScore} (passing:{' '}
            {Math.round(rubric.passingScore * 100)}%)
          </p>
          {result.pending && (
            <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
              Results submitted. Transaction is being processed.
            </p>
          )}
        </div>

        {/* Arkiv Builder Mode: Quiz Result Entity */}
        {arkivBuilderMode && (result.progress?.key || result.quizResult?.key) && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
              Quiz Result Entities
            </div>
            {result.progress?.key && (
              <div className="mb-2">
                <span className="text-xs text-emerald-700 dark:text-emerald-300">Progress: </span>
                <ViewOnArkivLink
                  entityKey={result.progress.key}
                  txHash={result.progress.txHash || undefined}
                  label=""
                  className="text-xs"
                />
              </div>
            )}
            {result.quizResult?.key && (
              <div>
                <span className="text-xs text-emerald-700 dark:text-emerald-300">Assessment: </span>
                <ViewOnArkivLink
                  entityKey={result.quizResult.key}
                  txHash={result.quizResult.txHash || undefined}
                  label=""
                  className="text-xs"
                />
              </div>
            )}
          </div>
        )}

        {/* Show/hide explanations toggle */}
        <button
          onClick={() => setShowExplanations(!showExplanations)}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          {showExplanations ? 'Hide explanations' : 'Show explanations'}
        </button>

        {/* Question review */}
        {showExplanations && (
          <div className="space-y-3">
            {questions.map((q, idx) => {
              const userAnswer = answers[q.id];
              const correct = isAnswerCorrect(q, userAnswer);
              return (
                <div
                  key={q.id}
                  className={`rounded-lg border p-3 ${
                    correct
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10'
                      : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10'
                  }`}
                >
                  <div className="mb-1 flex items-start gap-2">
                    <span className={`text-sm ${correct ? 'text-emerald-600' : 'text-red-600'}`}>
                      {correct ? '✓' : '✗'}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {idx + 1}. {q.question}
                      </p>
                      {!correct && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          Correct answer:{' '}
                          {Array.isArray(q.correctAnswer)
                            ? q.correctAnswer.join(', ')
                            : String(q.correctAnswer)}
                        </p>
                      )}
                      {q.explanation && (
                        <p className="mt-1 text-xs italic text-gray-600 dark:text-gray-400">
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Retry button (only if failed) */}
        {!result.passed && (
          <button
            onClick={handleRetry}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  // Submitting phase
  if (phase === 'submitting') {
    return (
      <div className="py-8">
        <LoadingSpinner text="Scoring quiz and recording results..." className="py-4" />
      </div>
    );
  }

  // Taking phase - render questions
  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          {answeredCount} of {questions.length} answered
        </span>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={shuffled}
              onChange={(e) => setShuffled(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs">Shuffle</span>
          </label>
          <span>Passing: {Math.round(rubric.passingScore * 100)}%</span>
        </div>
      </div>

      {/* Questions */}
      {questions.map((q, idx) => (
        <QuestionRenderer
          key={q.id}
          question={q}
          index={idx}
          answer={answers[q.id]}
          onAnswer={(value) => setAnswer(q.id, value)}
        />
      ))}

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Submit button */}
      {arkivBuilderMode ? (
        <ArkivQueryTooltip
          query={[
            `POST /api/quests/quiz`,
            `Body: { wallet, questId: "${questId}", stepId: "${stepId}",`,
            `  rubricVersion: "${rubric.version}", questionIds, answers, rubric }`,
            ``,
            `Scoring: Server-side scoring against rubric`,
            `Creates: quest_step_progress entity (evidence: quiz_result)`,
            `Creates: learner_quest_assessment_result entity`,
            `Returns: { score, maxScore, percentage, passed }`,
          ]}
          label="Submit Quiz"
        >
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className={`rounded-lg px-6 py-3 font-medium transition-colors ${
              allAnswered
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
            }`}
          >
            Submit Quiz
          </button>
        </ArkivQueryTooltip>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className={`rounded-lg px-6 py-3 font-medium transition-colors ${
            allAnswered
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
          }`}
        >
          Submit Quiz
        </button>
      )}
    </div>
  );
}

/**
 * Matching question: left items (options) paired with right items (correctAnswer)
 * via dropdowns. Scoring uses sorted array comparison.
 */
function MatchingQuestion({
  options,
  correctAnswer,
  questionId,
  answer,
  onAnswer,
}: {
  options: string[];
  correctAnswer: string[];
  questionId: string;
  answer: string[];
  onAnswer: (value: string[]) => void;
}) {
  const [choices] = useState(() => {
    const arr = [...correctAnswer];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  const selections =
    answer.length === options.length ? answer : new Array<string>(options.length).fill('');

  const handleSelect = (idx: number, value: string) => {
    const next = [...selections];
    next[idx] = value;
    onAnswer(next);
  };

  return (
    <div className="space-y-3">
      {options.map((leftItem, idx) => (
        <div
          key={idx}
          className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-600"
        >
          <span className="min-w-0 flex-1 text-sm font-medium">{leftItem}</span>
          <span className="text-gray-400">→</span>
          <select
            value={selections[idx] || ''}
            onChange={(e) => handleSelect(idx, e.target.value)}
            className="min-w-[140px] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          >
            <option value="">Select match...</option>
            {choices.map((choice, cIdx) => (
              <option key={cIdx} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

/**
 * Individual question renderer
 */
function QuestionRenderer({
  question,
  index,
  answer,
  onAnswer,
}: {
  question: QuizQuestion;
  index: number;
  answer: string | string[] | undefined;
  onAnswer: (value: string | string[]) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="mb-3 text-sm font-medium">
        <span className="mr-2 text-gray-500 dark:text-gray-400">{index + 1}.</span>
        {question.question}
      </p>

      {question.type === 'multiple_choice' && question.options && (
        <div className="space-y-2">
          {question.options.map((option, optIdx) => (
            <label
              key={optIdx}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                answer === option
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                  : 'border-gray-200 hover:border-blue-300 dark:border-gray-600 dark:hover:border-blue-600'
              }`}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option}
                checked={answer === option}
                onChange={() => onAnswer(option)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">{option}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'true_false' && (
        <div className="space-y-2">
          {['true', 'false'].map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                answer === option
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                  : 'border-gray-200 hover:border-blue-300 dark:border-gray-600 dark:hover:border-blue-600'
              }`}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option}
                checked={answer === option}
                onChange={() => onAnswer(option)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm capitalize">{option}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'fill_blank' && (
        <input
          type="text"
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="Type your answer..."
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
        />
      )}

      {question.type === 'matching' &&
        question.options &&
        Array.isArray(question.correctAnswer) && (
          <MatchingQuestion
            options={question.options}
            correctAnswer={question.correctAnswer as string[]}
            questionId={question.id}
            answer={Array.isArray(answer) ? answer : []}
            onAnswer={onAnswer}
          />
        )}

      {/* Points indicator */}
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {question.points} {question.points === 1 ? 'point' : 'points'}
      </div>
    </div>
  );
}
