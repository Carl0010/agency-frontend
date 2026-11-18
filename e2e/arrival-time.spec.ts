import { expect, test } from '@playwright/test';
import { Client } from 'pg';
import { accept, ownerApi } from './access-helpers';
import { list, signupToBoard } from './helpers';
import type { Board, CardTile, Page } from '../src/lib/types';
import type { BoardArrivals, ProjectArrival } from '../src/lib/arrival';
import type { Replan } from '../src/lib/arrival';

test('arrival settings, estimates, confidence and guest visibility follow API access', async ({ browser, request }, info) => {
  test.setTimeout(120_000);
  const { page, account } = await signupToBoard(browser);
  const parts = new URL(account.boardUrl).pathname.split('/');
  const workspaceId = parts[2]!;
  const projectId = parts[4]!;
  const call = await ownerApi(request, account);
  const board = await call<Board>('GET', `/boards/${account.boardId}`);
  const todo = board.lists[0]!;
  const done = board.lists[2]!;
  await list(page, done.name).getByRole('button', { name: `List actions for ${done.name}` }).click();
  await page.getByRole('button', { name: 'Mark as done list' }).click();
  await expect(list(page, done.name)).toContainText('Done list');
  await page.getByText('Arrival settings', { exact: true }).click();
  await page.getByLabel('Target date').fill('2030-01-01');
  await page.getByLabel("Show clients each card's arrival time").check();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect.poll(async () => (await call<{ targetDate: string | null }>('GET', `/projects/${projectId}/arrival-settings`)).targetDate).toBe('2030-01-01');
  await page.getByText('Arrival settings', { exact: true }).click();

  for (let i = 0; i < 20; i++) {
    const card = await call<CardTile>('POST', `/lists/${todo.id}/cards`, { title: `Finished ${i}` });
    await call('PATCH', `/cards/${card.id}/move`, { listId: done.id });
  }
  const open = await call<CardTile>('POST', `/lists/${todo.id}/cards`, { title: 'Open arrival card' });
  await expect.poll(async () => (await call<BoardArrivals>('GET', `/boards/${account.boardId}/arrivals`)).history, { timeout: 30_000 }).toBe('enough');
  await expect.poll(async () => (await call<ProjectArrival>('GET', `/projects/${projectId}/arrival`)).arrivesOn, { timeout: 30_000 }).not.toBeNull();
  await page.reload();
  await expect(page.getByTestId('project-arrival')).toContainText('Arrives');
  await expect(page.getByTestId('card-tile').filter({ hasText: 'Open arrival card' }).getByTestId('arrival-chip')).toBeVisible();
  const prompt = page.getByRole('region', { name: 'Project confidence' });
  await expect(prompt).toContainText('anonymous');
  await prompt.getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(prompt).toContainText('three people');
  const login = await request.post('/api/v1/auth/login', { data: { email: account.email, password: account.password } });
  const { accessToken } = await login.json() as { accessToken: string };
  const second = await request.put(`/api/v1/projects/${projectId}/confidence`, { headers: { Authorization: `Bearer ${accessToken}` }, data: { answer: 'no' } });
  expect(second.status()).toBe(409);
  const conflict = await second.json() as { error: { details: { reason: string } } };
  expect(conflict.error.details.reason).toBe('already_answered');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('arrival-mobile-dark.png'), animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });

  const memberEmail = `arrival-member-${Date.now()}@example.test`;
  await call('POST', `/workspaces/${workspaceId}/members/invites`, { email: memberEmail, role: 'member' });
  const member = await accept(browser, memberEmail, 'Arrival Member');
  const roster = await call<Page<{ userId: string; email: string }>>('GET', `/workspaces/${workspaceId}/members`);
  const memberId = roster.data.find((person) => person.email === memberEmail)!.userId;
  await call('PUT', `/projects/${projectId}/members/${memberId}`, { access: 'edit' });
  await member.goto(account.boardUrl);
  await member.getByText('Arrival settings', { exact: true }).click();
  await expect(member.getByLabel('Target date')).toBeDisabled();
  await list(member, done.name).getByRole('button', { name: `List actions for ${done.name}` }).click();
  await expect(member.getByRole('button', { name: /done list/i })).toHaveCount(0);

  const guestEmail = `arrival-guest-${Date.now()}@example.test`;
  await call('POST', `/projects/${projectId}/guests`, { email: guestEmail, access: 'comment' });
  const guest = await accept(browser, guestEmail, 'Arrival Guest');
  await expect(guest.getByTestId('project-arrival')).toContainText('Expected');
  await expect(guest.getByTestId('portal-card').filter({ hasText: 'Open arrival card' }).getByTestId('arrival-chip')).toBeVisible();
  await expect(guest.locator('body')).not.toContainText('past target');
  await expect(guest.getByRole('button', { name: 'Re-plan' })).toHaveCount(0);
  expect(open.id).toBeTruthy();
  await page.context().close(); await member.context().close(); await guest.context().close();
});

test('working days use the supported country list and save the calendar', async ({ browser, request }) => {
  const { page, account } = await signupToBoard(browser);
  const workspaceId = new URL(account.boardUrl).pathname.split('/')[2]!;
  const call = await ownerApi(request, account);
  await page.goto(`/w/${workspaceId}/settings/members`);
  const section = page.getByRole('region', { name: 'Working days' });
  await section.getByLabel('Country').selectOption('IN');
  await section.getByLabel('Timezone').selectOption('UTC');
  await section.getByRole('button', { name: 'Save working days' }).click();
  await expect.poll(async () => (await call<{ country: string | null }>('GET', `/workspaces/${workspaceId}/calendar`)).country).toBe('IN');
  await expect(section).toContainText('public holidays');
  await page.context().close();
});

test('a late card offers and applies a real re-plan', async ({ browser, request }) => {
  test.setTimeout(120_000);
  const { page, account } = await signupToBoard(browser);
  const call = await ownerApi(request, account);
  const board = await call<Board>('GET', `/boards/${account.boardId}`);
  const todo = board.lists[0]!;
  const done = board.lists[2]!;
  await call('PUT', `/lists/${done.id}/done`, { isDone: true });
  const dates: string[] = [];
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  for (let day = new Date(today); dates.length < 30; day.setUTCDate(day.getUTCDate() - 1)) {
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) dates.push(day.toISOString());
  }
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://agency:agency@127.0.0.1:55433/agency' });
  await db.connect();
  try {
    for (const day of dates) {
      const finished = await call<CardTile>('POST', `/lists/${todo.id}/cards`, { title: `Finished ${day}` });
      await call('PATCH', `/cards/${finished.id}/move`, { listId: done.id });
      await db.query('UPDATE card_movement SET occurred_at = $1 WHERE card_id = $2 AND project_id = $3', [day, finished.id, board.projectId]);
    }
  } finally { await db.end(); }
  const next = new Date(today);
  do { next.setUTCDate(next.getUTCDate() + 1); } while (next.getUTCDay() === 0 || next.getUTCDay() === 6);
  await call('POST', `/lists/${todo.id}/cards`, { title: 'First', dueAt: today.toISOString() });
  await call('POST', `/lists/${todo.id}/cards`, { title: 'Blog setup', dueAt: today.toISOString() });
  const late = await call<CardTile>('POST', `/lists/${todo.id}/cards`, { title: 'Homepage', dueAt: next.toISOString() });
  let plan: Replan | null = null;
  await expect.poll(async () => {
    plan = (await call<{ replan: Replan | null }>('GET', `/cards/${late.id}/replan?project=${board.projectId}`)).replan;
    return plan !== null;
  }, { timeout: 30_000 }).toBe(true);
  await page.reload();
  const card = page.getByTestId('card-tile').filter({ hasText: 'Homepage' });
  await expect(card.getByTestId('arrival-chip')).toContainText('late');
  await card.getByText('Homepage').click();
  const detail = page.getByTestId('card-detail');
  await detail.getByRole('button', { name: 'Re-plan' }).click();
  const dialog = detail.getByRole('dialog', { name: 'Re-plan' });
  await expect(dialog).toContainText('Blog setup');
  await page.route((url) => url.pathname === `/api/v1/cards/${late.id}/replan`, async (route) => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { code: 'replan_outdated', message: 'The re-plan changed.', details: {} } }) });
    else await route.continue();
  }, { times: 1 });
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('This re-plan changed. Showing the latest suggestion.')).toBeVisible();
  await expect(dialog).toContainText('Blog setup');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect.poll(async () => (await call<BoardArrivals>('GET', `/boards/${board.id}/arrivals`)).cards.find((entry) => entry.cardId === late.id)?.lateDays, { timeout: 30_000 }).toBe(0);
  await page.context().close();
});
