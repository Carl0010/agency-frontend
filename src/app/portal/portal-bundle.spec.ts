import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * AC2, asserted on the code rather than by eyeballing: the `/portal` layout
 * tree's full transitive import graph contains no workspace nav, no search
 * palette, no settings route and no internal-channel (Team) route (§3.6,
 * §6.2 layer 3). If one of these ever becomes reachable from a portal file,
 * it can end up in a guest's bundle — so this fails the build.
 */

const SRC = resolve(__dirname, '..', '..');
const PORTAL = join(SRC, 'app', 'portal');

const FORBIDDEN: { what: string; test: (file: string) => boolean }[] = [
  { what: 'workspace layout tree (/w/*)', test: (f) => f.startsWith('app/w/') },
  { what: 'workspace nav / project rail', test: (f) => f === 'components/project-chrome.tsx' },
  { what: 'workspace notification bell (links into /w)', test: (f) => f === 'components/notifications.tsx' },
  { what: 'search palette / search UI', test: (f) => f.startsWith('components/search/') || f.includes('/search/') },
  { what: 'settings route', test: (f) => f.includes('settings') },
  { what: 'internal channel (Team) route', test: (f) => /\/team\//.test(f) || f.endsWith('/team/page.tsx') },
  { what: 'workspace board screen (rail, filters, drag)', test: (f) => f === 'components/board/board.tsx' },
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(name) && !name.endsWith('.spec.ts') ? [p] : [];
  });
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return null; // a package — not our code
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`unresolved import ${spec} in ${relative(SRC, from)}`);
}

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm;

/** Every source file reachable from the roots, with the chain that reached it. */
function closure(roots: string[]): Map<string, string[]> {
  const seen = new Map<string, string[]>();
  const queue: [string, string[]][] = roots.map((r) => [r, [relative(SRC, r)]]);
  while (queue.length) {
    const [file, chain] = queue.shift() as [string, string[]];
    if (seen.has(file)) continue;
    seen.set(file, chain);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (!spec) continue;
      const target = resolveImport(file, spec);
      if (target && !seen.has(target)) queue.push([target, [...chain, relative(SRC, target)]]);
    }
  }
  return seen;
}

describe('AC2 — the /portal layout tree imports no workspace nav, search, settings or internal-channel route', () => {
  const roots = walk(PORTAL);
  const graph = closure(roots);
  const files = [...graph.keys()].map((f) => relative(SRC, f));

  it('has the portal routes we expect', () => {
    for (const route of ['layout.tsx', 'page.tsx', '[projectId]/layout.tsx', '[projectId]/page.tsx', '[projectId]/chat/page.tsx', '[projectId]/c/[cardId]/page.tsx']) {
      expect(files).toContain(`app/portal/${route}`);
    }
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(FORBIDDEN)('never reaches: $what', ({ test }) => {
    const hits = [...graph.entries()].filter(([f]) => test(relative(SRC, f))).map(([, chain]) => chain.join(' → '));
    expect(hits).toEqual([]);
  });

  it('builds no link into the workspace tree and never names the internal channel', () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(join(SRC, f), 'utf8');
      return /['"`]\/w\//.test(src);
    });
    expect(offenders).toEqual([]);
    for (const f of files.filter((x) => x.startsWith('app/portal/'))) {
      expect(readFileSync(join(SRC, f), 'utf8')).not.toMatch(/['"]internal['"]/);
    }
  });

  it('the guard itself works: the workspace layout does reach the palette and the nav', () => {
    const ws = closure([join(SRC, 'app', 'w', '[slug]', 'layout.tsx')]);
    const wsFiles = [...ws.keys()].map((f) => relative(SRC, f));
    expect(wsFiles).toContain('components/search/command-palette.tsx');
    expect(wsFiles).toContain('components/notifications.tsx');
  });
});
