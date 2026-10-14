'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { FormError } from '@/components/auth-card';
import { Button, Input, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { Page, Project } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { formText } from '@/lib/form';

const PROJECT_DOT: Record<string, string> = {
  slate: 'bg-slate-500', red: 'bg-red-500', orange: 'bg-orange-500', amber: 'bg-amber-500',
  green: 'bg-green-600', teal: 'bg-teal-600', blue: 'bg-blue-600', violet: 'bg-violet-600',
};

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
      await qc.invalidateQueries({ queryKey: ['projects', ws.id] });
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
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        {canCreate && !creating ? (
          <div className="flex items-center gap-2">
            <Link href={`/w/${ws.slug}/import`} className="tap inline-flex items-center rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Import from Trello
            </Link>
            <Button onClick={() => setCreating(true)}>New project</Button>
          </div>
        ) : null}
      </div>
      {creating ? (
        <form onSubmit={onSubmit} className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto]">
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
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm"
              >
                <span className={`h-3 w-3 shrink-0 rounded-full ${PROJECT_DOT[p.color] ?? 'bg-slate-500'}`} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-sm text-slate-500">
                    {p.clientName ?? 'No client'} · {p.key}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-600">No projects yet. Create one for your first client.</p>
      )}
    </main>
  );
}
