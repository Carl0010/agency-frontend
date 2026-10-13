'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import type { PersonRef } from '@/lib/types';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:text-slate-400',
    ghost: 'text-slate-700 hover:bg-slate-200/70 disabled:text-slate-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  }[variant];
  return (
    <button
      type="button"
      className={`tap inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`tap w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

const AVATAR_COLORS = ['bg-rose-500', 'bg-amber-500', 'bg-emerald-600', 'bg-sky-600', 'bg-violet-600', 'bg-teal-600'];

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
    <img src={person.avatarUrl} alt={person.name} title={person.name} style={style} className="rounded-full object-cover ring-2 ring-white" />
  ) : (
    <span
      title={person.active === false ? `${person.name} (deactivated)` : person.name}
      style={style}
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-white ${
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
