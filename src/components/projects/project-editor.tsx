'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icon';
import { Button, Field, Input } from '@/components/ui';
import { FormError } from '@/components/auth-card';
import { api, errorMessage } from '@/lib/api';
import { PROJECT_DOT } from '@/lib/content-colors';
import { formText } from '@/lib/form';
import { channelsKey } from '@/lib/unread';
import type { Project } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { TeamPicker } from '@/components/teams/team-picker';
import { useTeams } from '@/lib/teams';
import { PROJECT_ICONS, ProjectIcon } from './project-icon';
import { useWriteAvailability } from '@/components/billing/billing-notices';

/** Project name and color editor. */
export function ProjectEditor({ project, onClose, onSaved }: {
  project?: Project; onClose: () => void; onSaved: (project: Project) => void;
}) {
  const ws = useWorkspace();
  const { readOnly } = useWriteAvailability(ws);
  const qc = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const [color, setColor] = useState(project?.color ?? 'slate');
  const [icon, setIcon] = useState(PROJECT_ICONS.find((name) => name === project?.icon) ?? 'folder');
  const [validation, setValidation] = useState<string | null>(null);
  const teams = useTeams(ws.id);
  const save = useMutation({
    mutationFn: (body: { name: string; color: string; icon: string; teamIds?: string[] }) => project
      ? api.patch<Project>(`/projects/${project.id}`, body)
      : api.post<Project>(`/workspaces/${ws.id}/projects`, body),
    onSuccess: async (saved) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['projects', ws.id] }),
        qc.invalidateQueries({ queryKey: ['project', saved.id] }),
        qc.invalidateQueries({ queryKey: ['board'] }),
        qc.invalidateQueries({ queryKey: channelsKey(ws.id) }),
      ]);
      onSaved(saved);
    },
  });
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    element.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    return () => { element.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending || readOnly) return;
    const values = new FormData(event.currentTarget);
    const teamIds = values.getAll('teamIds').map(String);
    if (teamIds.length > 50) { setValidation('Choose at most 50 teams.'); return; }
    setValidation(null);
    save.mutate({ name: formText(values, 'name'), color, icon, ...(!project ? { teamIds } : {}) });
  }
  return <dialog ref={dialog} aria-label={project ? 'Edit project' : 'New project'}
    onKeyDown={(event) => event.stopPropagation()}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (!save.isPending) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !save.isPending) onClose(); }}
    className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-overlay/40">
    <form onSubmit={submit} className="space-y-5 p-6">
      <header className="flex items-center justify-between gap-3"><h2 className="text-body-lg font-semibold">{project ? 'Edit project' : 'New project'}</h2><Button variant="ghost" size="icon" aria-label="Close project editor" disabled={save.isPending} onClick={onClose}><Icon name="close" /></Button></header>
      <FormError message={validation ?? (save.error ? errorMessage(save.error) : null)} />
      <Field label="Project name"><Input autoFocus name="name" required maxLength={120} defaultValue={project?.name} /></Field>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"><ProjectIcon project={{ color, icon }} /><span className="text-label text-muted-foreground">Project icon preview</span></div>
      <fieldset><legend className="mb-2 text-label font-medium">Project icon</legend><div className="grid grid-cols-4 gap-2">
        {PROJECT_ICONS.map((name) => <label key={name} className={`tap relative flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-2 text-caption ${icon === name ? 'border-ring bg-primary-subtle text-primary-text' : 'border-border hover:bg-subtle'}`}>
          <input type="radio" name="icon" value={name} aria-label={name} checked={icon === name} onChange={() => setIcon(name)} className="peer absolute inset-0 opacity-0" /><Icon name={name} /><span className="capitalize">{name}</span><span className="pointer-events-none absolute inset-0 rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring" />
        </label>)}
      </div></fieldset>
      <fieldset><legend className="mb-2 text-label font-medium text-secondary-foreground">Project color</legend><div className="flex flex-wrap gap-2">
        {Object.entries(PROJECT_DOT).map(([value, background]) => <label key={value} title={value} className={`tap relative inline-flex size-10 cursor-pointer items-center justify-center rounded-lg border ${color === value ? 'border-ring bg-primary-subtle' : 'border-border bg-background hover:bg-subtle'}`}>
          <input type="radio" name="color" value={value} aria-label={value} checked={color === value} onChange={() => setColor(value)} className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0" />
          <span className={`size-5 rounded-md ${background}`} /><span className="pointer-events-none absolute inset-0 rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring" />
          {color === value ? <Icon name="check" className="absolute bottom-0 right-0 size-3 rounded-full bg-surface text-foreground" /> : null}
        </label>)}
      </div></fieldset>
      {!project ? <TeamPicker workspaceId={ws.id} disabled={save.isPending} /> : null}
      <footer className="flex justify-end gap-2 border-t border-border pt-4"><Button variant="ghost" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={readOnly || save.isPending || (!project && (teams.isPending || Boolean(teams.error)))}>{save.isPending ? 'Saving…' : project ? 'Save changes' : 'Create project'}</Button></footer>
    </form>
  </dialog>;
}
