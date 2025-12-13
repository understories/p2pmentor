/**
 * GitHub Issue Close API route
 * 
 * Closes a GitHub issue and adds a resolution comment.
 * 
 * Reference: refs/doc/beta_metrics_QUESTIONS.md Question 9
 */

import { NextRequest, NextResponse } from 'next/server';

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'understories';
const GITHUB_REPO = process.env.GITHUB_REPO || 'p2pmentor';

/**
 * PATCH /api/github/close-issue
 * 
 * Close a GitHub issue and add resolution comment
 * Body: { issueNumber, resolutionNote }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { issueNumber, resolutionNote } = body;

    if (!issueNumber) {
      return NextResponse.json(
        { ok: false, error: 'issueNumber is required' },
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

    // Add resolution comment if provided
    if (resolutionNote) {
      const commentBody = `## Resolution

${resolutionNote}

---
*Resolved via admin dashboard*`;

      const commentResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: commentBody,
          }),
        }
      );

      if (!commentResponse.ok) {
        const error = await commentResponse.json();
        console.warn('[api/github/close-issue] Failed to add comment:', error);
        // Continue anyway - closing the issue is more important
      }
    }

    // Close the issue
    const closeResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: 'closed',
        }),
      }
    );

    if (!closeResponse.ok) {
      const error = await closeResponse.json();
      throw new Error(`GitHub API error: ${error.message || closeResponse.statusText}`);
    }

    const issue = await closeResponse.json();

    return NextResponse.json({
      ok: true,
      issueNumber,
      issueUrl: issue.html_url,
      state: issue.state,
    });
  } catch (error: any) {
    console.error('[api/github/close-issue] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to close GitHub issue' },
      { status: 500 }
    );
  }
}
