'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { User } from '@/lib/types';

/**
 * The 3-step coach-mark tour (§3.5, AC25): add a card, open a card, open the
 * client channel. It points at `[data-tour=…]` anchors on whatever screen is
 * up; on the project list (where an invited member lands, AC27) it first
 * points at a project. Non-modal, so it never blocks the board. Finishing or
 * skipping persists on the user — it is never shown twice.
 */

interface TourStep {
  anchor: string;
  title: string;
  body: string;
  /** Counted in "n of 3"; the project-list lead-in is not. */
  counted: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  { anchor: 'project', title: 'Open a client project', body: 'Each client gets a board, a client chat and a team-only channel.', counted: false },
  { anchor: 'add-card', title: 'Add a card', body: 'Cards are the work: a deliverable, a task, a round of feedback.', counted: true },
  { anchor: 'card', title: 'Open a card', body: 'Details, checklists, files and the comment thread live inside.', counted: true },
  { anchor: 'client-channel', title: 'Open the client channel', body: 'Chat with your client here instead of email. They only see what you share.', counted: true },
];

const PROGRESS_KEY = 'agency:tourStep';
const COUNTED = TOUR_STEPS.filter((s) => s.counted).length;

function storedStep(): number {
  try {
    return Number(sessionStorage.getItem(PROGRESS_KEY) ?? '0') || 0;
  } catch {
    return 0;
  }
}

interface Placement {
  index: number;
  top: number;
  left: number;
}

/** The first step at or after `from` whose anchor is on screen now. */
function locate(from: number): Placement | null {
  for (let i = from; i < TOUR_STEPS.length; i++) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${TOUR_STEPS[i]!.anchor}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const width = 288;
    return {
      index: i,
      top: Math.min(window.innerHeight - 180, r.bottom + 8),
      left: Math.max(8, Math.min(window.innerWidth - width - 8, r.left)),
    };
  }
  return null;
}

export function CoachMarks() {
  const { user, setUser } = useSession();
  const pathname = usePathname();
  const [from, setFrom] = useState(storedStep);
  const [place, setPlace] = useState<Placement | null>(null);
  const active = Boolean(user && !user.tourCompletedAt);

  // Anchors appear as data loads and routes change; re-measure on a short poll.
  useEffect(() => {
    if (!active) return;
    const measure = () => setPlace(locate(from));
    measure();
    const t = setInterval(measure, 400);
    window.addEventListener('resize', measure);
    return () => {
      clearInterval(t);
      window.removeEventListener('resize', measure);
    };
  }, [active, from, pathname]);

  const done = useCallback(async () => {
    if (!user) return;
    try {
      sessionStorage.removeItem(PROGRESS_KEY);
    } catch {
      // ignore
    }
    setPlace(null);
    const res = await api.post<{ tourCompletedAt: string }>('/me/tour');
    setUser({ ...user, tourCompletedAt: res.tourCompletedAt } satisfies User);
  }, [user, setUser]);

  if (!active || !place) return null;
  const step = TOUR_STEPS[place.index]!;
  const counted = TOUR_STEPS.slice(0, place.index + 1).filter((s) => s.counted).length;
  const last = place.index === TOUR_STEPS.length - 1;
  const next = () => {
    const n = place.index + 1;
    try {
      sessionStorage.setItem(PROGRESS_KEY, String(n));
    } catch {
      // ignore
    }
    setFrom(n);
  };

  return (
    <div
      role="dialog"
      aria-label={`Tour: ${step.title}`}
      data-testid="coach-mark"
      className="fixed z-50 w-72 rounded-lg border border-blue-200 bg-white p-3 shadow-lg"
      style={{ top: place.top, left: place.left }}
    >
      <p className="text-xs font-medium text-blue-700">{step.counted ? `Step ${counted} of ${COUNTED}` : 'Getting started'}</p>
      <p className="mt-0.5 font-semibold">{step.title}</p>
      <p className="mt-1 text-sm text-slate-600">{step.body}</p>
      <div className="mt-3 flex justify-between">
        <Button variant="ghost" onClick={() => void done()}>
          Skip tour
        </Button>
        {last ? <Button onClick={() => void done()}>Done</Button> : <Button onClick={next}>Next</Button>}
      </div>
    </div>
  );
}
