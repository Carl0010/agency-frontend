'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TeamPicker } from '@/components/teams/team-picker';
import { useTeams } from '@/lib/teams';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AuthCard, FormError } from '@/components/auth-card';
import { Button, Field, Input, Spinner } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { formText } from '@/lib/form';
import { rememberWorkspace } from '@/lib/landing';
import { useSession } from '@/lib/session';
import type { Page, Project, Seats, TemplateSummary, Workspace } from '@/lib/types';

type Step = 1 | 2 | 3 | 4;
const LABELS = ['Workspace', 'First project', 'Invite your team', 'Bring your work over'] as const;

/**
 * The 4-step setup stepper (§3.5, AC20–AC24). Every step is skippable. The
 * current step is saved on `workspace.onboarding_state` as the user moves, so
 * closing the tab and coming back resumes at the same step; the header's
 * "Finish setup (n/4)" chip brings them back until they dismiss it.
 */
export default function OnboardingPage() {
  const { user } = useSession();
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (user === null) router.replace('/login?next=/onboarding');
  }, [user, router]);

  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<Page<Workspace>>('/workspaces'),
    enabled: Boolean(user),
  });
  const ws = workspaces.data?.data.find((w) => w.role === 'owner');
  const [step, setStep] = useState<Step | null>(null);

  useEffect(() => {
    if (!workspaces.data) return;
    if (!ws?.setup) {
      // Invited members and guests never see the stepper (AC27, AC28).
      router.replace('/');
      return;
    }
    setStep((s) => s ?? (ws.setup!.step as Step));
  }, [workspaces.data, ws, router]);

  if (!ws?.setup || step === null) return <Spinner />;

  const refresh = async (): Promise<Workspace> => {
    const fresh = await api.get<Workspace>(`/workspaces/${ws.id}`);
    await qc.invalidateQueries({ queryKey: ['workspaces'] });
    await qc.invalidateQueries({ queryKey: ['workspace', fresh.slug] });
    return fresh;
  };
  /** Records progress and moves on; a skip is remembered as a skip, not as done. */
  const advance = async (from: Step, patch: Record<string, unknown> = {}) => {
    const next = Math.min(4, from + 1) as Step;
    await api.patch(`/workspaces/${ws.id}/onboarding`, { ...patch, step: next });
    await refresh();
    setStep(next);
  };
  const skip = (from: Step) => advance(from, { skip: from });
  const finish = async (path: (fresh: Workspace) => string, patch: Record<string, unknown> = {}) => {
    await api.patch(`/workspaces/${ws.id}/onboarding`, { ...patch, completed: true });
    const fresh = await refresh();
    rememberWorkspace(fresh.slug);
    router.replace(path(fresh));
  };

  const header = (
    <div className="mb-4 space-y-2">
      <ol className="flex flex-wrap gap-1.5 text-xs font-medium" aria-label="Setup progress">
        {LABELS.map((label, i) => (
          <li
            key={label}
            aria-current={step === i + 1 ? 'step' : undefined}
            className={`rounded-full px-2 py-1 ${step === i + 1 ? 'bg-primary-muted text-primary-text' : ws.setup!.stepsDone[i] ? 'bg-success-subtle text-success-text' : 'bg-subtle text-muted-foreground'}`}
          >
            {ws.setup!.stepsDone[i] ? '✓ ' : `${i + 1}. `}
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
  const later = (
    <button
      type="button"
      className="text-secondary-foreground underline-offset-2 hover:underline"
      onClick={() => void finish((f) => `/w/${f.slug}/projects`)}
    >
      Finish setup later
    </button>
  );

  switch (step) {
    case 1:
      return <WorkspaceStep ws={ws} header={header} footer={later} onDone={() => advance(1, { workspaceNamed: true })} onSkip={() => skip(1)} />;
    case 2:
      return <ProjectStep ws={ws} header={header} footer={later} onDone={() => advance(2)} onSkip={() => skip(2)} />;
    case 3:
      return <InviteStep ws={ws} header={header} footer={later} onDone={() => advance(3, { memberInvited: true })} onSkip={() => skip(3)} />;
    case 4:
      return <WorkStep ws={ws} header={header} footer={later} finish={finish} />;
  }
}

interface StepProps {
  ws: Workspace;
  header: ReactNode;
  footer: ReactNode;
}

function StepButtons({ busy, label, onSkip, disabled }: { busy: boolean; label: string; onSkip: () => Promise<void>; disabled?: boolean }) {
  return (
    <div className="flex justify-between">
      <Button variant="ghost" disabled={busy} onClick={() => void onSkip()}>
        Skip
      </Button>
      <Button type="submit" disabled={busy || disabled}>
        {busy ? 'Saving…' : label}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — workspace name, slug, timezone (AC21)
// ---------------------------------------------------------------------------

function WorkspaceStep({ ws, header, footer, onDone, onSkip }: StepProps & { onDone: () => Promise<void>; onSkip: () => Promise<void> }) {
  const [name, setName] = useState(ws.name);
  const [slug, setSlug] = useState(ws.slug);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const slugValid = /^[a-z0-9-]{3,40}$/.test(slug);
  const availability = useQuery({
    queryKey: ['slug', slug],
    queryFn: () => api.get<{ available: boolean }>(`/workspaces/slug-availability?slug=${encodeURIComponent(slug)}`),
    enabled: slugValid && slug !== ws.slug,
  });
  const slugOk = slug === ws.slug || (slugValid && availability.data?.available === true);
  const slugHint =
    slug === ws.slug
      ? `Your workspace lives at /w/${slug}`
      : !slugValid
        ? '3–40 lowercase letters, digits or dashes.'
        : availability.isFetching
          ? 'Checking…'
          : availability.data?.available
            ? `✓ /w/${slug} is available`
            : 'That address is taken or reserved.';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slugOk) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch('/me', { timezone });
      await api.patch(`/workspaces/${ws.id}`, { name, ...(slug !== ws.slug ? { slug } : {}) });
      await onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Name your workspace" footer={footer}>
      {header}
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <FormError message={error} />
        <Field label="Agency name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </Field>
        <Field label="Workspace address" hint={<span data-testid="slug-hint">{slugHint}</span>}>
          <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} required />
        </Field>
        <Field label="Timezone">
          <Input value={timezone} readOnly aria-readonly />
        </Field>
        <StepButtons busy={busy} label="Continue" onSkip={onSkip} disabled={!slugOk || !name.trim()} />
      </form>
    </AuthCard>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — first project (AC22)
// ---------------------------------------------------------------------------

function ProjectStep({ ws, header, footer, onDone, onSkip }: StepProps & { onDone: () => Promise<void>; onSkip: () => Promise<void> }) {
  const teams = useTeams(ws.id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const existing = ws.setup?.projectId ?? null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      if (!existing) {
        // One transaction on the server: project, board, three lists, both channels.
        await api.post<Project>(`/workspaces/${ws.id}/projects`, {
          name: formText(form, 'name'),
          teamIds: form.getAll('teamIds').map(String),
        });
      }
      await onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Your first project" footer={footer}>
      {header}
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <FormError message={error} />
        {existing ? (
          <p className="rounded-md bg-success-subtle px-3 py-2 text-sm text-success-text">Your first project is set up.</p>
        ) : (
          <>
            <Field label="Project name" hint="e.g. “Acme — Q4 site rebuild”">
              <Input name="name" required maxLength={120} />
            </Field>
            <TeamPicker workspaceId={ws.id} disabled={busy} />
          </>
        )}
        <StepButtons busy={busy || (!existing && (teams.isPending || Boolean(teams.error)))} label={existing ? 'Continue' : 'Create project'} onSkip={onSkip} />
      </form>
    </AuthCard>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — invite up to 4 teammates (AC23)
// ---------------------------------------------------------------------------

interface InviteRow {
  key: number;
  email: string;
  role: 'member' | 'admin';
  error: string | null;
  sent: boolean;
}

function InviteStep({ ws, header, footer, onDone, onSkip }: StepProps & { onDone: () => Promise<void>; onSkip: () => Promise<void> }) {
  const teams = useTeams(ws.id);
  const qc = useQueryClient();
  const seats = useQuery({ queryKey: ['seats', ws.id], queryFn: () => api.get<Seats>(`/workspaces/${ws.id}/seats`) });
  const [rows, setRows] = useState<InviteRow[]>([{ key: 0, email: '', role: 'member', error: null, sent: false }]);
  const [busy, setBusy] = useState(false);
  // The 5th seat is the owner's (§3.5): four rows at most.
  const MAX_ROWS = 4;

  const update = (key: number, patch: Partial<InviteRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const teamIds = new FormData(e.currentTarget).getAll('teamIds').map(String);
    if (teamIds.length > 50) { update(rows[0]!.key, { error: 'Choose at most 50 teams.' }); return; }
    setBusy(true);
    let failed = false;
    let sent = false;
    for (const row of rows) {
      if (row.sent || !row.email.trim()) continue;
      try {
        await api.post(`/workspaces/${ws.id}/members/invites`, { email: row.email.trim(), role: row.role, teamIds });
        update(row.key, { sent: true, error: null });
        sent = true;
      } catch (err) {
        failed = true;
        const message =
          err instanceof ApiError && err.code === 'seat_limit_reached'
            ? `All ${String(err.details.included)} seats are in use.`
            : errorMessage(err);
        update(row.key, { error: message });
      }
    }
    await qc.invalidateQueries({ queryKey: ['seats', ws.id] });
    if (failed) {
      setBusy(false);
      return;
    }
    if (sent || rows.some((r) => r.sent)) await onDone();
    else setBusy(false);
  }

  const full = seats.data?.full ?? false;
  return (
    <AuthCard title="Invite your team" footer={footer} wide>
      {header}
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        {seats.data ? (
          <p data-testid="seat-meter" className={`text-sm font-medium ${full ? 'text-warning-text' : 'text-secondary-foreground'}`}>
            {seats.data.used} of {seats.data.included} seats used
            {full ? ' — your plan is full' : ''}
          </p>
        ) : null}
        {rows.map((row, i) => (
          <div key={row.key} className="space-y-1">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                type="email"
                aria-label={`Teammate ${i + 1} email`}
                placeholder="name@agency.com"
                value={row.email}
                disabled={row.sent}
                onChange={(e) => update(row.key, { email: e.target.value, error: null })}
              />
              <select
                aria-label={`Teammate ${i + 1} role`}
                value={row.role}
                disabled={row.sent}
                onChange={(e) => update(row.key, { role: e.target.value as InviteRow['role'] })}
                className="tap rounded-md border border-input bg-surface px-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {row.sent ? <p className="text-xs text-success-text">Invite sent.</p> : null}
            {row.error ? (
              <p role="alert" className="text-xs text-danger-text">
                {row.error}
              </p>
            ) : null}
          </div>
        ))}
        {rows.length < MAX_ROWS && !full ? (
          <button
            type="button"
            className="text-sm font-medium text-primary hover:underline"
            onClick={() => setRows((rs) => [...rs, { key: Date.now(), email: '', role: 'member', error: null, sent: false }])}
          >
            + Add another
          </button>
        ) : null}
        <p className="text-xs text-muted-foreground">Guests are free and don&apos;t use a seat — invite them from a project later.</p>
        <TeamPicker workspaceId={ws.id} disabled={busy} />
        <StepButtons busy={busy || teams.isPending || Boolean(teams.error)} label="Send invites" onSkip={onSkip} disabled={!rows.some((r) => r.email.trim() && !r.sent)} />
      </form>
    </AuthCard>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — import, template, or empty (AC24)
// ---------------------------------------------------------------------------

function WorkStep({
  ws,
  header,
  footer,
  finish,
}: StepProps & { finish: (path: (fresh: Workspace) => string, patch?: Record<string, unknown>) => Promise<void> }) {
  const templates = useQuery({ queryKey: ['templates'], queryFn: () => api.get<Page<TemplateSummary>>('/onboarding/templates') });
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** The project step 2 made; if they skipped it, make one now. */
  async function targetProject(name: string): Promise<Project> {
    if (ws.setup?.projectId) return api.get<Project>(`/projects/${ws.setup.projectId}`);
    return api.post<Project>(`/workspaces/${ws.id}/projects`, { name });
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  const applyTemplate = (t: TemplateSummary) =>
    run(t.id, async () => {
      const project = await targetProject(t.name);
      const applied = await api.post<{ projectId: string; boardId: string }>(`/projects/${project.id}/template`, { templateId: t.id });
      await finish((f) => `/w/${f.slug}/p/${applied.projectId}/b/${applied.boardId}`);
    });

  const startEmpty = () =>
    run('empty', async () => {
      const project = ws.setup?.projectId ? await api.get<Project>(`/projects/${ws.setup.projectId}`) : null;
      await finish((f) => (project ? `/w/${f.slug}/p/${project.id}/b/${project.defaultBoardId}` : `/w/${f.slug}/projects`), { startedEmpty: true });
    });

  const importTrello = () => run('import', () => finish((f) => `/w/${f.slug}/import`));

  const card = 'flex flex-col items-start gap-1 rounded-lg border border-border bg-surface p-4 text-left hover:border-primary-border hover:shadow-sm disabled:opacity-60';
  return (
    <AuthCard title="Bring your work over" footer={footer} wide>
      {header}
      <FormError message={error} />
      {picking ? (
        <div className="space-y-3">
          <p className="text-sm text-secondary-foreground">Pick a starting board. You can rename, move or delete anything afterwards.</p>
          {templates.isPending ? <Spinner /> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            {(templates.data?.data ?? []).map((t) => (
              <button key={t.id} type="button" className={card} disabled={busy !== null} onClick={() => void applyTemplate(t)} aria-label={`Use the ${t.name} template`}>
                <span className="font-medium">{t.name}</span>
                <span className="text-sm text-secondary-foreground">{t.description}</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  {t.lists.length} lists · {t.cardCount} example cards
                </span>
                {busy === t.id ? <span className="text-xs text-primary">Setting up…</span> : null}
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setPicking(false)} disabled={busy !== null}>
            Back
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <button type="button" className={card} disabled={busy !== null} onClick={() => void importTrello()}>
            <span className="font-medium">Import from Trello</span>
            <span className="text-sm text-secondary-foreground">Bring a board over with its lists, cards, checklists and comments.</span>
          </button>
          <button type="button" className={card} disabled={busy !== null} onClick={() => setPicking(true)}>
            <span className="font-medium">Start from a template</span>
            <span className="text-sm text-secondary-foreground">Project onboarding, Design sprint or Website build — with example cards.</span>
          </button>
          <button type="button" className={card} disabled={busy !== null} onClick={() => void startEmpty()}>
            <span className="font-medium">Start empty</span>
            <span className="text-sm text-secondary-foreground">A clean board with To do, In progress and Done.</span>
          </button>
        </div>
      )}
    </AuthCard>
  );
}
