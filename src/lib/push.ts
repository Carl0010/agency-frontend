'use client';

import { api } from './api';

/**
 * Web Push (D3) browser side. The permission prompt is only ever requested
 * from the in-app explainer, and only from a user's second-or-later browser
 * session — never on first load (§4.3, AC16).
 */

const SESSIONS = (userId: string) => `agency.sessions.${userId}`;
const COUNTED = (userId: string) => `agency.session-counted.${userId}`;
const DISMISSED = (userId: string) => `agency.push-explainer-dismissed.${userId}`;

/**
 * Counts browser sessions per user: sessionStorage lives exactly as long as a
 * tab's session, so each new session increments the persistent counter once.
 */
export function countSession(userId: string): number {
  try {
    const n = Number(window.localStorage.getItem(SESSIONS(userId)) ?? '0');
    if (window.sessionStorage.getItem(COUNTED(userId))) return n;
    window.sessionStorage.setItem(COUNTED(userId), '1');
    window.localStorage.setItem(SESSIONS(userId), String(n + 1));
    return n + 1;
  } catch {
    return 1; // storage blocked: behave like a first session (never prompt)
  }
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export function explainerDismissed(userId: string): boolean {
  try {
    return window.localStorage.getItem(DISMISSED(userId)) === '1';
  } catch {
    return true;
  }
}

export function dismissExplainer(userId: string): void {
  try {
    window.localStorage.setItem(DISMISSED(userId), '1');
  } catch {
    // ignore
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Registers the service worker and stores this browser's subscription with the API. No prompt. */
export async function subscribeThisBrowser(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const cfg = await api.get<{ enabled: boolean; vapidPublicKey: string | null }>('/push-subscriptions/config');
  if (!cfg.enabled || !cfg.vapidPublicKey) return false;
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(cfg.vapidPublicKey) }));
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false;
  await api.post('/push-subscriptions', {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent.slice(0, 500),
  });
  return true;
}

/** Called only from the explainer's "Enable notifications" button. */
export async function enablePush(): Promise<NotificationPermission> {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') await subscribeThisBrowser();
  return permission;
}
