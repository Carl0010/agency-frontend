import { expect, test, type Page } from '@playwright/test';
import { list, signupToBoard } from './helpers';

async function addCard(page: Page, title: string) {
  await list(page, 'To do').getByTestId('add-card-end').click();
  await list(page, 'To do').getByLabel('Card title').fill(title);
  await page.keyboard.press('Enter');
  await expect(list(page, 'To do').getByRole('button', { name: new RegExp(title) })).toBeVisible();
  await page.keyboard.press('Escape');
}

test('card drawer leaves the board usable, switches cards safely and retains filters', async ({ browser }, info) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 } });
  await addCard(page, 'Review first concept');
  await addCard(page, 'Review final layout');
  const first = list(page, 'To do').getByRole('button', { name: /Review first concept/ });
  const second = list(page, 'To do').getByRole('button', { name: /Review final layout/ });
  const drawer = page.getByRole('dialog', { name: 'Card details' });
  await first.click();
  await expect(drawer).toHaveAttribute('aria-modal', 'false');
  await expect(drawer.getByTestId('card-title')).toHaveText('Review first concept');
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  const [boardBox, drawerBox] = await Promise.all([page.locator('#board-view').boundingBox(), drawer.boundingBox()]);
  expect(boardBox).not.toBeNull();
  expect(drawerBox).not.toBeNull();
  expect(boardBox!.x + boardBox!.width).toBeLessThanOrEqual(drawerBox!.x + 1);

  await drawer.getByRole('button', { name: 'Focus board' }).click();
  await expect(page.locator('#board-view')).toBeFocused();
  const filter = page.getByRole('searchbox', { name: 'Filter cards' });
  await filter.fill('Review');
  await expect(filter).toBeFocused();
  await expect(drawer.getByTestId('card-title')).toHaveText('Review first concept');
  await expect(page).toHaveURL(/q=Review/);

  await drawer.getByRole('button', { name: 'Add a description…' }).click();
  await drawer.getByRole('textbox', { name: 'Description', exact: true }).fill('Draft for the first concept');
  const content = drawer.getByTestId('card-drawer-content');
  const boardScroll = await page.getByTestId('board-lists').evaluate((element) => element.scrollTop);
  await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(drawer.getByRole('button', { name: 'Close card' })).toBeVisible();
  expect(await page.getByTestId('board-lists').evaluate((element) => element.scrollTop)).toBe(boardScroll);
  await second.click();
  await expect(drawer.getByTestId('card-title')).toHaveText('Review final layout');
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(drawer.getByRole('textbox', { name: 'Description', exact: true })).toHaveCount(0);
  await first.click();
  await expect(drawer.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('Draft for the first concept');
  await drawer.getByRole('button', { name: 'Cancel', exact: true }).click();

  // A board editor owns Escape independently; it must not close card details.
  await list(page, 'To do').getByTestId('add-card-end').click();
  await list(page, 'To do').getByLabel('Card title').fill('Review next steps');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(drawer.getByTestId('card-title')).toHaveText('Review first concept');
  await expect(list(page, 'To do').getByRole('button', { name: /Review next steps/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath('card-drawer-desktop.png'), fullPage: true, style: 'nextjs-portal { visibility: hidden; }' });

  await drawer.focus();
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(`${account.boardUrl}?q=Review`);
  await expect(filter).toHaveValue('Review');
  await expect(first).toBeFocused();
  await page.context().close();
});

test('mobile card drawer fits the work area and returns focus to the card', async ({ browser }, info) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await addCard(page, 'Review the new client onboarding flow');
  const tile = list(page, 'To do').getByTestId('card-tile');
  await tile.click();
  const drawer = page.getByRole('dialog', { name: 'Card details' });
  await expect(drawer.getByTestId('card-title')).toBeVisible();
  await expect(page.locator('#board-view')).toBeHidden();
  await expect(drawer.getByRole('button', { name: 'Focus board' })).toBeHidden();
  expect(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('card-drawer-mobile.png'), fullPage: true, style: 'nextjs-portal { visibility: hidden; }' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('#board-view')).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Focus board' })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator('#board-view')).toBeHidden();
  await drawer.getByRole('button', { name: 'Close card' }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.locator('#board-view')).toBeVisible();
  await expect(tile).toBeFocused();
  await page.context().close();
});

test('card links support history, full-page reloads and a recoverable unavailable card', async ({ browser }) => {
  const { page, account } = await signupToBoard(browser);
  await addCard(page, 'Check the project brief');
  const tile = list(page, 'To do').getByRole('button', { name: /Check the project brief/ });
  await tile.click();
  const drawer = page.getByRole('dialog', { name: 'Card details' });
  await expect(drawer.getByTestId('card-title')).toBeVisible();
  const cardUrl = page.url();
  await page.goBack();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(account.boardUrl);
  await page.goForward();
  await expect(drawer.getByTestId('card-title')).toHaveText('Check the project brief');
  await expect(page).toHaveURL(cardUrl);
  await drawer.getByRole('link', { name: 'Open card as full page' }).click();
  await expect(page.getByRole('link', { name: /Back to board/ })).toBeVisible();
  await expect(drawer).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('card-title')).toHaveText('Check the project brief');
  await page.getByRole('link', { name: /Back to board/ }).click();

  // Use a card whose detail has never been fetched, so a fresh cached value
  // cannot mask the unavailable-card response.
  await addCard(page, 'Unavailable card');
  const unavailable = list(page, 'To do').getByRole('button', { name: /Unavailable card/ });
  const cardId = await unavailable.getAttribute('data-card-id');
  await page.route(`**/api/v1/cards/${cardId}`, (route) => route.fulfill({ status: 404, json: { error: { code: 'not_found', message: 'Card not found.' } } }));
  await unavailable.click();
  await expect(drawer).toContainText('This card does not exist or you cannot see it.');
  await page.getByRole('searchbox', { name: 'Filter cards' }).fill('brief');
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'Close card' }).click();
  await expect(drawer).toHaveCount(0);
  await expect(tile).toBeVisible();
  await page.context().close();
});
