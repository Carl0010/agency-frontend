'use client';

import { LoadingSkeleton } from '@/components/skeleton';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { ProjectError } from '@/components/projects/project-error';
import { api, ApiError } from '@/lib/api';
import { cardUrl } from '@/lib/card-url';
import { cardDetailKey, cardPath } from '@/lib/cards';
import type { CardDetail, Project } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

/** Every member project surface rechecks the authoritative project after access changes. */
export default function ProjectLayout({ children }: { children: ReactNode }) {
  const { projectId, cardId } = useParams<{ projectId: string; cardId?: string }>();
  const project = useQuery({ queryKey: ['project', projectId], queryFn: ({ signal }) => api.get<Project>(`/projects/${projectId}`, signal) });
  if (project.isPending) return <LoadingSkeleton variant="cards" className="p-4 sm:p-6" />;
  if (project.error) {
    const error = <ProjectError error={project.error} retry={() => void project.refetch()} />;
    // A card can be in several projects: a link into one the person cannot see opens it in one they can.
    if (cardId && project.error instanceof ApiError && project.error.status === 404) return <CardElsewhere cardId={cardId} projectId={projectId} fallback={error} />;
    return error;
  }
  return children;
}

function CardElsewhere({ cardId, projectId, fallback }: { cardId: string; projectId: string; fallback: ReactNode }) {
  const ws = useWorkspace();
  const router = useRouter();
  const card = useQuery({ queryKey: cardDetailKey(cardId, projectId), queryFn: ({ signal }) => api.get<CardDetail>(cardPath(cardId, projectId), signal), retry: false });
  const shownProject = card.data?.projectId;
  const shownBoard = card.data?.boardId;
  useEffect(() => {
    if (shownProject && shownBoard && shownProject !== projectId) router.replace(cardUrl(ws.id, { projectId: shownProject, boardId: shownBoard }, cardId, window.location.search));
  }, [shownProject, shownBoard, projectId, cardId, ws.id, router]);
  if (card.error || (card.data && card.data.projectId === projectId)) return fallback;
  return <LoadingSkeleton variant="cards" className="p-4 sm:p-6" />;
}
