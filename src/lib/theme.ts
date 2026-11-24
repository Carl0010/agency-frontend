'use client';

import { useSyncExternalStore } from 'react';

/**
 * Light/dark theme, kept in this browser (theme is UI state, not account data). `system`
 * follows the OS; THEME_INIT applies the same rule before paint.
 */
export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

const KEY = 'agency:theme';

function stored(): ThemePreference {
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch { /* Storage can be disabled. */ }
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Without storage the choice still holds for this page.
let memory: ThemePreference | null = null;

function apply(preference: ThemePreference) {
  document.documentElement.dataset.theme = preference === 'system' ? systemTheme() : preference;
}

function subscribe(notify: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  function followSystem() {
    if ((memory ?? stored()) === 'system') apply('system');
    notify();
  }
  function syncStorage(event: StorageEvent) {
    if (event.key !== KEY && event.key !== null) return;
    memory = null;
    apply(stored());
    notify();
  }
  window.addEventListener(KEY, notify);
  window.addEventListener('storage', syncStorage);
  media.addEventListener('change', followSystem);
  return () => {
    window.removeEventListener(KEY, notify);
    window.removeEventListener('storage', syncStorage);
    media.removeEventListener('change', followSystem);
  };
}

/** Save and apply a theme choice; other tabs follow through the storage event. */
export function setThemePreference(preference: ThemePreference) {
  memory = preference;
  apply(preference);
  try {
    if (preference === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, preference);
  } catch { /* Apply for this page even without storage. */ }
  window.dispatchEvent(new Event(KEY));
}

/** The saved choice, including `system`. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => memory ?? stored(), () => 'system');
}

/**
 * Mounted once in the root layout: keeps every page in step with other tabs and, under
 * Match system, with the OS setting, whether or not Appearance is open.
 */
export function ThemeSync() {
  useThemePreference();
  return null;
}
