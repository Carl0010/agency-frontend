'use client';

import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import type { Project } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { ProjectEditor } from './project-editor';

/** Native popover handles outside dismissal, Escape and focus return. */
export function ProjectMenu({ project, onNavigate }: { project: Project; onNavigate?: () => void }) {
  const ws = useWorkspace();
  const toast = useToast();
  const id = useId();
  const popover = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [editing, setEditing] = useState(false);
  const board = `/w/${ws.slug}/p/${project.id}/b/${project.defaultBoardId}`;
  const dismiss = () => popover.current?.hidePopover();
  return <>
    <Button variant="ghost" size="icon" aria-label={`Project actions for ${project.name}`} popoverTarget={id} onClick={(event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setPosition({ left: Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232)), top: Math.min(rect.bottom + 4, window.innerHeight - 200) });
    }}><Icon name="more" /></Button>
    <div ref={popover} id={id} popover="auto" role="group" aria-label={`${project.name} actions`} style={position} className="fixed m-0 w-56 rounded-xl border border-border bg-surface p-1.5 text-foreground shadow-lg">
      <p className="truncate px-3 py-2 text-caption font-medium text-muted-foreground">{project.name}</p>
      <Link href={board} onClick={() => { dismiss(); onNavigate?.(); }} className="ui-nav-link tap"><Icon name="board" />Open board</Link>
      <button type="button" className="ui-nav-link tap w-full" onClick={() => { dismiss(); setEditing(true); }}><Icon name="settings" />Edit project</button>
      <button type="button" className="ui-nav-link tap w-full" onClick={async () => {
        dismiss();
        try { await navigator.clipboard.writeText(new URL(board, window.location.origin).href); toast('Project link copied.'); }
        catch (error) { toast(errorMessage(error)); }
      }}><Icon name="attachment" />Copy project link</button>
    </div>
    {editing ? <ProjectEditor project={project} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} /> : null}
  </>;
}
