import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { join } from 'path';

/**
 * Get git history for a documentation file
 * Returns last commit date, author, and commit message
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Path parameter required' }, { status: 400 });
  }

  try {
    // Resolve file path relative to project root
    const fullPath = join(process.cwd(), filePath);
    const relativePath = filePath.replace(/^\/+/, ''); // Remove leading slashes

    // Get last commit info for the file
    const gitLog = execSync(
      `git log -1 --format="%H|%an|%ae|%ad|%s" --date=iso-strict -- "${relativePath}"`,
      { cwd: process.cwd(), encoding: 'utf-8' }
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

    // Get file stats
    const gitStats = execSync(
      `git log --format="" --stat -- "${relativePath}" | tail -1`,
      { cwd: process.cwd(), encoding: 'utf-8' }
    ).trim();

    return NextResponse.json({
      hash,
      author,
      email,
      date,
      message,
      stats: gitStats || null,
    });
  } catch (error: any) {
    console.error('[docs/git-history] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get git history', details: error.message },
      { status: 500 }
    );
  }
}
