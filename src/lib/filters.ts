import type { CardTile } from './types';

/**
 * Board filters (§3.2, AC22). State lives in the URL query so a filtered
 * board survives a reload and can be shared. Values within one filter are
 * OR'd; different filters compose with AND.
 */

export type DueFilter = 'overdue' | 'week' | 'none';
const DUE_FILTERS: readonly DueFilter[] = ['overdue', 'week', 'none'];

export interface BoardFilters {
  assignees: string[];
  labels: string[];
  due: DueFilter | null;
  q: string;
}

export const EMPTY_FILTERS: BoardFilters = { assignees: [], labels: [], due: null, q: '' };

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

export function parseFilters(params: URLSearchParams): BoardFilters {
  const due = params.get('due');
  return {
    assignees: list(params.get('assignee')),
    labels: list(params.get('label')),
    due: DUE_FILTERS.includes(due as DueFilter) ? (due as DueFilter) : null,
    q: params.get('q') ?? '',
  };
}

/** Writes filters into `params`, preserving unrelated keys. */
export function writeFilters(params: URLSearchParams, f: BoardFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (k: string, v: string) => (v ? next.set(k, v) : next.delete(k));
  set('assignee', f.assignees.join(','));
  set('label', f.labels.join(','));
  set('due', f.due ?? '');
  set('q', f.q.trim() ? f.q : '');
  return next;
}

export function isFiltering(f: BoardFilters): boolean {
  return f.assignees.length > 0 || f.labels.length > 0 || f.due !== null || f.q.trim() !== '';
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function matchesFilters(card: CardTile, f: BoardFilters, now: Date): boolean {
  if (f.assignees.length && !card.assignees.some((a) => f.assignees.includes(a.id))) return false;
  if (f.labels.length && !card.labels.some((l) => f.labels.includes(l.id))) return false;
  if (f.due) {
    const due = card.dueAt ? new Date(card.dueAt).getTime() : null;
    const open = !card.dueCompletedAt;
    if (f.due === 'none' && due !== null) return false;
    if (f.due === 'overdue' && !(due !== null && open && due < now.getTime())) return false;
    if (f.due === 'week' && !(due !== null && due >= now.getTime() && due <= now.getTime() + WEEK_MS)) return false;
  }
  const q = f.q.trim().toLowerCase();
  if (q && !card.title.toLowerCase().includes(q) && !String(card.number).startsWith(q.replace(/^#/, ''))) return false;
  return true;
}
