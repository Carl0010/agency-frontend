import { BrandMark } from './icon';
import type { ReactNode } from 'react';

export function AuthCard({
  title,
  children,
  footer,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <p className="mb-7 flex items-center gap-2.5 text-body-lg font-semibold tracking-tight text-foreground">
          <BrandMark />
          Agency
        </p>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="mb-6 text-page font-semibold leading-tight tracking-tight">{title}</h1>
          {children}
        </div>
        {footer ? <div className="mt-5 text-sm text-secondary-foreground">{footer}</div> : null}
      </div>
    </main>
  );
}

export function FormError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-md border border-danger-border bg-danger-subtle px-3 py-2.5 text-body text-danger-text">
      {message}
    </p>
  ) : null;
}
