import { useEffect } from 'react';
import type { ThemePreference } from '../../domain/types';

const STORAGE_KEY = 'goalbudget-theme';

function applyTheme(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  // Keep the status bar / Safari chrome tint in sync with the chosen theme.
  const color = dark ? '#000000' : '#f2f2f0';
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = color;
  });
}

/** Applies the theme preference (System / Light / Dark) and follows iOS appearance changes. */
export function useTheme(pref: ThemePreference | undefined): void {
  useEffect(() => {
    if (!pref) return;
    applyTheme(pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // Private mode: the pre-paint hint is only an optimisation.
    }
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
