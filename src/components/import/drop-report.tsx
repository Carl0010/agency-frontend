import type { ImportDrop } from '@/lib/types';

/** Every §7.4 category with its count, zero included (AC25). `null` = in Trello but not countable from this source. */
export function DropReport({ drops }: { drops: ImportDrop[] }) {
  return (
    <table className="mt-2 w-full text-sm" data-testid="drop-report">
      <tbody className="divide-y divide-border-subtle">
        {drops.map((d) => (
          <tr key={d.key} data-testid="drop-row">
            <td className="py-1.5 pr-3 align-top">
              {d.label}
              {d.breakdown && Object.keys(d.breakdown).length ? (
                <span className="block text-xs text-muted-foreground">
                  {Object.entries(d.breakdown)
                    .map(([k, n]) => `${k}: ${n}`)
                    .join(', ')}
                </span>
              ) : null}
              {d.note ? <span className="block text-xs text-muted-foreground">{d.note}</span> : null}
            </td>
            <td className={`py-1.5 text-right align-top tabular-nums ${d.count ? 'font-medium' : 'text-muted-foreground'}`}>{d.count ?? 'not countable'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
