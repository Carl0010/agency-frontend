import type { SearchHit } from '@/lib/types';

/** Server-highlighted snippet parts, rendered as text nodes — never as HTML. */
export function Snippet({ parts }: { parts: SearchHit['snippet'] }) {
  return (
    <span className="text-sm text-slate-600">
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded bg-yellow-200 px-0.5 text-slate-900">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}

export const TYPE_LABEL = { card: 'Cards', comment: 'Comments', message: 'Messages' } as const;

export function countLabel(g: { count: number; countCapped: boolean }): string {
  return g.countCapped ? `${g.count}+` : String(g.count);
}
