import { useState, useEffect } from 'react';

const STORAGE_KEY = '7th_pinned_modules';

export function usePinnedModules() {
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

  return { pinnedHrefs, togglePin, isPinned, isLoaded };
}
