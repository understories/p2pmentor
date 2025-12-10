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
  const currentPath = path ? path.join('/') : 'introduction';

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

  const renderFileTree = (files: DocFile[], level = 0) => {
    return (
      <ul className={level === 0 ? 'space-y-1' : 'ml-4 mt-1 space-y-1'}>
        {files.map((file) => (
          <li key={file.path}>
            {file.isDirectory ? (
              <>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider py-2 px-2">
                  {file.name}
                </div>
                {file.children && renderFileTree(file.children, level + 1)}
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
          </article>
        </main>
      </div>
    </>
  );
}
