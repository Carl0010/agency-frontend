'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ChangeEvent } from 'react';
import { FormError } from '@/components/auth-card';
import { ImportPreviewScreen, type ImportTarget } from '@/components/import/preview';
import { Button, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { memberMap, readTrelloReturn, type MemberChoices } from '@/lib/import';
import type { ImportJob, ImportPreview, Page, TrelloBoardSummary } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

const MAX_CSV_BYTES = 20 * 1024 * 1024;

type Source = { kind: 'csv'; file: File } | { kind: 'api'; boardId: string };

/**
 * The §7.1 wizard: Upload CSV or Connect Trello → (board picker) → preview
 * and member mapping, with nothing written until Confirm (AC19, AC20) → the
 * job page. Lives under `/w/*`, which a guest never renders (AC3, AC12).
 */
export default function ImportPage() {
  const ws = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  // Trello token: memory only, for this tab's wizard; never stored or put in a URL (AC30).
  const [token, setToken] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const back = readTrelloReturn(window.location.hash);
    if (!back) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if ('token' in back) setToken(back.token);
    else setError(back.error);
  }, []);

  const body = (s: Source, extra: Record<string, unknown> = {}): FormData | Record<string, unknown> => {
    if (s.kind === 'api') return { source: 'trello_api', boardId: s.boardId, trelloToken: token, ...extra };
    const form = new FormData();
    form.append('file', s.file);
    for (const [k, v] of Object.entries(extra)) form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
    return form;
  };

  const preview = useMutation({
    mutationFn: (s: Source) => api.post<ImportPreview>(`/workspaces/${ws.id}/imports/preview`, body(s)),
    onMutate: (s) => {
      setSource(s);
      setError(null);
    },
  });

  const submit = useMutation({
    mutationFn: ({ target, choices }: { target: ImportTarget; choices: MemberChoices }) => {
      if (!source || !preview.data) throw new Error('Nothing to import.');
      const map = memberMap(preview.data.members, choices);
      return target.kind === 'existing'
        ? api.post<ImportJob>(`/projects/${target.projectId}/imports`, body(source, { memberMap: map }))
        : api.post<ImportJob>(`/workspaces/${ws.id}/imports`, body(source, { memberMap: map, ...(target.name ? { projectName: target.name } : {}) }));
    },
    onSuccess: (job) => router.push(`/w/${ws.slug}/import/${job.id}`),
  });

  const connect = useMutation({
    mutationFn: () => api.get<{ url: string }>(`/workspaces/${ws.id}/imports/trello/authorize-url?returnPath=${encodeURIComponent(pathname)}`),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (err) => setError(errorMessage(err)),
  });

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) return setError('CSV uploads can be up to 20 MB.');
    preview.mutate({ kind: 'csv', file });
  }

  const startOver = () => {
    preview.reset();
    submit.reset();
    setSource(null);
    setError(null);
  };

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <h1 className="mb-1 text-2xl font-semibold">Import from Trello</h1>
      <p className="mb-6 text-sm text-slate-600">Bring a Trello board over as a project. Nothing is written until you confirm.</p>
      <div className="mb-4 space-y-2">
        <FormError message={error ?? (preview.error ? errorMessage(preview.error) : null)} />
      </div>

      {preview.isPending ? (
        <Spinner label="Reading the board…" />
      ) : preview.data && source ? (
        <ImportPreviewScreen
          preview={preview.data}
          workspaceId={ws.id}
          submitting={submit.isPending}
          submitError={submit.error ? errorMessage(submit.error) : null}
          onBack={startOver}
          onConfirm={(target, choices) => submit.mutate({ target, choices })}
        />
      ) : token ? (
        <BoardPicker
          workspaceId={ws.id}
          token={token}
          onPick={(boardId) => preview.mutate({ kind: 'api', boardId })}
          onDisconnect={() => setToken(null)}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-medium">Upload CSV</h2>
            <p className="mb-3 mt-1 text-sm text-slate-600">
              Trello → board menu → Print, export and share → Export as CSV. Up to 20 MB. Attachments come over as links.
            </p>
            <label className="tap inline-flex cursor-pointer items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              Choose CSV file
              <input type="file" accept=".csv,text/csv" className="sr-only" aria-label="Trello CSV export" onChange={onFile} />
            </label>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-medium">Connect Trello</h2>
            <p className="mb-3 mt-1 text-sm text-slate-600">
              Read-only access. Brings comments with their authors and dates, and copies uploaded files.
            </p>
            <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
              Connect Trello
            </Button>
          </section>
        </div>
      )}
    </main>
  );
}

function BoardPicker({ workspaceId, token, onPick, onDisconnect }: { workspaceId: string; token: string; onPick: (boardId: string) => void; onDisconnect: () => void }) {
  const boards = useQuery({
    // The token is the request body, never part of the cache key.
    queryKey: ['trello-boards', workspaceId],
    queryFn: () => api.post<Page<TrelloBoardSummary>>(`/workspaces/${workspaceId}/imports/trello/boards`, { trelloToken: token }),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-medium">Pick a board</h2>
        <button type="button" className="text-sm text-slate-600 hover:text-slate-900" onClick={onDisconnect}>
          Use a CSV instead
        </button>
      </div>
      {boards.isPending ? (
        <Spinner label="Loading your Trello boards…" />
      ) : boards.error ? (
        <div className="space-y-2">
          <FormError message={errorMessage(boards.error)} />
          <Button variant="secondary" onClick={() => void boards.refetch()}>
            Try again
          </Button>
        </div>
      ) : boards.data.data.length === 0 ? (
        <p className="text-sm text-slate-600">No open boards on this Trello account.</p>
      ) : (
        <ul className="divide-y divide-slate-200" data-testid="trello-boards">
          {boards.data.data.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{b.name}</span>
                {b.dateLastActivity ? (
                  <span className="block text-xs text-slate-500">Last active {new Date(b.dateLastActivity).toLocaleDateString()}</span>
                ) : null}
              </span>
              <Button variant="secondary" onClick={() => onPick(b.id)}>
                Preview
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
