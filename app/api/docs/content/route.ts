import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

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
    // Sanitize path to prevent directory traversal
    const sanitizedPath = filePath.replace(/\.\./g, '').replace(/^\//, '');
    const fullPath = join(process.cwd(), 'docs', 'betadocs', `${sanitizedPath}.md`);

    const content = await readFile(fullPath, 'utf-8');
    
    return NextResponse.json({ content });
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
