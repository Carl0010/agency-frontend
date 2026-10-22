// Prints marketing/sales-sheet/sales-sheet.html to an A4 PDF and a PNG preview.
// CHROME_PATH=/path/to/chrome node marketing/scripts/render_sales_sheet.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'sales-sheet');
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(join(dir, 'sales-sheet.html')).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: join(dir, 'agency-sales-sheet.pdf'), format: 'A4', printBackground: true, pageRanges: '1' });
await page.screenshot({ path: join(dir, 'agency-sales-sheet.png') });
await browser.close();
console.log('ok');
