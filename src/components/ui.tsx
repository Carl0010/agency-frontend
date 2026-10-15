'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import type { PersonRef } from '@/lib/types';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:bg-blue-300 disabled:shadow-none',
    secondary: 'border border-slate-300 bg-white text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-50 disabled:text-slate-400 disabled:shadow-none',
    ghost: 'text-slate-700 hover:bg-slate-200/70 disabled:text-slate-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  }[variant];
  return (
    <button
      type="button"
      className={`tap inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`tap w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 transition-shadow hover:border-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/15 ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[13px] font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

const AVATAR_COLORS = ['bg-[#9a4b43]', 'bg-[#a0722c]', 'bg-[#4a7a5c]', 'bg-[#4a6f8a]', 'bg-[#7a5a85]', 'bg-[#3f7a77]'];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export function Avatar({ person, size = 24 }: { person: Pick<PersonRef, 'id' | 'name' | 'avatarUrl'> & { active?: boolean }; size?: number }) {
  const color = AVATAR_COLORS[[...person.id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const style = { width: size, height: size, fontSize: Math.max(9, size * 0.4) };
  return person.avatarUrl ? (
    <img src={person.avatarUrl} alt={person.name} title={person.name} style={style} className="rounded-md object-cover ring-2 ring-white" />
  ) : (
    <span
      title={person.active === false ? `${person.name} (deactivated)` : person.name}
      style={style}
      className={`inline-flex items-center justify-center rounded-md font-semibold tracking-tight text-white ring-2 ring-white ${
        person.active === false ? 'bg-slate-400' : color
      }`}
    >
      {initials(person.name)}
    </span>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center p-8 text-sm text-slate-500">
      {label}
    </div>
  );
}

export const LABEL_BG: Record<string, string> = {
  grey: 'bg-slate-400',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-400',
  green: 'bg-green-500',
  teal: 'bg-teal-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  brown: 'bg-amber-800',
};

/** The `Guest` chip (§3.4, §3.6): on guest-authored comments and messages, and in the portal header with the access level. */
export function GuestChip({ access }: { access?: 'read' | 'comment' }) {
  return (
    <span data-testid="guest-chip" className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
      Guest{access ? ` · ${access === 'comment' ? 'Can comment' : 'View only'}` : ''}
    </span>
  );
}
