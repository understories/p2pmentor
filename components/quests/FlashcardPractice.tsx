/**
 * Flashcard Practice Component
 *
 * Interactive flashcard component for vocabulary practice.
 * Supports Chinese characters, pinyin, and English translations.
 * Used in language learning quest steps.
 *
 * Reference: refs/docs/jan26plan.md - Week 2 Mandarin Track
 */

'use client';

import { useState, useEffect, useRef } from 'react';

export interface VocabItem {
  // Chinese format
  chinese?: string;  // Chinese characters
  pinyin?: string;   // Pinyin pronunciation
  // Spanish format
  spanish?: string;  // Spanish word
  // Common
  english: string;  // English translation
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
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-6 text-center">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Reviewed: {reviewed.size} / {minCards} minimum
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min((reviewed.size / minCards) * 100, 100)}%` }}
          />
        </div>
        {completed && (
          <div className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
            ✓ Practice complete! You can continue reviewing or mark this step as done.
          </div>
        )}
      </div>

      {/* Flashcard */}
      <div className="relative">
        <div
          className="mb-6"
          style={{ perspective: '1000px' }}
        >
          <div
            className={`relative w-full h-64 cursor-pointer transition-transform duration-500 ${
              completed ? 'opacity-75' : ''
            }`}
            onClick={handleFlip}
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front of card */}
            <div
              className="absolute inset-0 w-full h-full rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center p-8"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(0deg)',
              }}
            >
              <div className="text-center">
                <div className="text-6xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  {current.chinese}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Click or press Space to flip
                </div>
              </div>
            </div>

            {/* Back of card */}
            <div
              className="absolute inset-0 w-full h-full rounded-lg border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 flex flex-col items-center justify-center p-8"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <div className="text-center space-y-4">
                <div className="text-6xl font-semibold text-gray-900 dark:text-gray-100">
                  {current.chinese}
                </div>
                <div className="text-2xl text-blue-600 dark:text-blue-400 font-medium">
                  {current.pinyin}
                </div>
                <div className="text-xl text-gray-700 dark:text-gray-300">
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
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <button
            onClick={handleFlip}
            disabled={completed}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFlipped ? (current.chinese ? 'Show Chinese' : 'Show Spanish') : 'Show Answer'}
          </button>
          <button
            onClick={handleNext}
            disabled={completed}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
          <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">Space</kbd> to flip •{' '}
          <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">←</kbd> <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">→</kbd> to navigate
        </div>
      </div>

      {/* Vocabulary List (Collapsible) */}
      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
          View all vocabulary ({vocabulary.length} words)
        </summary>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {vocabulary.map((item, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border ${
                reviewed.has(idx)
                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {item.chinese || item.spanish}
                  </div>
                  {item.pinyin && (
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      {item.pinyin}
                    </div>
                  )}
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {item.english}
                  </div>
                </div>
                {reviewed.has(idx) && (
                  <span className="text-emerald-600 dark:text-emerald-400 text-sm">✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
