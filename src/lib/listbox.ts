/** Pure helpers for the shared listbox controls (Combobox, MultiCombobox): filtering and keyboard movement. */

export interface ListOption {
  value: string;
  label: string;
  /** Second line under the label, also searched. */
  description?: string;
  disabled?: boolean;
}

/** Lower-case and strip accents so "Jose" finds "José". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Options whose label (or description) contains every word of the query, best matches first:
 * label starts with the query, then a word in the label starts with it, then anything else.
 * Original order is kept within each group. An empty query returns every option.
 */
export function filterOptions<T extends ListOption>(options: readonly T[], query: string): T[] {
  const q = fold(query.trim());
  if (!q) return [...options];
  const words = q.split(/\s+/);
  const ranked: Array<{ option: T; rank: number; index: number }> = [];
  options.forEach((option, index) => {
    const label = fold(option.label);
    const haystack = option.description ? `${label} ${fold(option.description)}` : label;
    if (!words.every((w) => haystack.includes(w))) return;
    const rank = label.startsWith(q) ? 0 : label.split(/[\s\-_/.]+/).some((part) => part.startsWith(words[0]!)) ? 1 : 2;
    ranked.push({ option, rank, index });
  });
  return ranked.sort((a, b) => a.rank - b.rank || a.index - b.index).map((r) => r.option);
}

/** Next enabled index for a key press, or `current` when the key doesn't move. Wraps at both ends. -1 means none. */
export function moveActive(options: readonly Pick<ListOption, 'disabled'>[], current: number, key: string): number {
  const n = options.length;
  if (n === 0) return -1;
  const enabled = (i: number) => !options[i]?.disabled;
  const scan = (start: number, step: number) => {
    for (let k = 0, i = start; k < n; k++, i = (i + step + n) % n) if (enabled(i)) return i;
    return -1;
  };
  switch (key) {
    case 'ArrowDown': return scan(current < 0 ? 0 : (current + 1) % n, 1);
    case 'ArrowUp': return scan(current < 0 ? n - 1 : (current - 1 + n) % n, -1);
    case 'Home': return scan(0, 1);
    case 'End': return scan(n - 1, -1);
    default: return current;
  }
}

/** Whether to offer "Create …" for a typed value: non-empty and not already an option label. */
export function canCreate(options: readonly ListOption[], query: string): boolean {
  const q = fold(query.trim());
  return q.length > 0 && !options.some((o) => fold(o.label) === q);
}
