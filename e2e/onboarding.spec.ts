import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { Client } from 'pg';
import { signupToBoard } from './helpers';

/**
 * Slice 4 smoke paths: the stopwatch run from a cold signup to a populated
 * board (AC26), the stepper resuming (AC20), the coach-mark tour (AC25),
 * invited members and guests skipping setup (AC27, AC28), and the billing
 * screen with a workspace dropping to read-only while export still works.
 * Billing and permission rules themselves are proven at the API layer.
 */

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://agency:agency@127.0.0.1:55433/agency';
const BUDGET_MS = 3 * 60_000;

async function sqlQuery(text: string, params: unknown[]): Promise<number> {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    return (await db.query(text, params)).rowCount ?? 0;
  } finally {
    await db.end();
  }
}

/** Dev mail goes to the API's stdout; swap in an invite token the test knows. */
async function knownInviteToken(email: string, role: 'guest' | 'member'): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const n = await sqlQuery(
    `UPDATE membership SET invite_token_hash = $1
      WHERE role ${role === 'guest' ? "= 'guest'" : "<> 'guest'"} AND status = 'invited'
        AND user_id = (SELECT id FROM "user" WHERE lower(email) = lower($2))`,
    [createHash('sha256').update(token).digest('hex'), email],
  );
  expect(n).toBe(1);
  return token;
}

async function bearer(request: APIRequestContext, email: string, password: string) {
  const res = await request.post('/api/v1/auth/login', { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  return { Authorization: `Bearer ${((await res.json()) as { accessToken: string }).accessToken}` };
}

async function acceptInvite(page: Page, token: string, name: string) {
  await page.goto(`/invite/${token}`);
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Choose a password').fill('invitee-password-123');
  await page.getByRole('button', { name: 'Accept invite' }).click();
}

test('AC26 a brand-new user reaches a board with ≥ 6 real cards in under 3 minutes', async ({ page }, info) => {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const started = Date.now();

  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Stopwatch Owner');
  await page.getByLabel('Work email').fill(`e2e-timed-${stamp}@example.test`);
  await page.getByLabel('Password').fill('e2e-password-123');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel('Agency name').fill(`Timed Studio ${stamp}`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Project name').fill('Northwind rebrand');
  await page.getByLabel('Client name').fill('Northwind');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('heading', { name: 'Invite your team' }).waitFor();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: /Start from a template/ }).click();
  await page.getByRole('button', { name: 'Use the Design sprint template' }).click();

  await expect(page).toHaveURL(/\/w\/[^/]+\/p\/[^/]+\/b\/[^/]+$/);
  await expect.poll(() => page.getByTestId('card-tile').count()).toBeGreaterThanOrEqual(6);
  const elapsed = Date.now() - started;

  // The CI number: attached to the report and written as a JSON artifact.
  info.annotations.push({ type: 'signup-to-board-ms', description: String(elapsed) });
  const dir = join(info.project.outputDir, 'metrics');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'signup-to-board.json'), JSON.stringify({ metric: 'signup_to_board_ms', value: elapsed, budget: BUDGET_MS, cards: await page.getByTestId('card-tile').count() }));
  console.log(`SIGNUP_TO_BOARD_MS=${elapsed}`);
  expect(elapsed).toBeLessThan(BUDGET_MS);

  // AC24: the template's named lists, with descriptions and checklists on the cards.
  await expect(page.getByRole('region', { name: 'List Monday · Map' })).toBeVisible();

  // AC25: a 3-step tour on the new board, never shown twice.
  const mark = page.getByTestId('coach-mark');
  await expect(mark).toContainText('Step 1 of 3');
  await expect(mark).toContainText('Add a card');
  await mark.getByRole('button', { name: 'Next' }).click();
  await expect(mark).toContainText('Open a card');
  await mark.getByRole('button', { name: 'Next' }).click();
  await expect(mark).toContainText('Open the client channel');
  await mark.getByRole('button', { name: 'Done' }).click();
  await expect(mark).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('card-tile').first()).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.getByTestId('coach-mark')).toHaveCount(0);

  // AC20: step 3 was skipped, so the chip offers to finish it (3/4).
  await expect(page.getByTestId('setup-chip')).toContainText('Finish setup (3/4)');
});

test('AC20 closing the tab mid-step resumes at the same step; the chip stays until dismissed', async ({ browser }) => {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Resume Owner');
  await page.getByLabel('Work email').fill(`e2e-resume-${stamp}@example.test`);
  await page.getByLabel('Password').fill('e2e-password-123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Agency name').fill(`Resume Studio ${stamp}`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Project name').fill('Half-done project');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('heading', { name: 'Invite your team' }).waitFor();

  // "Close the tab", come back to the app root in a new one.
  await page.close();
  const again = await context.newPage();
  await again.goto('/');
  await expect(again).toHaveURL(/\/onboarding$/);
  await expect(again.getByRole('heading', { name: 'Invite your team' })).toBeVisible();
  await expect(again.locator('[aria-current="step"]')).toContainText('Invite your team');

  // Leave for later: the chip brings the stepper back until dismissed.
  await again.getByRole('button', { name: 'Finish setup later' }).click();
  await expect(again).toHaveURL(/\/w\/[^/]+\/projects$/);
  const chip = again.getByTestId('setup-chip');
  await expect(chip).toContainText('Finish setup (2/4)');
  await chip.getByRole('link').click();
  await expect(again.getByRole('heading', { name: 'Invite your team' })).toBeVisible();
  await again.goBack();
  await again.getByTestId('setup-chip').getByRole('button', { name: 'Dismiss setup' }).click();
  await expect(again.getByTestId('setup-chip')).toHaveCount(0);
  await again.reload();
  await expect(again.getByRole('heading', { name: 'Clients' })).toBeVisible();
  await expect(again.getByTestId('setup-chip')).toHaveCount(0);
});

test('AC27 + AC28 invited people skip setup: a member lands on projects with the tour, a guest in the portal with neither', async ({ browser, request }) => {
  const { page: owner, account } = await signupToBoard(browser);
  const projectId = new URL(account.boardUrl).pathname.split('/')[4] ?? '';
  const auth = await bearer(request, account.email, account.password);
  const project = (await (await request.get(`/api/v1/projects/${projectId}`, { headers: auth })).json()) as { workspaceId: string };

  const memberEmail = `e2e-member-${Date.now()}@example.test`;
  expect((await request.post(`/api/v1/workspaces/${project.workspaceId}/members/invites`, { headers: auth, data: { email: memberEmail, role: 'member' } })).ok()).toBeTruthy();
  const member = await (await browser.newContext()).newPage();
  await acceptInvite(member, await knownInviteToken(memberEmail, 'member'), 'New Teammate');
  await expect(member).toHaveURL(/\/w\/[^/]+\/projects$/);
  await expect(member.getByTestId('coach-mark')).toContainText('Open a client project');
  await expect(member.getByText('Name your workspace')).toHaveCount(0);
  await expect(member.getByTestId('setup-chip')).toHaveCount(0);
  // Billing is the owner's: no nav entry, and the screen says so.
  await expect(member.getByRole('link', { name: 'Billing' })).toHaveCount(0);

  const guestEmail = `e2e-guest-${Date.now()}@example.test`;
  expect((await request.post(`/api/v1/projects/${projectId}/guests`, { headers: auth, data: { email: guestEmail, access: 'read' } })).ok()).toBeTruthy();
  const guest = await (await browser.newContext()).newPage();
  await acceptInvite(guest, await knownInviteToken(guestEmail, 'guest'), 'Client Person');
  await expect(guest).toHaveURL(new RegExp(`/portal/${projectId}$`));
  await expect(guest.getByTestId('portal-layout')).toBeVisible();
  await guest.waitForTimeout(1000);
  await expect(guest.getByTestId('coach-mark')).toHaveCount(0);
  await expect(guest.getByTestId('setup-chip')).toHaveCount(0);
  await expect(guest.getByTestId('trial-pill')).toHaveCount(0);
  await expect(guest.locator('body')).not.toContainText(/trial|seats|billing/i);
  await owner.close();
});

test('billing screen: owner sees plan and trial; forced cancel drops to read-only with export still working', async ({ browser }) => {
  const { page, account } = await signupToBoard(browser);
  const slug = new URL(account.boardUrl).pathname.split('/')[2] ?? '';

  await expect(page.getByTestId('trial-pill')).toContainText('14 days left in trial');
  await page.getByRole('link', { name: 'Billing', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${slug}/settings/billing$`));
  await expect(page.getByTestId('billing-status')).toHaveText('Trial');
  await expect(page.getByTestId('billing-seats')).toHaveText('1 of 5 seats used');
  await expect(page.getByRole('button', { name: 'Add payment method' })).toBeVisible();
  // No card field anywhere on the screen (AC2).
  await expect(page.locator('input[autocomplete^="cc-"]')).toHaveCount(0);

  // The demo's forced cancellation, applied the way the webhook would leave it.
  await sqlQuery(
    `UPDATE subscription SET status = 'canceled', stripe_subscription_id = $2, canceled_at = now(), data_delete_after = now() + interval '90 days'
      WHERE workspace_id = (SELECT id FROM workspace WHERE slug = $1)`,
    [slug, `sub_e2e_${Date.now()}`],
  );
  await page.goto(account.boardUrl);
  await expect(page.getByTestId('read-only-banner')).toContainText('read-only');
  await expect(page.getByTestId('card-tile').or(page.getByTestId('list-column')).first()).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByTestId('read-only-banner').getByRole('button', { name: 'Export JSON' }).click();
  expect((await download).suggestedFilename()).toBe(`${slug}-export.json`);

  // Writes are refused with the server's message; nothing changes.
  await page.getByTestId('add-card-end').first().click();
  await page.keyboard.type('Should not save');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/read-only/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Should not save')).toHaveCount(0);
});
