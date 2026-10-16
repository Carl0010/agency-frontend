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

/** Name/client/color editor; the icon picker and personal-star controls remain a documented handoff. */
export function ProjectEditor({ project, onClose, onSaved }: {
  project?: Project; onClose: () => void; onSaved: (project: Project) => void;
}) {
  const ws = useWorkspace();
  const qc = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const [color, setColor] = useState(project?.color ?? 'slate');
  const save = useMutation({
    mutationFn: (body: { name: string; clientName: string | null; color: string }) => project
      ? api.patch<Project>(`/projects/${project.id}`, body)
      : api.post<Project>(`/workspaces/${ws.id}/projects`, { ...body, clientName: body.clientName ?? undefined }),
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
    if (save.isPending) return;
    const values = new FormData(event.currentTarget);
    save.mutate({ name: formText(values, 'name'), clientName: formText(values, 'clientName') || null, color });
  }
  return <dialog ref={dialog} aria-label={project ? 'Edit project' : 'New project'}
    onKeyDown={(event) => event.stopPropagation()}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (!save.isPending) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !save.isPending) onClose(); }}
    className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-overlay/40">
    <form onSubmit={submit} className="space-y-5 p-6">
      <header className="flex items-center justify-between gap-3"><h2 className="text-body-lg font-semibold">{project ? 'Edit project' : 'New project'}</h2><Button variant="ghost" size="icon" aria-label="Close project editor" disabled={save.isPending} onClick={onClose}><Icon name="close" /></Button></header>
      <FormError message={save.error ? errorMessage(save.error) : null} />
      <Field label="Project name"><Input autoFocus name="name" required maxLength={120} defaultValue={project?.name} /></Field>
      <Field label="Client name" hint="Optional"><Input name="clientName" maxLength={120} defaultValue={project?.clientName ?? ''} /></Field>
      <fieldset><legend className="mb-2 text-label font-medium text-secondary-foreground">Project color</legend><div className="flex flex-wrap gap-2">
        {Object.entries(PROJECT_DOT).map(([value, background]) => <label key={value} title={value} className={`tap relative inline-flex size-10 cursor-pointer items-center justify-center rounded-lg border ${color === value ? 'border-ring bg-primary-subtle' : 'border-border bg-background hover:bg-subtle'}`}>
          <input type="radio" name="color" value={value} aria-label={value} checked={color === value} onChange={() => setColor(value)} className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0" />
          <span className={`size-5 rounded-md ${background}`} /><span className="pointer-events-none absolute inset-0 rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring" />
          {color === value ? <Icon name="check" className="absolute bottom-0 right-0 size-3 rounded-full bg-surface text-foreground" /> : null}
        </label>)}
      </div></fieldset>
      <footer className="flex justify-end gap-2 border-t border-border pt-4"><Button variant="ghost" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : project ? 'Save changes' : 'Create project'}</Button></footer>
    </form>
  </dialog>;
}
