import type { SVGProps } from 'react';

const paths = {
  projects: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  inbox: <><path d="m3 13 3-9h12l3 9v7H3v-7Z" /><path d="M3 13h5l2 3h4l2-3h5" /></>,
  people: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5" /></>,
  settings: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" fill="var(--color-background)" /><circle cx="15" cy="12" r="2" fill="var(--color-background)" /><circle cx="9" cy="18" r="2" fill="var(--color-background)" /></>,
  'credit-card': <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h3" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  logout: <><path d="M9 3H4v18h5M10 12h11m-4-4 4 4-4 4" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
  person: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  reply: <path d="m9 5-6 6 6 6M3 11h11a7 7 0 0 1 7 7" />,
  mention: <><circle cx="11" cy="12" r="4" /><path d="M15 8v7c0 3 6 2 6-3a9 9 0 1 0-3 7" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  comment: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 1v-8.5A8.5 8.5 0 0 1 11.5 4H13a8 8 0 0 1 8 7.5Z" />,
  attachment: <path d="m8 12 6.5-6.5a3 3 0 0 1 4.2 4.2L10 18.4a4.5 4.5 0 0 1-6.4-6.4L13 2.6" />,
  description: <path d="M5 6h14M5 10h14M5 14h14M5 18h8" />,
  check: <path d="m5 12 4 4L19 6" />,
  checklist: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m7 12 3 3 7-7" /></>,
  grip: <><path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" strokeWidth="3" /></>,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  arrow: <path d="M7 17 17 7M7 7h10v10" />,
  board: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16M15 4v16" /></>,
  import: <><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
} as const;

export type IconName = keyof typeof paths;

/** Consistent 24-unit outline icons; label the owning control, not its decoration. */
export function Icon({ name, className = 'size-4', ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className} {...props}>{paths[name]}</svg>;
}

export function BrandMark({ className = 'size-7' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" className="size-4"><path d="M4 17V7h4v10H4Zm6 0V4h4v13h-4Zm6 0V9h4v8h-4Z" fill="currentColor" /></svg>
    </span>
  );
}
