/**
 * Theme provider and context
 * 
 * Manages dark/light mode with persistence across page changes.
 * Dark mode matches the landing page forest aesthetic.
 * 
 * Based on mentor-graph's dark mode implementation.
 */

'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start with dark mode for landing page sunrise effect
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage or default to dark
  // Apply immediately to prevent flash of wrong theme
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const saved = localStorage.getItem('theme');
    let initialTheme: Theme = 'dark';
    
    if (saved === 'dark' || saved === 'light') {
      initialTheme = saved;
    }
    
    // Apply theme immediately to prevent flash
    const root = document.documentElement;
    if (initialTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    
    setThemeState(initialTheme);
    setMounted(true);
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return;
    
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    
    // Persist to localStorage
    localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Always provide context, even before mounting
  // This prevents "useTheme must be used within a ThemeProvider" errors
  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

