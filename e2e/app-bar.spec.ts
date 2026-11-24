import { expect, test, type Page } from '@playwright/test';
import { list, signupToBoard } from './helpers';

test('app bar spans the viewport with centered search and a reopenable contextual sidebar', async ({ browser }, info) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  const bar = page.getByRole('banner', { name: 'Application bar' });
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
  const rail = page.getByRole('complementary', { name: 'Module rail' });
  const search = bar.getByRole('button', { name: 'Search workspace' });
  const [barBox, searchBox, railBox, expanded] = await Promise.all([bar.boundingBox(), search.boundingBox(), rail.boundingBox(), page.locator('#workspace-content').boundingBox()]);
  expect(barBox!.x).toBe(0); expect(barBox!.width).toBe(1440); expect(barBox!.height).toBe(56);
  expect(Math.abs(searchBox!.x + searchBox!.width / 2 - 720)).toBeLessThan(2);
  expect(railBox!.y).toBe(barBox!.height);
  await expect(sidebar.getByRole('button', { name: /Search/ })).toHaveCount(0);
  await bar.getByRole('button', { name: 'Close sidebar' }).click();
  await expect(sidebar).toBeHidden(); await expect(rail).toBeVisible();
  await expect.poll(async () => (await page.locator('#workspace-content').boundingBox())!.width - expanded!.width).toBe(256);
  await rail.getByRole('link', { name: 'Inbox', exact: true }).click();
  await expect(sidebar).toBeHidden();
  await bar.getByRole('button', { name: 'Open sidebar' }).click();
  await expect(sidebar.getByRole('link', { name: 'All notifications' })).toBeVisible();
  await search.click(); await expect(page.getByTestId('command-palette')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: info.outputPath('appbar-light.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await page.context().close();
});

/** Your settings → Appearance through the account menu (client navigation keeps page state). */
async function openAppearance(page: Page) {
  await page.getByRole('complementary', { name: 'Workspace sidebar' }).getByTestId('account-menu').click();
  await page.getByRole('menuitem', { name: 'Your settings' }).click();
  await page.getByRole('navigation', { name: 'Your settings' }).getByRole('link', { name: 'Appearance' }).click();
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
}
const dark = (page: Page) => page.getByRole('radio', { name: 'Dark', exact: true });
const light = (page: Page) => page.getByRole('radio', { name: 'Light', exact: true });

test('the theme is chosen in Appearance, persists, synchronizes tabs, and the app bar has no theme switch', async ({ browser }, info) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  await expect(page.getByRole('banner', { name: 'Application bar' }).getByRole('button', { name: /mode/i })).toHaveCount(0);
  await openAppearance(page);
  await dark(page).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(dark(page)).toBeChecked();
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.goto(account.boardUrl);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const todo = list(page, 'To do');
  expect(await todo.getByTestId('list-surface').evaluate((surface) => !surface.contains(document.querySelector('[data-testid="add-card-end"]')))).toBe(true);
  await todo.getByTestId('add-card-end').click();
  await todo.getByLabel('Card title').fill('Review the dark theme');
  await todo.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(todo.getByText('Review the dark theme', { exact: true })).toBeVisible();
  await todo.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.screenshot({ path: info.outputPath('appbar-dark.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  const other = await page.context().newPage();
  await other.goto(account.boardUrl);
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await openAppearance(page);
  await light(page).check();
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'light');
  await other.close();
  await dark(page).check();
  await page.goto(account.boardUrl);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole('button', { name: 'Search workspace' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('appbar-dark-mobile-board.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('dialog', { name: 'Workspace navigation' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('appbar-dark-mobile.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await page.context().close();
});

test('system theme is the default, and switching works with storage unavailable', async ({ browser }) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Storage disabled'); }; });
  await openAppearance(page);
  await expect(page.getByRole('radio', { name: /Match system/ })).toBeChecked();
  await dark(page).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(dark(page)).toBeChecked();
  await page.context().close();
});
