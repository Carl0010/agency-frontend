// Renders marketing/banners/src/*.html to marketing/banners/png/*.png at each banner's exact size.
// Needs puppeteer-core and a Chrome/Chromium binary: CHROME_PATH=/path/to/chrome node render_banners.mjs
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'banners', 'src');
const out = join(here, '..', 'banners', 'png');
mkdirSync(out, { recursive: true });
const banners = JSON.parse(readFileSync(join(src, 'banners.json'), 'utf8'));
const only = process.argv.slice(2);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH,
  args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'],
});
const page = await browser.newPage();
for (const b of banners) {
  if (only.length && !only.includes(b.name)) continue;
  await page.setViewport({ width: b.width, height: b.height, deviceScaleFactor: b.scale });
  await page.goto(pathToFileURL(join(src, `${b.name}.html`)).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, `${b.name}.png`), clip: { x: 0, y: 0, width: b.width, height: b.height } });
  console.log(`${b.name}.png  ${b.width * b.scale}x${b.height * b.scale}`);
}
await browser.close();
