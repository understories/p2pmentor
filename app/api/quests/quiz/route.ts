/**
 * Quiz Submission API
 *
 * Handles quiz submission, scoring, and result storage.
 * Creates both quest_step_progress and learner_quest_assessment_result entities.
 *
 * Week 2 (Feb 8-14) - Quiz engine v1
 *
 * POST /api/quests/quiz
 * Body: { wallet, questId, stepId, rubricVersion, questionIds, answers }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrivateKey, SPACE_ID } from '@/lib/config';
import { createQuestStepProgress } from '@/lib/arkiv/questProgress';
import { createStepEvidence } from '@/lib/arkiv/questStep';
import { createQuizResult } from '@/lib/arkiv/quizResult';
import { isTransactionTimeoutError } from '@/lib/arkiv/transaction-utils';

/**
 * POST - Submit quiz answers and record results
 */
export async function POST(request: NextRequest) {
  // Verify beta access
  const { verifyBetaAccess } = await import('@/lib/auth/betaAccess');
  const betaCheck = await verifyBetaAccess(request, {
    requireArkivValidation: false,
  });

  if (!betaCheck.hasAccess) {
    return NextResponse.json(
      { ok: false, error: betaCheck.error || 'Beta access required' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      wallet,
      questId,
      stepId,
      rubricVersion,
      questionIds,
      answers,
      rubric, // Full rubric with questions for scoring
      passingScore,
    } = body;

    // Validate required fields
    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'wallet is required' },
        { status: 400 }
      );
    }
    if (!questId || !stepId) {
      return NextResponse.json(
        { ok: false, error: 'questId and stepId are required' },
        { status: 400 }
      );
    }
    if (!rubricVersion || !questionIds || !answers) {
      return NextResponse.json(
        { ok: false, error: 'rubricVersion, questionIds, and answers are required' },
        { status: 400 }
      );
    }
    if (!rubric || !rubric.questions) {
      return NextResponse.json(
        { ok: false, error: 'rubric with questions is required for scoring' },
        { status: 400 }
      );
    }

    const privateKey = getPrivateKey();

    // Score the quiz
    let score = 0;
    let maxScore = 0;

    for (const questionId of questionIds) {
      const question = rubric.questions.find((q: any) => q.id === questionId);
      if (!question) {
        console.warn(`[Quiz API] Question ${questionId} not found in rubric`);
        continue;
      }

      maxScore += question.points;
      const userAnswer = answers[questionId];
      const correctAnswer = question.correctAnswer;

      // Score based on question type
      let isCorrect = false;
      if (question.type === 'multiple_choice' || question.type === 'true_false') {
        isCorrect = String(userAnswer) === String(correctAnswer);
      } else if (question.type === 'fill_blank') {
        // Case-insensitive comparison for fill-in-the-blank
        isCorrect = String(userAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
      } else if (question.type === 'matching') {
        // For matching, compare arrays (order matters)
        if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
          isCorrect = JSON.stringify(userAnswer.sort()) === JSON.stringify(correctAnswer.sort());
        }
      }

      if (isCorrect) {
        score += question.points;
      }
    }

    const finalPassingScore = passingScore || rubric.passingScore || 0.7;

    // Create quest step progress with quiz evidence
    try {
      const progressEvidence = createStepEvidence('QUIZ', stepId, {
        score,
        maxScore,
        rubricVersion,
        questionIds,
      });

      const progressResult = await createQuestStepProgress({
        wallet,
        questId,
        stepId,
        stepType: 'QUIZ',
        evidence: progressEvidence,
        privateKey,
        spaceId: SPACE_ID,
      });

      // Create detailed quiz result entity
      try {
        const quizResult = await createQuizResult({
          wallet,
          questId,
          stepId,
          rubricVersion,
          questionIds,
          answers,
          score,
          maxScore,
          passingScore: finalPassingScore,
          progressEntityKey: progressResult.key,
          privateKey,
          spaceId: SPACE_ID,
        });

        return NextResponse.json({
          ok: true,
          progress: {
            key: progressResult.key,
            txHash: progressResult.txHash,
          },
          quizResult: {
            key: quizResult.key,
            txHash: quizResult.txHash,
          },
          score,
          maxScore,
          percentage: maxScore > 0 ? score / maxScore : 0,
          passed: maxScore > 0 ? score / maxScore >= finalPassingScore : false,
        });
      } catch (quizError: any) {
        // If quiz result creation fails, still return progress (graceful degradation)
        console.error('[Quiz API] Quiz result creation failed:', quizError);
        if (isTransactionTimeoutError(quizError)) {
          return NextResponse.json({
            ok: true,
            progress: {
              key: progressResult.key,
              txHash: progressResult.txHash,
            },
            quizResult: {
              key: null,
              txHash: null,
            },
            pending: true,
            message: quizError.message || 'Quiz result submission pending',
            score,
            maxScore,
            percentage: maxScore > 0 ? score / maxScore : 0,
            passed: maxScore > 0 ? score / maxScore >= finalPassingScore : false,
          });
        }
        // Re-throw to be caught by outer catch
        throw quizError;
      }
    } catch (progressError: any) {
      // Handle transaction timeout gracefully
      if (isTransactionTimeoutError(progressError)) {
        return NextResponse.json({
          ok: true,
          progress: {
            key: null,
            txHash: null,
          },
          quizResult: {
            key: null,
            txHash: null,
          },
          pending: true,
          message: progressError.message || 'Quiz submission pending',
          score,
          maxScore,
          percentage: maxScore > 0 ? score / maxScore : 0,
          passed: maxScore > 0 ? score / maxScore >= finalPassingScore : false,
        });
      }
      throw progressError;
    }
  } catch (error: any) {
    console.error('[/api/quests/quiz] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to submit quiz' },
      { status: 500 }
    );
  }
}
