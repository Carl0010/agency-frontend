'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useConfirm } from '@/components/confirmation';
import { FormError } from '@/components/auth-card';
import { Icon } from '@/components/icon';
import { useToast } from '@/components/toast';
import { Button, Field, Input } from '@/components/ui';
import { Dialog, DialogActions } from '@/components/ui-dialog';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { Project } from '@/lib/types';
import { channelsKey } from '@/lib/unread';
import { useWorkspace } from '@/lib/workspace';
import { ProjectEditor } from './project-editor';

/**
 * The dropdown right after the project name on a project screen: Edit project (name, status,
 * colour and icon), Archive or Restore, and, for the project's admins, Delete. A popover menu with
 * arrow-key navigation; the API still decides who may do each.
 */
export function ProjectHeaderMenu({ project }: { project: Project }) {
  const ws = useWorkspace();
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const archived = Boolean(project.archivedAt);
  const admin = project.access === 'admin';
  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
  const close = () => menu.current?.hidePopover();

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: ['projects', ws.id] }),
    qc.invalidateQueries({ queryKey: ['project', project.id] }),
    qc.invalidateQueries({ queryKey: channelsKey(ws.id) }),
  ]);

  async function toggleArchive() {
    close();
    if (!archived) {
      const ok = await confirm({
        title: `Archive ${project.name}?`,
        description: 'It leaves the sidebar and the project list for everyone, and guests lose it. Nothing is deleted: restore it any time from Projects → Archived.',
        confirmLabel: 'Archive project',
        tone: 'primary',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await api.post<Project>(`/projects/${project.id}/${archived ? 'restore' : 'archive'}`);
      await refresh();
      toast(archived ? `${project.name} is back.` : `${project.name} is archived.`, 'info');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" popoverTarget={id} aria-haspopup="menu" aria-label={`${project.name} settings`} data-testid="project-header-menu" disabled={busy}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 232)) });
      }}
      className="tap inline-flex size-8 shrink-0 items-center justify-center rounded-md text-secondary-foreground hover:bg-hover hover:text-foreground disabled:opacity-60">
      <Icon name="chevron" className="size-4 rotate-90" />
    </button>
    <div ref={menu} id={id} popover="auto" role="menu" aria-label={`${project.name} settings`} style={position}
      onToggle={(event) => { if (event.newState === 'open') items()[0]?.focus(); }}
      onKeyDown={(event) => {
        const all = items(); const index = all.indexOf(document.activeElement as HTMLElement);
        const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: all.length - 1 }[event.key];
        if (next === undefined) return;
        event.preventDefault(); all[(next + all.length) % all.length]?.focus();
      }}
      className="fixed m-0 w-56 rounded-xl border border-border bg-popover p-1.5 text-foreground shadow-lg">
      <button type="button" role="menuitem" tabIndex={-1} className="ui-nav-link tap w-full" onClick={() => { close(); setDialog('edit'); }}><Icon name="settings" />Edit project</button>
      <button type="button" role="menuitem" tabIndex={-1} className="ui-nav-link tap w-full" onClick={() => void toggleArchive()}><Icon name="inbox" />{archived ? 'Restore project' : 'Archive project'}</button>
      {admin ? <>
        <div role="separator" className="my-1 h-px bg-border" />
        <button type="button" role="menuitem" tabIndex={-1} className="ui-nav-link tap w-full text-danger-text hover:text-danger-text" onClick={() => { close(); setDialog('delete'); }}><Icon name="trash" />Delete project</button>
      </> : null}
    </div>
    {dialog === 'edit' ? <ProjectEditor project={project} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} /> : null}
    {dialog === 'delete' ? <DeleteProjectDialog project={project} onClose={() => setDialog(null)} onDeleted={async () => {
      setDialog(null);
      router.replace(`/w/${ws.id}/projects`);
      qc.removeQueries({ queryKey: ['project', project.id] });
      await Promise.all([qc.invalidateQueries({ queryKey: ['projects', ws.id] }), qc.invalidateQueries({ queryKey: channelsKey(ws.id) })]);
      toast(`${project.name} was deleted.`, 'info');
    }} /> : null}
  </>;
}

/** Deleting cannot be undone, so the person types the project's name first. */
function DeleteProjectDialog({ project, onClose, onDeleted }: { project: Project; onClose: () => void; onDeleted: () => Promise<void> }) {
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim() === project.name.trim();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matches || pending) return;
    setPending(true); setError(null);
    try {
      await api.del(`/projects/${project.id}`);
      await onDeleted();
    } catch (err) {
      setError(err instanceof ApiError && err.details?.reason === 'cards_in_other_projects'
        ? `${err.message} Open each shared card and choose Make home on another project.`
        : errorMessage(err));
      setPending(false);
    }
  }
  return <Dialog title="Delete project" size="compact" onClose={() => { if (!pending) onClose(); }}>
    <form onSubmit={submit} className="space-y-4">
      <p className="text-body text-secondary-foreground">
        This deletes <span className="font-medium text-foreground">{project.name}</span> for good: its boards, lists and cards, with their comments and files, and both chat channels. Everyone loses it. This cannot be undone.
      </p>
      <FormError message={error} />
      <Field label={`Type ${project.name} to confirm`}>
        <Input data-autofocus name="confirmName" autoComplete="off" spellCheck={false} value={typed} onChange={(event) => setTyped(event.target.value)} />
      </Field>
      <DialogActions>
        <Button variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="danger" disabled={!matches || pending}>{pending ? 'Deleting…' : 'Delete project'}</Button>
      </DialogActions>
    </form>
  </Dialog>;
}
