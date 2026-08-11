'use client';

import React, { createContext, useContext } from 'react';

type Theme = 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * The marketplace uses one intentionally strict visual system. The context is
 * retained for compatibility with existing consumers, but alternate themes are
 * not exposed or persisted.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const toggleTheme = () => undefined;

  return (
    <ThemeContext.Provider value={{ theme: 'dark', toggleTheme }}>
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
