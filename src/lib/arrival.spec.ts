import { arrivalText, confidenceSummary, formatArrivalDate, replanLines, type Confidence } from './arrival';

test('calendar days render without timezone shifts', () => {
  expect(formatArrivalDate('2026-11-12')).toBe('Thu 12 Nov');
  expect(formatArrivalDate('2027-01-01')).toBe('Fri 1 Jan');
});

test('arrival text includes readable lateness only for members', () => {
  const entry = { arrivesOn: '2026-11-12', confidence: 82, lateDays: 2 };
  expect(arrivalText(entry)).toBe('Arrives Thu 12 Nov · 82% sure · 2 days late');
  expect(arrivalText(entry, true)).toBe('Arrives Thu 12 Nov · 82% sure');
  expect(arrivalText({ ...entry, lateDays: 0 })).not.toContain('late');
});

test('re-plan text uses each suggested day and the new arrival', () => {
  expect(replanLines({ projectId: 'p', cardId: 'c', changes: [{ cardId: 'a', title: 'Blog', fromDueOn: '2026-11-03', toDueOn: '2026-11-06' }], arrivesOnAfter: '2026-11-05' }, 'Homepage')).toEqual(['Move ‘Blog’ to Fri 6 Nov.', '‘Homepage’ arrives on time (Thu 5 Nov).']);
});

test('confidence summary respects the minimum anonymous tally', () => {
  const view: Confidence = { projectId: 'p', weekStart: '2026-11-02', answeredThisWeek: false, askNow: true, aggregate: null };
  expect(confidenceSummary(view)).toBeNull();
  expect(confidenceSummary({ ...view, answeredThisWeek: true })).toMatch(/three people/);
  expect(confidenceSummary({ ...view, aggregate: { yes: 3, unsure: 1, no: 1 } })).toBe('3 yes · 1 unsure · 1 no this week');
});
