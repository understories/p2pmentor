import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { QuestDefinition } from '@/lib/quests/questFormat';

// ---------------------------------------------------------------------------
// Hoisted mocks (available inside vi.mock factories)
// ---------------------------------------------------------------------------
const {
  mockVerifyBetaAccess,
  mockLoadQuestByQuestId,
  mockGetLatestQuestDef,
  mockCreateProgress,
  mockCreateStepEvidence,
  mockCreateQuizResult,
  mockCheckQuizTimeGate,
  mockComputeMinSeconds,
  mockClearQuizStart,
} = vi.hoisted(() => ({
  mockVerifyBetaAccess: vi.fn(),
  mockLoadQuestByQuestId: vi.fn(),
  mockGetLatestQuestDef: vi.fn(),
  mockCreateProgress: vi.fn(),
  mockCreateStepEvidence: vi.fn(),
  mockCreateQuizResult: vi.fn(),
  mockCheckQuizTimeGate: vi.fn(),
  mockComputeMinSeconds: vi.fn(),
  mockClearQuizStart: vi.fn(),
}));

vi.mock('@/lib/auth/betaAccess', () => ({
  verifyBetaAccess: mockVerifyBetaAccess,
}));

vi.mock('@/lib/config', () => ({
  getPrivateKey: () => '0xdeadbeef' as `0x${string}`,
  SPACE_ID: 'test-space',
  QUEST_ENTITY_MODE: 'file',
}));

vi.mock('@/lib/quests', () => ({
  loadQuestDefinitionByQuestId: mockLoadQuestByQuestId,
}));

vi.mock('@/lib/arkiv/questDefinition', () => ({
  getLatestQuestDefinition: mockGetLatestQuestDef,
}));

vi.mock('@/lib/arkiv/questProgress', () => ({
  createQuestStepProgress: mockCreateProgress,
}));

vi.mock('@/lib/arkiv/questStep', () => ({
  createStepEvidence: mockCreateStepEvidence,
}));

vi.mock('@/lib/arkiv/quizResult', () => ({
  createQuizResult: mockCreateQuizResult,
}));

vi.mock('@/lib/arkiv/transaction-utils', () => ({
  isTransactionTimeoutError: () => false,
}));

vi.mock('@/lib/quests/quizTimegate', () => ({
  checkQuizTimeGate: mockCheckQuizTimeGate,
  computeMinSeconds: mockComputeMinSeconds,
  clearQuizStart: mockClearQuizStart,
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_QUEST: QuestDefinition = {
  questId: 'test_quest',
  version: '1',
  track: 'demo',
  title: 'Test Quest',
  description: 'A quest for testing',
  estimatedDuration: '10 minutes',
  difficulty: 'beginner',
  steps: [
    {
      stepId: 'quiz-step',
      type: 'QUIZ',
      title: 'Test Quiz',
      description: 'A quiz',
      order: 1,
      required: true,
      quizRubricId: 'test_rubric_v1',
    },
    {
      stepId: 'read-step',
      type: 'READ',
      title: 'A Read Step',
      description: 'Not a quiz',
      order: 2,
      required: false,
    },
  ],
  rubrics: {
    test_rubric_v1: {
      version: '1',
      passingScore: 0.7,
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'What is 1+1?',
          options: ['1', '2', '3', '4'],
          correctAnswer: '2',
          points: 1,
        },
        {
          id: 'q2',
          type: 'true_false',
          question: 'The sky is blue',
          correctAnswer: 'true',
          points: 1,
        },
        {
          id: 'q3',
          type: 'fill_blank',
          question: 'Capital of France',
          correctAnswer: 'Paris',
          points: 1,
        },
      ],
    },
  },
};

let ipCounter = 0;
let walletCounter = 0;

function uniqueIP(): string {
  return `10.0.0.${++ipCounter}`;
}

function uniqueWallet(): string {
  return `0xwallet${++walletCounter}`;
}

function makeRequest(body: Record<string, unknown>, ip?: string): NextRequest {
  const req = new NextRequest('http://localhost:3000/api/quests/quiz', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ip ? { 'x-forwarded-for': ip } : {}),
    },
    body: JSON.stringify(body),
  });
  return req;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    wallet: uniqueWallet(),
    questId: 'test_quest',
    stepId: 'quiz-step',
    rubricVersion: '1',
    questionIds: ['q1', 'q2', 'q3'],
    answers: { q1: '2', q2: 'true', q3: 'Paris' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let POST: (req: NextRequest) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import('@/app/api/quests/quiz/route');
  POST = mod.POST;

  mockVerifyBetaAccess.mockResolvedValue({ hasAccess: true });
  mockLoadQuestByQuestId.mockResolvedValue(TEST_QUEST);
  mockGetLatestQuestDef.mockResolvedValue(null);
  mockCreateProgress.mockResolvedValue({ key: 'pk', txHash: '0x1' });
  mockCreateStepEvidence.mockReturnValue({ type: 'quiz_result' });
  mockCreateQuizResult.mockResolvedValue({ key: 'qk', txHash: '0x2' });
  mockCheckQuizTimeGate.mockReturnValue({ allowed: true, elapsedSeconds: 60, requiredSeconds: 30 });
  mockComputeMinSeconds.mockReturnValue(30);
  mockClearQuizStart.mockReturnValue(undefined);
});

// ---- Fix 1: Server-side rubric -------------------------------------------

describe('server-side rubric loading', () => {
  it('scores against the server-loaded rubric, not a client-provided one', async () => {
    const ip = uniqueIP();
    const body = validBody({
      answers: { q1: '2', q2: 'true', q3: 'Paris' },
    });

    const res = await POST(makeRequest(body, ip));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.score).toBe(3);
    expect(data.maxScore).toBe(3);
    expect(data.passed).toBe(true);
  });

  it('ignores a rubric supplied in the request body', async () => {
    const ip = uniqueIP();
    const body = validBody({
      answers: { q1: 'WRONG', q2: 'false', q3: 'London' },
      rubric: {
        version: '1',
        passingScore: 0.0,
        questions: [
          { id: 'q1', type: 'multiple_choice', correctAnswer: 'WRONG', points: 1 },
          { id: 'q2', type: 'true_false', correctAnswer: 'false', points: 1 },
          { id: 'q3', type: 'fill_blank', correctAnswer: 'London', points: 1 },
        ],
      },
    });

    const res = await POST(makeRequest(body, ip));
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.score).toBe(0);
    expect(data.passed).toBe(false);
  });

  it('returns 404 when quest definition is not found', async () => {
    mockLoadQuestByQuestId.mockResolvedValue(null);
    const ip = uniqueIP();

    const res = await POST(makeRequest(validBody(), ip));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/Quest not found/);
  });

  it('returns 404 when stepId is not a QUIZ step', async () => {
    const ip = uniqueIP();
    const body = validBody({ stepId: 'read-step' });

    const res = await POST(makeRequest(body, ip));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/Quiz step not found/);
  });

  it('uses passingScore from server rubric, ignoring client value', async () => {
    const ip = uniqueIP();
    const body = validBody({
      answers: { q1: '2', q2: 'false', q3: 'London' },
      passingScore: 0.01,
    });

    const res = await POST(makeRequest(body, ip));
    const data = await res.json();

    expect(data.score).toBe(1);
    expect(data.maxScore).toBe(3);
    expect(data.passed).toBe(false);
  });
});

// ---- Fix 2: Anti-gaming --------------------------------------------------

describe('anti-gaming: question completeness', () => {
  it('rejects submission that omits rubric questions', async () => {
    const ip = uniqueIP();
    const body = validBody({
      questionIds: ['q1'],
      answers: { q1: '2' },
    });

    const res = await POST(makeRequest(body, ip));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/All quiz questions must be answered/);
  });

  it('accepts submission with all rubric questions present', async () => {
    const ip = uniqueIP();
    const res = await POST(makeRequest(validBody(), ip));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });
});

describe('anti-gaming: IP rate limit', () => {
  it('blocks after 10 submissions from the same IP', async () => {
    const ip = uniqueIP();

    for (let i = 0; i < 10; i++) {
      const body = validBody();
      const res = await POST(makeRequest(body, ip));
      expect(res.status).not.toBe(429);
    }

    const res = await POST(makeRequest(validBody(), ip));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toMatch(/Too many quiz submissions/);
    expect(data.retryAfterMs).toBeGreaterThan(0);
  });

  it('allows submissions from different IPs independently', async () => {
    const ip1 = uniqueIP();
    const ip2 = uniqueIP();

    const res1 = await POST(makeRequest(validBody(), ip1));
    expect(res1.status).toBe(200);

    const res2 = await POST(makeRequest(validBody(), ip2));
    expect(res2.status).toBe(200);
  });
});

describe('anti-gaming: wallet+step cooldown', () => {
  it('blocks rapid retry for the same wallet+step', async () => {
    const ip = uniqueIP();
    const wallet = uniqueWallet();

    const body1 = validBody({ wallet });
    const res1 = await POST(makeRequest(body1, ip));
    expect(res1.status).toBe(200);

    const ip2 = uniqueIP();
    const body2 = validBody({ wallet });
    const res2 = await POST(makeRequest(body2, ip2));
    const data2 = await res2.json();

    expect(res2.status).toBe(429);
    expect(data2.error).toMatch(/Please wait/);
    expect(data2.retryAfterMs).toBeGreaterThan(0);
  });

  it('allows different wallets to submit concurrently', async () => {
    const ip = uniqueIP();

    const res1 = await POST(makeRequest(validBody(), ip));
    expect(res1.status).toBe(200);

    const res2 = await POST(makeRequest(validBody(), ip));
    expect(res2.status).toBe(200);
  });
});

describe('anti-gaming: server-side time gate', () => {
  it('rejects quiz submitted too quickly after start', async () => {
    mockCheckQuizTimeGate.mockReturnValue({
      allowed: false,
      elapsedSeconds: 5,
      requiredSeconds: 30,
    });
    const ip = uniqueIP();

    const res = await POST(makeRequest(validBody(), ip));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toMatch(/too quickly/);
    expect(data.retryAfterMs).toBeGreaterThan(0);
  });

  it('allows quiz submission after enough time has elapsed', async () => {
    mockCheckQuizTimeGate.mockReturnValue({
      allowed: true,
      elapsedSeconds: 60,
      requiredSeconds: 30,
    });
    const ip = uniqueIP();

    const res = await POST(makeRequest(validBody(), ip));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('passes through when no start time was recorded', async () => {
    mockCheckQuizTimeGate.mockReturnValue({
      allowed: true,
      elapsedSeconds: 0,
      requiredSeconds: 30,
    });
    const ip = uniqueIP();

    const res = await POST(makeRequest(validBody(), ip));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('clears start time after successful submission', async () => {
    const ip = uniqueIP();
    const body = validBody();

    const res = await POST(makeRequest(body, ip));
    expect(res.status).toBe(200);

    expect(mockClearQuizStart).toHaveBeenCalledWith(body.wallet, body.questId, body.stepId);
  });
});
