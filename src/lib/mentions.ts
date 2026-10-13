/** Mention token format shared with the API's parser: `@[Name](user:<uuid>)`. */
export function mentionToken(name: string, userId: string): string {
  return `@[${name.replace(/[[\]\n]/g, '')}](user:${userId})`;
}

/** The `@query` being typed immediately before the caret, if any. */
export function activeMentionQuery(text: string, caret: number): { query: string; start: number } | null {
  const m = /(^|\s)@([^\s@[\]()]{0,30})$/.exec(text.slice(0, caret));
  if (!m) return null;
  return { query: m[2] ?? '', start: caret - (m[2]?.length ?? 0) - 1 };
}

/** Replaces the `@query` at `start..caret` with a token; returns new text and caret. */
export function insertMention(text: string, start: number, caret: number, name: string, userId: string): { text: string; caret: number } {
  const token = `${mentionToken(name, userId)} `;
  return { text: text.slice(0, start) + token + text.slice(caret), caret: start + token.length };
}
