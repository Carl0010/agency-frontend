import type { ImportJob, ImportMemberMatch, ImportStats, ImportStatus, ImportTally } from './types';

/**
 * Pure pieces of the §7 import wizard: reading Trello's authorize redirect,
 * turning mapping-screen choices into a `memberMap`, and the progress and
 * summary numbers. The API owns every count; this only arranges them.
 */

export type TrelloReturn = { token: string } | { error: string } | null;

/**
 * Trello's `callback_method=fragment` lands back on the wizard with
 * `#token=…`, or `#error=…` when the user declines. The token stays in memory
 * and is wiped from the URL so it never reaches history or a shared link (AC30).
 */
export function readTrelloReturn(hash: string): TrelloReturn {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('token');
  if (token && /^[A-Za-z0-9]{32,256}$/.test(token)) return { token };
  if (params.has('error') || params.has('token')) return { error: 'Trello did not grant access. Try Connect Trello again.' };
  return null;
}

/** `''` in a mapping `<select>` means "leave unassigned". */
export type MemberChoices = Record<string, string>;

export function initialChoices(members: ImportMemberMatch[]): MemberChoices {
  return Object.fromEntries(members.map((m) => [m.externalId, m.userId ?? '']));
}

/**
 * Only the choices the user changed: the server's own email/name match still
 * applies to everything else, and `null` means "leave this one unassigned".
 */
export function memberMap(members: ImportMemberMatch[], choices: MemberChoices): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const m of members) {
    const chosen = choices[m.externalId] ?? m.userId ?? '';
    if (chosen !== (m.userId ?? '')) out[m.externalId] = chosen || null;
  }
  return out;
}

export function isFinished(status: ImportStatus): boolean {
  return status === 'succeeded' || status === 'partial' || status === 'failed';
}

/** Cards written so far as a whole percent; real progress from each 50-card batch (AC32). */
export function progressPercent(job: Pick<ImportJob, 'status' | 'stats'>): number {
  if (job.status === 'succeeded' || job.status === 'partial') return 100;
  const p = job.stats.progress;
  if (!p || p.totalCards === 0) return 0;
  return Math.min(100, Math.floor((p.processedCards / p.totalCards) * 100));
}

export interface SummaryRow {
  entity: string;
  created: number;
  updated: number;
  skipped: number;
  dropped: number;
}

/** Created / updated / skipped / dropped per entity, so a re-import reads as an upsert (AC28). */
export function summaryRows(counts: ImportStats['counts']): SummaryRow[] {
  const row = (entity: string, t: ImportTally, dropped = 0): SummaryRow => ({ entity, created: t.created, updated: t.updated, skipped: t.skipped, dropped });
  return [
    row('Lists', counts.lists),
    row('Labels', counts.labels),
    row('Cards', counts.cards, counts.cards.dropped),
    row('Checklists', counts.checklists),
    row('Checklist items', counts.checklistItems),
    row('Comments', counts.comments),
  ];
}
