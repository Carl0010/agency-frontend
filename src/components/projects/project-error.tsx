'use client';

import Link from 'next/link';
import { ApiError, errorMessage } from '@/lib/api';
import { useWorkspace } from '@/lib/workspace';
import { Button } from '@/components/ui';

export function ProjectError({ error, retry }: { error: unknown; retry?: () => void }) {
  const ws = useWorkspace();
  const missing = error instanceof ApiError && error.code === 'not_found';
  return <div role="alert" className="space-y-3 p-6 text-center">
    <h1 className="text-body-lg font-semibold">{missing ? "You don't have access to this project" : 'Could not load project'}</h1>
    <p className="text-label text-secondary-foreground">{missing ? 'It may no longer be shared with you, or may no longer exist.' : errorMessage(error)}</p>
    <Link href={`/w/${ws.slug}/projects`} className="ui-button tap text-primary">Back to projects</Link>
    {!missing && retry ? <Button variant="secondary" onClick={retry}>Try again</Button> : null}
  </div>;
}
