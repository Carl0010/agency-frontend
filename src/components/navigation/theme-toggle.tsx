'use client';

import { useSyncExternalStore } from 'react';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui';

type Theme = 'light' | 'dark';
const eventName = 'agency:theme';
function snapshot(): Theme { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
function serverSnapshot(): Theme { return 'light'; }
function subscribe(notify: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  function followSystem() {
    let saved: string | null = null;
    try { saved = localStorage.getItem(eventName); } catch { /* Storage can be disabled. */ }
    if (saved !== 'light' && saved !== 'dark') document.documentElement.dataset.theme = media.matches ? 'dark' : 'light';
    notify();
  }
  function syncStorage(event: StorageEvent) {
    if (event.key !== eventName && event.key !== null) return;
    if (event.newValue === 'light' || event.newValue === 'dark') document.documentElement.dataset.theme = event.newValue;
    else followSystem();
    notify();
  }
  window.addEventListener(eventName, notify);
  window.addEventListener('storage', syncStorage);
  media.addEventListener('change', followSystem);
  return () => {
    window.removeEventListener(eventName, notify);
    window.removeEventListener('storage', syncStorage);
    media.removeEventListener('change', followSystem);
  };
}
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const target = theme === 'dark' ? 'light' : 'dark';
  return <Button variant="ghost" aria-label={`Switch to ${target} mode`} onClick={() => {
    document.documentElement.dataset.theme = target;
    try { localStorage.setItem(eventName, target); } catch { /* Apply for this page even without storage. */ }
    window.dispatchEvent(new Event(eventName));
  }}><Icon name={target === 'dark' ? 'moon' : 'sun'} /><span className="text-label">{target === 'dark' ? 'Dark mode' : 'Light mode'}</span></Button>;
}
