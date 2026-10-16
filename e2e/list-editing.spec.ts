import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';
import { list, signupToBoard } from './helpers';

async function editableBoard(browser: Browser, request: APIRequestContext, mobile = false) {
  const { page, account } = await signupToBoard(browser, { viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, ...(mobile ? { isMobile: true, hasTouch: true } : {}), colorScheme: 'light' });
  const login = await request.post('/api/v1/auth/login', { data: { email: account.email, password: account.password } });
  expect(login.ok()).toBe(true);
  const auth = await login.json() as { accessToken: string };
  const headers = { Authorization: `Bearer ${auth.accessToken}` };
  const response = await request.get(`/api/v1/boards/${account.boardId}`, { headers });
  expect(response.ok()).toBe(true);
  const board = await response.json() as { project: { key: string }; lists: { id: string; name: string }[] };
  async function card(name: string, section = 'To do') {
    const result = await request.post(`/api/v1/lists/${board.lists.find((column) => column.name === section)!.id}/cards`, { headers, data: { title: name, at: 'end' } });
    expect(result.ok()).toBe(true);
    const tile = await result.json() as { id: string; number: number };
    return { ...tile, key: `${board.project.key}-${tile.number}` };
  }
  const first = await card('Review the client brief');
  const second = await card('Prepare the launch checklist');
  await card('Check the final assets', 'In progress');
  await page.goto(`${account.boardUrl}?view=list`);
  await expect(page.getByTestId('card-row')).toHaveCount(3);
  return { page, account, first, second, board };
}

test('section dragging temporarily closes an open section and restores its state after drop, cancel or failure', async ({ browser, request }) => {
  const { page, first, board } = await editableBoard(browser, request);
  const todo = list(page, 'To do');
  const handle = todo.getByRole('button', { name: 'Move list To do', exact: true });
  const progressId = board.lists.find((column) => column.name === 'In progress')!.id;
  const todoId = board.lists.find((column) => column.name === 'To do')!.id;
  const title = todo.getByRole('button', { name: `Edit name for ${first.key}` });
  await todo.getByTestId('list-header').hover(); await expect(handle).toHaveCSS('opacity', '1');
  await handle.focus(); await handle.press('Space'); await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await expect(title).toBeHidden(); await expect(todo.getByRole('button', { name: 'Expand To do' })).toBeDisabled();
  await expect(list(page, 'In progress').getByRole('button', { name: /^Edit name for/ })).toBeVisible();
  await expect(page.getByRole('status')).toContainText(`over droppable area list:${todoId}`);
  await page.keyboard.press('ArrowDown'); await expect(page.getByRole('status')).toContainText(`over droppable area list:${progressId}`); await page.keyboard.press('Space');
  await expect.poll(() => sectionOrder(page)).toEqual(['List In progress', 'List To do', 'List Done']); await expect(title).toBeVisible();
  await page.reload(); await expect.poll(() => sectionOrder(page)).toEqual(['List In progress', 'List To do', 'List Done']);
  await handle.focus(); await handle.press('Space'); await expect(title).toBeHidden(); await page.keyboard.press('Escape'); await expect(title).toBeVisible();
  await page.route('**/api/v1/lists/*/position', (route) => route.fulfill({ status: 500, json: { error: { code: 'internal', message: 'Please try again.' } } }));
  await handle.focus(); await handle.press('Space'); await expect(title).toBeHidden();
  await expect(page.getByRole('status')).toContainText(`over droppable area list:${todoId}`);
  await page.keyboard.press('ArrowUp'); await expect(page.getByRole('status')).toContainText(`over droppable area list:${progressId}`); await page.keyboard.press('Space');
  await expect(page.getByTestId('toast').filter({ hasText: "Couldn't move the list" })).toBeVisible(); await expect(title).toBeVisible();
  await expect.poll(() => sectionOrder(page)).toEqual(['List In progress', 'List To do', 'List Done']);
  await page.unroute('**/api/v1/lists/*/position');
  await todo.getByRole('button', { name: 'Collapse To do' }).click();
  await handle.focus(); await handle.press('Space'); await expect(handle).toHaveAttribute('aria-pressed', 'true'); await page.keyboard.press('Escape');
  await expect(title).toBeHidden(); await expect(todo.getByRole('button', { name: 'Expand To do' })).toHaveAttribute('aria-expanded', 'false');
  await page.context().close();
});

test('mobile rows keep inline editors, drawer access and drag handles reachable without overflow', async ({ browser, request }, info) => {
  const { page, first } = await editableBoard(browser, request, true);
  const task = row(page, first.id);
  await expect(task.getByRole('button', { name: `Move card ${first.key}` })).toHaveCSS('opacity', '1');
  await task.getByRole('button', { name: `Edit name for ${first.key}` }).click();
  const name = task.getByRole('textbox', { name: `Card name for ${first.key}` });
  await name.fill('Review the mobile brief'); await name.press('Enter');
  await expect(task.getByRole('button', { name: `Edit name for ${first.key}` })).toHaveText('Review the mobile brief');
  await task.getByRole('button', { name: `Edit due date for ${first.key}` }).click();
  const due = page.getByRole('dialog', { name: `Due date for ${first.key}` });
  const box = (await due.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(12); expect(box.x + box.width).toBeLessThanOrEqual(378);
  await due.getByLabel('Due date', { exact: true }).fill('2026-11-21T09:00'); await due.getByRole('button', { name: 'Save', exact: true }).click();
  await page.screenshot({ path: info.outputPath('list-table-mobile.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  expect(await page.getByTestId('board-list-view').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const button of await task.getByRole('button').all()) { const bounds = (await button.boundingBox())!; expect(bounds.height).toBeGreaterThanOrEqual(44); expect(bounds.width).toBeGreaterThanOrEqual(44); }
  await task.getByRole('link').click(); await expect(page.getByTestId('card-drawer').getByTestId('card-title')).toHaveText('Review the mobile brief');
  await page.getByRole('button', { name: 'Close card' }).click(); await expect(task.getByRole('link')).toBeFocused();
  await page.context().close();
});

const row = (page: Page, id: string) => page.locator(`[data-card-row-id="${id}"]`);
const rowOrder = (group: Locator) => group.getByTestId('card-row').evaluateAll((rows) => rows.map((element) => element.getAttribute('data-card-row-id')));
const sectionOrder = (page: Page) => page.getByTestId('list-group').evaluateAll((groups) => groups.map((element) => element.getAttribute('aria-label')));

test('one compact table supports inline name, assignment and due-date editing with failure recovery', async ({ browser, request }, info) => {
  const { page, first } = await editableBoard(browser, request);
  const table = page.getByRole('table', { name: 'Board cards' });
  await expect(page.getByRole('table')).toHaveCount(1);
  await expect(table.getByRole('rowgroup', { name: 'List To do' })).toBeVisible();
  const task = row(page, first.id);
  expect((await task.boundingBox())!.height).toBeLessThanOrEqual(44);
  const title = task.getByRole('button', { name: `Edit name for ${first.key}` });
  await title.click();
  const input = task.getByRole('textbox', { name: `Card name for ${first.key}` });
  await expect(input).toBeFocused(); await input.fill('Discard this draft'); await input.press('Escape');
  await expect(title).toHaveText('Review the client brief'); await expect(title).toBeFocused();
  await title.click(); await input.fill('Revised client brief');
  await page.route('**/api/v1/cards/*', async (route) => { if (route.request().method() === 'PATCH') await route.fulfill({ status: 500, json: { error: { code: 'internal', message: 'Could not save this card.' } } }); else await route.continue(); });
  await input.press('Enter'); await expect(task.getByRole('alert')).toHaveText('Could not save this card.'); await expect(input).toHaveValue('Revised client brief');
  await page.unroute('**/api/v1/cards/*'); await input.press('Enter'); await expect(title).toHaveText('Revised client brief');
  await expect(page.getByTestId('card-drawer')).toHaveCount(0);
  await task.getByRole('button', { name: `Assign members for ${first.key}` }).click();
  const people = page.getByRole('dialog', { name: `Assignees for ${first.key}` });
  await people.getByRole('button', { name: 'E2E Owner', exact: true }).click();
  await expect(people.getByRole('button', { name: 'E2E Owner', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await people.getByRole('button', { name: 'Done', exact: true }).click();
  const dueTrigger = task.getByRole('button', { name: `Edit due date for ${first.key}` });
  await dueTrigger.click();
  const due = page.getByRole('dialog', { name: `Due date for ${first.key}` });
  await expect(due.getByLabel('Due date', { exact: true })).toBeFocused();
  await due.getByLabel('Due date', { exact: true }).fill('2026-11-20T10:30');
  await due.getByLabel('Mark due date complete').check(); await due.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(due).toBeHidden(); await expect(dueTrigger.getByTestId('due-pill')).toHaveAttribute('data-state', 'done');
  await page.screenshot({ path: info.outputPath('list-table-desktop.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.screenshot({ path: info.outputPath('list-table-dark.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await task.getByRole('link').click();
  const drawer = page.getByTestId('card-drawer'); await expect(drawer.getByTestId('card-title')).toHaveText('Revised client brief');
  await expect(drawer.getByLabel('Due date')).toHaveValue('2026-11-20T10:30');
  await drawer.getByRole('button', { name: 'Close card' }).click();
  await expect(page).toHaveURL(/\/b\/[^/?]+\?view=list$/);
  await page.reload(); await expect(title).toHaveText('Revised client brief');
  await expect(task.getByRole('button', { name: `Assign members for ${first.key}` })).toContainText('E2E Owner');
  await dueTrigger.click(); await expect(due.getByLabel('Due date', { exact: true })).toHaveValue('2026-11-20T10:30');
  await due.getByRole('button', { name: 'Remove due date', exact: true }).click(); await expect(dueTrigger).toHaveText('No due date');
  await page.context().close();
});

test('row handles reorder cards, move them between sections, cancel and recover failed saves', async ({ browser, request }) => {
  const { page, first, second } = await editableBoard(browser, request);
  const todo = list(page, 'To do');
  const handle = row(page, first.id).getByRole('button', { name: `Move card ${first.key}` });
  await handle.focus(); await expect(handle).toHaveCSS('opacity', '1'); await handle.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toContainText(`over droppable area ${first.id}`);
  await page.keyboard.press('ArrowDown'); await expect(page.getByRole('status')).toContainText(`over droppable area ${second.id}`); await page.keyboard.press('Space');
  await expect.poll(() => rowOrder(todo)).toEqual([second.id, first.id]);
  await page.reload(); await expect.poll(() => rowOrder(todo)).toEqual([second.id, first.id]);
  await handle.focus(); await handle.press('Space'); await expect(handle).toHaveAttribute('aria-pressed', 'true'); await page.keyboard.press('Escape');
  await expect.poll(() => rowOrder(todo)).toEqual([second.id, first.id]);
  await page.route('**/api/v1/cards/*/move', (route) => route.fulfill({ status: 500, json: { error: { code: 'internal', message: 'Please try again.' } } }));
  await handle.focus(); await handle.press('Space'); await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toContainText(`over droppable area ${first.id}`);
  await page.keyboard.press('ArrowUp'); await expect(page.getByRole('status')).toContainText(`over droppable area ${second.id}`); await page.keyboard.press('Space');
  await expect(page.getByTestId('toast').filter({ hasText: "Couldn't move the card" })).toBeVisible(); await expect.poll(() => rowOrder(todo)).toEqual([second.id, first.id]);
  await page.unroute('**/api/v1/cards/*/move');
  await handle.hover();
  const start = (await handle.boundingBox())!; await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down(); await page.mouse.move(start.x + 14, start.y + start.height / 2, { steps: 3 });
  const target = (await list(page, 'Done').getByTestId('list-drop-end').boundingBox())!;
  await page.mouse.move(target.x + 50, target.y + target.height / 2, { steps: 20 }); await page.mouse.up();
  await expect(list(page, 'Done').getByRole('button', { name: `Edit name for ${first.key}` })).toBeVisible();
  await page.reload(); await expect(list(page, 'Done').getByRole('button', { name: `Edit name for ${first.key}` })).toBeVisible();
  await page.context().close();
});
