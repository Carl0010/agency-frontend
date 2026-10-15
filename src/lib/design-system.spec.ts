import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '../styles/tokens.css'), 'utf8');
const colors = new Map<string, string>();
for (const match of css.matchAll(/--color-([\w-]+): (#[\da-f]{6});/g)) {
  if (match[1] && match[2]) colors.set(match[1], match[2]);
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

describe('readable design token combinations', () => {
  it.each([
    ['foreground', 'background'], ['secondary-foreground', 'surface'],
    ['muted-foreground', 'surface'], ['muted-foreground', 'subtle'],
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

  it.each([['input', 'surface'], ['ring', 'surface'], ['ring', 'background']])(
    '%s remains distinguishable on %s at 3:1', (control, background) => {
      expect(contrast(control, background)).toBeGreaterThanOrEqual(3);
    },
  );
});
