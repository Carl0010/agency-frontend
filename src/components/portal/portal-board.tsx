'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { CardTileView } from '@/components/board/card-tile';
import { Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useProjectRealtime } from '@/lib/realtime';
import type { Board, CardTile, PortalProject } from '@/lib/types';
import { useNow } from '@/lib/use-now';

/**
 * The guest board (§3.6): the same list/card rendering as the workspace board,
 * with no drag, no `+ Add card`, no list menus, no filters and no archive.
 * Assignees never arrive (the API strips them, AC9); tiles are normalised so
 * nothing downstream expects them.
 */
export function PortalBoard({ project }: { project: PortalProject }) {
  const now = useNow();
  const [active, setActive] = useState(0);
  const board = useQuery({
    queryKey: ['board', project.defaultBoardId],
    queryFn: () => api.get<Board>(`/boards/${project.defaultBoardId}`),
  });
  useProjectRealtime(project.id);

  if (board.isPending) return <Spinner />;
  if (board.error) return <p className="p-8 text-center text-slate-600">{errorMessage(board.error)}</p>;
  const lists = board.data.lists;
  const tile = (c: CardTile): CardTile => ({ ...c, assignees: [] });

  return (
    <div className="flex h-full flex-col" data-testid="portal-board">
      {/* < 640px: one list at a time with a horizontal selector (§3.7). */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 bg-white px-2 py-1 sm:hidden" role="tablist" aria-label="Lists">
        {lists.map((l, i) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`tap shrink-0 rounded px-2 text-sm ${i === active ? 'bg-slate-100 font-medium' : 'text-slate-600'}`}
          >
            {l.name}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3">
        {lists.map((l, i) => (
          <section
            key={l.id}
            aria-label={l.name}
            data-testid="portal-list"
            className={`w-full shrink-0 flex-col rounded-lg bg-slate-100 p-2 sm:flex sm:w-72 ${i === active ? 'flex' : 'hidden'}`}
          >
            <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-slate-700">
              {l.name}
              <span className="text-xs font-normal text-slate-500">{l.cards.length}</span>
            </h2>
            <ol className="min-h-0 space-y-2 overflow-y-auto">
              {l.cards.map((c) => (
                <li key={c.id}>
                  <Link href={`/portal/${project.id}/c/${c.id}`} data-testid="portal-card" className="block rounded-md focus-visible:outline-2 focus-visible:outline-blue-600">
                    <CardTileView card={tile(c)} projectKey={project.key} now={now} />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
