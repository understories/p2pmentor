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
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h2 
          className="text-4xl md:text-5xl font-bold mb-4 text-white dark:text-white drop-shadow-lg"
          style={{
            textShadow: '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3)',
          }}
        >
          There are four paths through the Garden
        </h2>
        <p 
          className="text-gray-200 dark:text-gray-300 text-lg mb-8 drop-shadow-md"
          style={{
            textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
          }}
        >
          Follow any one to begin. You can explore others later.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {paths.map((path) => (
          <button
            key={path.id}
            onClick={() => {
              setSelectedPath(path.id);
              // Small delay for visual feedback before transitioning
              setTimeout(() => onSelectPath(path.id), 300);
            }}
            className={`
              relative p-6 md:p-8 rounded-xl border-2 transition-all duration-300
              ${selectedPath === path.id
                ? 'border-green-500 scale-105'
                : 'border-white/30 dark:border-white/20 hover:border-green-400'
              }
              bg-white/90 dark:bg-gray-900/90 backdrop-blur-md
              hover:shadow-xl active:scale-95
            `}
            style={{
              boxShadow: selectedPath === path.id
                ? `0 0 30px ${path.glowColor}, 0 0 60px ${path.glowColor}`
                : '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="text-5xl mb-4">{path.icon}</div>
            <h3 className="font-bold text-xl mb-2 text-gray-900 dark:text-gray-100">{path.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{path.description}</p>
            
            {selectedPath === path.id && (
              <div className="absolute top-3 right-3">
                <span className="text-green-500 text-2xl">✓</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
