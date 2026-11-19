'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui';
import { parseGrouping } from '@/lib/board-grouping';

export function GroupingSelect({ guest = false }: { guest?: boolean }) {
  const pathname = usePathname(); const router = useRouter(); const params = useSearchParams();
  return <label className="flex shrink-0 items-center gap-2 text-label text-secondary-foreground"><span>Group by</span><Select aria-label="Group by" size="sm" className="w-36" value={parseGrouping(params.get('group'), guest)}
    options={[{ value: 'list', label: 'List' }, ...(!guest ? [{ value: 'assignee', label: 'Assignee' }] : []), { value: 'due', label: 'Due date' }]}
    onChange={(group) => {
      const next = new URLSearchParams(window.location.search);
      if (group === 'list') next.delete('group'); else next.set('group', group);
      router.push(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
    }} /></label>;
}
