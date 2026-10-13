'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/time';
import type { SearchHit, SearchResult, SearchType } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { useWorkspace } from '@/lib/workspace';
import { countLabel, Snippet, TYPE_LABEL } from './snippet';

const ORDER: SearchType[] = ['card', 'comment', 'message'];
export const DEBOUNCE_MS = 250;
/** Header search button → palette, without prop drilling. */
export const OPEN_EVENT = 'agency:open-search';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * `⌘K` / `Ctrl+K` palette, mounted for every `/w/*` route (§5.4, AC26).
 * Queries after 2+ characters with a 250ms debounce; `↵` navigates and `⌘↵`
 * opens in a new tab. Not mounted in the guest portal.
 */
export function CommandPalette() {
  const ws = useWorkspace();
  const router = useRouter();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(q.trim(), DEBOUNCE_MS);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);
  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.select());
  }, [open]);

  const results = useQuery({
    queryKey: ['search', ws.id, 'palette', debounced],
    queryFn: ({ signal }) => api.get<SearchResult>(`/workspaces/${ws.id}/search?q=${encodeURIComponent(debounced)}`, signal),
    enabled: open && debounced.length >= 2,
    staleTime: 10_000,
  });
  const items: SearchHit[] = results.data ? ORDER.flatMap((t) => results.data.groups[t].items.slice(0, 5)) : [];

  if (!open) return null;

  function go(hit: SearchHit | undefined, newTab: boolean) {
    if (!hit) {
      if (debounced.length >= 2) {
        setOpen(false);
        router.push(`/w/${ws.slug}/search?q=${encodeURIComponent(debounced)}`);
      }
      return;
    }
    if (newTab) {
      window.open(hit.url, '_blank', 'noopener');
      return;
    }
    setOpen(false);
    router.push(hit.url);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(items[active], e.metaKey || e.ctrlKey);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/30 p-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Search" onMouseDown={() => setOpen(false)}>
      <div className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()} data-testid="command-palette">
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          aria-label="Search cards, comments and messages"
          placeholder='Search… try "exact phrase" or -exclude'
          className="w-full border-b border-slate-200 px-4 py-3 text-base outline-none"
        />
        <div className="max-h-[60vh] overflow-y-auto">
          {debounced.length < 2 ? (
            <p className="p-4 text-sm text-slate-500">Type at least 2 characters.</p>
          ) : results.isPending ? (
            <p className="p-4 text-sm text-slate-500">Searching…</p>
          ) : results.data && items.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No results for “{debounced}”.</p>
          ) : results.data ? (
            <>
              <p className="px-4 pt-2 text-xs text-slate-500" data-testid="search-counts">
                {ORDER.map((t) => `${TYPE_LABEL[t]} (${countLabel(results.data.groups[t])})`).join(' · ')}
                {results.data.fallback ? ' · showing close matches' : ''}
              </p>
              <ul role="listbox" aria-label="Results">
                {items.map((hit, i) => (
                  <li
                    key={`${hit.type}:${hit.id}`}
                    role="option"
                    aria-selected={i === active}
                    data-testid="search-result"
                    onMouseEnter={() => setActive(i)}
                    onClick={(e) => go(hit, e.metaKey || e.ctrlKey)}
                    className={`cursor-pointer border-b border-slate-100 px-4 py-2 ${i === active ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-baseline gap-2 text-xs text-slate-500">
                      <span className="font-medium uppercase">{hit.type}</span>
                      <span className="truncate">{hit.projectName}</span>
                      <span className="ml-auto shrink-0">{timeAgo(hit.createdAt, now)}</span>
                    </div>
                    <div className="truncate text-sm font-medium">{hit.title}</div>
                    <Snippet parts={hit.snippet} />
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => go(undefined, false)} className="w-full px-4 py-2 text-left text-sm text-blue-700 hover:bg-slate-50">
                See all results for “{debounced}”
              </button>
            </>
          ) : (
            <p className="p-4 text-sm text-red-700">Search failed.</p>
          )}
        </div>
      </div>
    </div>
  );
}
