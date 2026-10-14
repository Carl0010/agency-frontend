'use client';

import { useQuery } from '@tanstack/react-query';
import { useRef, useState, type KeyboardEvent } from 'react';
import { Avatar } from '@/components/ui';
import { api } from '@/lib/api';
import { mentionableQuery, useMentionScope } from '@/lib/mention-scope';
import { activeMentionQuery, insertMention } from '@/lib/mentions';
import type { Page, RosterEntry } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

/**
 * Textarea with `@` mention typeahead (AC20). Candidates come from
 * `?mentionable=true`, scoped to the surface in MentionScopeContext; the API
 * decides who is mentionable there (members, the project's guests, or — for
 * a guest author — only people who posted where they can read).
 * `⌘↵` / `Ctrl↵` submits; with `enterToSend` (chat, §3.4) `↵` sends and
 * `⇧↵` inserts a newline.
 */
export function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  autoFocus,
  label,
  enterToSend = false,
  onTyping,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  label: string;
  enterToSend?: boolean;
  onTyping?: () => void;
  rows?: number;
}) {
  const ws = useWorkspace();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const scope = useMentionScope();
  const qs = mentionableQuery(scope);
  const members = useQuery({
    queryKey: ['members', ws.id, qs],
    queryFn: () => api.get<Page<RosterEntry>>(`/workspaces/${ws.id}/members?${qs}`),
  });

  const active = activeMentionQuery(value, caret);
  const q = active?.query.toLowerCase() ?? '';
  const options =
    active && dismissed !== active.start
      ? (members.data?.data ?? []).filter((m) => m.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || m.name.toLowerCase().startsWith(q)).slice(0, 6)
      : [];

  function choose(m: RosterEntry) {
    if (!active) return;
    const next = insertMention(value, active.start, caret, m.name, m.userId);
    onChange(next.text);
    setCaret(next.caret);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(next.caret, next.caret);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (options.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => (h + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const m = options[Math.min(highlight, options.length - 1)];
        if (m) choose(m);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setDismissed(active?.start ?? null);
        return;
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || (enterToSend && !e.shiftKey && !e.nativeEvent.isComposing))) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        aria-label={label}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={10_000}
        onChange={(e) => {
          onChange(e.target.value);
          onTyping?.();
          setCaret(e.target.selectionStart);
          setHighlight(0);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
      {options.length ? (
        <ul role="listbox" aria-label="Mention a teammate" data-testid="mention-options" className="absolute bottom-full left-0 z-30 mb-1 w-64 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {options.map((m, i) => (
            <li
              key={m.userId}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(m);
              }}
              className={`tap flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${i === highlight ? 'bg-blue-50' : ''}`}
            >
              <Avatar person={{ id: m.userId, name: m.name, avatarUrl: m.avatarUrl }} size={22} />
              {m.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
