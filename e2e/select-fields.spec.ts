import { expect, test } from '@playwright/test';
import { ownerApi } from './access-helpers';
import { choose, signupToBoard, darkTheme } from './helpers';

test('select menus use the theme, the keyboard and typeahead, and work inside popovers, dialogs and forms', async ({ browser }, info) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 } });
  const select = page.getByRole('combobox', { name: 'Group by', exact: true });
  const menu = page.getByRole('listbox');
  await select.click();
  await expect(select).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.getByRole('option', { name: 'List', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(menu.getByRole('option', { name: 'Due date', exact: true })).toBeVisible();
  expect(await menu.evaluate((node) => node.matches(':popover-open'))).toBe(true);
  await page.screenshot({ path: info.outputPath('select-menu-light.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await page.keyboard.press('Escape'); await expect(menu).toHaveCount(0); await expect(select).toBeFocused();

  // Keyboard: Space opens on the chosen option, End moves, Enter picks; typing a letter jumps.
  await select.press('Space'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await expect(select).toHaveText('Due date'); await expect(page).toHaveURL(/group=due/);
  await select.press('a'); await page.keyboard.press('Enter');
  await expect(select).toHaveText('Assignee'); await expect(page).toHaveURL(/group=assignee/);
  await choose(select, 'List'); await expect(page).not.toHaveURL(/group=/);

  await darkTheme(page);
  await select.click(); await expect(menu.getByRole('option', { name: 'Due date', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('select-menu-dark.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await page.keyboard.press('Escape');

  // Inside the filter popover: picking keeps the popover open.
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const filters = page.getByTestId('filter-panel'); const due = filters.getByRole('combobox', { name: 'Due date' });
  await choose(due, 'No due date');
  await expect(filters).toBeVisible(); await expect(due).toHaveText('No due date');
  await filters.getByRole('button', { name: 'Done', exact: true }).click();

  // Inside the share dialog: the menu draws above it and picking keeps it open.
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const share = page.getByRole('dialog', { name: 'Share project', exact: true });
  const access = share.getByRole('combobox', { name: 'New project access', exact: true });
  await access.click();
  const admin = menu.getByRole('option', { name: 'Project admin', exact: true });
  const box = (await admin.boundingBox())!;
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[role="option"]')?.textContent, { x: box.x + box.width / 2, y: box.y + box.height / 2 })).toBe('Project admin');
  await admin.click();
  await expect(share).toBeVisible(); await expect(access).toHaveText('Project admin');
  await share.getByRole('button', { name: 'Close Share project' }).click();

  // Phone: 44px options inside the viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  await select.click();
  const option = menu.getByRole('option', { name: 'Assignee', exact: true });
  await expect(option).toBeVisible();
  await menu.evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished)));
  const optionBox = (await option.boundingBox())!;
  expect(optionBox.height).toBeGreaterThanOrEqual(44);
  expect(optionBox.x).toBeGreaterThanOrEqual(0); expect(optionBox.x + optionBox.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath('select-menu-mobile.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await page.keyboard.press('Escape');

  // Forms: the value reaches FormData through `name`.
  const workspaceId = new URL(account.boardUrl).pathname.split('/')[2]!;
  await page.goto(`/w/${workspaceId}/settings/members`);
  const role = page.getByRole('combobox', { name: 'Role', exact: true });
  await choose(role, 'Admin');
  expect(await role.evaluate((node: HTMLButtonElement) => new FormData(node.form!).get('role'))).toBe('admin');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.context().close();
});

test('a required select blocks its form until something is chosen', async ({ browser, request }) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 } });
  const workspaceId = new URL(account.boardUrl).pathname.split('/')[2]!;
  const call = await ownerApi(request, account);
  await call('POST', `/workspaces/${workspaceId}/teams`, { name: 'Delivery' });
  await page.reload();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const share = page.getByRole('dialog', { name: 'Share project', exact: true });
  const team = share.getByRole('combobox', { name: 'Team to share', exact: true });
  await expect(team).toHaveAttribute('aria-required', 'true');
  await expect(team).toHaveText('Choose team');
  await share.getByRole('button', { name: 'Share team', exact: true }).click();
  await expect(team).toBeFocused();
  await expect(share.getByRole('button', { name: 'Unshare Delivery' })).toHaveCount(0);
  await choose(team, 'Delivery');
  await share.getByRole('button', { name: 'Share team', exact: true }).click();
  await expect(share.getByRole('button', { name: 'Unshare Delivery' })).toBeVisible();
  await page.context().close();
});
