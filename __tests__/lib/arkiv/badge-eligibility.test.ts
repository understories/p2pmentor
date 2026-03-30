import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetRequiredStepIds, mockGetQuestStepProgress } = vi.hoisted(() => ({
  mockGetRequiredStepIds: vi.fn(),
  mockGetQuestStepProgress: vi.fn(),
}));

vi.mock('@/lib/quests', () => ({
  getRequiredStepIds: mockGetRequiredStepIds,
}));

vi.mock('@/lib/arkiv/questProgress', () => ({
  getQuestStepProgress: mockGetQuestStepProgress,
}));

vi.mock('@/lib/arkiv/client', () => ({
  getPublicClient: vi.fn(),
  getWalletClientFromPrivateKey: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  SPACE_ID: 'test-space',
}));

import { checkBadgeEligibility } from '@/lib/arkiv/badge';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkBadgeEligibility', () => {
  const baseParams = {
    wallet: '0xABC123',
    questId: 'quest_1',
    trackId: 'demo',
  };

  it('returns eligible when all required steps are completed', async () => {
    mockGetRequiredStepIds.mockResolvedValue(['step-a', 'step-b']);
    mockGetQuestStepProgress.mockResolvedValue([
      { stepId: 'step-a', key: 'k1', txHash: '0x1', questVersion: '2' },
      { stepId: 'step-b', key: 'k2', txHash: '0x2', questVersion: '2' },
    ]);

    const result = await checkBadgeEligibility(baseParams);

    expect(result.eligible).toBe(true);
    expect(result.completedSteps).toEqual(['step-a', 'step-b']);
    expect(result.missingSteps).toEqual([]);
    expect(result.evidenceRefs).toHaveLength(2);
    expect(result.questVersion).toBe('2');
  });

  it('returns not eligible when some required steps are missing', async () => {
    mockGetRequiredStepIds.mockResolvedValue(['step-a', 'step-b', 'step-c']);
    mockGetQuestStepProgress.mockResolvedValue([{ stepId: 'step-a', key: 'k1', txHash: '0x1' }]);

    const result = await checkBadgeEligibility(baseParams);

    expect(result.eligible).toBe(false);
    expect(result.completedSteps).toEqual(['step-a']);
    expect(result.missingSteps).toEqual(['step-b', 'step-c']);
  });

  it('returns not eligible when no required steps exist for trackId', async () => {
    mockGetRequiredStepIds.mockResolvedValue([]);
    mockGetQuestStepProgress.mockResolvedValue([]);

    const result = await checkBadgeEligibility(baseParams);

    expect(result.eligible).toBe(false);
    expect(result.completedSteps).toEqual([]);
    expect(result.missingSteps).toEqual([]);
  });

  it('ignores progress for non-required steps', async () => {
    mockGetRequiredStepIds.mockResolvedValue(['step-a']);
    mockGetQuestStepProgress.mockResolvedValue([
      { stepId: 'step-a', key: 'k1', txHash: '0x1' },
      { stepId: 'step-extra', key: 'k2', txHash: '0x2' },
    ]);

    const result = await checkBadgeEligibility(baseParams);

    expect(result.eligible).toBe(true);
    expect(result.completedSteps).toEqual(['step-a']);
    expect(result.evidenceRefs).toHaveLength(1);
  });

  it('passes wallet and questId to progress lookup', async () => {
    mockGetRequiredStepIds.mockResolvedValue(['step-a']);
    mockGetQuestStepProgress.mockResolvedValue([{ stepId: 'step-a', key: 'k1', txHash: '0x1' }]);

    await checkBadgeEligibility(baseParams);

    expect(mockGetQuestStepProgress).toHaveBeenCalledWith(
      expect.objectContaining({ wallet: '0xABC123', questId: 'quest_1' })
    );
  });

  it('defaults questVersion to 1 when not in progress', async () => {
    mockGetRequiredStepIds.mockResolvedValue(['step-a']);
    mockGetQuestStepProgress.mockResolvedValue([{ stepId: 'step-a', key: 'k1', txHash: '0x1' }]);

    const result = await checkBadgeEligibility(baseParams);

    expect(result.questVersion).toBe('1');
  });
});
