'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { FormError } from '@/components/auth-card';
import { DropReport } from '@/components/import/drop-report';
import { useToast } from '@/components/toast';
import { Button, Spinner } from '@/components/ui';
import { api, ApiError, download, errorMessage } from '@/lib/api';
import { isFinished, progressPercent, summaryRows } from '@/lib/import';
import type { ImportJob, ImportStats, Project } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { channelsKey } from '@/lib/unread';

const POLL_MS = 1000;

/**
 * §7.1 steps 4–5: a progress bar driven by `GET /imports/:id` — written after
 * each 50-card batch, so it is real (AC32) — then the summary, the drop report
 * and `report.csv` (AC25, AC28). Survives a reload; the job runs server-side.
 */
export default function ImportJobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const ws = useWorkspace();
  const toast = useToast();
  const qc = useQueryClient();

  const job = useQuery({
    queryKey: ['import', jobId],
    queryFn: () => api.get<ImportJob>(`/imports/${jobId}`),
    refetchInterval: (q) => (q.state.data && isFinished(q.state.data.status) ? false : POLL_MS),
  });
  const done = job.data ? isFinished(job.data.status) : false;
  useEffect(() => {
    if (!done) return;
    // The persistent sidebar must discover projects/channels created by the job.
    void qc.invalidateQueries({ queryKey: ['projects', ws.id] });
    void qc.invalidateQueries({ queryKey: channelsKey(ws.id) });
  }, [done, qc, ws.id]);
  const project = useQuery({
    queryKey: ['project', job.data?.projectId],
    queryFn: () => api.get<Project>(`/projects/${job.data?.projectId ?? ''}`),
    enabled: done && job.data?.status !== 'failed',
  });
  const report = useMutation({
    mutationFn: () => download(`/imports/${jobId}/report.csv`, `import-${jobId}.csv`),
    onError: (err) => toast(errorMessage(err)),
  });

  if (job.isPending) return <Spinner />;
  if (job.error) {
    const missing = job.error instanceof ApiError && job.error.status === 404;
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-8">
        <FormError message={missing ? 'Import not found.' : errorMessage(job.error)} />
      </main>
    );
  }

  const j = job.data;
  const pct = progressPercent(j);
  const p = j.stats.progress;
  const heading = {
    pending: 'Import queued',
    running: 'Importing…',
    succeeded: 'Import complete',
    partial: 'Import finished with errors',
    failed: 'Import failed',
  }[j.status];

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="import-status" data-status={j.status}>
          {heading}
        </h1>
        <p className="text-sm text-secondary-foreground">{j.source === 'trello_api' ? 'From Trello' : 'From a Trello CSV export'}</p>
      </div>

      {j.status !== 'failed' ? (
        <section>
          <div
            role="progressbar"
            aria-label="Import progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div className={`h-full transition-[width] ${j.status === 'partial' ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-sm text-secondary-foreground" data-testid="import-progress">
            {p && p.totalCards ? `${p.processedCards} of ${p.totalCards} cards` : done ? 'No cards on this board' : 'Getting started…'}
          </p>
        </section>
      ) : null}

      {j.status === 'failed' ? <FormError message={j.error?.message ?? 'The import did not run. Nothing was changed.'} /> : null}
      {j.status === 'partial' ? (
        <p role="alert" className="rounded-md bg-warning-subtle px-3 py-2 text-sm text-warning-text">
          Some cards could not be imported. Everything else is in place; report.csv lists the rows that failed.
        </p>
      ) : null}

      {done && j.stats.counts ? <Summary stats={j.stats as ImportStats} /> : null}

      {done ? (
        <div className="flex flex-wrap gap-2">
          {project.data ? (
            <Link href={`/w/${ws.slug}/p/${project.data.id}/b/${project.data.defaultBoardId}`} className="tap inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-inverse-foreground hover:bg-primary-hover">
              Open {project.data.name}
            </Link>
          ) : null}
          <Button variant="secondary" onClick={() => report.mutate()} disabled={report.isPending}>
            Download report.csv
          </Button>
          <Link href={`/w/${ws.slug}/import`} className="tap inline-flex items-center px-3 text-sm text-secondary-foreground hover:text-foreground">
            Import another board
          </Link>
        </div>
      ) : null}
    </main>
  );
}

function Summary({ stats }: { stats: ImportStats }) {
  const { attachments, assignees, comments, cards } = stats.counts;
  const extras = [
    attachments.files ? `${attachments.files} files copied` : null,
    attachments.links ? `${attachments.links} attachments as links` : null,
    attachments.skipped ? `${attachments.skipped} attachments skipped` : null,
    comments.archive ? `${comments.archive} archive comments (CSV has no per-comment authors)` : null,
    assignees.assigned ? `${assignees.assigned} assignments` : null,
    assignees.unmatched ? `${assignees.unmatched} assignments to unmatched members left off` : null,
    cards.failed ? `${cards.failed} cards failed` : null,
    stats.fieldDrops.titlesTruncated ? `${stats.fieldDrops.titlesTruncated} titles shortened` : null,
  ].filter((x): x is string => Boolean(x));

  return (
    <>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 font-medium">Summary</h2>
        <table className="w-full text-sm tabular-nums" data-testid="import-counts">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-normal">&nbsp;</th>
              <th className="py-1 text-right font-normal">Created</th>
              <th className="py-1 text-right font-normal">Updated</th>
              <th className="py-1 text-right font-normal">Skipped</th>
              <th className="py-1 text-right font-normal">Dropped</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {summaryRows(stats.counts).map((r) => (
              <tr key={r.entity} data-testid={`count-${r.entity}`}>
                <td className="py-1.5">{r.entity}</td>
                <td className="py-1.5 text-right">{r.created}</td>
                <td className="py-1.5 text-right">{r.updated}</td>
                <td className="py-1.5 text-right">{r.skipped}</td>
                <td className="py-1.5 text-right">{r.dropped}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {extras.length ? <p className="mt-3 text-sm text-secondary-foreground">{extras.join(' · ')}</p> : null}
        {stats.notices.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary-foreground">
            {stats.notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-medium">Not imported</h2>
        <p className="text-sm text-secondary-foreground">Trello data with no equivalent here. report.csv has the per-row detail.</p>
        <DropReport drops={stats.dropped} />
      </section>
    </>
  );
}
