import { expect, test } from '@playwright/test';
import { list, signupToBoard } from './helpers';

test('a phone shows the board as swipeable columns with a compact toolbar and search that keeps every keystroke', async ({ browser }, info) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  // Columns sit side by side: the first fills most of the screen and the next one peeks in.
  await expect(list(page, 'To do')).toBeInViewport();
  await expect(list(page, 'In progress')).toBeInViewport();
  const column = (await list(page, 'To do').boundingBox())!;
  expect(column.width).toBeGreaterThan(300); expect(column.width).toBeLessThan(340);
  await expect(page.getByRole('tablist', { name: 'Lists' })).toHaveCount(0);

  // One toolbar row: view switch, a search icon and Filters.
  const toolbar = page.getByTestId('board-toolbar');
  expect((await toolbar.boundingBox())!.height).toBeLessThan(64);
  await toolbar.getByRole('button', { name: 'Search cards' }).click();
  const search = toolbar.getByRole('searchbox', { name: 'Search by card name' });
  await expect(search).toBeFocused();
  await search.pressSequentially('brand', { delay: 15 });
  await expect(search).toHaveValue('brand');
  await expect(page).toHaveURL(/q=brand/);
  await search.press('Escape');
  await expect(search).toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('board-mobile.png'), animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await page.context().close();
});

test('arrival estimates are opt-in and project extras live in the project menu', async ({ browser }) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 } });
  await expect(page.getByTestId('project-arrival')).toHaveCount(0);

  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const options = page.getByTestId('view-options');
  await expect(options.getByRole('combobox', { name: 'Group by' })).toBeVisible();
  const arrivals = options.getByRole('switch', { name: 'Show arrival estimates' });
  await expect(arrivals).toHaveAttribute('aria-checked', 'false');
  await arrivals.click();
  await expect(page).toHaveURL(/arrival=on/);
  await expect(arrivals).toHaveAttribute('aria-checked', 'true');
  await arrivals.click();
  await expect(page).not.toHaveURL(/arrival=on/);
  await page.keyboard.press('Escape');

  for (const item of ['Archived cards', 'Arrival settings']) {
    await page.getByRole('button', { name: 'Project options', exact: true }).click();
    await page.getByRole('menuitem', { name: item, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: item, exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: `Close ${item}` }).click();
    await expect(dialog).toHaveCount(0);
  }
  await page.context().close();
});

test('card actions sit behind one menu in the card details', async ({ browser }) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 } });
  await list(page, 'To do').getByTestId('add-card-end').click();
  await page.getByLabel('Card title').fill('Draft the homepage copy');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.getByTestId('card-tile').filter({ hasText: 'Draft the homepage copy' }).click();
  const drawer = page.getByTestId('card-drawer');
  await expect(drawer.getByTestId('card-properties')).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Archive', exact: true })).toHaveCount(0);
  await drawer.getByRole('button', { name: 'Card actions' }).click();
  for (const item of ['Add to project', 'Copy link', 'Archive']) await expect(page.getByRole('menuitem', { name: item, exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'Archive', exact: true })).toBeHidden();
  await page.context().close();
});
