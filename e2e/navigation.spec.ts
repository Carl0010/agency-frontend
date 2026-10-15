import { expect, test } from '@playwright/test';
import { list, signupToBoard } from './helpers';

test('the sidebar owns workspace and project destinations while headers retain local actions', async ({ browser }, info) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 } });
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Board', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(sidebar.getByTestId('internal-badge')).toHaveText('Internal');
  await expect(page.getByTestId('workspace-header').getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Share with client' })).toBeVisible();

  await sidebar.getByRole('link', { name: 'Team Internal' }).click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByTestId('channel-badge')).toHaveText('Internal');
  await expect(sidebar.getByRole('link', { name: 'Team Internal' })).toHaveAttribute('aria-current', 'page');
  await sidebar.getByRole('link', { name: 'Chat', exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByTestId('client-reminder')).toBeVisible();

  await sidebar.getByRole('button', { name: /Search/ }).click();
  await expect(page.getByTestId('command-palette')).toBeVisible();
  await expect(page.getByLabel('Search cards, comments and messages')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('command-palette')).toHaveCount(0);
  await sidebar.getByRole('link', { name: 'Members', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/members$/);
  await expect(sidebar.getByRole('link', { name: 'Members', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.goto(account.boardUrl);
  await expect(list(page, 'To do')).toBeVisible();
  await page.screenshot({ path: info.outputPath('sidebar-desktop.png'), fullPage: true });

  await sidebar.getByRole('link', { name: /^Projects/ }).click();
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Project name').fill('Northwind launch');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Northwind launch', exact: true })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Northwind launch', exact: true })).toHaveAttribute('aria-current', 'location');
  await expect(sidebar.getByRole('link', { name: 'Board', exact: true })).toHaveAttribute('aria-current', 'page');
  await sidebar.getByRole('link', { name: 'Chat', exact: true }).click();
  await expect(page.getByTestId('client-reminder')).toBeVisible();
  await page.context().close();
});

test('mobile drawer traps focus, closes on navigation/Escape/backdrop, and hands off to search', async ({ browser }, info) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 390, height: 844 } });
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  const drawer = page.getByRole('dialog', { name: 'Workspace navigation' });
  await expect(drawer).toHaveCount(0);
  await trigger.click();
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.screenshot({ path: info.outputPath('sidebar-mobile.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await drawer.getByRole('link', { name: 'Chat', exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(drawer).toHaveCount(0);
  await trigger.click();
  await drawer.getByRole('button', { name: /Search/ }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByTestId('command-palette')).toBeVisible();
  await expect(page.getByLabel('Search cards, comments and messages')).toBeFocused();
  await page.keyboard.press('Escape');

  await trigger.click();
  await page.keyboard.press('Control+k');
  await expect(drawer).toHaveCount(0);
  await expect(page.getByTestId('command-palette')).toBeVisible();
  await expect(page.getByLabel('Search cards, comments and messages')).toBeFocused();
  await page.keyboard.press('Escape');

  await trigger.click();
  await page.mouse.click(385, 400);
  await expect(drawer).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await trigger.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Workspace sidebar' })).toBeVisible();
  await page.context().close();
});
