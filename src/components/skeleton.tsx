import type { ReactNode } from 'react';
import { BrandMark } from '@/components/icon';

/** Decorative shapes share semantic surfaces in both themes. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton-shape block rounded-md bg-muted ${className}`} />;
}

function LoadingRegion({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <div role="status" aria-busy="true" className={`skeleton-region ${className}`} data-testid="loading-skeleton">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true">{children}</div>
  </div>;
}

/** Reserve the shape of the incoming content without presenting fake controls. */
export function LoadingSkeleton({ variant = 'rows', label = 'Loading content', count = 3, className = '' }: {
  variant?: 'rows' | 'cards' | 'form' | 'messages'; label?: string; count?: number; className?: string;
}) {
  return <LoadingRegion label={label} className={className}>
    <div className={variant === 'cards' ? 'grid gap-3 sm:grid-cols-2' : 'space-y-4'}>
      {Array.from({ length: count }, (_, index) => variant === 'form' ? <div key={index} className="space-y-2">
        <Skeleton className="h-3 w-24" /><Skeleton className="h-10 w-full" />
      </div> : variant === 'messages' ? <div key={index} className="flex gap-3 py-2">
        <Skeleton className="size-8 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className={index % 2 ? 'h-3 w-3/5' : 'h-3 w-4/5'} /><Skeleton className="h-3 w-2/5" /></div>
      </div> : <div key={index} className={`flex items-center gap-3 ${variant === 'cards' ? 'min-h-24 rounded-lg border border-border bg-surface p-4' : 'min-h-12 py-2'}`}>
        <Skeleton className={variant === 'cards' ? 'size-10 shrink-0 rounded-lg' : 'size-8 shrink-0 rounded-full'} /><div className="min-w-0 flex-1 space-y-2"><Skeleton className={index % 2 ? 'h-3 w-1/2' : 'h-3 w-2/3'} /><Skeleton className="h-2.5 w-1/3" /></div>
      </div>)}
    </div>
  </LoadingRegion>;
}

/**
 * Full-screen loader for app boot and redirects, before any layout exists to hold a skeleton:
 * the brand mark inside a spinning ring, with the product name below. It fades in after a short
 * delay so quick loads never flash it. Content inside a page keeps using the skeletons above.
 */
export function AppLoader({ label = 'Loading Agency' }: { label?: string }) {
  return <div role="status" aria-busy="true" className="app-loader flex min-h-dvh flex-col items-center justify-center gap-5 p-6" data-testid="app-loader">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="relative grid size-24 place-items-center">
      <svg viewBox="0 0 96 96" className="app-loader-ring absolute inset-0 size-full" fill="none">
        <circle cx="48" cy="48" r="44" strokeWidth="4" className="stroke-muted" />
        <circle cx="48" cy="48" r="44" strokeWidth="4" strokeLinecap="round" pathLength="100" strokeDasharray="28 72" className="stroke-primary" />
      </svg>
      <BrandMark className="size-12 rounded-xl" glyphClassName="size-7" />
    </div>
    <span aria-hidden="true" className="text-page font-semibold tracking-tight">Agency</span>
  </div>;
}

export function CardSkeleton() {
  return <LoadingRegion label="Loading card details" className="space-y-6" >
    <div className="space-y-6">
      <div className="space-y-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-4/5" /><Skeleton className="h-3 w-2/5" /></div>
      <div className="flex gap-2"><Skeleton className="h-7 w-20 rounded-full" /><Skeleton className="h-7 w-24 rounded-full" /></div>
      <div className="space-y-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" /></div>
      <div className="space-y-3 border-t border-border pt-5"><Skeleton className="h-3 w-24" /><Skeleton className="h-20 w-full" /><Skeleton className="h-9 w-24" /></div>
    </div>
  </LoadingRegion>;
}

export function BoardSkeleton({ view = 'kanban' }: { view?: 'kanban' | 'list' | 'calendar' }) {
  return <LoadingRegion label="Loading board" className="h-full min-h-0 overflow-hidden bg-board-canvas">
    <div className="flex items-center gap-3 border-b border-border bg-surface p-4"><Skeleton className="size-8" /><Skeleton className="h-5 w-40" /></div>
    <div className="flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3"><Skeleton className="h-9 w-36" /><Skeleton className="h-9 w-48 max-w-[40%]" /></div>
    {view === 'calendar' ? <div className="m-4 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">{Array.from({ length: 35 }, (_, day) => <div key={day} className="min-h-24 bg-surface p-2"><Skeleton className="size-5 rounded-full" /></div>)}</div> : view === 'list' ? <div className="m-4 overflow-hidden rounded-lg border border-border bg-surface">{[0, 1, 2].map((section) => <div key={section}><div className="border-b border-border bg-subtle p-4"><Skeleton className="h-4 w-32" /></div>{[0, 1].map((row) => <div key={row} className="flex gap-6 border-b border-border-subtle p-4"><Skeleton className="h-3 w-12" /><Skeleton className="h-3 w-1/2" /><Skeleton className="ml-auto hidden h-3 w-20 sm:block" /></div>)}</div>)}</div> : <div className="flex items-start gap-4 overflow-hidden p-4">{[0, 1, 2].map((column) => <div key={column} className={`w-80 shrink-0 rounded-xl border border-border bg-subtle p-3 ${column > 0 ? 'hidden sm:block' : ''}`}>
      <div className="mb-4 flex items-center justify-between p-1"><Skeleton className="h-4 w-28" /><Skeleton className="size-5" /></div>
      {[0, 1, 2].slice(0, column === 1 ? 2 : 3).map((card) => <div key={card} className="mb-3 space-y-4 rounded-lg border border-border bg-surface p-4"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /><div className="flex items-center justify-between border-t border-border-subtle pt-3"><Skeleton className="h-3 w-12" /><Skeleton className="size-6 rounded-full" /></div></div>)}
    </div>)}</div>}
  </LoadingRegion>;
}
