'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface CardArrival { cardId: string; arrivesOn: string; confidence: number; lateDays?: number }
export interface BoardArrivals { projectId: string; history?: 'pending' | 'insufficient' | 'enough'; cards: CardArrival[] }
export interface ProjectArrival { projectId: string; arrivesOn: string | null; confidence: number | null; lateDays?: number }
export interface ArrivalSettings { projectId: string; doneListIds: string[]; targetDate: string | null; guestCardArrivals: boolean }
export interface Calendar { country: string | null; timezone: string; weekendDays: number[]; publicHolidays: boolean }
export interface CalendarCountry { code: string; name: string; weekendDays: number[] }
export interface Replan { projectId: string; cardId: string; changes: { cardId: string; title: string; fromDueOn: string; toDueOn: string }[]; arrivesOnAfter: string }
export interface Confidence { projectId: string; weekStart: string; answeredThisWeek: boolean; askNow: boolean; aggregate: { yes: number; unsure: number; no: number } | null }

/** Calendar dates are displayed in UTC so the viewer's timezone cannot shift the day. */
export function formatArrivalDate(day: string): string {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, date)));
}

export function arrivalText(arrival: Pick<CardArrival, 'arrivesOn' | 'confidence' | 'lateDays'>, guest = false): string {
  const late = !guest && arrival.lateDays ? ` · ${arrival.lateDays} ${arrival.lateDays === 1 ? 'day' : 'days'} late` : '';
  return `Arrives ${formatArrivalDate(arrival.arrivesOn)} · ${arrival.confidence}% sure${late}`;
}

export function replanLines(plan: Replan, title: string): string[] {
  return [...plan.changes.map((change) => `Move ‘${change.title}’ to ${formatArrivalDate(change.toDueOn)}.`), `‘${title}’ arrives on time (${formatArrivalDate(plan.arrivesOnAfter)}).`];
}

export function confidenceSummary(view: Confidence): string | null {
  if (view.aggregate) return `${view.aggregate.yes} yes · ${view.aggregate.unsure} unsure · ${view.aggregate.no} no this week`;
  return view.answeredThisWeek ? 'Thanks, the team’s view shows once three people have answered.' : null;
}

export function useBoardArrivals(boardId: string | undefined) {
  return useQuery({ queryKey: ['board-arrivals', boardId], queryFn: () => api.get<BoardArrivals>(`/boards/${boardId}/arrivals`), enabled: Boolean(boardId), staleTime: 30_000 });
}
export function useArrivalSettings(projectId: string | undefined) {
  return useQuery({ queryKey: ['arrival-settings', projectId], queryFn: () => api.get<ArrivalSettings>(`/projects/${projectId}/arrival-settings`), enabled: Boolean(projectId), staleTime: 30_000 });
}
