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
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(60rem_40rem_at_50%_-10%,var(--color-blue-100),transparent)] px-4 py-12">
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-sm'}`}>
        <p className="mb-8 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-slate-900">
          <span aria-hidden className="size-5 rounded-md bg-blue-600 shadow-sm" />
          Agency
        </p>
        <div className="rounded-xl bg-white p-7 shadow-lg ring-1 ring-slate-900/5">
          <h1 className="mb-5 text-2xl font-semibold leading-tight tracking-tight">{title}</h1>
          {children}
        </div>
        {footer ? <div className="mt-5 text-sm text-slate-600">{footer}</div> : null}
      </div>
    </main>
  );
}

export function FormError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  ) : null;
}
