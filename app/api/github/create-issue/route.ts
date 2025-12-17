/**
 * GitHub Issue Creation API route
 * 
 * Creates a GitHub issue from app feedback.
 * Stores the link as an Arkiv entity for transparency.
 * 
 * Reference: refs/doc/beta_metrics_QUESTIONS.md Question 9
 */

import { NextRequest, NextResponse } from 'next/server';
import { createGitHubIssueLink } from '@/lib/arkiv/githubIssueLink';
import { getPrivateKey, SPACE_ID } from '@/lib/config';

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'understories';
const GITHUB_REPO = process.env.GITHUB_REPO || 'p2pmentor';

/**
 * POST /api/github/create-issue
 * 
 * Create a GitHub issue from feedback
 * Body: { feedbackKey, page, message, rating, feedbackType, wallet }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { feedbackKey, page, message, rating, feedbackType, wallet } = body;

    if (!feedbackKey || !page || !message) {
      return NextResponse.json(
        { ok: false, error: 'feedbackKey, page, and message are required' },
        { status: 400 }
      );
    }

    // Check for GitHub token
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json(
        { ok: false, error: 'GITHUB_TOKEN not configured' },
        { status: 500 }
      );
    }

    // Create GitHub issue
    const issueTitle = `[${feedbackType || 'feedback'}] ${page}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`;
    
    // Construct Arkiv explorer link with entity key
    const arkivExplorerUrl = `https://explorer.mendoza.hoodi.arkiv.network/entity/${feedbackKey}`;
    
    const issueBody = `## Feedback Details

**Page:** ${page}
**Type:** ${feedbackType || 'feedback'}
**Rating:** ${rating !== null && rating !== undefined ? `${rating}/5` : 'N/A'}
**Wallet:** ${wallet || 'N/A'}

**Message:**
${message}

---
*Created from app feedback entity: ${feedbackKey}*
*[View on Arkiv Explorer](${arkivExplorerUrl})*`;

    const githubResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: issueTitle,
          body: issueBody,
          labels: feedbackType === 'issue' ? ['bug', 'feedback'] : ['feedback'],
        }),
      }
    );

    if (!githubResponse.ok) {
      const error = await githubResponse.json();
      throw new Error(`GitHub API error: ${error.message || githubResponse.statusText}`);
    }

    const issue = await githubResponse.json();
    const issueNumber = issue.number;
    const issueUrl = issue.html_url;

    // Store link as Arkiv entity
    const privateKey = getPrivateKey();
    const { key, txHash } = await createGitHubIssueLink({
      feedbackKey,
      issueNumber,
      issueUrl,
      repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
      privateKey,
      spaceId: SPACE_ID,
    });

    return NextResponse.json({
      ok: true,
      issueNumber,
      issueUrl,
      key,
      txHash,
    });
  } catch (error: any) {
    console.error('[api/github/create-issue] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create GitHub issue' },
      { status: 500 }
    );
  }
}
