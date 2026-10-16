import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';
import { accept, ownerApi } from './access-helpers';
import { signupToBoard } from './helpers';
import type { Board, CardTile, Member, Page as ApiPage, Project, User } from '../src/lib/types';

const group = (page: Page, name: string) => page.getByRole('region', { name: `Group ${name}`, exact: true }).or(page.getByRole('rowgroup', { name: `Group ${name}`, exact: true }));
const handle = (scope: Locator, id: string) => scope.locator(`[data-group-card-handle][data-card-id="${id}"]`);
async function setup(browser: Browser, request: APIRequestContext, mobile = false) {
  const { page, account } = await signupToBoard(browser, { viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  const call = await ownerApi(request, account);
  const projectId = new URL(account.boardUrl).pathname.split('/')[4]!;
  const project = await call<Project>('GET', `/projects/${projectId}`);
  const board = await call<Board>('GET', `/boards/${account.boardId}`);
  const me = await call<User>('PATCH', '/me', { timezone: 'America/Los_Angeles' });
  const card = async (title: string) => call<CardTile>('POST', `/lists/${board.lists[0]!.id}/cards`, { title });
  return { page, account, call, project, board, me, card };
}
async function keyboardDrop(page: Page, start: Locator, direction: 'ArrowDown' | 'ArrowRight' | 'ArrowLeft' | 'ArrowUp', target: string) {
  await start.focus(); await start.press('Space');
  await expect(start).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press(direction);
  await expect(page.getByRole('status')).toContainText(`group:${target}`);
  await page.keyboard.press('Space');
}

test('grouping composes with filters, presentation, reload and history', async ({ browser, request }) => {
  const { page, account, card } = await setup(browser, request);
  await card('Design homepage'); await card('Write guide'); await page.reload();
  await page.getByRole('searchbox', { name: 'Search by card name' }).fill('Design');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByTestId('filter-panel').getByLabel('Due date').selectOption('none');
  await page.getByTestId('filter-panel').getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('combobox', { name: 'Group by', exact: true }).selectOption('due');
  await expect(group(page, 'No due date').getByRole('link')).toHaveCount(1);
  await expect(page).toHaveURL(/group=due/);
  await expect(handle(group(page, 'No due date'), (await group(page, 'No due date').locator('[data-group-card-handle]').getAttribute('data-card-id'))!)).toBeDisabled();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Board cards' })).toBeVisible();
  await expect(group(page, 'No due date').getByRole('button', { name: /Edit name/ })).toHaveText('Design homepage');
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('Design');
  await expect(page.getByRole('combobox', { name: 'Group by' })).toHaveValue('due');
  await page.getByRole('combobox', { name: 'Group by' }).selectOption('assignee');
  await expect(group(page, 'Unassigned')).toContainText('Design homepage');
  await page.goBack();
  await expect(page.getByRole('combobox', { name: 'Group by' })).toHaveValue('due');
  await expect(page.getByRole('searchbox')).toHaveValue('Design');
  await page.goto(`${account.boardUrl}?group=unknown`);
  await expect(page.getByRole('combobox', { name: 'Group by' })).toHaveValue('list');
  await expect(page.getByTestId('board-lists')).toBeVisible();
  await page.context().close();
});

test('assignee drags atomically swap a person in both presentations and recover from denied writes', async ({ browser, request }, info) => {
  const { page, account, call, project, me, card } = await setup(browser, request);
  const email = `group-assignee-${Date.now()}@example.test`;
  await call('POST', `/workspaces/${project.workspaceId}/members/invites`, { email, role: 'member' });
  const second = await accept(browser, email, 'Design Partner');
  await expect(second.getByRole('heading', { name: 'No projects shared with you yet' })).toBeVisible();
  const roster = await call<ApiPage<Member>>('GET', `/workspaces/${project.workspaceId}/members`);
  const other = roster.data.find((member) => member.email === email)!;
  await call('PUT', `/projects/${project.id}/members/${other.userId}`, { access: 'edit' });
  const c = await card('Prepare design review');
  await call('PATCH', `/cards/${c.id}/assignees`, { add: [me.id] });
  await page.goto(`${account.boardUrl}?group=assignee`);
  await expect(group(page, 'Design Partner')).toBeVisible();
  const response = page.waitForRequest((req) => req.url().endsWith(`/cards/${c.id}/assignees`) && req.method() === 'PATCH');
  await keyboardDrop(page, handle(group(page, 'E2E Owner'), c.id), 'ArrowLeft', other.userId);
  expect((await response).postDataJSON()).toEqual({ remove: [me.id], add: [other.userId] });
  await expect(handle(group(page, 'Design Partner'), c.id)).toBeFocused();
  await expect(group(page, 'E2E Owner').getByRole('link')).toHaveCount(0);
  expect((await call<CardTile>('GET', `/cards/${c.id}`)).assignees.map((p) => p.id)).toEqual([other.userId]);
  await page.screenshot({ path: info.outputPath('group-assignee-light.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await group(page, 'E2E Owner').getByRole('button', { expanded: true }).click();
  const start = handle(group(page, 'Design Partner'), c.id);
  for (const status of [422, 402, 403]) {
    await page.route('**/api/v1/cards/*/assignees', (route) => route.fulfill({ status, json: { error: { code: status === 422 ? 'validation_failed' : status === 402 ? 'workspace_read_only' : 'forbidden', message: `Denied ${status}` } } }));
    await keyboardDrop(page, start, 'ArrowDown', me.id);
    await expect(page.getByTestId('toast').filter({ hasText: `Denied ${status}` })).toBeVisible();
    await expect(start).toBeFocused();
    await expect(group(page, 'E2E Owner').getByTestId('card-row')).toHaveCount(0);
    await page.unroute('**/api/v1/cards/*/assignees');
  }
  await keyboardDrop(page, start, 'ArrowDown', me.id);
  await expect(handle(group(page, 'E2E Owner'), c.id)).toBeFocused();
  await page.reload(); await expect(group(page, 'E2E Owner')).toContainText('Prepare design review');
  await page.context().close(); await second.context().close();
});

test('due drags set Today, ask for Later, cancel and retry without changing list or position', async ({ browser, request }, info) => {
  const { page, account, call, card } = await setup(browser, request);
  const c = await card('Plan the launch');
  await page.goto(`${account.boardUrl}?group=due&view=list`);
  const start = handle(group(page, 'No due date'), c.id);
  await start.hover(); const from = (await start.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + from.height / 2, { steps: 3 });
  const today = (await group(page, 'Today').boundingBox())!;
  await page.mouse.move(today.x + today.width / 2, today.y + today.height / 2, { steps: 20 }); await page.mouse.up();
  await expect(handle(group(page, 'Today'), c.id)).toBeFocused();
  const saved = await call<CardTile>('GET', `/cards/${c.id}`);
  expect(saved.listId).toBe(c.listId); expect(saved.position).toBe(c.position);
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' });
  expect(fmt.format(new Date(saved.dueAt!))).toBe(fmt.format(new Date()));
  // A pointer drop over Overdue must cancel, rather than select its nearest enabled neighbor.
  const current = (await handle(group(page, 'Today'), c.id).boundingBox())!;
  const overdue = (await group(page, 'Overdue').boundingBox())!;
  await page.mouse.move(current.x + current.width / 2, current.y + current.height / 2); await page.mouse.down();
  await page.mouse.move(current.x + 12, current.y + current.height / 2, { steps: 3 });
  await page.mouse.move(overdue.x + 70, overdue.y + overdue.height / 2, { steps: 10 }); await page.mouse.up();
  await expect(handle(group(page, 'Today'), c.id)).toBeFocused();
  expect((await call<CardTile>('GET', `/cards/${c.id}`)).dueAt).toBe(saved.dueAt);
  // Overdue is never an available keyboard drop target.
  await handle(group(page, 'Today'), c.id).press('Space'); await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('status')).not.toContainText('group:overdue'); await page.keyboard.press('Escape');
  await keyboardDrop(page, handle(group(page, 'Today'), c.id), 'ArrowRight', 'next_7_days');
  await expect(handle(group(page, 'Next 7 days'), c.id)).toBeFocused();
  await keyboardDrop(page, handle(group(page, 'Next 7 days'), c.id), 'ArrowRight', 'later');
  const dialog = page.getByRole('dialog', { name: 'Choose a later due date' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(handle(group(page, 'Next 7 days'), c.id)).toBeFocused();
  await keyboardDrop(page, handle(group(page, 'Next 7 days'), c.id), 'ArrowRight', 'later');
  const date = new Date(); date.setUTCDate(date.getUTCDate() + 14); const picked = date.toISOString().slice(0, 10);
  await dialog.getByLabel('Later due date', { exact: true }).fill(new Date().toISOString().slice(0, 10));
  await dialog.getByRole('button', { name: 'Reschedule card' }).click();
  await expect(dialog.getByRole('alert')).toContainText('after the next 7 days');
  await dialog.getByLabel('Later due date', { exact: true }).fill(picked);
  await page.route('**/api/v1/cards/*/reschedule', (route) => route.fulfill({ status: 422, json: { error: { code: 'validation_failed', message: 'Retry date save' } } }));
  await dialog.getByRole('button', { name: 'Reschedule card' }).click();
  await expect(page.getByTestId('toast').filter({ hasText: 'Retry date save' })).toBeVisible();
  await expect(dialog.getByLabel('Later due date', { exact: true })).toHaveValue(picked);
  await page.unroute('**/api/v1/cards/*/reschedule'); await dialog.getByRole('button', { name: 'Reschedule card' }).click();
  await expect(dialog).toHaveCount(0); await expect(handle(group(page, 'Later'), c.id)).toBeFocused();
  await expect(page.getByTestId('toast')).toHaveCount(0);
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await handle(group(page, 'Later'), c.id).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('group-due-dark.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await keyboardDrop(page, handle(group(page, 'Later'), c.id), 'ArrowRight', 'none');
  await expect(handle(group(page, 'No due date'), c.id)).toBeFocused();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Board cards' })).toBeVisible();
  await expect(group(page, 'No due date')).toContainText('Plan the launch');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('group-list-mobile-dark.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await page.context().close();
});

test('due windows refresh at due expiration and on remote card.updated', async ({ browser, request }) => {
  const { page, account, call, card } = await setup(browser, request);
  const c = await card('Timed check');
  const dueAt = new Date(Date.now() + 8000).toISOString();
  await call('PATCH', `/cards/${c.id}`, { dueAt });
  await page.goto(`${account.boardUrl}?group=due&view=list`);
  await expect(group(page, 'Today')).toContainText('Timed check');
  await expect(group(page, 'Overdue')).toContainText('Timed check', { timeout: 12000 });
  await call('POST', `/cards/${c.id}/reschedule`, { to: 'none' });
  await expect(group(page, 'No due date')).toContainText('Timed check');
  await page.context().close();
});

test('guest due grouping is read-only, excludes assignees and survives returning from a card', async ({ browser, request }, info) => {
  const { page, call, project, card } = await setup(browser, request, true);
  await card('Guest visible card');
  const email = `group-guest-${Date.now()}@example.test`;
  await call('POST', `/projects/${project.id}/guests`, { email });
  const guest = await accept(browser, email, 'Grouping Guest', true);
  await expect(guest).toHaveURL(new RegExp(`/portal/${project.id}$`));
  await guest.getByRole('combobox', { name: 'Group by' }).selectOption('due');
  await expect(guest.getByRole('combobox').getByRole('option')).toHaveText(['List', 'Due date']);
  await guest.getByRole('tab', { name: 'No due date', exact: true }).click();
  await expect(guest.getByTestId('portal-card')).toBeVisible();
  await expect(guest.locator('[data-group-card-handle], [aria-roledescription="draggable"]')).toHaveCount(0);
  await guest.getByTestId('portal-card').click(); await guest.getByRole('link', { name: '← Board', exact: true }).click();
  await expect(guest.getByRole('combobox', { name: 'Group by' })).toHaveValue('due');
  await guest.screenshot({ path: info.outputPath('group-guest-mobile.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.context().close(); await guest.context().close();
});
