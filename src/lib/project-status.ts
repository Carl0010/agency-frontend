import type { ProjectStatus } from './types';

export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'muted';

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; tone: StatusTone }[] = [
  { value: 'planned', label: 'Planned', tone: 'neutral' },
  { value: 'in_progress', label: 'In progress', tone: 'info' },
  { value: 'on_hold', label: 'On hold', tone: 'warning' },
  { value: 'completed', label: 'Completed', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'muted' },
];

export const OPEN_STATUSES: ProjectStatus[] = ['planned', 'in_progress', 'on_hold'];

/** Unknown or absent values render as In progress, like unknown project icons. */
export function projectStatus(value: string | undefined | null) {
  return PROJECT_STATUSES.find((status) => status.value === value) ?? PROJECT_STATUSES[1]!;
}

/** The Projects screen filter: Open is the default and every choice is answered by the API. */
export type StatusFilter = 'open' | 'completed' | 'cancelled' | 'all';
export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' }, { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }, { value: 'all', label: 'All' },
];

export function statusFilter(value: string | null): StatusFilter {
  return STATUS_FILTERS.find((filter) => filter.value === value)?.value ?? 'open';
}

/** `status=` query value for a filter, or null for All (no parameter). */
export function statusParam(filter: StatusFilter): string | null {
  if (filter === 'all') return null;
  return filter === 'open' ? OPEN_STATUSES.join(',') : filter;
}

/** "Since 21 Oct"; null until the first change. */
export function statusSince(changedAt: string | null | undefined): string | null {
  if (!changedAt) return null;
  return `Since ${new Date(changedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}
