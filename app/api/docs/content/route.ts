import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';

const DOCS_BASE = resolve(process.cwd(), 'docs', 'betadocs');

function isSafePath(resolved: string): boolean {
  return resolved.startsWith(DOCS_BASE + '/') || resolved === DOCS_BASE;
}

/**
 * Get markdown content for a documentation file
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Path parameter required' }, { status: 400 });
  }

  try {
    const stripped = filePath.replace(/^\/+/, '');

    // Resolve and verify the path stays inside DOCS_BASE
    const fullPath = resolve(DOCS_BASE, `${stripped}.md`);
    if (!isSafePath(fullPath)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    try {
      const content = await readFile(fullPath, 'utf-8');
      return NextResponse.json({ content });
    } catch (directError: any) {
      if (directError.code === 'ENOENT') {
        const readmePath = resolve(DOCS_BASE, stripped, 'README.md');
        if (!isSafePath(readmePath)) {
          return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
        }
        try {
          const content = await readFile(readmePath, 'utf-8');
          return NextResponse.json({ content });
        } catch (readmeError: any) {
          if (readmeError.code === 'ENOENT') {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
          }
          throw readmeError;
        }
      }
      throw directError;
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    console.error('[docs/content] Error:', error);
    return NextResponse.json(
      { error: 'Failed to read file', details: error.message },
      { status: 500 }
    );
  }
}
