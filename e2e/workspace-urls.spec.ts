import { expect, test } from '@playwright/test';
import { list, signupToBoard } from './helpers';

test('workspace UUID remains stable after renaming; legacy deep links retain query and hash', async ({ browser }) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 1440, height: 900 } });
  const workspaceId = new URL(account.boardUrl).pathname.split('/')[2]!;
  expect(workspaceId).toMatch(/^[0-9a-f-]{36}$/);
  const raw = (await page.context().cookies()).find((cookie) => cookie.name === 'agency_aud')!.value;
  const audience = JSON.parse(Buffer.from(raw, 'base64url').toString()) as { m: string[] };
  const slug = audience.m[1]!;
  await list(page, 'To do').getByTestId('add-card-end').click();
  await list(page, 'To do').getByLabel('Card title').fill('Review permanent links');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('card-tile')).toHaveCount(1);
  const cardId = await page.getByTestId('card-tile').getAttribute('data-card-id');
  const canonical = `${account.boardUrl}/c/${cardId}?view=list&q=Review&full=false#card`;
  await page.goto(canonical.replace(`/w/${workspaceId}/`, `/w/${slug}/`));
  await expect(page).toHaveURL(canonical);
  await expect(page.getByRole('dialog', { name: 'Card details' }).getByTestId('card-title')).toHaveText('Review permanent links');
  await expect(page.getByTestId('board-list-view')).toBeVisible();

  const login = await page.request.post('/api/v1/auth/login', { data: { email: account.email, password: account.password } });
  expect(login.ok()).toBe(true);
  const { accessToken } = await login.json() as { accessToken: string };
  const renamed = await page.request.patch(`/api/v1/workspaces/${workspaceId}`, { headers: { Authorization: `Bearer ${accessToken}` }, data: { name: 'Renamed workspace', slug: `renamed-${Date.now()}` } });
  expect(renamed.ok()).toBe(true);
  await page.reload();
  await expect(page).toHaveURL(canonical);
  await expect(page.getByRole('dialog', { name: 'Card details' }).getByTestId('card-title')).toHaveText('Review permanent links');
  await expect(page.getByRole('complementary', { name: 'Workspace sidebar' })).toContainText('Renamed workspace');
  await page.getByRole('button', { name: 'Close card' }).click();
  await expect(page).toHaveURL(`${account.boardUrl}?view=list&q=Review`);
  // The initial remembered-workspace preference uses the id, not the old alias.
  expect(await page.evaluate(() => localStorage.getItem('agency:lastWorkspace'))).toBe(workspaceId);
  const signedOut = await (await browser.newContext()).newPage();
  const fullUrl = `${account.boardUrl}/c/${cardId}?full=true&view=list#card`;
  await signedOut.goto(fullUrl);
  await expect(signedOut).toHaveURL(/\/login\?next=/);
  expect(new URL(signedOut.url()).searchParams.get('next')).toBe(new URL(fullUrl).pathname + '?full=true&view=list#card');
  await signedOut.getByLabel('Email', { exact: true }).fill(account.email);
  await signedOut.getByLabel('Password', { exact: true }).fill(account.password);
  await signedOut.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(signedOut).toHaveURL(fullUrl);
  await expect(signedOut.getByTestId('card-title')).toHaveText('Review permanent links');
  await expect(signedOut.getByRole('dialog', { name: 'Card details' })).toHaveCount(0);
  await signedOut.context().close();
  await page.context().close();
});
