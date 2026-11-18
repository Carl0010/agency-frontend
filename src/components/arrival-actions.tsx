'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { cardPath } from '@/lib/cards';
import { confidenceSummary, replanLines, useBoardArrivals, type Confidence, type Replan } from '@/lib/arrival';

export function ConfidencePrompt({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const key = ['project-confidence', projectId] as const;
  const query = useQuery({ queryKey: key, queryFn: () => api.get<Confidence>(`/projects/${projectId}/confidence`) });
  async function answer(value: 'yes' | 'unsure' | 'no') {
    setSaving(true);
    try { qc.setQueryData(key, await api.put<Confidence>(`/projects/${projectId}/confidence`, { answer: value })); }
    catch (error) {
      if (error instanceof ApiError && error.details.reason === 'already_answered') await qc.invalidateQueries({ queryKey: key });
      else toast(errorMessage(error));
    } finally { setSaving(false); }
  }
  if (query.error) return <p role="alert" className="px-4 text-caption text-danger-text">{errorMessage(query.error)}</p>;
  if (!query.data || dismissed) return null;
  const { askNow, answeredThisWeek, aggregate } = query.data;
  const summary = confidenceSummary(query.data);
  if (!askNow && !answeredThisWeek && !aggregate) return null;
  return <section className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2 text-label" aria-label="Project confidence">
    {askNow ? <><span>Will this project be finished on time? Your answer is anonymous.</span>{(['yes', 'unsure', 'no'] as const).map((value) => <Button key={value} size="sm" variant="secondary" disabled={saving} onClick={() => void answer(value)}>{value.charAt(0).toUpperCase() + value.slice(1)}</Button>)}</> : null}
    {summary ? <span>{summary}</span> : null}
    <Button size="sm" variant="ghost" onClick={() => setDismissed(true)} aria-label="Dismiss project confidence">Dismiss</Button>
  </section>;
}

export function ReplanAction({ boardId, projectId, cardId, title }: { boardId: string; projectId: string; cardId: string; title: string }) {
  const arrivals = useBoardArrivals(boardId);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const path = cardPath(cardId, projectId, '/replan');
  const query = useQuery({ queryKey: ['replan', cardId, projectId], queryFn: () => api.get<{ replan: Replan | null }>(path), enabled: open, staleTime: 0 });
  if (!arrivals.data?.cards.find((item) => item.cardId === cardId)?.lateDays) return null;
  async function apply() {
    if (!query.data?.replan) return;
    setSaving(true);
    try {
      await api.post(path, { changes: query.data.replan.changes.map(({ cardId: id, toDueOn }) => ({ cardId: id, toDueOn })) });
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['board', boardId] });
      toast('Re-plan applied.', 'info');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'replan_outdated') { toast('This re-plan changed. Showing the latest suggestion.'); await query.refetch(); }
      else toast(errorMessage(error));
    } finally { setSaving(false); }
  }
  return <div className="mt-1 text-label"><Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Re-plan</Button>{open ? <div role="dialog" aria-label="Re-plan" className="mt-2 rounded-lg border border-border bg-surface p-3">
    {query.isPending || query.isFetching ? <p>Loading re-plan…</p> : query.error ? <p role="alert" className="text-danger-text">{errorMessage(query.error)} <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>Retry</Button></p> : query.data.replan ? <>{replanLines(query.data.replan, title).map((line) => <p key={line}>{line}</p>)}<Button size="sm" disabled={saving} onClick={() => void apply()}>{saving ? 'Applying…' : 'Apply'}</Button></> : <p>No simple re-plan brings this card back on time.</p>}
    <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Dismiss</Button>
  </div> : null}</div>;
}
