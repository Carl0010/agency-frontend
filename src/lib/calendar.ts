import { localDayAt } from './board-grouping';
import type { CardTile } from './types';

/** Month calendar arithmetic for the board's Calendar view, always in the viewer's profile timezone. */
export interface CalendarMonth { year: number; month: number }
export interface CalendarDay { date: string; day: number; inMonth: boolean }

const pad = (n: number) => String(n).padStart(2, '0');
const formatters = new Map<string, Intl.DateTimeFormat>();

/** `YYYY-MM-DD` of an instant in a timezone. */
export function localDateKey(instant: Date, timezone: string): string {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    formatters.set(timezone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export const monthParam = ({ year, month }: CalendarMonth) => `${year}-${pad(month)}`;

/** `?month=YYYY-MM`; anything else is the month that contains today. */
export function parseMonth(value: string | null, now: Date, timezone: string): CalendarMonth {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]); const month = Number(match[2]);
    if (year >= 1970 && year <= 9999 && month >= 1 && month <= 12) return { year, month };
  }
  const [year, month] = localDateKey(now, timezone).split('-').map(Number);
  return { year: year!, month: month! };
}

export function shiftMonth({ year, month }: CalendarMonth, by: number): CalendarMonth {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthTitle({ year, month }: CalendarMonth): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Whole weeks, Sunday first, that cover the month (four to six rows). */
export function monthGrid({ year, month }: CalendarMonth): CalendarDay[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = Date.UTC(year, month - 1, 1 - first.getUTCDay());
  const last = Date.UTC(year, month, 0);
  const weeks: CalendarDay[][] = [];
  for (let day = start; day <= last; day += 7 * 86_400_000) {
    weeks.push(Array.from({ length: 7 }, (_, i) => {
      const date = new Date(day + i * 86_400_000);
      return { date: date.toISOString().slice(0, 10), day: date.getUTCDate(), inMonth: date.getUTCMonth() === month - 1 };
    }));
  }
  return weeks;
}

/** Cards by their local due day, earliest due time first and board order for ties. */
export function cardsByDay(cards: readonly CardTile[], timezone: string): Map<string, CardTile[]> {
  const days = new Map<string, CardTile[]>();
  [...cards].filter((card) => card.dueAt).sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!)).forEach((card) => {
    const key = localDateKey(new Date(card.dueAt!), timezone);
    const list = days.get(key);
    if (list) list.push(card); else days.set(key, [card]);
  });
  return days;
}

/** The same local time of day, on another local date; calendar days, not 24-hour steps (DST). */
export function moveDueToDay(dueAt: string, date: string, timezone: string): string {
  const due = new Date(dueAt);
  const from = localDateKey(due, timezone);
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  const timeOfDay = due.getTime() - localDayAt(due, timezone, 0).getTime();
  return new Date(localDayAt(due, timezone, days).getTime() + timeOfDay).toISOString();
}
