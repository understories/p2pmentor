/**
 * Forest Pulse Stats Component
 * 
 * Displays high-level metrics (Asks, Offers, Matches) as organic glowing cards.
 * Part of Network page "Canopy Map" transformation.
 */

'use client';

import { useTheme } from '@/lib/theme';

interface ForestPulseStatsProps {
  asksCount: number;
  offersCount: number;
  matchesCount: number;
  matchesLabel?: string; // Optional custom label for matches (default: "Matches")
  onStatClick?: (type: 'asks' | 'offers' | 'matches') => void;
}

export function ForestPulseStats({
  asksCount,
  offersCount,
  matchesCount,
  matchesLabel = 'Matches',
  onStatClick,
}: ForestPulseStatsProps) {
  const { theme } = useTheme();

  const stats = [
    {
      label: 'Asks',
      count: asksCount,
      description: 'Learning requests',
      icon: '🌱',
      type: 'asks' as const,
      color: theme === 'dark' 
        ? 'rgba(34, 197, 94, 0.15)' 
        : 'rgba(34, 197, 94, 0.1)',
      borderColor: theme === 'dark'
        ? 'rgba(34, 197, 94, 0.4)'
        : 'rgba(34, 197, 94, 0.3)',
    },
    {
      label: 'Offers',
      count: offersCount,
      description: 'Teaching offers',
      icon: '🌿',
      type: 'offers' as const,
      color: theme === 'dark'
        ? 'rgba(34, 197, 94, 0.15)'
        : 'rgba(34, 197, 94, 0.1)',
      borderColor: theme === 'dark'
        ? 'rgba(34, 197, 94, 0.4)'
        : 'rgba(34, 197, 94, 0.3)',
    },
    {
      label: matchesLabel,
      count: matchesCount,
      description: 'Skill matches',
      icon: '✨',
      type: 'matches' as const,
      color: theme === 'dark'
        ? 'rgba(255, 200, 100, 0.15)'
        : 'rgba(255, 200, 100, 0.1)',
      borderColor: theme === 'dark'
        ? 'rgba(255, 200, 100, 0.4)'
        : 'rgba(255, 200, 100, 0.3)',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {stats.map((stat) => (
        <button
          key={stat.type}
          onClick={() => onStatClick?.(stat.type)}
          className={`
            relative p-4 rounded-xl border transition-all duration-200
            ${onStatClick ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
          `}
          style={{
            backgroundColor: stat.color,
            borderColor: stat.borderColor,
            boxShadow: theme === 'dark'
              ? `0 0 12px ${stat.borderColor}, inset 0 0 8px ${stat.color}`
              : `0 2px 8px ${stat.borderColor}`,
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{stat.icon}</span>
            <div className="flex-1 text-left">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                {stat.count}
              </div>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
                {stat.label}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {stat.description}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
