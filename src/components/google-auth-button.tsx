/**
 * Full-width "… with Google" button for the log-in and sign-up pages; the API runs the OAuth flow.
 * The "G" is Google's own asset (public/google-g.svg): its branding guidelines fix its colours.
 */
export function GoogleAuthButton({ label, next }: { label: string; next?: string | null }) {
  const href = `/api/v1/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  return (
    <a
      className="tap flex w-full items-center justify-center gap-2.5 rounded-md border border-input py-2 text-sm font-medium hover:bg-background"
      href={href}
    >
      <img src="/google-g.svg" alt="" width={20} height={20} className="size-5 shrink-0" />
      {label}
    </a>
  );
}
