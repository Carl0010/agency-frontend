'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthCard, FormError } from '@/components/auth-card';
import { Button, Field, Input, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { rememberWorkspace } from '@/lib/landing';
import { useSession } from '@/lib/session';
import type { Page, Project, Workspace } from '@/lib/types';
import { formText } from '@/lib/form';

/**
 * Onboarding steps 1–2 (§3.5, AC1). Steps 3–4 (invite, templates/import) and
 * the coach-mark tour ship with Slice 4. Every step is skippable and the
 * stepper resumes from `workspace.onboarding_state`.
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
  const [step, setStep] = useState<1 | 2 | null>(null);

  useEffect(() => {
    if (!workspaces.data) return;
    if (!ws) {
      router.replace('/');
      return;
    }
    setStep((s) => s ?? (ws.onboardingState.workspaceNamed ? 2 : 1));
  }, [workspaces.data, ws, router]);

  if (!ws || step === null) return <Spinner />;

  const finish = async (path: string) => {
    rememberWorkspace(ws.slug);
    await qc.invalidateQueries({ queryKey: ['workspaces'] });
    router.replace(path);
  };

  return step === 1 ? (
    <WorkspaceStep
      ws={ws}
      onDone={async () => {
        await qc.invalidateQueries({ queryKey: ['workspaces'] });
        setStep(2);
      }}
    />
  ) : (
    <ProjectStep
      ws={ws}
      onDone={(p) => finish(`/w/${p.slug}/p/${p.project.id}/b/${p.project.defaultBoardId}`)}
      onSkip={async () => {
        await api.patch(`/workspaces/${ws.id}/onboarding`, { dismissed: true });
        await finish(`/w/${ws.slug}/projects`);
      }}
    />
  );
}

function Steps({ current }: { current: 1 | 2 }) {
  return (
    <ol className="mb-4 flex gap-2 text-xs font-medium" aria-label="Setup progress">
      {['Workspace', 'First client project'].map((label, i) => (
        <li
          key={label}
          aria-current={current === i + 1 ? 'step' : undefined}
          className={`rounded-full px-2 py-1 ${current === i + 1 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}`}
        >
          {i + 1}. {label}
        </li>
      ))}
    </ol>
  );
}

function WorkspaceStep({ ws, onDone }: { ws: Workspace; onDone: () => Promise<void> }) {
  const [name, setName] = useState(ws.name);
  const [slug, setSlug] = useState(ws.slug);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const slugValid = /^[a-z0-9-]{3,40}$/.test(slug);
  const availability = useQuery({
    queryKey: ['slug', slug],
    queryFn: () =>
      api.get<{ available: boolean }>(`/workspaces/slug-availability?slug=${encodeURIComponent(slug)}`),
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
      await api.patch(`/workspaces/${ws.id}/onboarding`, { workspaceNamed: true });
      await onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Name your workspace">
      <Steps current={1} />
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
        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => void onDone()}>
            Skip
          </Button>
          <Button type="submit" disabled={busy || !slugOk || !name.trim()}>
            Continue
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}

function ProjectStep({
  ws,
  onDone,
  onSkip,
}: {
  ws: Workspace;
  onDone: (r: { slug: string; project: Project }) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const clientName = formText(form, 'clientName');
      // Creates the project, its board, the three default lists and both channels in one transaction.
      const project = await api.post<Project>(`/workspaces/${ws.id}/projects`, {
        name: formText(form, 'name'),
        ...(clientName ? { clientName } : {}),
      });
      await api.patch(`/workspaces/${ws.id}/onboarding`, { projectCreated: true });
      const fresh = await api.get<Workspace>(`/workspaces/${ws.id}`);
      await onDone({ slug: fresh.slug, project });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Your first client project">
      <Steps current={2} />
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <FormError message={error} />
        <Field label="Project name" hint="e.g. “Acme — Q4 site rebuild”">
          <Input name="name" required maxLength={120} />
        </Field>
        <Field label="Client name">
          <Input name="clientName" maxLength={120} />
        </Field>
        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => void onSkip()}>
            Skip
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create project'}
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}
