import { NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

interface DocFile {
  path: string;
  name: string;
  isDirectory: boolean;
  children?: DocFile[];
  order?: number;
}

/**
 * Define custom ordering for documentation sections and files
 */
const SECTION_ORDER: Record<string, number> = {
  'introduction': 1,
  'philosophy': 2,
  'history': 3,
  'architecture': 4,
  'arkiv': 5,
  'modules': 6,
  'practices': 7,
  'user-flows': 8,
  'meta': 9,
};

const FILE_ORDER: Record<string, Record<string, number>> = {
  '': { // Root level files (now in introduction/)
    'introduction': 1,
    'overview': 2,
    'getting-started': 3,
    'roadmap': 4,
    'README': 5,
  },
  'introduction': {
    'introduction': 1,
    'overview': 2,
    'getting-started': 3,
    'roadmap': 4,
    'README': 5,
  },
  'philosophy': {
    'first-principles': 1,
    'dark-forest-garden': 2,
    'design-values': 3,
  },
  'history': {
    'context': 1,
  },
  'architecture': {
    'overview': 1,
    'arkiv-integration': 2,
    'graphql-performance': 3,
  },
  'arkiv': {
    'overview': 1,
    'data-model': 2,
    'privacy-consent': 3,
  },
  'modules': {
    'arkiv-client': 1,
    'graphql-api': 2,
    'jitsi-integration': 3,
    'feedback-modules': 4,
  },
  'practices': {
    'developer-experience': 1,
    'performance': 2,
    'arkiv-integration': 3,
  },
  'user-flows': {
    'overview': 1,
    'profiles-skills': 2,
    'asks-offers': 3,
    'network-discovery': 4,
    'sessions': 5,
    'feedback': 6,
  },
  'meta': {
    'outline': 1,
  },
};

/**
 * Recursively list all markdown files in docs/betadocs
 */
async function listDocs(dir: string, basePath: string = ''): Promise<DocFile[]> {
  const files: DocFile[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = join(basePath, entry.name);

    if (entry.isDirectory()) {
      const children = await listDocs(fullPath, relativePath);
      const sectionOrder = SECTION_ORDER[entry.name] || 999;
      files.push({
        path: relativePath,
        name: entry.name,
        isDirectory: true,
        children,
        order: sectionOrder,
      });
    } else if (entry.name.endsWith('.md')) {
      const fileName = entry.name.replace(/\.md$/, '');
      // Use basePath as the section, or 'introduction' for root level files
      const section = basePath || '';
      const fileOrder = FILE_ORDER[section]?.[fileName] || FILE_ORDER['']?.[fileName] || 999;
      files.push({
        path: relativePath.replace(/\.md$/, ''),
        name: fileName,
        isDirectory: false,
        order: fileOrder,
      });
    }
  }

  return files.sort((a, b) => {
    // Directories first, then files
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    // Use custom order if available
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function GET() {
  try {
    const docsPath = join(process.cwd(), 'docs', 'betadocs');
    const files = await listDocs(docsPath, '');
    
    return NextResponse.json({ files });
  } catch (error: any) {
    console.error('[docs/list] Error:', error);
    return NextResponse.json(
      { error: 'Failed to list docs', details: error.message },
      { status: 500 }
    );
  }
}

