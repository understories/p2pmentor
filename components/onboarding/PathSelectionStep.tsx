/**
 * Path Selection Step Component
 * 
 * Step 3: Choose one of four paths (Ask, Offer, Network, Community)
 */

'use client';

import { useState } from 'react';

interface PathSelectionStepProps {
  onSelectPath: (path: 'ask' | 'offer' | 'network' | 'community') => void;
}

export function PathSelectionStep({ onSelectPath }: PathSelectionStepProps) {
  const [selectedPath, setSelectedPath] = useState<'ask' | 'offer' | 'network' | 'community' | null>(null);

  const paths = [
    {
      id: 'ask' as const,
      title: 'Create an Ask',
      description: 'What are you seeking?',
      icon: '🎓',
      color: 'purple',
      glowColor: 'rgba(168, 85, 247, 0.3)',
    },
    {
      id: 'offer' as const,
      title: 'Create an Offer',
      description: 'What can you share?',
      icon: '💎',
      color: 'cyan',
      glowColor: 'rgba(6, 182, 212, 0.3)',
    },
    {
      id: 'network' as const,
      title: 'Explore the Network',
      description: 'Meet fellow travelers',
      icon: '🌐',
      color: 'white',
      glowColor: 'rgba(255, 255, 255, 0.2)',
    },
    {
      id: 'community' as const,
      title: 'Join a Community',
      description: 'Join a learning grove',
      icon: '🌲',
      color: 'green',
      glowColor: 'rgba(34, 197, 94, 0.3)',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">There are four paths through the Garden</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Follow any one to begin. You can explore others later.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {paths.map((path) => (
          <button
            key={path.id}
            onClick={() => {
              setSelectedPath(path.id);
              setTimeout(() => onSelectPath(path.id), 300); // Small delay for visual feedback
            }}
            className={`
              relative p-6 rounded-lg border-2 transition-all duration-300
              ${selectedPath === path.id
                ? 'border-green-500 scale-105'
                : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
              }
              bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm
              hover:shadow-lg
            `}
            style={{
              boxShadow: selectedPath === path.id
                ? `0 0 20px ${path.glowColor}`
                : undefined,
            }}
          >
            <div className="text-4xl mb-3">{path.icon}</div>
            <h3 className="font-bold text-lg mb-1">{path.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{path.description}</p>
            
            {selectedPath === path.id && (
              <div className="absolute top-2 right-2">
                <span className="text-green-500 text-xl">✓</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
