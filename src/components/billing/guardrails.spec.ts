import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Billing guardrails asserted on the code itself (AC2, AC18):
 * - no card data can touch our UI: no card input, no Stripe Elements;
 * - the frontend computes no seat counts or trial dates — the API does.
 */

const ROOT = resolve(__dirname, '..', '..', '..', '..', '..');
const WEB_SRC = join(ROOT, 'apps', 'web', 'src');
const API_SRC = join(ROOT, 'apps', 'api', 'src');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(tsx?|jsx?)$/.test(name) && !/\.spec\.tsx?$/.test(name) ? [p] : [];
  });
}

const lines = (files: string[]) =>
  files.flatMap((f) => readFileSync(f, 'utf8').split('\n').map((text, i) => ({ where: `${relative(ROOT, f)}:${i + 1}`, text })));

describe('AC2 no card input field exists in the codebase', () => {
  const CARD_FIELD = [
    /autoComplete=["']cc-/i,
    /autocomplete=["']cc-/i,
    /name=["'](card|cc)[-_]?(number|num|cvc|cvv|exp)/i,
    /\b(cardNumber|card_number|cvc|cvv)\b\s*[:=]/,
    /\bCardElement\b|\bPaymentElement\b|@stripe\/(stripe-js|react-stripe-js)/,
  ];

  it('no file in web or api renders or names a card field', () => {
    const hits = lines([...sources(WEB_SRC), ...sources(API_SRC)]).filter((l) => CARD_FIELD.some((re) => re.test(l.text)));
    expect(hits).toEqual([]);
  });

  it('the web app does not depend on any Stripe browser SDK', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'apps', 'web', 'package.json'), 'utf8')) as Record<string, Record<string, string> | undefined>;
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => d.includes('stripe'))).toEqual([]);
  });
});

describe('AC18 no seat or trial arithmetic in frontend code', () => {
  const ARITHMETIC = [
    // used/included compared or combined: `used >= included`, `included - used`, …
    /\b(used|included)\s*(>=|<=|>|<|-|\+)\s*[\w.]*\b(used|included|\d)/,
    /[\w.]*\b(used|included)\b\s*(>=|<=|>|<)/,
    // Counting seats from a member list.
    /\.filter\([^)]*(status|role)[^)]*\)\.length/,
    // Trial or period dates turned into a countdown on the client.
    /(trialEndsAt|currentPeriodEnd|dataDeleteAfter)[^;]*(getTime\(\)|Date\.now\(\))\s*-/,
    /(Date\.now\(\)|getTime\(\))\s*-[^;]*(trialEndsAt|currentPeriodEnd|dataDeleteAfter)/,
  ];

  it('every seat number and trial countdown is rendered as the API sent it', () => {
    const hits = lines(sources(WEB_SRC)).filter((l) => ARITHMETIC.some((re) => re.test(l.text)));
    expect(hits).toEqual([]);
  });

  it('the guard itself catches the pattern it forbids', () => {
    expect(ARITHMETIC.some((re) => re.test('const full = seats.used >= seats.included;'))).toBe(true);
    expect(ARITHMETIC.some((re) => re.test('const left = new Date(ws.trialEndsAt).getTime() - Date.now();'))).toBe(true);
  });
});
