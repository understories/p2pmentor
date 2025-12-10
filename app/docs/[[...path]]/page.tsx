'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';

interface GitHistory {
  hash: string | null;
  author: string | null;
  email: string | null;
  date: string | null;
  message: string | null;
}

interface DocFile {
  path: string;
  name: string;
  isDirectory: boolean;
  children?: DocFile[];
}

export default function DocsPage() {
  const params = useParams();
  const path = params?.path as string[] | undefined;
  const currentPath = path ? path.join('/') : null; // null means root /docs

  const [content, setContent] = useState<string>('');
  const [gitHistory, setGitHistory] = useState<GitHistory | null>(null);
  const [files, setFiles] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDocs = async () => {
      setLoading(true);
      try {
        // Load file list
        const filesRes = await fetch('/api/docs/list');
        const filesData = await filesRes.json();
        setFiles(filesData.files || []);

        // If no path, show table of contents
        if (!currentPath) {
          setContent(''); // Will render TOC instead
          setLoading(false);
          return;
        }

        // Load content
        const contentRes = await fetch(`/api/docs/content?path=${encodeURIComponent(currentPath)}`);
        if (contentRes.ok) {
          const contentData = await contentRes.json();
          setContent(contentData.content || '');
        } else {
          setContent('# Page not found\n\nThe requested documentation page could not be found.');
        }

        // Load git history
        const gitPath = `docs/betadocs/${currentPath}.md`;
        const gitRes = await fetch(`/api/docs/git-history?path=${encodeURIComponent(gitPath)}`);
        if (gitRes.ok) {
          const gitData = await gitRes.json();
          setGitHistory(gitData);
        }
      } catch (error) {
        console.error('Error loading docs:', error);
        setContent('# Error\n\nFailed to load documentation.');
      } finally {
        setLoading(false);
      }
    };

    loadDocs();
  }, [currentPath]);

  const renderFileTree = (files: DocFile[], level = 0, forTOC = false) => {
    return (
      <ul className={level === 0 ? 'space-y-1' : 'ml-4 mt-1 space-y-1'}>
        {files.map((file) => (
          <li key={file.path}>
            {file.isDirectory ? (
              <>
                <div className={`${forTOC ? 'text-sm font-semibold text-gray-900 dark:text-white mt-4 mb-2' : 'text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider py-2 px-2'}`}>
                  {file.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                {file.children && renderFileTree(file.children, level + 1, forTOC)}
              </>
            ) : (
              <Link
                href={`/docs/${file.path}`}
                className={`block px-2 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                  currentPath === file.path
                    ? 'bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {file.name.replace(/-/g, ' ')}
              </Link>
            )}
          </li>
        ))}
      </ul>
    );
  };

  const renderTableOfContents = () => {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            p2pmentor Beta Documentation
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            Planting the first beta seed of peer to peer mentorship. Teach, learn, and mentor without intermediaries. Own your data.
          </p>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <h2 className="text-2xl font-bold mb-4">Table of Contents</h2>
          {renderFileTree(files, 0, true)}
        </div>

        <div className="mt-12 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-3">Getting Started</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <strong>Builders:</strong> Start with <Link href="/docs/architecture/overview" className="text-blue-600 dark:text-blue-400 hover:underline">Architecture</Link> and <Link href="/docs/arkiv/overview" className="text-blue-600 dark:text-blue-400 hover:underline">Arkiv Integration</Link>
            </li>
            <li>
              <strong>Designers/PMs:</strong> Start with <Link href="/docs/user-flows/overview" className="text-blue-600 dark:text-blue-400 hover:underline">User Flows</Link>
            </li>
            <li>
              <strong>Users:</strong> Start with <Link href="/docs/introduction/getting-started" className="text-blue-600 dark:text-blue-400 hover:underline">Getting Started</Link>
            </li>
          </ul>
        </div>
      </div>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading documentation...</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-screen bg-white dark:bg-gray-900">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4 overflow-y-auto fixed left-0 top-0 bottom-0">
          <div className="mb-4">
            <Link href="/docs" className="text-lg font-bold text-gray-900 dark:text-white">
              p2pmentor Docs
            </Link>
          </div>
          <nav>{renderFileTree(files)}</nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 ml-64">
          <article className="max-w-4xl mx-auto px-8 py-12">
            {/* Show table of contents for root /docs */}
            {!currentPath ? (
              renderTableOfContents()
            ) : (
              <>
                {/* Markdown content */}
                <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                </div>

                {/* Git history banner */}
                {gitHistory && gitHistory.date && (
                  <div className="mt-12 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                      <div>
                        <span className="font-medium">Last updated:</span>{' '}
                        {formatDate(gitHistory.date)}
                        {gitHistory.author && (
                          <>
                            {' '}by <span className="font-medium">{gitHistory.author}</span>
                          </>
                        )}
                      </div>
                      {gitHistory.hash && (
                        <a
                          href={`https://github.com/understories/p2pmentor/commit/${gitHistory.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View changes →
                        </a>
                      )}
                    </div>
                    {gitHistory.message && (
                      <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                        {gitHistory.message}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </article>
        </main>
      </div>
    </>
  );
}
