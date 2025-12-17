/**
 * GitHub Issue Link CRUD helpers
 * 
 * Links app feedback entities to GitHub issues.
 * Stores GitHub issue number and URL for tracking.
 * 
 * Reference: refs/doc/beta_metrics_QUESTIONS.md Question 9
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";
import { SPACE_ID } from "@/lib/config";

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
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();

  const payload = {
    feedbackKey,
    issueNumber,
    issueUrl,
    repository,
    createdAt,
  };

  // GitHub issue links persist for record keeping (1 year)
  const expiresIn = 31536000; // 1 year in seconds

  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'github_issue_link' },
        { key: 'feedbackKey', value: feedbackKey },
        { key: 'issueNumber', value: String(issueNumber) },
        { key: 'issueUrl', value: issueUrl },
        { key: 'repository', value: repository },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn,
    });
  });

  // Store txHash
  try {
    await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({ txHash })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'github_issue_link_txhash' },
        { key: 'linkKey', value: entityKey },
        { key: 'feedbackKey', value: feedbackKey },
        { key: 'spaceId', value: spaceId },
      ],
      expiresIn,
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
      publicClient.buildQuery()
        .where(eq('type', 'github_issue_link'))
        .withAttributes(true)
        .withPayload(true)
        .limit(limit || 100)
        .fetch(),
      publicClient.buildQuery()
        .where(eq('type', 'github_issue_link_txhash'))
        .withAttributes(true)
        .withPayload(true)
        .fetch(),
    ]);

    if (!result?.entities || !Array.isArray(result.entities)) {
      return [];
    }

    // Build txHash map
    const txHashMap: Record<string, string> = {};
    if (txHashResult?.entities && Array.isArray(txHashResult.entities)) {
      txHashResult.entities.forEach((entity: any) => {
        const attrs = entity.attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };
        const linkKey = getAttr('linkKey');
        try {
          if (entity.payload) {
            const decoded = entity.payload instanceof Uint8Array
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
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('[listGitHubIssueLinks] Error decoding payload:', e);
      }

      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };

      return {
        key: entity.key,
        feedbackKey: getAttr('feedbackKey') || payload.feedbackKey,
        issueNumber: payload.issueNumber || parseInt(getAttr('issueNumber'), 10),
        issueUrl: getAttr('issueUrl') || payload.issueUrl,
        repository: getAttr('repository') || payload.repository,
        createdAt: getAttr('createdAt') || payload.createdAt,
        txHash: txHashMap[entity.key] || payload.txHash || undefined,
      };
    });

    // Apply filters
    if (feedbackKey) {
      links = links.filter(l => l.feedbackKey === feedbackKey);
    }

    return links.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error: any) {
    console.error('[listGitHubIssueLinks] Error:', error);
    return [];
  }
}
