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
 * Natural order: Introduction → Philosophy → History → Architecture → Arkiv → Modules → Practices → User Flows → Integrations → Meta
 */
const SECTION_ORDER: Record<string, number> = {
  'introduction': 1,
  'architecture': 2,
  'philosophy': 3,
  'user-flows': 4,
  'arkiv': 5,
  'modules': 6,
  'practices': 7,
  'integrations': 8,
  'meta': 9,
  'history': 10,
};

const FILE_ORDER: Record<string, Record<string, number>> = {
  // Root level files (standalone docs)
  '': {
    'roadmap': 1,
  },
  // Introduction section
  'introduction': {
    'README': 1,
    'documentation-tour': 2,
    'introduction': 3,
    'overview': 4,
    'getting-started': 5,
    'roadmap': 6,
  },
  // Philosophy section
  'philosophy': {
    'first-principles': 1,
    'dark-forest-garden': 2,
    'design-values': 3,
    'tracking-and-privacy': 4,
    'engineering-guidelines': 5,
    'a-platform-that-teaches': 6,
    'serverless-and-trustless': 7,
  },
  // History section
  'history': {
    'context': 1,
  },
  // Architecture section
  'architecture': {
    'overview': 1,
    'arkiv-integration': 2,
    'graphql-performance': 3,
    'admin-dashboard': 4,
  },
  // Arkiv section
  'arkiv': {
    'overview': 1,
    'data-model': 2,
    'entity-overview': 3, // Overview page (will be linked from folder)
    'wallet-architecture': 4,
    'environments': 5,
    'privacy-consent': 6,
    'implementation-faq': 7,
    // Entity schemas (alphabetical, grouped under entity-schemas folder)
    'ask': 1,
    'availability': 2,
    'feedback': 3,
    'offer': 4,
    'profile': 5,
    'session': 6,
    'skill': 7,
  },
  // Modules section
  'modules': {
    'arkiv-client': 1,
    'graphql-api': 2,
    'feedback-modules': 3,
  },
  // Practices section
  'practices': {
    'developer-experience': 1,
    'performance': 2,
    'arkiv-integration': 3,
  },
  // User Flows section
  'user-flows': {
    'overview': 1,
    'getting-started': 2,
    'profiles-skills': 3,
    'asks-offers': 4,
    'network-discovery': 5,
    'sessions': 6,
    'feedback': 7,
  },
  // Integrations section
  'integrations': {
    'jitsi-integration': 1,
    'github-integration': 2,
    'graphql-integration': 3,
    'passkey-integration': 4,
  },
  // Meta section
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

/**
 * Post-process files to group entity schema files under a virtual "entity-schemas" directory
 */
function groupEntitySchemas(files: DocFile[]): DocFile[] {
  const schemaFiles = ['ask', 'availability', 'feedback', 'offer', 'profile', 'session', 'skill'];
  
  return files.map((file) => {
    if (file.path === 'arkiv' && file.isDirectory && file.children) {
      // Find entity schema files and the entity-overview overview
      const schemaChildren: DocFile[] = [];
      const otherChildren: DocFile[] = [];
      let entitySchemasOverview: DocFile | null = null;
      
      file.children.forEach((child) => {
        if (schemaFiles.includes(child.name)) {
          schemaChildren.push(child);
        } else if (child.name === 'entity-overview' && !child.isDirectory) {
          // Keep the overview page reference (we'll link to it from the folder)
          entitySchemasOverview = child;
        } else {
          otherChildren.push(child);
        }
      });
      
      // Create virtual "entity-schemas" directory
      if (schemaChildren.length > 0) {
        const entitySchemasDir: DocFile = {
          path: 'arkiv/entity-overview',
          name: 'entity-overview',
          isDirectory: true,
          children: schemaChildren.sort((a, b) => {
            const orderA = FILE_ORDER['arkiv']?.[a.name] || 999;
            const orderB = FILE_ORDER['arkiv']?.[b.name] || 999;
            return orderA - orderB;
          }),
          order: FILE_ORDER['arkiv']?.['entity-overview'] || 3,
        };
        
        // Keep entity-overview.md in the top level (it's the overview page)
        // The folder will link to it, but we also show it as a file
        const finalChildren = [
          ...otherChildren,
        ];
        
        // Insert entity-overview overview before the folder if it exists
        if (entitySchemasOverview) {
          finalChildren.push(entitySchemasOverview);
        }
        
        // Add the folder after the overview
        finalChildren.push(entitySchemasDir);
        
        return {
          ...file,
          children: finalChildren.sort((a, b) => {
            const orderA = a.order || 999;
            const orderB = b.order || 999;
            return orderA - orderB;
          }),
        };
      }
    }
    return file;
  });
}

export async function GET() {
  try {
    const docsPath = join(process.cwd(), 'docs', 'betadocs');
    const files = await listDocs(docsPath, '');
    
    // Group entity schemas under virtual directory
    const processedFiles = groupEntitySchemas(files);
    
    return NextResponse.json({ files: processedFiles });
  } catch (error: any) {
    console.error('[docs/list] Error:', error);
    return NextResponse.json(
      { error: 'Failed to list docs', details: error.message },
      { status: 500 }
    );
  }
}

