import { dueState } from './due';

// AC16: verified against a fixed clock, never wall time.
const NOW = new Date('2026-10-13T12:00:00Z');
const at = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString();

describe('dueState', () => {
  it.each([
    ['no due date', null, null, null],
    ['grey when more than 48h away', at(49), null, 'later'],
    ['grey exactly at 48h', at(48), null, 'later'],
    ['amber just under 48h', at(47.9), null, 'soon'],
    ['amber at 1 minute left', at(1 / 60), null, 'soon'],
    ['red once overdue', at(-0.01), null, 'overdue'],
    ['red days overdue', at(-72), null, 'overdue'],
    ['green when completed, even if overdue', at(-72), at(-80), 'done'],
    ['green when completed early', at(100), at(-1), 'done'],
  ])('%s', (_name, due, completed, expected) => {
    expect(dueState(due, completed, NOW)).toBe(expected);
  });
});
