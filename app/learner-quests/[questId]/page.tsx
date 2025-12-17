/**
 * Language Assessment Quest Page
 *
 * MVP version for taking language assessment quests.
 * Displays questions by section, handles all question types, tracks progress, and shows results.
 *
 * Reference: docs/betadocs/arkiv/learner-quests.md
 */

'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { BetaGate } from '@/components/auth/BetaGate';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import type { LanguageAssessmentQuest, LanguageAssessmentQuestion, LanguageAssessmentSection } from '@/lib/arkiv/languageQuest';

type AssessmentProgress = Record<string, {
  answer: string | string[];
  timeSpent: number;
  submitted: boolean;
}>;

type AssessmentResult = {
  totalScore: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  sections: Array<{
    sectionId: string;
    questionsAnswered: number;
    questionsCorrect: number;
    pointsEarned: number;
    pointsPossible: number;
  }>;
};

export default function LanguageAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const questId = params.questId as string;
  
  const [wallet, setWallet] = useState<string | null>(null);
  const [quest, setQuest] = useState<LanguageAssessmentQuest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AssessmentProgress>({});
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const questionStartTimeRef = useRef<Record<string, number>>({});

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
    if (!questId) return;
    
    const loadQuest = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/learner-quests?questId=${questId}`);
        const data = await res.json();

        if (!data.ok || !data.quest) {
          setError(data.error || 'Quest not found');
          return;
        }

        // Parse language assessment payload
        if (data.quest.questType !== 'language_assessment' || !data.quest.payload) {
          setError('This is not a language assessment quest');
          return;
        }

        const assessmentQuest = data.quest.payload as LanguageAssessmentQuest;
        setQuest(assessmentQuest);
        setStartedAt(new Date().toISOString());
        setTimeRemaining(assessmentQuest.metadata.timeLimit);
      } catch (err: any) {
        console.error('Error loading quest:', err);
        setError('Failed to load assessment');
      } finally {
        setLoading(false);
      }
    };

    loadQuest();
  }, [questId]);

  // Timer countdown
  useEffect(() => {
    if (!timeRemaining || timeRemaining <= 0 || completed) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          // Time's up - auto-submit
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, completed]);

  // Track question start time
  useEffect(() => {
    if (!quest) return;
    const currentSection = quest.sections[currentSectionIndex];
    if (!currentSection) return;
    const currentQuestion = currentSection.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    const questionKey = `${currentSection.id}:${currentQuestion.id}`;
    if (!questionStartTimeRef.current[questionKey]) {
      questionStartTimeRef.current[questionKey] = Date.now();
    }
  }, [quest, currentSectionIndex, currentQuestionIndex]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentSection = (): LanguageAssessmentSection | null => {
    if (!quest) return null;
    return quest.sections[currentSectionIndex] || null;
  };

  const getCurrentQuestion = (): LanguageAssessmentQuestion | null => {
    const section = getCurrentSection();
    if (!section) return null;
    return section.questions[currentQuestionIndex] || null;
  };

  const getQuestionKey = (sectionId: string, questionId: string): string => {
    return `${sectionId}:${questionId}`;
  };

  const handleAnswerChange = (value: string | string[]) => {
    const section = getCurrentSection();
    const question = getCurrentQuestion();
    if (!section || !question) return;

    const key = getQuestionKey(section.id, question.id);
    setAnswers((prev) => ({
      ...prev,
      [key]: {
        answer: value,
        timeSpent: prev[key]?.timeSpent || 0,
        submitted: false,
      },
    }));
  };

  const handleSubmitAnswer = async () => {
    const section = getCurrentSection();
    const question = getCurrentQuestion();
    if (!section || !question || !wallet) return;

    const key = getQuestionKey(section.id, question.id);
    const answerData = answers[key];
    if (!answerData || answerData.submitted) return;

    const startTime = questionStartTimeRef.current[key] || Date.now();
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    setSubmitting(key);
    try {
      const res = await fetch('/api/learner-quests/assessment/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          questId,
          sectionId: section.id,
          questionId: question.id,
          answer: answerData.answer,
          timeSpent,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setAnswers((prev) => ({
          ...prev,
          [key]: {
            ...answerData,
            timeSpent,
            submitted: true,
          },
        }));
      } else {
        console.error('Failed to submit answer:', data.error);
      }
    } catch (err: any) {
      console.error('Error submitting answer:', err);
    } finally {
      setSubmitting(null);
    }
  };

  const handleNext = () => {
    if (!quest) return;
    const section = getCurrentSection();
    if (!section) return;

    // Submit current answer if not submitted
    const question = getCurrentQuestion();
    if (question) {
      const key = getQuestionKey(section.id, question.id);
      const answerData = answers[key];
      if (answerData && !answerData.submitted) {
        handleSubmitAnswer();
      }
    }

    // Move to next question or section
    if (currentQuestionIndex < section.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (currentSectionIndex < quest.sections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      setCurrentQuestionIndex(0);
    } else {
      // Last question - complete assessment
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!wallet || !startedAt || completed) return;

    setCompleted(true);
    try {
      const res = await fetch('/api/learner-quests/assessment/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          questId,
          startedAt,
        }),
      });

      const data = await res.json();
      if (data.ok && data.result?.result) {
        const assessmentResult = data.result.result;
        setResult({
          totalScore: assessmentResult.totalScore,
          totalPoints: assessmentResult.totalPoints,
          percentage: assessmentResult.percentage,
          passed: assessmentResult.passed,
          sections: assessmentResult.sections || [],
        });
      } else {
        setError(data.error || 'Failed to complete assessment');
      }
    } catch (err: any) {
      console.error('Error completing assessment:', err);
      setError('Failed to complete assessment');
    }
  };

  // Stable shuffle for matching questions (based on question ID to avoid re-shuffling)
  const getShuffledMatchingPairs = useMemo(() => {
    const cache = new Map<string, { left: string[]; right: string[] }>();
    return (question: LanguageAssessmentQuestion) => {
      if (!question.matchingPairs || question.matchingPairs.length === 0) {
        return { left: [], right: [] };
      }
      const cacheKey = question.id;
      if (!cache.has(cacheKey)) {
        // Create shuffled copies (stable per question ID)
        const leftItems = [...question.matchingPairs.map(p => p.left)].sort(() => Math.random() - 0.5);
        const rightItems = [...question.matchingPairs.map(p => p.right)].sort(() => Math.random() - 0.5);
        cache.set(cacheKey, { left: leftItems, right: rightItems });
      }
      return cache.get(cacheKey)!;
    };
  }, []);

  const renderQuestion = (question: LanguageAssessmentQuestion) => {
    const section = getCurrentSection();
    if (!section) return null;

    const key = getQuestionKey(section.id, question.id);
    const answerData = answers[key];
    const currentAnswer = answerData?.answer;

    switch (question.type) {
      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {question.options?.map((option) => (
              <label
                key={option.id}
                className="flex items-center gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
              >
                <input
                  type="radio"
                  name={key}
                  value={option.id}
                  checked={currentAnswer === option.id}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex-1 text-gray-900 dark:text-gray-100">{option.text}</span>
              </label>
            ))}
          </div>
        );

      case 'true_false':
        return (
          <div className="space-y-3">
            {['true', 'false'].map((value) => (
              <label
                key={value}
                className="flex items-center gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
              >
                <input
                  type="radio"
                  name={key}
                  value={value}
                  checked={currentAnswer === value}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex-1 text-gray-900 dark:text-gray-100 capitalize">{value}</span>
              </label>
            ))}
          </div>
        );

      case 'fill_blank':
        // Display full sentence with user's answer inserted
        const displaySentence = question.question.replace('____', typeof currentAnswer === 'string' && currentAnswer ? currentAnswer : '____');
        return (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-gray-200 dark:border-gray-700">
              <p className="text-lg text-gray-900 dark:text-gray-100 font-medium mb-2">Complete:</p>
              <p className="text-base text-gray-800 dark:text-gray-200">{displaySentence}</p>
            </div>
            {question.wordBank && question.wordBank.length > 0 && (
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Word Bank:</p>
                <div className="flex flex-wrap gap-2">
                  {question.wordBank.map((word, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAnswerChange(word)}
                      className="px-3 py-1 bg-white dark:bg-gray-700 rounded text-sm text-gray-900 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <input
              type="text"
              value={typeof currentAnswer === 'string' ? currentAnswer : ''}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Enter your answer"
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        );

      case 'matching':
        const matchingAnswer = Array.isArray(currentAnswer) ? currentAnswer : [];
        // Get stable shuffled pairs (cached per question ID)
        const { left: shuffledLeft, right: shuffledRight } = getShuffledMatchingPairs(question);
        
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Match the items on the left with the items on the right by clicking:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Left:</p>
                {shuffledLeft.map((left, idx) => {
                  // Find the correct right match for this left item
                  const correctPair = question.matchingPairs?.find(p => p.left === left);
                  const pairKey = correctPair ? `${correctPair.left}-${correctPair.right}` : '';
                  const isMatched = pairKey && matchingAnswer.includes(pairKey);
                  return (
                    <div
                      key={idx}
                      className={`p-3 border-2 rounded-lg ${
                        isMatched
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'
                      }`}
                    >
                      <span className="text-gray-900 dark:text-gray-100">{left}</span>
                      {isMatched && correctPair && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400">→ {correctPair.right}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Right:</p>
                {shuffledRight.map((right, idx) => {
                  // Check if this right item is already matched
                  const matchedPair = question.matchingPairs?.find(p => p.right === right);
                  const pairKey = matchedPair ? `${matchedPair.left}-${matchedPair.right}` : '';
                  const isMatched = pairKey && matchingAnswer.includes(pairKey);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (matchedPair) {
                          const newPairKey = `${matchedPair.left}-${matchedPair.right}`;
                          if (isMatched) {
                            // Remove if already matched
                            handleAnswerChange(matchingAnswer.filter(a => a !== newPairKey));
                          } else {
                            // Add to matches
                            handleAnswerChange([...matchingAnswer, newPairKey]);
                          }
                        }
                      }}
                      className={`w-full p-3 text-left border-2 rounded-lg transition-colors ${
                        isMatched
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:border-blue-400 dark:hover:border-blue-500'
                      }`}
                    >
                      {right}
                    </button>
                  );
                })}
              </div>
            </div>
            {matchingAnswer.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Your matches ({matchingAnswer.length}):</p>
                <div className="space-y-1">
                  {matchingAnswer.map((match, idx) => {
                    const [left, right] = match.split('-');
                    return (
                      <div key={idx} className="text-sm text-blue-800 dark:text-blue-200">
                        {left} → {right}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 'sentence_order':
        const orderAnswer = Array.isArray(currentAnswer) ? currentAnswer : [];
        if (!question.sentences || question.sentences.length === 0) {
          return <p className="text-gray-600 dark:text-gray-400">No sentences provided</p>;
        }
        return (
          <div className="space-y-3">
            {question.sentences.map((sentence, idx) => {
              const currentIndex = orderAnswer.indexOf(sentence);
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <select
                    value={currentIndex >= 0 ? currentIndex + 1 : ''}
                    onChange={(e) => {
                      const position = parseInt(e.target.value) - 1;
                      const newAnswer = [...orderAnswer];
                      // Remove from old position
                      const oldIndex = newAnswer.indexOf(sentence);
                      if (oldIndex >= 0) newAnswer.splice(oldIndex, 1);
                      // Insert at new position
                      newAnswer.splice(position, 0, sentence);
                      handleAnswerChange(newAnswer);
                    }}
                    className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">-</option>
                    {question.sentences?.map((_, i) => (
                      <option key={i} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                  <span className="flex-1 text-gray-900 dark:text-gray-100">{sentence}</span>
                </div>
              );
            })}
          </div>
        );

      default:
        return <p className="text-gray-600 dark:text-gray-400">Unsupported question type</p>;
    }
  };

  if (loading) {
    return (
      <BetaGate>
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
          <div className="max-w-4xl mx-auto">
            <BackButton href="/learner-quests" />
            <LoadingSpinner text="Loading assessment..." className="py-12" />
          </div>
        </div>
      </BetaGate>
    );
  }

  if (error) {
    return (
      <BetaGate>
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
          <div className="max-w-4xl mx-auto">
            <BackButton href="/learner-quests" />
            <EmptyState title="Error" description={error} />
          </div>
        </div>
      </BetaGate>
    );
  }

  if (!quest) {
    return (
      <BetaGate>
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
          <div className="max-w-4xl mx-auto">
            <BackButton href="/learner-quests" />
            <EmptyState title="Assessment not found" description="The assessment you're looking for doesn't exist." />
          </div>
        </div>
      </BetaGate>
    );
  }

  // Show results if completed
  if (completed && result) {
    const section = getCurrentSection();
    const question = getCurrentQuestion();
    const totalQuestions = quest.sections.reduce((sum, s) => sum + s.questions.length, 0);
    const answeredQuestions = Object.keys(answers).length;

    return (
      <BetaGate>
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
          <div className="max-w-4xl mx-auto">
            <BackButton href="/learner-quests" />

            <div className="mb-8">
              <h1 className="text-3xl font-semibold mb-2">{quest.metadata.certificationName}</h1>
              <p className="text-gray-600 dark:text-gray-400">
                {quest.language.toUpperCase()} {quest.proficiencyLevel} Assessment
              </p>
            </div>

            <div className={`p-6 rounded-lg border-2 mb-6 ${
              result.passed
                ? 'border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                : 'border-orange-500 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20'
            }`}>
              <div className="text-center">
                <div className="text-4xl mb-4">{result.passed ? '✓' : '✗'}</div>
                <h2 className="text-2xl font-semibold mb-2">
                  {result.passed ? 'Assessment Passed!' : 'Assessment Not Passed'}
                </h2>
                <p className="text-lg mb-4">
                  Score: {result.totalScore} / {result.totalPoints} ({result.percentage}%)
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Passing Score: {quest.metadata.passingScore} / {result.totalPoints} ({Math.round((quest.metadata.passingScore / result.totalPoints) * 100)}%)
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <h3 className="text-xl font-semibold">Section Results</h3>
              {result.sections.map((sectionResult) => {
                const section = quest.sections.find((s) => s.id === sectionResult.sectionId);
                return (
                  <div key={sectionResult.sectionId} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{section?.title || sectionResult.sectionId}</h4>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {sectionResult.pointsEarned} / {sectionResult.pointsPossible} points
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {sectionResult.questionsCorrect} / {sectionResult.questionsAnswered} questions correct
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => router.push('/learner-quests')}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Back to Quests
              </button>
            </div>
          </div>
        </div>
      </BetaGate>
    );
  }

  // Show assessment interface
  const section = getCurrentSection();
  const question = getCurrentQuestion();
  if (!section || !question) return null;

  const totalQuestions = quest.sections.reduce((sum, s) => sum + s.questions.length, 0);
  const currentQuestionNumber = quest.sections
    .slice(0, currentSectionIndex)
    .reduce((sum, s) => sum + s.questions.length, 0) + currentQuestionIndex + 1;
  const questionKey = getQuestionKey(section.id, question.id);
  const answerData = answers[questionKey];
  const hasAnswer = answerData && (Array.isArray(answerData.answer) ? answerData.answer.length > 0 : answerData.answer !== '');

  return (
    <BetaGate>
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <BackButton href="/learner-quests" />

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-2">{quest.metadata.certificationName}</h1>
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>
                Question {currentQuestionNumber} of {totalQuestions}
              </span>
              {timeRemaining !== null && (
                <span className={`font-medium ${timeRemaining < 300 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  ⏰ {formatTime(timeRemaining)}
                </span>
              )}
            </div>
          </div>

          {/* Section Info */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h2 className="font-semibold mb-1">{section.title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{section.description}</p>
          </div>

          {/* Question */}
          <div className="mb-6 p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium mb-4">{question.question}</h3>
            {renderQuestion(question)}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (currentQuestionIndex > 0) {
                  setCurrentQuestionIndex(currentQuestionIndex - 1);
                } else if (currentSectionIndex > 0) {
                  setCurrentSectionIndex(currentSectionIndex - 1);
                  const prevSection = quest.sections[currentSectionIndex - 1];
                  setCurrentQuestionIndex(prevSection.questions.length - 1);
                }
              }}
              disabled={currentSectionIndex === 0 && currentQuestionIndex === 0}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Previous
            </button>

            <div className="flex gap-3">
              {!answerData?.submitted && hasAnswer && (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={submitting === questionKey || !hasAnswer}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting === questionKey ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    'Submit Answer'
                  )}
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!hasAnswer && !answerData?.submitted}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentQuestionNumber === totalQuestions ? 'Complete Assessment' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </BetaGate>
  );
}

