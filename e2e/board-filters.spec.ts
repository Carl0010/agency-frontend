import { expect, test, type APIRequestContext } from '@playwright/test';
import { list, signupToBoard, type Account } from './helpers';

async function setup(request: APIRequestContext, account: Account) {
  const login = await request.post('/api/v1/auth/login', { data: { email: account.email, password: account.password } });
  expect(login.ok()).toBe(true);
  const auth = await login.json() as { accessToken: string; user: { id: string } };
  const headers = { Authorization: `Bearer ${auth.accessToken}` };
  const response = await request.get(`/api/v1/boards/${account.boardId}`, { headers });
  expect(response.ok()).toBe(true);
  const board = await response.json() as { project: { id: string; workspaceId: string }; lists: { id: string; name: string }[] };
  return { board, headers, userId: auth.user.id };
}

test('right-aligned filters open over the board, preserve focus and filter both presentations', async ({ browser, request }, info) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  const { board, headers, userId } = await setup(request, account);
  async function post(path: string, data: object = {}) {
    const result = await request.post(`/api/v1${path}`, { headers, data });
    expect(result.ok(), path).toBe(true);
    return await result.json() as { id: string };
  }
  const todo = board.lists.find((column) => column.name === 'To do')!;
  const first = await post(`/lists/${todo.id}/cards`, { title: 'Review the client experience', dueAt: new Date(Date.now() + 2 * 86400000).toISOString() });
  await post(`/lists/${todo.id}/cards`, { title: 'Write release notes' });
  await post(`/cards/${first.id}/assignees/${userId}`);
  const label = await post(`/workspaces/${board.project.workspaceId}/labels`, { name: 'Client experience and accessibility', color: 'teal' });
  await post(`/cards/${first.id}/labels/${label.id}`);
  await page.reload();
  const toolbar = page.getByTestId('board-toolbar');
  const views = toolbar.getByRole('group', { name: 'Board view', exact: true });
  const controls = toolbar.getByTestId('board-filter-controls');
  const search = controls.getByRole('searchbox', { name: 'Search by card name' });
  const trigger = controls.getByRole('button', { name: 'Filters', exact: true });
  const panel = page.getByRole('dialog', { name: 'Board filters', exact: true });
  await expect(search).toHaveAttribute('placeholder', 'Search by card name');
  const [toolbarBox, controlsBox, viewsBox, before] = await Promise.all([toolbar.boundingBox(), controls.boundingBox(), views.boundingBox(), page.getByTestId('board-lists').boundingBox()]);
  expect(viewsBox!.x - toolbarBox!.x).toBe(16);
  expect(Math.abs(controlsBox!.x + controlsBox!.width - toolbarBox!.x - toolbarBox!.width + 16)).toBeLessThan(2);
  expect((await search.boundingBox())!.x).toBeGreaterThan(viewsBox!.x + viewsBox!.width + 100);
  await expect(panel).toBeHidden();
  await trigger.click(); await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Close filters' })).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect((await page.getByTestId('board-lists').boundingBox())!.y).toBe(before!.y);
  await panel.getByRole('button', { name: 'Assigned to E2E Owner' }).click();
  await panel.getByRole('button', { name: 'Client experience and accessibility', exact: true }).click();
  const due = panel.getByLabel('Due date');
  await due.focus(); await due.selectOption('week'); await expect(due).toBeFocused();
  await expect(page.getByTestId('card-tile')).toHaveCount(1);
  await expect(trigger).toHaveText('Filters3');
  expect((await page.getByTestId('board-lists').boundingBox())!.y).toBe(before!.y);
  await page.screenshot({ path: info.outputPath('board-filters-light.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await page.keyboard.press('Escape'); await expect(panel).toBeHidden(); await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await trigger.click(); await expect(panel.getByRole('button', { name: 'Assigned to E2E Owner' })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: info.outputPath('board-filters-dark.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await panel.getByRole('button', { name: 'Done', exact: true }).click(); await expect(trigger).toBeFocused();
  await page.reload(); await expect(panel).toBeHidden(); await expect(page.getByTestId('card-tile')).toHaveCount(1);
  await trigger.click(); await expect(panel.getByLabel('Due date')).toHaveValue('week');
  await page.getByTestId('board-title').click(); await expect(panel).toBeHidden();
  await search.fill('Review');
  await trigger.click(); await panel.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(search).toHaveValue('Review'); await expect(trigger).toHaveText('Filters');
  await expect(panel.getByRole('button', { name: 'Reset filters' })).toBeDisabled();
  await panel.getByRole('button', { name: 'Done', exact: true }).click();
  await controls.getByRole('button', { name: 'Clear', exact: true }).click(); await expect(page.getByTestId('card-tile')).toHaveCount(2);
  await views.getByRole('button', { name: 'List', exact: true }).click();
  await trigger.click(); await panel.getByRole('button', { name: 'Client experience and accessibility', exact: true }).click();
  await expect(page.getByTestId('card-row')).toHaveCount(1);
  await expect(page).toHaveURL(new RegExp(`view=list.*label=${label.id}|label=${label.id}.*view=list`));
  await panel.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(list(page, 'To do').getByRole('link', { name: /Review the client experience/ })).toBeVisible();
  await page.context().close();
});

test('mobile filter popover fits the viewport, stays anchored on resize and has accessible controls', async ({ browser }, info) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const trigger = page.getByRole('button', { name: 'Filters', exact: true });
  const panel = page.getByRole('dialog', { name: 'Board filters', exact: true });
  const before = await page.getByTestId('board-lists').boundingBox();
  await trigger.click(); await expect(panel).toBeVisible();
  await expect(panel.getByText('No labels in this workspace yet.')).toBeVisible();
  expect((await page.getByTestId('board-lists').boundingBox())!.y).toBe(before!.y);
  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(12); expect(box.x + box.width).toBeLessThanOrEqual(378);
  expect(box.y + box.height).toBeLessThanOrEqual(832);
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  for (const control of await panel.locator('button, select').all()) {
    const bounds = (await control.boundingBox())!; expect(bounds.width).toBeGreaterThanOrEqual(44); expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: info.outputPath('board-filters-mobile.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await page.setViewportSize({ width: 390, height: 520 });
  await expect.poll(async () => { const bounds = (await panel.boundingBox())!; return bounds.y + bounds.height; }).toBeLessThanOrEqual(508);
  await expect(panel.getByRole('button', { name: 'Done', exact: true })).toBeInViewport();
  await panel.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(panel).toBeHidden(); await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.context().close();
});

test('project header shows the saved icon and color without board counts, with a safe unknown-icon fallback', async ({ browser, request }) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 } });
  const { board, headers } = await setup(request, account);
  const saved = await request.patch(`/api/v1/projects/${board.project.id}`, { headers, data: { icon: 'rocket', color: 'teal' } });
  expect(saved.ok()).toBe(true);
  expect((await saved.json() as { icon: string }).icon).toBe('rocket');
  await page.reload();
  const header = page.getByTestId('board-project-header');
  const marker = header.getByTestId('project-icon');
  const sidebarMarker = page.getByTestId('rail-project').filter({ hasText: 'Acme site rebuild' }).getByTestId('project-icon');
  await expect(marker).toHaveAttribute('data-icon', 'rocket'); await expect(sidebarMarker).toHaveAttribute('data-icon', 'rocket');
  expect(await marker.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(await sidebarMarker.evaluate((element) => getComputedStyle(element).backgroundColor));
  await expect(header).not.toContainText(/\d+ cards? in \d+ lists?/);
  await page.route(`**/api/v1/projects/${board.project.id}`, async (route) => {
    const response = await route.fetch(); const body = await response.json() as Record<string, unknown>;
    await route.fulfill({ response, json: { ...body, icon: '<unknown>' } });
  });
  await page.reload(); await expect(marker).toHaveAttribute('data-icon', 'folder');
  await expect(header.getByTestId('board-title')).toHaveText('Acme site rebuild');
  await page.context().close();
});
