/**
 * Active Recall Creator Component
 *
 * Interactive component for creating active recall questions and answers.
 * Used in meta-learning quest steps to demonstrate active recall practice.
 */

'use client';

import { useState } from 'react';

interface ActiveRecallCreatorProps {
  onQuestionsCreated?: (data: {
    topic: string;
    questions: Array<{ question: string; answer: string }>;
  }) => void;
  minQuestions?: number;
}

export function ActiveRecallCreator({
  onQuestionsCreated,
  minQuestions = 5,
}: ActiveRecallCreatorProps) {
  const [topic, setTopic] = useState('');
  const [questions, setQuestions] = useState<Array<{ question: string; answer: string }>>([
    { question: '', answer: '' },
    { question: '', answer: '' },
    { question: '', answer: '' },
    { question: '', answer: '' },
    { question: '', answer: '' },
  ]);
  const [created, setCreated] = useState(false);

  const updateQuestion = (index: number, field: 'question' | 'answer', value: string) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const addQuestion = () => {
    setQuestions([...questions, { question: '', answer: '' }]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > minQuestions) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const handleCreate = () => {
    if (!topic.trim()) return;

    const validQuestions = questions.filter((q) => q.question.trim() && q.answer.trim());

    if (validQuestions.length < minQuestions) {
      return;
    }

    setCreated(true);

    if (onQuestionsCreated) {
      onQuestionsCreated({
        topic: topic.trim(),
        questions: validQuestions,
      });
    }
  };

  const completedQuestions = questions.filter((q) => q.question.trim() && q.answer.trim()).length;

  return (
    <div className="mx-auto w-full max-w-2xl rounded-lg border border-purple-200 bg-purple-50 p-6 dark:border-purple-800 dark:bg-purple-900/20">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Active Recall Question Creator
      </h3>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Topic you're learning:
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., 'Blockchain fundamentals', 'Spanish grammar', 'React hooks'"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Create {minQuestions}+ questions (test understanding, not just memorization):
            </label>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {completedQuestions} / {minQuestions} minimum
            </span>
          </div>
          <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Tip: Use explanation, application, comparison, why, and design questions.
          </div>
        </div>

        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Question {idx + 1}:
                </span>
                {questions.length > minQuestions && (
                  <button
                    onClick={() => removeQuestion(idx)}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                )}
              </div>
              <textarea
                value={q.question}
                onChange={(e) => updateQuestion(idx, 'question', e.target.value)}
                placeholder="e.g., 'Explain how X works', 'How would you use X to solve Y?'"
                rows={2}
                className="mb-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <textarea
                value={q.answer}
                onChange={(e) => updateQuestion(idx, 'answer', e.target.value)}
                placeholder="Your answer (write without looking at notes)"
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          ))}
        </div>

        <button
          onClick={addQuestion}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          + Add Another Question
        </button>

        <button
          onClick={handleCreate}
          disabled={!topic.trim() || completedQuestions < minQuestions || created}
          className="w-full rounded-lg bg-purple-600 px-6 py-3 font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {created
            ? 'Questions Created'
            : `Create Question Set (${completedQuestions}/${minQuestions} completed)`}
        </button>

        {created && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
            <div className="mb-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              Your Active Recall Set:
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <div>
                <strong>Topic:</strong> {topic}
              </div>
              <div>
                <strong>Questions Created:</strong> {completedQuestions}
              </div>
            </div>
            <div className="mt-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              ✓ Questions created! Use these for spaced repetition review.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
