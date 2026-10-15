'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { FormError } from '@/components/auth-card';
import { Button, Input, Spinner, PageHeader, EmptyState } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { Page, Project } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { PROJECT_DOT } from '@/lib/content-colors';
import { Icon } from '@/components/icon';
import { formText } from '@/lib/form';
import { channelsKey } from '@/lib/unread';

export default function ProjectsPage() {
  const ws = useWorkspace();
  const router = useRouter();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const projects = useQuery({
    queryKey: ['projects', ws.id],
    queryFn: () => api.get<Page<Project>>(`/workspaces/${ws.id}/projects`),
  });
  const create = useMutation({
    mutationFn: (body: { name: string; clientName?: string }) => api.post<Project>(`/workspaces/${ws.id}/projects`, body),
    onSuccess: async (p) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['projects', ws.id] }),
        qc.invalidateQueries({ queryKey: channelsKey(ws.id) }),
      ]);
      router.push(`/w/${ws.slug}/p/${p.id}/b/${p.defaultBoardId}`);
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const clientName = formText(form, 'clientName');
    create.mutate({ name: formText(form, 'name'), ...(clientName ? { clientName } : {}) });
  }

  const canCreate = ws.role !== 'guest';
  return (
    <main className="ui-page">
      <PageHeader title="Clients" description="Every client, project, and next step. In one place." actions={
        canCreate && !creating ? <>
          <Link href={`/w/${ws.slug}/import`} className="ui-button tap text-secondary-foreground hover:bg-subtle"><Icon name="import" />Import from Trello</Link>
          <Button onClick={() => setCreating(true)}><Icon name="plus" />New project</Button>
        </> : null
      } />
      {creating ? (
        <form onSubmit={onSubmit} className="mb-6 grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-[1fr_1fr_auto]">
          <div className="sm:col-span-3">
            <FormError message={create.error ? errorMessage(create.error) : null} />
          </div>
          <Input name="name" placeholder="Project name" aria-label="Project name" required maxLength={120} autoFocus />
          <Input name="clientName" placeholder="Client name" aria-label="Client name" maxLength={120} />
          <div className="flex gap-2">
            <Button type="submit" disabled={create.isPending}>Create</Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </form>
      ) : null}
      {projects.isPending ? (
        <Spinner />
      ) : projects.data?.data.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.data.data.map((p) => (
            <li key={p.id}>
              <Link
                href={`/w/${ws.slug}/p/${p.id}/b/${p.defaultBoardId}`}
                data-tour="project"
                className="group flex min-h-24 items-center gap-4 rounded-xl border border-border bg-surface p-5 transition-shadow hover:border-primary-border hover:shadow-md"
              >
                <span className={`h-3 w-3 shrink-0 rounded-full ${PROJECT_DOT[p.color] ?? 'bg-muted-foreground'}`} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {p.clientName ?? 'No client'} · {p.key}
                  </span>
                </span>
                <Icon name="arrow" className="ml-auto size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Your client work starts here" description="Create a project for your first client, or bring an existing board over from Trello." action={canCreate ? <Button onClick={() => setCreating(true)}><Icon name="plus" />New project</Button> : undefined} />
      )}
    </main>
  );
}
