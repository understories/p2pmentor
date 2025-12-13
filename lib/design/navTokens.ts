/**
 * Navigation Design Tokens
 * 
 * Design tokens for navigation system following forest/garden aesthetic.
 * Phase 0: Subtle glows and node-style enhancements.
 * Phase 1: Full constellation lines and pulse animations.
 */

export const navTokens = {
  node: {
    idle: {
      glow: 'rgba(34, 197, 94, 0.1)', // emerald-500 with 10% opacity
      scale: 1,
    },
    hover: {
      glow: 'rgba(34, 197, 94, 0.3)', // emerald-500 with 30% opacity
      scale: 1.05,
    },
    active: {
      glow: 'rgba(34, 197, 94, 0.5)', // emerald-500 with 50% opacity
      scale: 1.08,
      borderGlow: 'rgba(34, 197, 94, 0.8)', // emerald-500 with 80% opacity
    },
  },
  motion: {
    duration: 150, // ms - Phase 0: keep current 120-200ms transitions
    easing: 'ease-out',
  },
  colors: {
    sprout: {
      green: '#22c55e', // emerald-500
      dark: '#16a34a', // emerald-600
      light: '#4ade80', // emerald-400
    },
    forest: {
      dark: '#020a08', // night-forest gradient start
      mid: '#041712', // night-forest gradient end
      light: '#f0fdf4', // light leaf green
    },
  },
};
