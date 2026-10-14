import { initialChoices, isFinished, memberMap, progressPercent, readTrelloReturn, summaryRows } from './import';
import type { ImportMemberMatch, ImportStats } from './types';

const TOKEN = 'a'.repeat(64);

describe('readTrelloReturn', () => {
  it('reads the token from the fragment', () => {
    expect(readTrelloReturn(`#token=${TOKEN}`)).toEqual({ token: TOKEN });
  });
  it('reports a declined grant', () => {
    expect(readTrelloReturn('#error=Token%20request%20rejected')).toEqual({ error: 'Trello did not grant access. Try Connect Trello again.' });
  });
  it('rejects a malformed token rather than sending it on', () => {
    expect(readTrelloReturn('#token=abc<script>')).toHaveProperty('error');
  });
  it('ignores an unrelated or empty fragment', () => {
    expect(readTrelloReturn('')).toBeNull();
    expect(readTrelloReturn('#section')).toBeNull();
  });
});

describe('memberMap', () => {
  const members: ImportMemberMatch[] = [
    { externalId: 'dana', name: 'Dana Scully', userId: 'u-dana', how: 'email' },
    { externalId: 'fox', name: 'Fox Mulder', userId: null, how: null },
    { externalId: 'walter', name: 'Walter Skinner', userId: null, how: null },
  ];

  it('sends nothing when the suggestions are kept', () => {
    expect(memberMap(members, initialChoices(members))).toEqual({});
  });
  it('sends a manual match for an unmatched member', () => {
    expect(memberMap(members, { ...initialChoices(members), fox: 'u-fox' })).toEqual({ fox: 'u-fox' });
  });
  it('sends null when a suggested match is cleared', () => {
    expect(memberMap(members, { ...initialChoices(members), dana: '' })).toEqual({ dana: null });
  });
});

describe('progress', () => {
  const progress = (processedCards: number, totalCards: number) => ({
    progress: { totalCards, processedCards, batchesTotal: Math.ceil(totalCards / 50), batchesDone: processedCards / 50, batchesFailed: 0 },
  });

  it('starts at 0 before the first batch is written', () => {
    expect(progressPercent({ status: 'pending', stats: {} })).toBe(0);
  });
  it('advances with each batch of a 2000-card import (AC32)', () => {
    expect(progressPercent({ status: 'running', stats: progress(50, 2000) })).toBe(2);
    expect(progressPercent({ status: 'running', stats: progress(1000, 2000) })).toBe(50);
    expect(progressPercent({ status: 'running', stats: progress(1950, 2000) })).toBe(97);
  });
  it('is full once the job is done, even with failed batches', () => {
    expect(progressPercent({ status: 'partial', stats: progress(1900, 2000) })).toBe(100);
  });
  it('knows which statuses are terminal', () => {
    expect(['pending', 'running', 'succeeded', 'partial', 'failed'].map((s) => isFinished(s as never))).toEqual([false, false, true, true, true]);
  });
});

describe('summaryRows', () => {
  it('separates created / updated / skipped / dropped (AC28)', () => {
    const t = (created: number, updated = 0, skipped = 0) => ({ created, updated, skipped });
    const counts: ImportStats['counts'] = {
      lists: t(0, 4),
      labels: t(0, 3),
      cards: { ...t(1, 10, 2), failed: 0, dropped: 1 },
      checklists: t(0, 2),
      checklistItems: t(0, 6),
      comments: { ...t(0, 0, 25), archive: 0 },
      attachments: { files: 0, links: 0, skipped: 0 },
      assignees: { assigned: 0, unmatched: 0 },
    };
    const cards = summaryRows(counts).find((r) => r.entity === 'Cards');
    expect(cards).toEqual({ entity: 'Cards', created: 1, updated: 10, skipped: 2, dropped: 1 });
    expect(summaryRows(counts).map((r) => r.entity)).toEqual(['Lists', 'Labels', 'Cards', 'Checklists', 'Checklist items', 'Comments']);
  });
});
