/** Due-date pill state (§3.2, AC16). Pure: callers pass `now`, so tests pin the clock. */

export type DueState = 'done' | 'overdue' | 'soon' | 'later';

const SOON_MS = 48 * 60 * 60 * 1000;

export function dueState(dueAt: string | null, dueCompletedAt: string | null, now: Date): DueState | null {
  if (!dueAt) return null;
  if (dueCompletedAt) return 'done';
  const remaining = new Date(dueAt).getTime() - now.getTime();
  if (remaining < 0) return 'overdue';
  if (remaining < SOON_MS) return 'soon';
  return 'later';
}

export const DUE_CLASSES: Record<DueState, string> = {
  later: 'bg-subtle text-secondary-foreground',
  soon: 'bg-warning-muted text-warning-text',
  overdue: 'bg-danger-muted text-danger-text',
  done: 'bg-success-muted text-success-text',
};

export function formatDue(dueAt: string, now: Date): string {
  const d = new Date(dueAt);
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}
