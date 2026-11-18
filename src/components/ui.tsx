'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, HTMLAttributes, ReactNode, Ref } from 'react';
import { AVATAR_COLORS } from '@/lib/content-colors';
import { Icon, type IconName } from './icon';
export { LABEL_BG } from '@/lib/content-colors';

import type { PersonRef } from '@/lib/types';

export function Button({
  variant = 'primary', size = 'default', className = '', ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: Ref<HTMLButtonElement>;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'default' | 'sm' | 'icon';
}) {
  const styles = {
    primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:bg-primary-active',
    secondary: 'border border-input bg-surface text-foreground shadow-sm hover:border-border-hover hover:bg-subtle active:bg-muted',
    ghost: 'text-secondary-foreground hover:bg-subtle hover:text-foreground active:bg-muted',
    danger: 'bg-danger text-inverse-foreground hover:bg-danger-hover active:bg-danger-active',
  }[variant];
  const sizes = { default: '', sm: 'min-h-8 px-2.5', icon: 'size-9 p-0' }[size];
  return <button type="button" className={`ui-button tap disabled:pointer-events-none ${styles} ${sizes} ${className}`} {...props} />;
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input className={`ui-input tap ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ui-input min-h-24 resize-y ${className}`} {...props} />;
}

/** Native select for short, fixed lists (up to ~10 options). For long or searchable lists use Combobox. */
export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return <select className={`ui-input ui-select tap ${className}`} {...props} />;
}

export { Combobox, MultiCombobox, type ListOption } from './combobox';

/** A checkbox with its label (and optional description) as one click target. Use inside forms saved later. */
export function Checkbox({ label, description, className = '', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode; description?: ReactNode;
}) {
  return (
    <label className={`ui-check ${props.disabled ? 'opacity-50' : ''} ${className}`}>
      <input type="checkbox" className="ui-check-input" {...props} />
      <span className="min-w-0">
        <span className="block text-body text-foreground">{label}</span>
        {description ? <span className="block text-label text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  );
}

/** One choice from 2–5 visible options. More options, or long labels: use Select or Combobox. */
export function RadioGroup<V extends string>({ legend, name, value, onChange, options, disabled, className = '' }: {
  legend: ReactNode; name: string; value: V; onChange: (value: V) => void; disabled?: boolean; className?: string;
  options: Array<{ value: V; label: ReactNode; description?: ReactNode; disabled?: boolean }>;
}) {
  return (
    <fieldset className={`space-y-2 ${className}`} disabled={disabled}>
      <legend className="mb-1 text-label font-medium text-secondary-foreground">{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className={`ui-check ${o.disabled || disabled ? 'opacity-50' : ''}`}>
          <input type="radio" className="ui-check-input" name={name} value={o.value} checked={value === o.value}
            disabled={o.disabled} onChange={() => onChange(o.value)} />
          <span className="min-w-0">
            <span className="block text-body text-foreground">{o.label}</span>
            {o.description ? <span className="block text-label text-muted-foreground">{o.description}</span> : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** An on/off setting that applies immediately. Inside a form with a Save button, use Checkbox. */
export function Switch({ checked, onChange, label, disabled, className = '' }: {
  checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; disabled?: boolean; className?: string;
}) {
  return (
    <label className={`ui-check items-center ${disabled ? 'opacity-50' : ''} ${className}`}>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} className="ui-switch"
        onClick={() => onChange(!checked)}>
        <span className="ui-switch-thumb" />
      </button>
      <span className="text-body text-foreground">{label}</span>
    </label>
  );
}

/** Keyboard shortcut keys, e.g. <Kbd keys={['⌘', 'K']} />. */
export function Kbd({ keys }: { keys: string[] }) {
  return <span className="inline-flex gap-0.5">{keys.map((k) => <kbd key={k} className="ui-kbd">{k}</kbd>)}</span>;
}

export function Panel({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-panel ${className}`} {...props} />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><h1 className="text-page font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-body text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ title, description, icon = 'board', action }: { title: string; description: string; icon?: IconName; action?: ReactNode }) {
  return (
    <div className="ui-panel flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-subtle text-secondary-foreground"><Icon name={icon} className="size-5" /></span>
      <h2 className="text-body-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-body text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

const BADGE_TONES = {
  neutral: 'bg-subtle text-secondary-foreground',
  primary: 'bg-primary-subtle text-primary-text',
  success: 'bg-success-subtle text-success-text',
  warning: 'bg-warning-subtle text-warning-text',
  danger: 'bg-danger-subtle text-danger-text',
  info: 'bg-info-subtle text-info-text',
};

export function Badge({ tone = 'neutral', className = '', ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof BADGE_TONES }) {
  return <span className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-caption font-medium ${BADGE_TONES[tone]} ${className}`} {...props} />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-label font-medium text-secondary-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

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
    <img src={person.avatarUrl} alt={person.name} title={person.name} style={style} className="rounded-full object-cover ring-2 ring-surface" />
  ) : (
    <span
      title={person.active === false ? `${person.name} (deactivated)` : person.name}
      style={style}
      className={`inline-flex items-center justify-center rounded-full font-semibold tracking-tight text-inverse-foreground ring-2 ring-surface ${
        person.active === false ? 'bg-disabled-foreground' : color
      }`}
    >
      {initials(person.name)}
    </span>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center p-8 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

/** The `Guest` chip (§3.4, §3.6): on guest-authored comments and messages, and in the portal header with the access level. */
export function GuestChip({ access }: { access?: 'read' | 'comment' }) {
  return (
    <span data-testid="guest-chip" className="inline-flex items-center rounded-sm bg-subtle px-2 py-0.5 text-caption font-medium text-secondary-foreground">
      Guest{access ? ` · ${access === 'comment' ? 'Can comment' : 'View only'}` : ''}
    </span>
  );
}
