/**
 * Path Selection Step Component
 * 
 * Step 3: Choose one of four paths (Ask, Offer, Network, Community)
 */

'use client';

import { useState } from 'react';

interface PathSelectionStepProps {
  onSelectPath: (path: 'ask' | 'offer') => void;
}

export function PathSelectionStep({ onSelectPath }: PathSelectionStepProps) {
  const [selectedPath, setSelectedPath] = useState<'ask' | 'offer' | null>(null);

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
          Choose your path
        </h2>
        <p 
          className="text-gray-200 dark:text-gray-300 text-lg mb-12 drop-shadow-md"
          style={{
            textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
          }}
        >
          Follow one path to begin. You can explore others later.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 max-w-2xl mx-auto">
        {paths.map((path) => (
          <button
            key={path.id}
            onClick={() => {
              setSelectedPath(path.id);
              // Small delay for visual feedback before transitioning
              setTimeout(() => onSelectPath(path.id), 300);
            }}
            className="relative flex flex-col items-center justify-center transition-all duration-300 group"
            style={{
              filter: selectedPath === path.id
                ? `drop-shadow(0 0 20px ${path.glowColor}) drop-shadow(0 0 40px ${path.glowColor})`
                : undefined,
            }}
            onMouseEnter={(e) => {
              if (selectedPath !== path.id) {
                e.currentTarget.style.filter = `drop-shadow(0 0 15px ${path.glowColor}) drop-shadow(0 0 30px ${path.glowColor})`;
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedPath !== path.id) {
                e.currentTarget.style.filter = '';
                e.currentTarget.style.transform = '';
              }
            }}
          >
            <div 
              className="text-6xl md:text-7xl mb-4 transition-all duration-300"
              style={{
                transform: selectedPath === path.id ? 'scale(1.1)' : 'scale(1)',
                filter: selectedPath === path.id
                  ? `drop-shadow(0 0 15px ${path.glowColor})`
                  : undefined,
              }}
            >
              {path.icon}
            </div>
            <h3 
              className="font-bold text-2xl md:text-3xl mb-2 text-white dark:text-white drop-shadow-lg transition-all duration-300"
              style={{
                textShadow: selectedPath === path.id
                  ? `0 0 10px ${path.glowColor}, 0 0 20px ${path.glowColor}`
                  : '0 0 10px rgba(0, 0, 0, 0.5)',
              }}
            >
              {path.title}
            </h3>
            <p 
              className="text-base md:text-lg text-gray-200 dark:text-gray-300 drop-shadow-md text-center"
              style={{
                textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
              }}
            >
              {path.description}
            </p>
            
            {selectedPath === path.id && (
              <div className="absolute -top-2 -right-2">
                <span 
                  className="text-green-400 text-3xl drop-shadow-lg"
                  style={{
                    filter: 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.8))',
                  }}
                >
                  ✓
                </span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
