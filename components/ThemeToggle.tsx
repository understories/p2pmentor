/**
 * Theme toggle button
 * 
 * Toggle between light and dark mode with forest aesthetic styling.
 */

'use client';

import { useTheme } from '@/lib/theme';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useTheme();
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return null;
  }

  return (
    <button
      onClick={toggleTheme}
      className="hidden md:block fixed top-4 right-4 z-50 p-3 rounded-lg border transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{
        backgroundColor: theme === 'dark' 
          ? 'rgba(5, 20, 5, 0.3)' 
          : 'rgba(240, 240, 240, 0.9)',
        borderColor: theme === 'dark'
          ? 'rgba(150, 255, 150, 0.3)'
          : 'rgba(0, 0, 0, 0.1)',
        color: theme === 'dark'
          ? 'rgba(200, 255, 200, 0.9)'
          : '#495057',
        boxShadow: theme === 'dark'
          ? '0 0 20px rgba(100, 255, 100, 0.1), inset 0 0 20px rgba(100, 255, 100, 0.05)'
          : '0 1px 3px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(10px)',
      }}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="text-xl" style={{ 
        textShadow: theme === 'dark' 
          ? '0 0 8px rgba(150, 255, 150, 0.4), 0 0 15px rgba(100, 255, 100, 0.2)'
          : 'none'
      }}>
        {theme === 'dark' ? '☀️' : '🌙'}
      </span>
    </button>
  );
}

