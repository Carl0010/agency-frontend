'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui';
import { parseGrouping } from '@/lib/board-grouping';

export function GroupingSelect({ guest = false }: { guest?: boolean }) {
  const pathname = usePathname(); const router = useRouter(); const params = useSearchParams();
  return <label className="flex shrink-0 items-center gap-2 text-label text-secondary-foreground"><span>Group by</span><Select aria-label="Group by" className="w-auto py-1.5 text-label" value={parseGrouping(params.get('group'), guest)} onChange={(event) => {
    const next = new URLSearchParams(window.location.search);
    if (event.target.value === 'list') next.delete('group'); else next.set('group', event.target.value);
    router.push(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  }}><option value="list">List</option>{!guest ? <option value="assignee">Assignee</option> : null}<option value="due">Due date</option></Select></label>;
}
