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
 * Close a GitHub issue and add resolution comment with Arkiv entity link
 * Body: { issueNumber, resolutionNote?, resolutionKey?, txHash? }
 */
export async function PATCH(request: NextRequest) {
  try {
    console.log('[api/github/close-issue] Received request');
    const body = await request.json();
    console.log('[api/github/close-issue] Request body:', body);
    const { issueNumber, resolutionNote, resolutionKey, txHash } = body;

    if (!issueNumber) {
      console.error('[api/github/close-issue] Missing issueNumber');
      return NextResponse.json(
        { ok: false, error: 'issueNumber is required' },
        { status: 400 }
      );
    }

    console.log('[api/github/close-issue] Closing issue #', issueNumber);

    // Check for GitHub token
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('[api/github/close-issue] GITHUB_TOKEN not configured');
      return NextResponse.json(
        { ok: false, error: 'GITHUB_TOKEN not configured' },
        { status: 500 }
      );
    }

    console.log('[api/github/close-issue] GitHub token found, proceeding...');

    // Build Arkiv explorer link if resolution key is provided
    const arkivExplorerLink = resolutionKey 
      ? `https://explorer.mendoza.hoodi.arkiv.network/entity/${resolutionKey}`
      : null;

    console.log('[api/github/close-issue] Resolution key:', resolutionKey);
    console.log('[api/github/close-issue] Arkiv explorer link:', arkivExplorerLink);
    console.log('[api/github/close-issue] Resolution note:', resolutionNote);

    // Always add a resolution comment (arkiv-native entity update pattern)
    let commentBody = `## ✅ Issue Resolved

This issue has been marked as resolved using Arkiv's immutable entity update pattern.`;

    if (resolutionNote && resolutionNote.trim()) {
      commentBody += `\n\n**Resolution Details:**\n${resolutionNote}`;
    }

    if (arkivExplorerLink) {
      commentBody += `\n\n**Resolution Entity:**\n[View resolution entity on Arkiv Explorer](${arkivExplorerLink})`;
      if (txHash) {
        const txExplorerUrl = `https://explorer.mendoza.hoodi.arkiv.network/tx/${txHash}`;
        commentBody += `\n\n**Transaction:** [${txHash.slice(0, 10)}...${txHash.slice(-8)}](${txExplorerUrl})`;
      }
    }

    commentBody += `\n\n---\n*Resolved via admin dashboard using Arkiv-native entity update pattern*`;

    console.log('[api/github/close-issue] Comment body:', commentBody);
    console.log('[api/github/close-issue] Posting comment to GitHub...');

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

    console.log('[api/github/close-issue] Comment response status:', commentResponse.status);

    if (!commentResponse.ok) {
      const error = await commentResponse.json();
      console.error('[api/github/close-issue] Failed to add comment:', error);
      // Continue anyway - closing the issue is more important
    } else {
      console.log('[api/github/close-issue] Comment added successfully');
    }

    // Close the issue
    console.log('[api/github/close-issue] Closing issue...');
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

    console.log('[api/github/close-issue] Close response status:', closeResponse.status);

    if (!closeResponse.ok) {
      const error = await closeResponse.json();
      console.error('[api/github/close-issue] Failed to close issue:', error);
      throw new Error(`GitHub API error: ${error.message || closeResponse.statusText}`);
    }

    const issue = await closeResponse.json();
    console.log('[api/github/close-issue] Issue closed successfully. Issue URL:', issue.html_url);

    return NextResponse.json({
      ok: true,
      issueNumber,
      issueUrl: issue.html_url,
      state: issue.state,
    });
  } catch (error: any) {
    console.error('[api/github/close-issue] Error:', error);
    console.error('[api/github/close-issue] Error stack:', error.stack);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to close GitHub issue' },
      { status: 500 }
    );
  }
}
