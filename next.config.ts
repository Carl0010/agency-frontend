import type { NextConfig } from 'next';

/**
 * The browser talks to the API through this origin (`/api/v1/*` is proxied),
 * so the httpOnly refresh cookie is first-party and no CORS is involved.
 * Only the realtime socket connects to the API origin directly.
 * Rewrites are fixed at build time: set API_INTERNAL_URL (and NEXT_PUBLIC_WS_URL) when building.
 * In the Docker deployment Caddy routes /api and /ws to the API before they reach Next.js.
 */
const apiOrigin = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4100';

const config: NextConfig = {
  reactStrictMode: true,
  // Quiet Pro ships TypeScript sources (vendor/carl0010-quiet-pro-*.tgz).
  transpilePackages: ['@carl0010/quiet-pro'],
  poweredByHeader: false,
  // A self-contained server (.next/standalone) for the Docker image; `next start` still works.
  output: 'standalone',
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }];
  },
};

export default config;
