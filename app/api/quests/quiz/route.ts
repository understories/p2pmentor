/**
 * Quiz Submission API
 *
 * Handles quiz submission, scoring, and result storage.
 * Creates both quest_step_progress and learner_quest_assessment_result entities.
 *
 * Rubric is loaded server-side from the quest definition to prevent
 * clients from submitting a tampered rubric with altered correct answers.
 *
 * POST /api/quests/quiz
 * Body: { wallet, questId, stepId, rubricVersion, questionIds, answers }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrivateKey, SPACE_ID, QUEST_ENTITY_MODE } from '@/lib/config';
import { createQuestStepProgress } from '@/lib/arkiv/questProgress';
import { createStepEvidence } from '@/lib/arkiv/questStep';
import { createQuizResult } from '@/lib/arkiv/quizResult';
import { isTransactionTimeoutError } from '@/lib/arkiv/transaction-utils';
import { loadQuestDefinitionByQuestId } from '@/lib/quests';
import { getLatestQuestDefinition } from '@/lib/arkiv/questDefinition';
import type { QuestDefinition, QuizRubric } from '@/lib/quests/questFormat';

// ---------------------------------------------------------------------------
// Anti-gaming: server-side rate limiting & submission cooldown
// ---------------------------------------------------------------------------

const QUIZ_IP_LIMIT = 10; // max submissions per IP per window
const QUIZ_IP_WINDOW_MS = 60_000; // 1 minute
const QUIZ_COOLDOWN_MS = 30_000; // 30 s between attempts on the same wallet+step

interface RateEntry {
  count: number;
  resetAt: number;
}

const ipRateStore = new Map<string, RateEntry>();
const cooldownStore = new Map<string, number>(); // key → earliest-allowed timestamp

function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;
  return 'unknown';
}

function checkQuizRateLimit(request: Request): { allowed: boolean; retryAfterMs: number } {
  const ip = getClientIP(request);
  const now = Date.now();

  let entry = ipRateStore.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + QUIZ_IP_WINDOW_MS };
    ipRateStore.set(ip, entry);
  }
  entry.count += 1;

  if (entry.count > QUIZ_IP_LIMIT) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  // Probabilistic cleanup (same pattern as explorer rate limiter)
  if (Math.random() < 0.02) {
    for (const [key, val] of ipRateStore.entries()) {
      if (now > val.resetAt + QUIZ_IP_WINDOW_MS) ipRateStore.delete(key);
    }
    for (const [key, ts] of cooldownStore.entries()) {
      if (now > ts + QUIZ_COOLDOWN_MS) cooldownStore.delete(key);
    }
  }

  return { allowed: true, retryAfterMs: 0 };
}

function checkSubmissionCooldown(
  wallet: string,
  stepId: string
): { allowed: boolean; retryAfterMs: number } {
  const key = `${wallet.toLowerCase()}:${stepId}`;
  const now = Date.now();
  const earliest = cooldownStore.get(key) ?? 0;

  if (now < earliest) {
    return { allowed: false, retryAfterMs: earliest - now };
  }

  cooldownStore.set(key, now + QUIZ_COOLDOWN_MS);
  return { allowed: true, retryAfterMs: 0 };
}

// ---------------------------------------------------------------------------

/**
 * Resolve the authoritative quest definition server-side.
 * Tries entity store first (when configured), falls back to filesystem.
 */
async function resolveQuestDefinition(questId: string): Promise<QuestDefinition | null> {
  if (QUEST_ENTITY_MODE === 'entity' || QUEST_ENTITY_MODE === 'dual') {
    try {
      const entity = await getLatestQuestDefinition({ questId });
      if (entity?.quest) return entity.quest;
    } catch (err) {
      console.warn('[Quiz API] Entity lookup failed, falling back to file:', err);
    }
    if (QUEST_ENTITY_MODE === 'entity') return null;
  }
  return loadQuestDefinitionByQuestId(questId);
}

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
    const { wallet, questId, stepId, rubricVersion, questionIds, answers } = body;

    // Validate required fields
    if (!wallet) {
      return NextResponse.json({ ok: false, error: 'wallet is required' }, { status: 400 });
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

    // Anti-gaming: IP rate limit
    const rateCheck = checkQuizRateLimit(request);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Too many quiz submissions. Please wait before trying again.',
          retryAfterMs: rateCheck.retryAfterMs,
        },
        { status: 429 }
      );
    }

    // Anti-gaming: per-wallet+step cooldown
    const cooldownCheck = checkSubmissionCooldown(wallet, stepId);
    if (!cooldownCheck.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Please wait ${Math.ceil(cooldownCheck.retryAfterMs / 1000)}s before retrying this quiz.`,
          retryAfterMs: cooldownCheck.retryAfterMs,
        },
        { status: 429 }
      );
    }

    // Load rubric server-side from the authoritative quest definition
    const questDef = await resolveQuestDefinition(questId);
    if (!questDef) {
      return NextResponse.json(
        { ok: false, error: `Quest not found: ${questId}` },
        { status: 404 }
      );
    }

    const step = questDef.steps.find((s) => s.stepId === stepId);
    if (!step || step.type !== 'QUIZ' || !step.quizRubricId) {
      return NextResponse.json(
        { ok: false, error: `Quiz step not found: ${stepId}` },
        { status: 404 }
      );
    }

    const rubric: QuizRubric | undefined = questDef.rubrics?.[step.quizRubricId];
    if (!rubric || !rubric.questions) {
      return NextResponse.json(
        { ok: false, error: `Rubric not found for step: ${stepId}` },
        { status: 404 }
      );
    }

    // Validate that all rubric questions are submitted (prevents cherry-picking easy questions)
    const rubricQuestionIds = new Set(rubric.questions.map((q) => q.id));
    const submittedIds = new Set<string>(questionIds);
    const missing = [...rubricQuestionIds].filter((id) => !submittedIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { ok: false, error: 'All quiz questions must be answered' },
        { status: 400 }
      );
    }

    const privateKey = getPrivateKey();

    // Score the quiz against the server-loaded rubric
    let score = 0;
    let maxScore = 0;

    for (const questionId of questionIds) {
      const question = rubric.questions.find((q) => q.id === questionId);
      if (!question) {
        console.warn(`[Quiz API] Question ${questionId} not found in rubric`);
        continue;
      }

      maxScore += question.points;
      const userAnswer = answers[questionId];
      const correctAnswer = question.correctAnswer;

      let isCorrect = false;
      if (question.type === 'multiple_choice' || question.type === 'true_false') {
        isCorrect = String(userAnswer) === String(correctAnswer);
      } else if (question.type === 'fill_blank') {
        isCorrect =
          String(userAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
      } else if (question.type === 'matching') {
        if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
          isCorrect = JSON.stringify(userAnswer.sort()) === JSON.stringify(correctAnswer.sort());
        }
      }

      if (isCorrect) {
        score += question.points;
      }
    }

    const finalPassingScore = rubric.passingScore || 0.7;

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
