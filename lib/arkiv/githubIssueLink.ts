/**
 * GitHub Issue Link CRUD helpers
 *
 * Links app feedback entities to GitHub issues.
 * Stores GitHub issue number and URL for tracking.
 *
 * Reference: refs/doc/beta_metrics_QUESTIONS.md Question 9
 */

import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
import { SPACE_ID } from '@/lib/config';

export type GitHubIssueLink = {
  key: string;
  feedbackKey: string; // Reference to app_feedback entity
  issueNumber: number;
  issueUrl: string;
  repository: string; // e.g., "understories/p2pmentor"
  createdAt: string;
  txHash?: string;
};

/**
 * Create a GitHub issue link entity on Arkiv
 */
export async function createGitHubIssueLink({
  feedbackKey,
  issueNumber,
  issueUrl,
  repository,
  privateKey,
  spaceId = SPACE_ID,
}: {
  feedbackKey: string;
  issueNumber: number;
  issueUrl: string;
  repository: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const createdAt = new Date().toISOString();

  const payload = {
    feedbackKey,
    issueNumber,
    issueUrl,
    repository,
    createdAt,
  };

  // GitHub issue links persist for record keeping (type default lifetime from schema.ts)
  // issue_url is payload-only (URLs never go in attributes)
  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'github_issue_link',
      attributes: {
        feedback_key: feedbackKey,
        issue_number: String(issueNumber),
        repository,
        space_id: spaceId,
        created_at: createdAt,
      },
      payload,
    });
  });

  // Store txHash
  try {
    await createArkivEntity(walletClient, {
      type: 'github_issue_link_txhash',
      attributes: {
        link_key: entityKey,
        feedback_key: feedbackKey,
        space_id: spaceId,
      },
      payload: { txHash },
    });
  } catch (error: any) {
    console.warn('[githubIssueLink] Failed to create txhash entity:', error);
  }

  return { key: entityKey, txHash };
}

/**
 * List GitHub issue links from Arkiv
 */
export async function listGitHubIssueLinks({
  feedbackKey,
  limit = 100,
}: {
  feedbackKey?: string;
  limit?: number;
} = {}): Promise<GitHubIssueLink[]> {
  try {
    const publicClient = getPublicClient();

    const [result, txHashResult] = await Promise.all([
      fetchAll(
        feedbackKey
          ? arkivSelect('github_issue_link', publicClient).where(
              eqAttr('feedback_key', feedbackKey)
            )
          : arkivSelect('github_issue_link', publicClient),
        limit || 100,
        publicClient
      ),
      fetchAll(arkivSelect('github_issue_link_txhash', publicClient), 500, publicClient),
    ]);

    if (!result?.entities || !Array.isArray(result.entities)) {
      return [];
    }

    // Build txHash map
    const txHashMap: Record<string, string> = {};
    if (txHashResult?.entities && Array.isArray(txHashResult.entities)) {
      txHashResult.entities.forEach((entity: any) => {
        const getAttr = (key: string): string => readAttr(entity, key);
        const linkKey = getAttr('link_key');
        try {
          if (entity.payload) {
            const decoded =
              entity.payload instanceof Uint8Array
                ? new TextDecoder().decode(entity.payload)
                : typeof entity.payload === 'string'
                  ? entity.payload
                  : JSON.stringify(entity.payload);
            const payload = JSON.parse(decoded);
            if (payload.txHash && linkKey) {
              txHashMap[linkKey] = payload.txHash;
            }
          }
        } catch (e) {
          // Ignore decode errors
        }
      });
    }

    let links = result.entities.map((entity: any) => {
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
        console.error('[listGitHubIssueLinks] Error decoding payload:', e);
      }

      const getAttr = (key: string): string => readAttr(entity, key);

      return {
        key: entity.key,
        feedbackKey: getAttr('feedback_key') || payload.feedbackKey,
        issueNumber: payload.issueNumber || parseInt(getAttr('issue_number'), 10),
        issueUrl: payload.issueUrl || getAttr('issue_url'),
        repository: getAttr('repository') || payload.repository,
        createdAt: getAttr('created_at') || payload.createdAt,
        txHash: txHashMap[entity.key] || payload.txHash || undefined,
      };
    });

    // Apply filters
    if (feedbackKey) {
      links = links.filter((l) => l.feedbackKey === feedbackKey);
    }

    return links.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error: any) {
    console.error('[listGitHubIssueLinks] Error:', error);
    return [];
  }
}
