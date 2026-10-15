import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { THEME_INIT } from '@/lib/theme-init';
import { Providers } from './providers';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

export const metadata: Metadata = { title: 'Agency', description: 'Boards and client work for small agencies.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT }} /></head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
