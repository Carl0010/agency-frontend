'use client';

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { FormError } from '@/components/auth-card';
import { useWriteAvailability } from '@/components/billing/billing-notices';
import { useConfirm } from '@/components/confirmation';
import { ProjectIcon } from '@/components/projects/project-icon';
import { useToast } from '@/components/toast';
import { Badge, Button, Field, Select } from '@/components/ui';
import { Dialog } from '@/components/ui-dialog';
import { api, ApiError, errorMessage } from '@/lib/api';
import { removeFromList } from '@/lib/board-state';
import { cardPath, cardPeopleKey } from '@/lib/cards';
import { cardUrl } from '@/lib/card-url';
import { applyTile } from '@/lib/realtime';
import type { Board, CardDetail, CardPlacement, CardTile, Page, Project } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

/** After a placement change: every board, the detail in each project and the card's people move together. */
function refreshAfterPlacement(qc: QueryClient, cardId: string, tile: CardTile) {
  applyTile(qc, tile);
  void qc.invalidateQueries({ queryKey: ['card', cardId] });
  void qc.invalidateQueries({ queryKey: ['board'] });
  void qc.invalidateQueries({ queryKey: cardPeopleKey(cardId) });
}

/**
 * The projects a card is in that the viewer can see, home first (docs/CARD_PLACEMENTS.md in the API
 * repository). Each opens the same card in that project; the home owns the card's number, and any
 * other placement can become the home or be removed. Agency only.
 */
export function CardPlacements({ card }: { card: CardDetail }) {
  const ws = useWorkspace();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const params = useSearchParams();
  const { readOnly } = useWriteAvailability(ws);
  const [pending, setPending] = useState<string | null>(null);
  const placements = card.placements ?? [];
  // Changing the home involves the current home: someone who cannot see it cannot make that change.
  const seesHome = placements.some((p) => p.isHome);
  const search = params.toString();

  async function run(placement: CardPlacement, write: () => Promise<CardTile>, done?: (tile: CardTile) => void) {
    setPending(placement.projectId);
    try {
      const tile = await write();
      refreshAfterPlacement(qc, card.id, tile);
      done?.(tile);
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setPending(null);
    }
  }

  async function remove(placement: CardPlacement) {
    const accepted = await confirm({
      title: `Remove from ${placement.projectName}?`,
      description: `The card leaves the ${placement.projectName} board and loses that project's labels. People who only see it there lose access to it.`,
      confirmLabel: 'Remove from project',
    });
    if (!accepted) return;
    await run(placement, () => api.del<CardTile>(cardPath(card.id, card.projectId, `/placements/${placement.projectId}`)), (home) => {
      for (const q of qc.getQueryCache().findAll({ queryKey: ['board'] })) qc.setQueryData<Board>(q.queryKey, (b) => (b ? removeFromList(b, card.id, placement.listId) : b));
      toast(`Removed from ${placement.projectName}.`, 'info');
      // The card is no longer in the project this screen shows: open it where it still is.
      if (placement.projectId === card.projectId) router.replace(cardUrl(ws.id, home, card.id, search), { scroll: false });
    });
  }

  async function makeHome(placement: CardPlacement) {
    await run(placement, () => api.put<CardTile>(cardPath(card.id, card.projectId, '/home'), { projectId: placement.projectId }), () => toast(`${placement.projectName} is now the card's home. Its number changed.`, 'info'));
  }

  if (!placements.length) return null;
  return (
    <ul aria-label="Projects this card is in" className="space-y-1" data-testid="card-placements">
      {placements.map((placement) => {
        const current = placement.projectId === card.projectId;
        return (
          <li key={placement.projectId} data-testid="card-placement" data-project-id={placement.projectId} className={`flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 ${current ? 'border-primary-border bg-primary-subtle' : 'border-border bg-surface'}`}>
            <Link href={cardUrl(ws.id, placement, card.id, search)} scroll={false} aria-current={current ? 'page' : undefined} className="tap flex min-w-0 flex-1 items-center gap-2 rounded-md text-label hover:text-primary">
              <ProjectIcon project={{ color: placement.projectColor, icon: placement.projectIcon }} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{placement.projectName}</span>
                <span className="block truncate text-caption text-muted-foreground">{placement.listName}</span>
              </span>
            </Link>
            {placement.isHome ? (
              <Badge title="The home project owns the card's number">Home</Badge>
            ) : (
              <span className="flex shrink-0 gap-1">
                {seesHome ? <Button variant="ghost" size="sm" disabled={readOnly || pending !== null} aria-label={`Make ${placement.projectName} the home`} onClick={() => void makeHome(placement)}>Make home</Button> : null}
                <Button variant="ghost" size="sm" disabled={readOnly || pending !== null} aria-label={`Remove from ${placement.projectName}`} onClick={() => void remove(placement)}>Remove</Button>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** "Add to project" and "Move to project" for the card's actions. Moving leaves the home, so it needs the home in sight. */
export function PlacementActions({ card }: { card: CardDetail }) {
  const ws = useWorkspace();
  const { readOnly } = useWriteAvailability(ws);
  const [mode, setMode] = useState<'add' | 'move' | null>(null);
  if (card.archivedAt || !card.placements) return null;
  const seesHome = card.placements.some((p) => p.isHome);
  return (
    <>
      <Button variant="secondary" disabled={readOnly} onClick={() => setMode('add')}>Add to project</Button>
      {seesHome ? <Button variant="secondary" disabled={readOnly} onClick={() => setMode('move')}>Move to project</Button> : null}
      {mode ? <PlaceCardDialog card={card} mode={mode} onClose={() => setMode(null)} /> : null}
    </>
  );
}

/**
 * Pick a project the person can see, then a list on its board. Adding keeps the card where it is;
 * moving transfers it: placed there, made home, and taken off the old home. The API asks before guests
 * of the target project would newly see the card (`409 guests_will_see`).
 */
function PlaceCardDialog({ card, mode, onClose }: { card: CardDetail; mode: 'add' | 'move'; onClose: () => void }) {
  const ws = useWorkspace();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const params = useSearchParams();
  const [projectId, setProjectId] = useState('');
  const [listId, setListId] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Fresh on open: the choice must include projects shared with the person since the sidebar loaded.
  const projects = useQuery({ queryKey: ['projects', ws.id], queryFn: () => api.get<Page<Project>>(`/workspaces/${ws.id}/projects`), refetchOnMount: 'always' });
  const placed = new Set((card.placements ?? []).map((p) => p.projectId));
  const choices = (projects.data?.data ?? []).filter((p) => !p.archivedAt && !placed.has(p.id));
  const project = choices.find((p) => p.id === projectId);
  const board = useQuery({ queryKey: ['board', project?.defaultBoardId], queryFn: () => api.get<Board>(`/boards/${project!.defaultBoardId}`), enabled: Boolean(project) });
  const lists = board.data?.lists ?? [];
  const chosenList = lists.find((l) => l.id === listId) ?? lists[0];
  const verb = mode === 'add' ? 'Add to project' : 'Move to project';

  async function send(target: Project, exposeToGuests: boolean): Promise<void> {
    if (!chosenList) return;
    try {
      const tile = await api.post<CardTile>(cardPath(card.id, card.projectId, mode === 'add' ? '/placements' : '/transfer'), { listId: chosenList.id, ...(exposeToGuests ? { exposeToGuests: true } : {}) });
      refreshAfterPlacement(qc, card.id, tile);
      toast(mode === 'add' ? `Added to ${target.name}.` : `Moved to ${target.name}.`, 'info');
      onClose();
      // A moved card has left this project: follow it.
      if (mode === 'move') router.replace(cardUrl(ws.id, tile, card.id, params.toString()), { scroll: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.details.reason === 'guests_will_see' && !exposeToGuests) {
        const guests = Number(err.details.guests ?? 0);
        const accepted = await confirm({
          title: 'Guests will see this card',
          description: `${guests} guest${guests === 1 ? '' : 's'} of ${target.name} will see this card and its comments.`,
          confirmLabel: verb,
          tone: 'primary',
        });
        if (accepted) await send(target, true);
        return;
      }
      if (err instanceof ApiError && err.status === 409 && err.details.reason === 'already_in_project') setError(`This card is already in ${target.name}.`);
      else setError(errorMessage(err));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !chosenList) return;
    setPending(true);
    setError(null);
    await send(project, false);
    setPending(false);
  }

  return (
    <Dialog title={verb} onClose={() => { if (!pending) onClose(); }}>
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <p className="text-label text-muted-foreground">
          {mode === 'add'
            ? 'The card stays where it is and also shows on the other project’s board. It stays one card: the same comments, checklists and assignees everywhere.'
            : 'The card moves to the other project, which becomes its home and gives it a new number. Links to the card keep working.'}
        </p>
        <Field label="Project">
          <Select value={projectId} required disabled={pending || projects.isPending} onChange={(event) => { setProjectId(event.target.value); setListId(''); setError(null); }} className="w-full">
            <option value="">{projects.isPending ? 'Loading projects…' : choices.length ? 'Choose a project' : 'No other projects'}</option>
            {choices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        {project ? (
          <Field label="List">
            <Select value={chosenList?.id ?? ''} required disabled={pending || board.isPending} onChange={(event) => setListId(event.target.value)} className="w-full">
              {board.isPending ? <option value="">Loading lists…</option> : null}
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
        ) : null}
        <FormError message={error ?? (projects.error ? errorMessage(projects.error) : board.error ? errorMessage(board.error) : null)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending || !project || !chosenList}>{pending ? 'Saving…' : verb}</Button>
        </div>
      </form>
    </Dialog>
  );
}
