/**
 * Constellation Lines Component
 * 
 * Adds faint connecting lines between nav nodes to create "constellation" effect.
 * Phase 1 enhancement - subtle visual connection between navigation items.
 */

'use client';

import { useTheme } from '@/lib/theme';

interface ConstellationLinesProps {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  activeIndex?: number;
  hoveredIndex?: number;
}

export function ConstellationLines({
  itemCount,
  itemHeight,
  containerHeight,
  activeIndex,
  hoveredIndex,
}: ConstellationLinesProps) {
  const { theme } = useTheme();

  // Only show lines when hovering or when an item is active
  const shouldShow = activeIndex !== undefined || hoveredIndex !== undefined;
  if (!shouldShow || itemCount < 2) {
    return null;
  }

  const lines: Array<{ from: number; to: number; opacity: number }> = [];
  
  // Connect adjacent items
  for (let i = 0; i < itemCount - 1; i++) {
    const fromY = (i * itemHeight) + (itemHeight / 2);
    const toY = ((i + 1) * itemHeight) + (itemHeight / 2);
    
    // Higher opacity if connecting to active/hovered item
    const isConnectedToActive = activeIndex === i || activeIndex === i + 1;
    const isConnectedToHovered = hoveredIndex === i || hoveredIndex === i + 1;
    const opacity = isConnectedToActive ? 0.4 : isConnectedToHovered ? 0.3 : 0.15;
    
    lines.push({ from: fromY, to: toY, opacity });
  }

  return (
    <svg
      className="absolute left-0 top-0 w-full h-full pointer-events-none z-0"
      style={{ height: containerHeight }}
    >
      <defs>
        <linearGradient id="constellationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={theme === 'dark' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)'} />
          <stop offset="100%" stopColor={theme === 'dark' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.1)'} />
        </linearGradient>
      </defs>
      {lines.map((line, index) => (
        <line
          key={index}
          x1="50%"
          y1={line.from}
          x2="50%"
          y2={line.to}
          stroke="url(#constellationGradient)"
          strokeWidth="1"
          opacity={line.opacity}
          style={{
            transition: 'opacity 200ms ease-out',
          }}
        />
      ))}
    </svg>
  );
}
