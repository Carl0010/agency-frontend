'use client';

import { Icon, type IconName } from '@/components/icon';

/** A square icon button for editor toolbars. Keeps the editor's selection when pressed. */
export function ToolButton({ label, icon, pressed, onClick, disabled }: { label: string; icon: IconName; pressed?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`tap inline-grid size-8 place-items-center rounded-md text-secondary-foreground hover:bg-hover hover:text-foreground disabled:opacity-40 ${pressed ? 'bg-primary-subtle text-primary-text' : ''}`}
    >
      <Icon name={icon} className="size-4" />
    </button>
  );
}
