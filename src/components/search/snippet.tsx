import type { SearchHit } from '@/lib/types';

/** Server-highlighted snippet parts, rendered as text nodes — never as HTML. */
export function Snippet({ parts }: { parts: SearchHit['snippet'] }) {
  return (
    <span className="text-sm text-secondary-foreground">
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded bg-highlight px-0.5 text-highlight-foreground">
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
