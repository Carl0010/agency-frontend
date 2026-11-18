'use client';

import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { arrivalText, formatArrivalDate, useBoardArrivals, type ProjectArrival } from '@/lib/arrival';

export function ArrivalChip({ boardId, cardId, guest = false }: { boardId: string; cardId: string; guest?: boolean }) {
  const arrivals = useBoardArrivals(boardId);
  const arrival = arrivals.data?.cards.find((entry) => entry.cardId === cardId);
  if (!arrival) return null;
  return <span data-testid="arrival-chip" className={`mt-2 inline-flex rounded px-2 py-0.5 text-caption ${!guest && arrival.lateDays ? 'bg-warning-subtle text-warning-text' : 'bg-subtle text-secondary-foreground'}`}>{arrivalText(arrival, guest)}</span>;
}

export function ProjectArrivalLine({ projectId, guest = false }: { projectId: string; guest?: boolean }) {
  const arrival = useQuery({ queryKey: ['project-arrival', projectId], queryFn: () => api.get<ProjectArrival>(`/projects/${projectId}/arrival`) });
  if (arrival.error) return <span role="alert" className="text-caption text-danger-text">{errorMessage(arrival.error)}</span>;
  if (!arrival.data?.arrivesOn) return null;
  const { arrivesOn, confidence, lateDays } = arrival.data;
  return <span data-testid="project-arrival" className="text-caption text-secondary-foreground">{guest ? 'Expected' : 'Arrives'} {formatArrivalDate(arrivesOn)} · {confidence}% sure{!guest && lateDays ? ` · ${lateDays} ${lateDays === 1 ? 'day' : 'days'} past target` : ''}</span>;
}
