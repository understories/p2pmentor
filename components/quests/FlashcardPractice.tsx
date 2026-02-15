/**
 * Flashcard Practice Component
 *
 * Interactive flashcard component for vocabulary practice.
 * Supports Chinese characters with pinyin, Spanish, and English translations.
 * Used in language learning quest steps.
 *
 * Reference: refs/docs/jan26plan.md - Week 2 Mandarin/Spanish Tracks
 */

'use client';

import { useState, useEffect, useRef } from 'react';

export interface VocabItem {
  // Chinese format
  chinese?: string; // Chinese characters
  pinyin?: string; // Pinyin pronunciation
  // Spanish format
  spanish?: string; // Spanish word
  // Common
  english: string; // English translation
}

export interface FlashcardPracticeProps {
  vocabulary: VocabItem[];
  minCards: number; // Minimum cards to review before completion
  onComplete: (stats: { reviewed: number; duration: number }) => void;
  stepId: string;
}

export function FlashcardPractice({
  vocabulary,
  minCards,
  onComplete,
  stepId,
}: FlashcardPracticeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(new Set<number>());
  const [startTime] = useState(Date.now());
  const [completed, setCompleted] = useState(false);

  const current = vocabulary[currentIndex];

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    const newReviewed = new Set(reviewed);
    newReviewed.add(currentIndex);
    setReviewed(newReviewed);
    setIsFlipped(false);

    // Check if minimum cards reviewed
    if (newReviewed.size >= minCards && !completed) {
      setCompleted(true);
      onComplete({
        reviewed: newReviewed.size,
        duration: Math.round((Date.now() - startTime) / 1000),
      });
    }

    // Move to next card
    setCurrentIndex((currentIndex + 1) % vocabulary.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((currentIndex - 1 + vocabulary.length) % vocabulary.length);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (completed) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleFlip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFlipped, reviewed, completed]);

  if (vocabulary.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        No vocabulary items available.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Progress Indicator */}
      <div className="mb-6 text-center">
        <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          Reviewed: {reviewed.size} / {minCards} minimum
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${Math.min((reviewed.size / minCards) * 100, 100)}%` }}
          />
        </div>
        {completed && (
          <div className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            ✓ Practice complete! You can continue reviewing or mark this step as done.
          </div>
        )}
      </div>

      {/* Flashcard */}
      <div className="relative">
        <div className="mb-6" style={{ perspective: '1000px' }}>
          <div
            className={`relative h-48 w-full cursor-pointer transition-transform duration-500 md:h-64 ${
              completed ? 'opacity-75' : ''
            }`}
            onClick={handleFlip}
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front of card - shows target language word */}
            <div
              className="absolute inset-0 flex h-full w-full items-center justify-center rounded-lg border-2 border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/20 md:p-8"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(0deg)',
              }}
            >
              <div className="text-center">
                <div className="mb-4 text-4xl font-semibold text-gray-900 dark:text-gray-100 md:text-6xl">
                  {current.chinese || current.spanish}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Click or press Space to flip
                </div>
              </div>
            </div>

            {/* Back of card - shows full details */}
            <div
              className="absolute inset-0 flex h-full w-full flex-col items-center justify-center rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-900/20 md:p-8"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <div className="space-y-3 text-center md:space-y-4">
                <div className="text-4xl font-semibold text-gray-900 dark:text-gray-100 md:text-6xl">
                  {current.chinese || current.spanish}
                </div>
                {current.pinyin && (
                  <div className="text-xl font-medium text-blue-600 dark:text-blue-400 md:text-2xl">
                    {current.pinyin}
                  </div>
                )}
                <div className="text-lg text-gray-700 dark:text-gray-300 md:text-xl">
                  {current.english}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handlePrev}
            disabled={completed}
            className="rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            ← Previous
          </button>
          <button
            onClick={handleFlip}
            disabled={completed}
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isFlipped ? (current.chinese ? 'Show Chinese' : 'Show Spanish') : 'Show Answer'}
          </button>
          <button
            onClick={handleNext}
            disabled={completed}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next →
          </button>
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
          <kbd className="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">Space</kbd> to flip •{' '}
          <kbd className="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">←</kbd>{' '}
          <kbd className="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">→</kbd> to navigate
        </div>
      </div>

      {/* Vocabulary List (Collapsible) */}
      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100">
          View all vocabulary ({vocabulary.length} words)
        </summary>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {vocabulary.map((item, idx) => (
            <div
              key={idx}
              className={`rounded-lg border p-3 ${
                reviewed.has(idx)
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20'
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {item.chinese || item.spanish}
                  </div>
                  {item.pinyin && (
                    <div className="text-sm text-blue-600 dark:text-blue-400">{item.pinyin}</div>
                  )}
                  <div className="text-sm text-gray-600 dark:text-gray-400">{item.english}</div>
                </div>
                {reviewed.has(idx) && (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
