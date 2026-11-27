import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '../styles/tokens.css'), 'utf8');
const [lightCss, darkCss = ''] = css.split("html[data-theme='dark']");

// Agency tokens that alias Quiet Pro (var(--accent)) resolve through the package's own tokens.
type QpToken = { name: string; value: string | Record<string, string> };
const quietPro = JSON.parse(
  readFileSync(join(__dirname, '../../node_modules/@carl0010/quiet-pro/tokens/tokens.json'), 'utf8'),
) as { color: { tokens: QpToken[] } };

/** oklch(L C H) → #rrggbb (sRGB, clipped). */
function oklchToHex(value: string): string {
  const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  if (!m) return value;
  const [L, C, H] = [Number(m[1]), Number(m[2]), (Number(m[3]) * Math.PI) / 180];
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const enc = (x: number) => {
    const c = Math.min(1, Math.max(0, x));
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return '#' + lin.map(enc).join('');
}

function quietProColor(name: string, theme: string): string {
  const token = quietPro.color.tokens.find((t) => t.name === name);
  if (!token) throw new Error(`Quiet Pro has no colour token --${name}`);
  const value = typeof token.value === 'string' ? token.value : token.value[theme] ?? token.value.dark!;
  return oklchToHex(value);
}

const colors = new Map<string, string>();
function loadColors(source: string, theme: string) {
  for (const match of source.matchAll(/--color-([\w-]+): (#[\da-f]{6}|var\(--([\w-]+)\));/g)) {
    if (!match[1] || !match[2]) continue;
    colors.set(match[1], match[3] ? quietProColor(match[3], theme) : match[2]);
  }
}

function luminance(token: string): number {
  const color = colors.get(token);
  if (!color) throw new Error(`Missing design token: ${token}`);
  const channel = (offset: number) => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return channel(1) * 0.2126 + channel(3) * 0.7152 + channel(5) * 0.0722;
}

function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe.each(['light', 'dark'])('%s readable design token combinations', (theme) => {
  beforeAll(() => { colors.clear(); loadColors(lightCss!, theme); if (theme === 'dark') loadColors(darkCss, theme); });
  it.each([
    ['inverse-foreground', 'inverse'], ['foreground', 'background'], ['secondary-foreground', 'surface'],
    ['foreground', 'board-canvas'], ['secondary-foreground', 'board-canvas'], ['muted-foreground', 'board-canvas'],
    ['muted-foreground', 'surface'], ['muted-foreground', 'subtle'],
    ['foreground', 'popover'], ['secondary-foreground', 'popover'], ['muted-foreground', 'popover'],
    ['foreground', 'field'], ['muted-foreground', 'field'],
    ['foreground', 'lane'], ['secondary-foreground', 'lane'], ['muted-foreground', 'lane'],
    ['foreground', 'chrome'], ['muted-foreground', 'chrome'], ['secondary-foreground', 'sidebar'], ['muted-foreground', 'sidebar'],
    ['foreground', 'raised'], ['muted-foreground', 'raised'],
    ['primary-foreground', 'primary'], ['primary-foreground', 'primary-hover'],
    ['primary-foreground', 'primary-active'], ['primary', 'surface'],
    ['primary-text', 'primary-subtle'], ['primary-text', 'primary-muted'],
    ['danger-text', 'danger-subtle'], ['danger-text', 'danger-muted'],
    ['inverse-foreground', 'danger'], ['inverse-foreground', 'warning'],
    ['success-text', 'success-subtle'], ['success-text', 'success-muted'],
    ['warning-text', 'warning-subtle'], ['warning-text', 'warning-muted'],
    ['info-text', 'info-subtle'], ['highlight-foreground', 'highlight'],
    ...Array.from({ length: 6 }, (_, i) => ['inverse-foreground', `avatar-${i + 1}`]),
  ])('%s on %s has at least 4.5:1 contrast', (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  if (theme === 'dark') {
    // Dark elevation is lightness: each layer must be a visible step above the one it sits on,
    // or cards melt into lanes and lanes into the page.
    it.each([['lane', 'board-canvas'], ['sidebar', 'background'], ['surface', 'lane'], ['popover', 'surface'], ['raised', 'surface']])(
      '%s sits a visible step above %s', (upper, lower) => {
        expect(luminance(upper)).toBeGreaterThan(luminance(lower));
        expect(contrast(upper, lower)).toBeGreaterThanOrEqual(1.08);
      },
    );
    it('card edges show on their lane', () => { expect(contrast('border', 'lane')).toBeGreaterThanOrEqual(1.4); });
  }

  it.each([['input', 'surface'], ['input', 'field'], ['ring', 'surface'], ['ring', 'popover'], ['ring', 'field'], ['ring', 'background'], ['ring', 'board-canvas'], ['border-hover', 'board-canvas']])(
    '%s remains distinguishable on %s at 3:1', (control, background) => {
      expect(contrast(control, background)).toBeGreaterThanOrEqual(3);
    },
  );
});
