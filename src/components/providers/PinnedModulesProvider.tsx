"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const STORAGE_KEY = '7th_pinned_modules';

interface PinnedModulesContextType {
  pinnedHrefs: string[];
  togglePin: (href: string) => void;
  isPinned: (href: string) => boolean;
  isLoaded: boolean;
}

const PinnedModulesContext = createContext<PinnedModulesContextType | undefined>(undefined);

export function PinnedModulesProvider({ children }: { children: ReactNode }) {
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setPinnedHrefs(JSON.parse(saved));
      } catch (e) {
        setPinnedHrefs([]);
      }
    }
    setIsLoaded(true);
  }, []);

  const togglePin = (href: string) => {
    const newPinned = pinnedHrefs.includes(href)
      ? pinnedHrefs.filter(h => h !== href)
      : [...pinnedHrefs, href];
    
    setPinnedHrefs(newPinned);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPinned));
  };

  const isPinned = (href: string) => pinnedHrefs.includes(href);

  return (
    <PinnedModulesContext.Provider value={{ pinnedHrefs, togglePin, isPinned, isLoaded }}>
      {children}
    </PinnedModulesContext.Provider>
  );
}

export function usePinnedModulesContext() {
  const context = useContext(PinnedModulesContext);
  if (context === undefined) {
    throw new Error('usePinnedModulesContext must be used within a PinnedModulesProvider');
  }
  return context;
}
