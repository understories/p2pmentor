/**
 * GitHub Issue Links API route
 * 
 * Lists GitHub issue links for feedback entities.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listGitHubIssueLinks } from '@/lib/arkiv/githubIssueLink';

/**
 * GET /api/github/issue-links
 * 
 * List GitHub issue links
 * Query params: feedbackKey
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const feedbackKey = searchParams.get('feedbackKey') || undefined;

    const links = await listGitHubIssueLinks({
      feedbackKey,
      limit: 1000,
    });

    return NextResponse.json({ ok: true, links });
  } catch (error: any) {
    console.error('[api/github/issue-links] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to list issue links' },
      { status: 500 }
    );
  }
}
