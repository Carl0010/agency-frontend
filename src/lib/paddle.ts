/**
 * Paddle.js, loaded from Paddle's CDN only on `/pay`. Paddle is the merchant of record: card details
 * are entered in its checkout overlay and never touch this app or the API (AC2). The client-side
 * token is public by design; it can only open checkouts.
 */

export type PaddleEnvironment = 'sandbox' | 'production';

export const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? '';
export const PADDLE_ENVIRONMENT: PaddleEnvironment = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';

const SCRIPT = 'https://cdn.paddle.com/paddle/v2/paddle.js';

export interface PaddleCheckoutEvent {
  name?: string;
}

export interface PaddleJs {
  Environment: { set(environment: 'sandbox'): void };
  Initialize(options: {
    token: string;
    eventCallback?: (event: PaddleCheckoutEvent) => void;
    checkout?: { settings: { displayMode: 'overlay'; theme: 'light' | 'dark'; successUrl?: string; allowLogout?: boolean } };
  }): void;
}

declare global {
  interface Window {
    Paddle?: PaddleJs;
  }
}

let loading: Promise<PaddleJs> | null = null;

/** Adds Paddle.js once; rejects if it can't load (offline, blocked by an extension). */
export function loadPaddle(): Promise<PaddleJs> {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  loading ??= new Promise<PaddleJs>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => (window.Paddle ? resolve(window.Paddle) : reject(new Error('Paddle.js did not start')));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error('Paddle.js could not load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Where `/pay` may send someone afterwards: a path on this site, never another origin. */
export function safeReturnPath(next: string | null): string {
  const controlChar = [...(next ?? '')].some((c) => c.charCodeAt(0) < 0x20);
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\') || controlChar) return '/';
  return next;
}

/** The return path with `checkout=<result>` added, keeping any query it already has. */
export function withCheckoutResult(path: string, result: 'success' | 'canceled'): string {
  return `${path}${path.includes('?') ? '&' : '?'}checkout=${result}`;
}
