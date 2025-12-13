import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

/**
 * Get git history for a documentation file
 * 
 * Uses GitHub API in production (serverless-friendly) and falls back to git commands locally.
 * Returns last commit date, author, and commit message.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Path parameter required' }, { status: 400 });
  }

  const relativePath = filePath.replace(/^\/+/, ''); // Remove leading slashes
  
  // Try GitHub API first (works in serverless environments)
  const useGitHubAPI = process.env.VERCEL || process.env.NODE_ENV === 'production';
  
  if (useGitHubAPI) {
    try {
      return await getGitHistoryFromGitHubAPI(relativePath);
    } catch (error: any) {
      console.warn('[docs/git-history] GitHub API failed, trying local git:', error.message);
      // Fall through to local git method
    }
  }

  // Fallback to local git (works in development)
  try {
    return await getGitHistoryFromLocalGit(relativePath);
  } catch (error: any) {
    console.error('[docs/git-history] All methods failed:', error);
    return NextResponse.json({
      hash: null,
      author: null,
      email: null,
      date: null,
      message: null,
    });
  }
}

/**
 * Get git history using GitHub API (serverless-friendly)
 */
async function getGitHistoryFromGitHubAPI(filePath: string): Promise<NextResponse> {
  const owner = 'understories';
  const repo = 'p2pmentor';
  const branch = 'main';
  
  // GitHub API endpoint to get commits for a specific file
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(filePath)}&sha=${branch}&per_page=1`;
  
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };
  
  // Add auth token if available (increases rate limit)
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(apiUrl, { headers });
  
  if (!response.ok) {
    if (response.status === 404) {
      // File not found or not tracked
      return NextResponse.json({
        hash: null,
        author: null,
        email: null,
        date: null,
        message: null,
      });
    }
    throw new Error(`GitHub API responded with status: ${response.status}`);
  }

  const commits = await response.json();
  
  if (!commits || commits.length === 0) {
    return NextResponse.json({
      hash: null,
      author: null,
      email: null,
      date: null,
      message: null,
    });
  }

  const commit = commits[0];
  const commitDate = commit.commit?.author?.date || commit.commit?.committer?.date;
  
  return NextResponse.json({
    hash: commit.sha || null,
    author: commit.commit?.author?.name || commit.author?.login || null,
    email: commit.commit?.author?.email || null,
    date: commitDate || null,
    message: commit.commit?.message || null,
  });
}

/**
 * Get git history using local git commands (development only)
 */
async function getGitHistoryFromLocalGit(relativePath: string): Promise<NextResponse> {
  // Check if git is available
  try {
    execSync('git --version', { cwd: process.cwd(), encoding: 'utf-8', stdio: 'ignore' });
  } catch {
    throw new Error('Git not available');
  }

  // Get last commit info for the file
  const gitLog = execSync(
    `git log -1 --format="%H|%an|%ae|%ad|%s" --date=iso-strict -- "${relativePath}"`,
    { cwd: process.cwd(), encoding: 'utf-8', stdio: 'pipe' }
  ).trim();

  if (!gitLog) {
    return NextResponse.json({
      hash: null,
      author: null,
      email: null,
      date: null,
      message: null,
    });
  }

  const [hash, author, email, date, ...messageParts] = gitLog.split('|');
  const message = messageParts.join('|');

  // Get file stats (optional)
  let gitStats: string | null = null;
  try {
    gitStats = execSync(
      `git log --format="" --stat -- "${relativePath}" | tail -1`,
      { cwd: process.cwd(), encoding: 'utf-8', stdio: 'pipe' }
    ).trim() || null;
  } catch {
    // Stats are optional
  }

  return NextResponse.json({
    hash,
    author,
    email,
    date,
    message,
    stats: gitStats,
  });
}
