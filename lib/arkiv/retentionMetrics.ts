/**
 * Retention Metrics CRUD helpers
 *
 * Privacy-preserving retention and cohort analysis.
 * Uses one-way hashed wallets for internal calculations.
 * Stores only aggregated results (no per-wallet history).
 *
 * Reference: refs/doc/beta_metrics_QUESTIONS.md Question 6
 */

import { arkivSelect, fetchAll, getAttr as readAttr } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
import { keccak256, toBytes } from 'viem';
import { listUserProfiles } from './profile';
import { listAsks } from './asks';
import { listOffers } from './offers';
import { listSessions } from './sessions';
import { SPACE_ID } from '@/lib/config';

export type RetentionCohort = {
  key: string;
  cohortDate: string; // YYYY-MM-DD - when users first appeared
  period: 'daily' | 'weekly' | 'monthly';
  day0: number; // Users active on cohort date
  day1?: number; // Users active 1 day later
  day7?: number; // Users active 7 days later
  day14?: number; // Users active 14 days later
  day30?: number; // Users active 30 days later
  createdAt: string;
  txHash?: string;
};

/**
 * Hash wallet address for privacy-preserving retention calculations
 *
 * One-way hash: cannot reverse to get original wallet.
 * Deterministic: same wallet always produces same hash.
 */
export function hashWalletForRetention(wallet: string): string {
  const normalized = wallet.toLowerCase().trim();
  // Use keccak256 for deterministic hashing (matches Ethereum/Arkiv patterns)
  return keccak256(toBytes(`p2pmentor-retention-v1:${normalized}`));
}

/**
 * Get active wallets for a date range
 *
 * A wallet is considered "active" if it has:
 * - Created/updated a profile
 * - Created an ask
 * - Created an offer
 * - Created a session
 */
export async function getActiveWalletsForDateRange(
  startDate: Date,
  endDate: Date
): Promise<Set<string>> {
  const activeWallets = new Set<string>();

  try {
    // Get all profiles, asks, offers, sessions in date range
    const [profiles, asks, offers, sessions] = await Promise.all([
      listUserProfiles(),
      listAsks({ limit: 1000 }),
      listOffers({ limit: 1000 }),
      listSessions(), // listSessions doesn't support limit parameter
    ]);

    // Check profiles
    profiles.forEach((profile) => {
      const profileDate = profile.createdAt ? new Date(profile.createdAt) : null;
      if (profileDate && profileDate >= startDate && profileDate <= endDate) {
        activeWallets.add(profile.wallet.toLowerCase());
      }
    });

    // Check asks
    asks.forEach((ask) => {
      const askDate = new Date(ask.createdAt);
      if (askDate >= startDate && askDate <= endDate) {
        activeWallets.add(ask.wallet.toLowerCase());
      }
    });

    // Check offers
    offers.forEach((offer) => {
      const offerDate = new Date(offer.createdAt);
      if (offerDate >= startDate && offerDate <= endDate) {
        activeWallets.add(offer.wallet.toLowerCase());
      }
    });

    // Check sessions
    sessions.forEach((session) => {
      const sessionDate = new Date(session.sessionDate);
      if (sessionDate >= startDate && sessionDate <= endDate) {
        activeWallets.add(session.mentorWallet.toLowerCase());
        activeWallets.add(session.learnerWallet.toLowerCase());
      }
    });
  } catch (error) {
    console.error('[retentionMetrics] Error getting active wallets:', error);
  }

  return activeWallets;
}

/**
 * Compute retention cohort
 *
 * Tracks how many users from a cohort date remain active over time.
 * Uses hashed wallets for privacy.
 */
export async function computeRetentionCohort(
  cohortDate: string, // YYYY-MM-DD
  period: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<Omit<RetentionCohort, 'key' | 'txHash'>> {
  const cohortStart = new Date(cohortDate);
  cohortStart.setHours(0, 0, 0, 0);
  const cohortEnd = new Date(cohortDate);
  cohortEnd.setHours(23, 59, 59, 999);

  // Get wallets active on cohort date
  const cohortWallets = await getActiveWalletsForDateRange(cohortStart, cohortEnd);
  const day0 = cohortWallets.size;

  // Hash wallets for privacy-preserving tracking
  const hashedCohort = new Set<string>();
  cohortWallets.forEach((wallet) => {
    hashedCohort.add(hashWalletForRetention(wallet));
  });

  // Check retention at different intervals
  let day1 = 0;
  let day7 = 0;
  let day14 = 0;
  let day30 = 0;

  // Day 1 retention
  const day1Start = new Date(cohortStart);
  day1Start.setDate(day1Start.getDate() + 1);
  const day1End = new Date(day1Start);
  day1End.setHours(23, 59, 59, 999);
  const day1Wallets = await getActiveWalletsForDateRange(day1Start, day1End);
  day1Wallets.forEach((wallet) => {
    if (hashedCohort.has(hashWalletForRetention(wallet))) {
      day1++;
    }
  });

  // Day 7 retention
  const day7Start = new Date(cohortStart);
  day7Start.setDate(day7Start.getDate() + 7);
  const day7End = new Date(day7Start);
  day7End.setHours(23, 59, 59, 999);
  const day7Wallets = await getActiveWalletsForDateRange(day7Start, day7End);
  day7Wallets.forEach((wallet) => {
    if (hashedCohort.has(hashWalletForRetention(wallet))) {
      day7++;
    }
  });

  // Day 14 retention
  const day14Start = new Date(cohortStart);
  day14Start.setDate(day14Start.getDate() + 14);
  const day14End = new Date(day14Start);
  day14End.setHours(23, 59, 59, 999);
  const day14Wallets = await getActiveWalletsForDateRange(day14Start, day14End);
  day14Wallets.forEach((wallet) => {
    if (hashedCohort.has(hashWalletForRetention(wallet))) {
      day14++;
    }
  });

  // Day 30 retention
  const day30Start = new Date(cohortStart);
  day30Start.setDate(day30Start.getDate() + 30);
  const day30End = new Date(day30Start);
  day30End.setHours(23, 59, 59, 999);
  const day30Wallets = await getActiveWalletsForDateRange(day30Start, day30End);
  day30Wallets.forEach((wallet) => {
    if (hashedCohort.has(hashWalletForRetention(wallet))) {
      day30++;
    }
  });

  return {
    cohortDate,
    period,
    day0,
    day1: day0 > 0 ? day1 : undefined,
    day7: day0 > 0 ? day7 : undefined,
    day14: day0 > 0 ? day14 : undefined,
    day30: day0 > 0 ? day30 : undefined,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a retention cohort entity on Arkiv
 */
export async function createRetentionCohort({
  cohort,
  privateKey,
  spaceId = SPACE_ID,
}: {
  cohort: Omit<RetentionCohort, 'key' | 'txHash'>;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const createdAt = cohort.createdAt || new Date().toISOString();

  const payload = {
    cohortDate: cohort.cohortDate,
    period: cohort.period,
    day0: cohort.day0,
    day1: cohort.day1,
    day7: cohort.day7,
    day14: cohort.day14,
    day30: cohort.day30,
    createdAt,
  };

  // Retention cohorts use the type default lifetime (see lib/arkiv/schema.ts)

  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'retention_cohort',
      attributes: {
        cohort_date: cohort.cohortDate,
        period: cohort.period,
        day0: String(cohort.day0),
        day1: cohort.day1 !== undefined ? String(cohort.day1) : undefined,
        day7: cohort.day7 !== undefined ? String(cohort.day7) : undefined,
        day14: cohort.day14 !== undefined ? String(cohort.day14) : undefined,
        day30: cohort.day30 !== undefined ? String(cohort.day30) : undefined,
        space_id: spaceId,
        created_at: createdAt,
      },
      payload,
    });
  });

  // Store txHash
  try {
    await createArkivEntity(walletClient, {
      type: 'retention_cohort_txhash',
      attributes: {
        cohort_key: entityKey,
        cohort_date: cohort.cohortDate,
        space_id: spaceId,
      },
      payload: { txHash },
    });
  } catch (error: any) {
    console.warn('[retentionMetrics] Failed to create txhash entity:', error);
  }

  return { key: entityKey, txHash };
}

/**
 * List retention cohorts from Arkiv
 */
export async function listRetentionCohorts({
  cohortDate,
  period,
  limit = 100,
}: {
  cohortDate?: string;
  period?: 'daily' | 'weekly' | 'monthly';
  limit?: number;
} = {}): Promise<RetentionCohort[]> {
  try {
    const publicClient = getPublicClient();

    const [result, txHashResult] = await Promise.all([
      fetchAll(arkivSelect('retention_cohort', publicClient), limit || 100, publicClient),
      fetchAll(arkivSelect('retention_cohort_txhash', publicClient), 1000, publicClient),
    ]);

    if (!result?.entities || !Array.isArray(result.entities)) {
      return [];
    }

    // Build txHash map
    const txHashMap: Record<string, string> = {};
    if (txHashResult?.entities && Array.isArray(txHashResult.entities)) {
      txHashResult.entities.forEach((entity: any) => {
        const getAttr = (key: string): string => readAttr(entity, key);
        const cohortKey = getAttr('cohort_key');
        try {
          if (entity.payload) {
            const decoded =
              entity.payload instanceof Uint8Array
                ? new TextDecoder().decode(entity.payload)
                : typeof entity.payload === 'string'
                  ? entity.payload
                  : JSON.stringify(entity.payload);
            const payload = JSON.parse(decoded);
            if (payload.txHash && cohortKey) {
              txHashMap[cohortKey] = payload.txHash;
            }
          }
        } catch (e) {
          // Ignore decode errors
        }
      });
    }

    let cohorts = result.entities.map((entity: any) => {
      let payload: any = {};
      try {
        if (entity.payload) {
          const decoded =
            entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
                ? entity.payload
                : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('[listRetentionCohorts] Error decoding payload:', e);
      }

      const getAttr = (key: string): string => readAttr(entity, key);

      return {
        key: entity.key,
        cohortDate: getAttr('cohort_date') || payload.cohortDate,
        period: (getAttr('period') || payload.period || 'daily') as 'daily' | 'weekly' | 'monthly',
        day0: payload.day0 || parseInt(getAttr('day0'), 10),
        day1:
          payload.day1 !== undefined
            ? payload.day1
            : getAttr('day1')
              ? parseInt(getAttr('day1'), 10)
              : undefined,
        day7:
          payload.day7 !== undefined
            ? payload.day7
            : getAttr('day7')
              ? parseInt(getAttr('day7'), 10)
              : undefined,
        day14:
          payload.day14 !== undefined
            ? payload.day14
            : getAttr('day14')
              ? parseInt(getAttr('day14'), 10)
              : undefined,
        day30:
          payload.day30 !== undefined
            ? payload.day30
            : getAttr('day30')
              ? parseInt(getAttr('day30'), 10)
              : undefined,
        createdAt: getAttr('created_at') || payload.createdAt,
        txHash: txHashMap[entity.key] || payload.txHash || undefined,
      };
    });

    // Apply filters
    if (cohortDate) {
      cohorts = cohorts.filter((c) => c.cohortDate === cohortDate);
    }
    if (period) {
      cohorts = cohorts.filter((c) => c.period === period);
    }

    return cohorts.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error: any) {
    console.error('[listRetentionCohorts] Error:', error);
    return [];
  }
}
