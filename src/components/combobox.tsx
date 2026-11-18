'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { canCreate, filterOptions, moveActive, type ListOption } from '@/lib/listbox';
import { Icon } from './icon';

export type { ListOption } from '@/lib/listbox';

const CREATE = '\u0000create';

interface SharedProps {
  options: ListOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Submits the value with a form: one hidden input (multi: one per value). */
  name?: string;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  /** Shown when nothing matches. */
  emptyText?: string;
  /** Offer "Create …" for typed text that matches no option. The caller creates it through the API and selects it. */
  onCreate?: (label: string) => void;
  createLabel?: (query: string) => ReactNode;
  className?: string;
}

/** Shared open/query/active state and keyboard handling for both comboboxes. */
function useListbox(options: ListOption[], { onCreate }: Pick<SharedProps, 'onCreate'>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const rowsFor = (text: string, hasTyped: boolean): ListOption[] => {
    const filtered = hasTyped ? filterOptions(options, text) : options;
    return onCreate && hasTyped && canCreate(options, text) ? [...filtered, { value: CREATE, label: text.trim() }] : filtered;
  };
  const rows = rowsFor(query, typed);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, listId]);

  function openWith(index: number) {
    setOpen(true);
    setActive(index);
  }
  function close() {
    setOpen(false);
    setTyped(false);
    setQuery('');
    setActive(-1);
  }
  function type(text: string) {
    setQuery(text);
    setTyped(true);
    setOpen(true);
    // Highlight the best enabled match so Enter picks it; nothing while the field is empty.
    setActive(text.trim() ? moveActive(rowsFor(text, true), -1, 'ArrowDown') : -1);
  }
  return { open, query, typed, active, setActive, listId, rows, openWith, close, type };
}

function OptionRow({ option, index, listId, active, selected, multi, onPick, onHover, createLabel }: {
  option: ListOption; index: number; listId: string; active: boolean; selected: boolean; multi?: boolean;
  onPick: () => void; onHover: () => void; createLabel?: (q: string) => ReactNode;
}) {
  const isCreate = option.value === CREATE;
  return (
    <li
      id={`${listId}-${index}`}
      role="option"
      aria-selected={selected}
      aria-disabled={option.disabled || undefined}
      data-active={active || undefined}
      className="ui-option"
      // Keep focus in the input so typing and arrow keys keep working.
      onMouseDown={(e) => e.preventDefault()}
      onMouseMove={onHover}
      onClick={() => { if (!option.disabled) onPick(); }}
    >
      {isCreate ? (
        <><Icon name="plus" className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{createLabel ? createLabel(option.label) : <>Create “{option.label}”</>}</span></>
      ) : (
        <>
          {multi ? (
            <span aria-hidden="true" className="ui-option-check" data-checked={selected || undefined}>{selected ? <Icon name="check" className="size-3" /> : null}</span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate">{option.label}</span>
            {option.description ? <span className="block truncate text-caption text-muted-foreground">{option.description}</span> : null}
          </span>
          {!multi && selected ? <Icon name="check" className="size-4 shrink-0 text-primary" /> : null}
        </>
      )}
    </li>
  );
}

/**
 * Single-value autocomplete (ARIA 1.2 combobox with a listbox popup). Type to filter, arrow keys to move,
 * Enter to choose, Escape to close (or clear when already closed).
 */
export function Combobox({
  value, onChange, clearable = true, options, placeholder = 'Search…', disabled, name, id, emptyText = 'No matches',
  onCreate, createLabel, className = '', ...aria
}: SharedProps & { value: string | null; onChange: (value: string | null) => void; clearable?: boolean }) {
  const lb = useListbox(options, { onCreate });
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;
  const selectedIndex = lb.rows.findIndex((o) => o.value === value);

  function pick(option: ListOption) {
    if (option.value === CREATE) onCreate?.(option.label);
    else onChange(option.value);
    lb.close();
  }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!lb.open) lb.openWith(selectedIndex >= 0 ? selectedIndex : moveActive(lb.rows, -1, e.key));
      else lb.setActive(moveActive(lb.rows, lb.active, e.key));
    } else if (e.key === 'Enter' && lb.open) {
      const option = lb.rows[lb.active];
      if (option && !option.disabled) { e.preventDefault(); pick(option); }
    } else if (e.key === 'Escape') {
      if (lb.open) { e.preventDefault(); lb.close(); }
      else if (clearable && value) { e.preventDefault(); onChange(null); }
    } else if (e.key === 'Tab') {
      lb.close();
    }
  }

  return (
    <div className={`ui-combobox ${className}`}>
      {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}
      <div className="ui-input ui-input-group" data-disabled={disabled || undefined} aria-invalid={aria['aria-invalid']}>
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={lb.open}
          aria-controls={lb.listId}
          aria-autocomplete="list"
          aria-activedescendant={lb.open && lb.active >= 0 ? `${lb.listId}-${lb.active}` : undefined}
          aria-label={aria['aria-label']}
          aria-describedby={aria['aria-describedby']}
          aria-invalid={aria['aria-invalid']}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={selected ? selected.label : placeholder}
          value={lb.typed ? lb.query : selected?.label ?? ''}
          onChange={(e) => lb.type(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onClick={() => { if (!lb.open) lb.openWith(selectedIndex); }}
          onBlur={() => lb.close()}
          onKeyDown={onKeyDown}
          className="ui-input-bare"
        />
        {clearable && value && !disabled ? (
          <button type="button" tabIndex={-1} aria-label="Clear" className="ui-input-icon"
            onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(null); inputRef.current?.focus(); }}>
            <Icon name="close" className="size-3.5" />
          </button>
        ) : null}
        <button type="button" tabIndex={-1} aria-hidden="true" disabled={disabled} className="ui-input-icon"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { if (lb.open) lb.close(); else { lb.openWith(selectedIndex); inputRef.current?.focus(); } }}>
          <Icon name="chevron" className="size-3.5 rotate-90" />
        </button>
      </div>
      <ul id={lb.listId} role="listbox" aria-label={aria['aria-label']} hidden={!lb.open} className="ui-listbox">
        {lb.rows.length === 0 ? <li role="presentation" className="ui-listbox-empty">{emptyText}</li> : null}
        {lb.rows.map((option, i) => (
          <OptionRow key={option.value} option={option} index={i} listId={lb.listId} active={i === lb.active}
            selected={option.value === value} onPick={() => pick(option)} onHover={() => lb.setActive(i)} createLabel={createLabel} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Multi-value autocomplete: selected values show as removable chips in the field. The list stays open
 * while choosing; Backspace in an empty field removes the last chip.
 */
export function MultiCombobox({
  values, onChange, options, placeholder = 'Add…', disabled, name, id, emptyText = 'No matches',
  onCreate, createLabel, className = '', ...aria
}: SharedProps & { values: string[]; onChange: (values: string[]) => void }) {
  const lb = useListbox(options, { onCreate });
  const inputRef = useRef<HTMLInputElement>(null);
  const chosen = values.map((v) => options.find((o) => o.value === v) ?? { value: v, label: v });

  function toggle(option: ListOption) {
    if (option.value === CREATE) { onCreate?.(option.label); lb.close(); return; }
    onChange(values.includes(option.value) ? values.filter((v) => v !== option.value) : [...values, option.value]);
    if (lb.typed) lb.type('');
  }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!lb.open) lb.openWith(moveActive(lb.rows, -1, e.key));
      else lb.setActive(moveActive(lb.rows, lb.active, e.key));
    } else if (e.key === 'Enter' && lb.open) {
      const option = lb.rows[lb.active];
      if (option && !option.disabled) { e.preventDefault(); toggle(option); }
    } else if (e.key === 'Escape' && lb.open) {
      e.preventDefault(); lb.close();
    } else if (e.key === 'Backspace' && !lb.query && values.length) {
      onChange(values.slice(0, -1));
    } else if (e.key === 'Tab') {
      lb.close();
    }
  }

  return (
    <div className={`ui-combobox ${className}`}>
      {name ? values.map((v) => <input key={v} type="hidden" name={name} value={v} />) : null}
      <div className="ui-input ui-input-group flex-wrap" data-disabled={disabled || undefined} aria-invalid={aria['aria-invalid']}
        onClick={() => inputRef.current?.focus()}>
        {chosen.map((o) => (
          <span key={o.value} className="ui-chip">
            <span className="truncate">{o.label}</span>
            {!disabled ? (
              <button type="button" tabIndex={-1} aria-label={`Remove ${o.label}`} className="ui-chip-remove"
                onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); onChange(values.filter((v) => v !== o.value)); }}>
                <Icon name="close" className="size-3" />
              </button>
            ) : null}
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={lb.open}
          aria-controls={lb.listId}
          aria-autocomplete="list"
          aria-activedescendant={lb.open && lb.active >= 0 ? `${lb.listId}-${lb.active}` : undefined}
          aria-label={aria['aria-label']}
          aria-describedby={aria['aria-describedby']}
          aria-invalid={aria['aria-invalid']}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={values.length ? '' : placeholder}
          value={lb.query}
          onChange={(e) => lb.type(e.target.value)}
          onClick={() => { if (!lb.open) lb.openWith(-1); }}
          onBlur={() => lb.close()}
          onKeyDown={onKeyDown}
          className="ui-input-bare min-w-24"
        />
      </div>
      <ul id={lb.listId} role="listbox" aria-multiselectable="true" aria-label={aria['aria-label']} hidden={!lb.open} className="ui-listbox">
        {lb.rows.length === 0 ? <li role="presentation" className="ui-listbox-empty">{emptyText}</li> : null}
        {lb.rows.map((option, i) => (
          <OptionRow key={option.value} option={option} index={i} listId={lb.listId} active={i === lb.active} multi
            selected={values.includes(option.value)} onPick={() => toggle(option)} onHover={() => lb.setActive(i)} createLabel={createLabel} />
        ))}
      </ul>
    </div>
  );
}
