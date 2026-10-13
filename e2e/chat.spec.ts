import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { signupToBoard } from './helpers';

/**
 * Slice 2 smoke path: chat (post, live in a second session, edit, thread,
 * delete), the push permission explainer (AC16), the ⌘K palette (AC26) and the
 * inbox/preferences screens.
 */

/** Records Notification.requestPermission calls; the permission stays "default" until asked. */
async function instrumentNotifications(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as unknown as { __permissionRequests: number; __permission: NotificationPermission };
    w.__permissionRequests = 0;
    w.__permission = 'default';
    if (!('Notification' in window)) return;
    Object.defineProperty(Notification, 'permission', { configurable: true, get: () => w.__permission });
    Notification.requestPermission = () => {
      w.__permissionRequests += 1;
      w.__permission = 'denied';
      return Promise.resolve('denied');
    };
  });
}
const permissionRequests = (page: Page) => page.evaluate(() => (window as unknown as { __permissionRequests: number }).__permissionRequests);

const composer = (page: Page, channel: string) => page.getByLabel(`Message ${channel}`);
const message = (page: Page, text: string | RegExp) => page.getByTestId('message').filter({ hasText: text });

test('chat: post, live second session, edit, thread, delete', async ({ browser }) => {
  const { page: a, account } = await signupToBoard(browser);
  const base = account.boardUrl.replace(/\/b\/[^/]+$/, '');

  // Client channel carries the load-bearing reminder (§3.4).
  await a.getByRole('link', { name: 'Chat' }).click();
  await expect(a).toHaveURL(`${base}/chat`);
  await expect(a.getByTestId('channel-badge')).toHaveText('Client');
  await expect(a.getByTestId('client-reminder')).toHaveText('Your client can read and post here.');

  await a.getByRole('link', { name: 'Team' }).click();
  await expect(a).toHaveURL(`${base}/team`);
  await expect(a.getByTestId('channel-badge')).toHaveText('Internal');
  await expect(a.getByTestId('client-reminder')).toHaveCount(0);

  await composer(a, 'Team').fill('Kickoff notes are in the **brief**');
  await composer(a, 'Team').press('Enter');
  await expect(message(a, 'Kickoff notes are in the brief')).toBeVisible();
  await expect(message(a, 'Kickoff notes are in the brief').locator('strong')).toHaveText('brief');

  // Second session of the same user sees new messages stream in (AC2: < 2s).
  const b = await (await browser.newContext()).newPage();
  await b.goto(`/login?next=${encodeURIComponent(new URL(`${base}/team`).pathname)}`);
  await b.getByLabel('Email').fill(account.email);
  await b.getByLabel('Password').fill(account.password);
  await b.getByRole('button', { name: 'Log in' }).click();
  await expect(b).toHaveURL(`${base}/team`);
  await expect(message(b, 'Kickoff notes')).toBeVisible();

  await composer(a, 'Team').fill('Second message');
  await composer(a, 'Team').press('Enter');
  await expect(message(b, 'Second message')).toBeVisible({ timeout: 2_000 });

  // Shift+Enter is a newline, not a send.
  await composer(a, 'Team').fill('line one');
  await composer(a, 'Team').press('Shift+Enter');
  await composer(a, 'Team').pressSequentially('line two');
  await expect(message(a, 'line one')).toHaveCount(0);
  await composer(a, 'Team').press('Enter');
  await expect(message(a, /line one\s*line two/)).toBeVisible();

  // Edit shows "(edited)" everywhere.
  await message(a, 'Second message').hover();
  await message(a, 'Second message').getByRole('button', { name: 'Edit' }).click();
  await a.getByLabel('Edit message').fill('Second message, revised');
  await a.getByLabel('Edit message').press('Enter');
  await expect(message(a, 'Second message, revised')).toContainText('(edited)');
  await expect(message(b, 'Second message, revised')).toContainText('(edited)', { timeout: 2_000 });

  // Thread: reply opens the pane; the root shows "1 reply · last reply …" (AC4).
  await message(a, 'Kickoff notes').hover();
  await message(a, 'Kickoff notes').getByRole('button', { name: 'Reply in thread' }).click();
  const pane = a.getByTestId('thread-pane');
  await expect(pane).toBeVisible();
  await pane.getByLabel('Reply in thread').fill('On it');
  await pane.getByLabel('Reply in thread').press('Enter');
  await expect(pane.getByTestId('message').filter({ hasText: 'On it' })).toBeVisible();
  await expect(message(a, 'Kickoff notes').getByTestId('reply-summary')).toHaveText(/^1 reply · last reply/);
  await expect(message(b, 'Kickoff notes').getByTestId('reply-summary')).toHaveText(/^1 reply/, { timeout: 2_000 });
  // The reply lives in the thread, not the channel.
  await expect(a.getByTestId('message-list').getByTestId('message').filter({ hasText: 'On it' })).toHaveCount(0);
  await pane.getByRole('button', { name: 'Close thread' }).click();
  await expect(pane).toHaveCount(0);

  // Delete: a root with no replies disappears for everyone.
  a.once('dialog', (d) => void d.accept());
  await message(a, 'Second message, revised').hover();
  await message(a, 'Second message, revised').getByRole('button', { name: 'Delete' }).click();
  await expect(message(a, 'Second message, revised')).toHaveCount(0);
  await expect(message(b, 'Second message, revised')).toHaveCount(0, { timeout: 2_000 });

  // Survives a reload, oldest → newest.
  await a.reload();
  await expect(message(a, 'line one')).toBeVisible();
  const bodies = await a.getByTestId('message-list').getByTestId('message-body').allInnerTexts();
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toMatch(/^Kickoff notes are in the brief/);
  expect(bodies[1]).toMatch(/^line one\s+line two/);
});

test('push permission is only requested from the explainer, on a second session (AC16)', async ({ browser }) => {
  const context = await browser.newContext();
  await instrumentNotifications(context);
  const { page: first, account } = await signupToBoardIn(context);

  // First session: no prompt, no explainer — not even after a reload.
  await expect(first.getByTestId('board-title')).toBeVisible();
  await first.reload();
  await expect(first.getByTestId('board-title')).toBeVisible();
  await expect(first.getByTestId('push-explainer')).toHaveCount(0);
  expect(await permissionRequests(first)).toBe(0);

  // Second session (a new tab is a new browser session for sessionStorage).
  const second = await context.newPage();
  await second.goto(account.boardUrl);
  const explainer = second.getByTestId('push-explainer');
  await expect(explainer).toBeVisible();
  expect(await permissionRequests(second)).toBe(0);
  await explainer.getByRole('button', { name: 'Enable notifications' }).click();
  await expect(explainer).toHaveCount(0);
  expect(await permissionRequests(second)).toBe(1);
});

test('⌘K palette: debounced search, ↵ navigates to the message, ⌘↵ opens a new tab (AC26)', async ({ browser }) => {
  const { page, account } = await signupToBoard(browser);
  const base = account.boardUrl.replace(/\/b\/[^/]+$/, '');
  await page.goto(`${base}/team`);
  await composer(page, 'Team').fill('The quokka mascot is approved');
  await composer(page, 'Team').press('Enter');
  await expect(message(page, 'quokka mascot')).toBeVisible();

  // Opens from any /w/* route.
  await page.goto(account.boardUrl);
  await expect(page.getByTestId('board-title')).toBeVisible();
  const searches: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/search?')) searches.push(r.url());
  });
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByTestId('command-palette');
  await expect(palette).toBeVisible();
  await palette.getByLabel('Search cards, comments and messages').pressSequentially('quokka', { delay: 40 });
  await expect(palette.getByTestId('search-result').first()).toContainText('quokka mascot');
  // Typed faster than the 250ms debounce: one request, for the full word.
  expect(searches).toHaveLength(1);
  expect(searches[0]).toContain('q=quokka');
  await expect(palette.getByTestId('search-counts')).toHaveText(/Messages \(1\)/);

  const [popup] = await Promise.all([page.context().waitForEvent('page'), page.keyboard.press('ControlOrMeta+Enter')]);
  await expect(popup).toHaveURL(/\/team\?m=/);
  await popup.close();

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/team\?m=/);
  await expect(message(page, 'quokka mascot')).toBeVisible();
});

test('inbox and notification preferences render', async ({ browser }) => {
  const { page, account } = await signupToBoard(browser);
  const slug = new URL(account.boardUrl).pathname.split('/')[2];
  await page.getByTestId('notification-bell').click();
  await expect(page).toHaveURL(`/w/${slug}/inbox`);
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();
  await page.getByRole('link', { name: 'Preferences' }).click();
  const grid = page.getByTestId('preferences-grid');
  await expect(grid.locator('tbody tr')).toHaveCount(6);
  await expect(page.getByLabel('Mentions in-app (always on)')).toBeDisabled();
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/notifications/preferences') && r.request().method() === 'PUT'),
    page.getByLabel('New messages email').click(),
  ]);
  await expect(page.getByLabel('New messages email')).not.toBeChecked();
  await page.reload();
  await expect(page.getByLabel('New messages email')).not.toBeChecked();
  await expect(page.getByLabel('Mentions email')).toBeChecked();
});

/** signupToBoard in a caller-supplied context (so init scripts apply from the first page). */
async function signupToBoardIn(context: BrowserContext) {
  const fake = { newContext: () => Promise.resolve(context) } as unknown as Parameters<typeof signupToBoard>[0];
  return signupToBoard(fake);
}
