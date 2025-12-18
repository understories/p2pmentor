'use client';

import { useState } from 'react';

interface DiagramViewerProps {
  src: string;
  alt: string;
  title?: string;
}

export function DiagramViewer({ src, alt, title }: DiagramViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const openFullscreen = () => {
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  const openInNewTab = () => {
    window.open(src, '_blank');
  };

  return (
    <>
      {/* Mini version with fullscreen button */}
      <div className="relative my-4 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900 group">
        <div className="relative w-full flex items-center justify-center" style={{ height: '400px', overflow: 'hidden', backgroundColor: 'white' }}>
          <iframe
            src={src}
            className="border-0"
            style={{ 
              width: '100%',
              height: '100%',
              minHeight: '400px',
            }}
            title={alt}
            loading="lazy"
          />
        </div>
        {/* Fullscreen button in corner */}
        <button
          onClick={openFullscreen}
          className="absolute top-2 right-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md p-2 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="View fullscreen"
          aria-label="View diagram fullscreen"
        >
          <svg
            className="w-5 h-5 text-gray-700 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>
      </div>

      {/* Fullscreen modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={closeFullscreen}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Close button */}
            <button
              onClick={closeFullscreen}
              className="absolute top-4 right-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md p-2 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 z-10"
              title="Close fullscreen"
              aria-label="Close fullscreen"
            >
              <svg
                className="w-6 h-6 text-gray-700 dark:text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            
            {/* Open in new tab button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                openInNewTab();
              }}
              className="absolute top-4 right-20 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md p-2 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 z-10"
              title="Open in new tab"
              aria-label="Open diagram in new tab"
            >
              <svg
                className="w-6 h-6 text-gray-700 dark:text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </button>

            {/* Diagram */}
            <div
              className="relative w-full h-full flex items-center justify-center overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full h-full flex items-center justify-center p-4">
                <iframe
                  src={src}
                  className="border-0 bg-white"
                  style={{ 
                    width: '100%',
                    height: '100%',
                    maxWidth: '95vw',
                    maxHeight: '95vh',
                    aspectRatio: 'auto',
                  }}
                  title={alt}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

