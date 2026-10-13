import { DUE_CLASSES, dueState, formatDue } from '@/lib/due';

export function DuePill({ dueAt, dueCompletedAt, now }: { dueAt: string | null; dueCompletedAt: string | null; now: Date }) {
  const state = dueState(dueAt, dueCompletedAt, now);
  if (!state || !dueAt) return null;
  const label = { later: 'Due', soon: 'Due soon', overdue: 'Overdue', done: 'Done' }[state];
  return (
    <span
      data-testid="due-pill"
      data-state={state}
      title={`${label}: ${new Date(dueAt).toLocaleString()}`}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${DUE_CLASSES[state]}`}
    >
      {state === 'done' ? '✓ ' : ''}
      {formatDue(dueAt, now)}
    </span>
  );
}
