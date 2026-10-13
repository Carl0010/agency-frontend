import { expect, test, type Page } from '@playwright/test';

/**
 * Slice 1 smoke path: signup → onboarding → board, then a second browser on
 * the same board sees live updates while the first creates, moves (keyboard)
 * and comments on a card. Order survives a reload.
 */

const list = (page: Page, name: string) => page.getByRole('region', { name: `List ${name}` });

test('signup to a commented card, live in a second browser', async ({ browser }) => {
  const stamp = Date.now();
  const email = `smoke-${stamp}@example.test`;
  const password = 'smoke-password-123';

  const a = await (await browser.newContext()).newPage();
  await a.goto('/signup');
  await a.getByLabel('Your name').fill('Smoke Owner');
  await a.getByLabel('Work email').fill(email);
  await a.getByLabel('Password').fill(password);
  await a.getByRole('button', { name: 'Create account' }).click();

  // Onboarding step 1: name the workspace.
  await expect(a).toHaveURL(/\/onboarding$/);
  await a.getByLabel('Agency name').fill(`Smoke Agency ${stamp}`);
  await a.getByRole('button', { name: 'Continue' }).click();

  // Step 2: first client project → lands on its board with the three default lists.
  await a.getByLabel('Project name').fill('Acme site rebuild');
  await a.getByLabel('Client name').fill('Acme');
  await a.getByRole('button', { name: 'Create project' }).click();
  await expect(a).toHaveURL(/\/w\/[^/]+\/p\/[^/]+\/b\/[^/]+$/);
  for (const name of ['To do', 'In progress', 'Done']) await expect(list(a, name)).toBeVisible();
  const boardUrl = a.url();

  // Browser B: same account, separate session, same board.
  const b = await (await browser.newContext()).newPage();
  await b.goto(`/login?next=${encodeURIComponent(new URL(boardUrl).pathname)}`);
  await b.getByLabel('Email').fill(email);
  await b.getByLabel('Password').fill(password);
  await b.getByRole('button', { name: 'Log in' }).click();
  await expect(b).toHaveURL(boardUrl);
  await expect(list(b, 'To do')).toBeVisible();

  // A creates a card; B sees it without reloading (AC21: within 2 s).
  await list(a, 'To do').getByTestId('add-card-end').click();
  await a.getByLabel('Card title').fill('Kickoff call');
  await a.keyboard.press('Enter');
  const tileA = list(a, 'To do').getByRole('button', { name: /Kickoff call/ });
  await expect(tileA).toBeVisible();
  await expect(list(b, 'To do').getByRole('button', { name: /Kickoff call/ })).toBeVisible({ timeout: 2_000 });

  // Keyboard-only move to "In progress" (AC14): Space lifts, arrow moves, Space drops.
  await a.keyboard.press('Escape');
  await tileA.focus();
  await a.keyboard.press('Space');
  // dnd-kit binds its arrow-key listeners only once the drag is live.
  await expect(tileA).toHaveAttribute('aria-pressed', 'true');
  await a.keyboard.press('ArrowRight');
  // The target list opens a gap (live preview) before the drop is committed.
  await expect(list(a, 'In progress').getByRole('button', { name: /Kickoff call/ })).toBeVisible();
  await a.keyboard.press('Space');
  await expect(a.getByRole('button', { name: /Kickoff call/ })).not.toHaveAttribute('aria-pressed', 'true');
  await expect(list(b, 'In progress').getByRole('button', { name: /Kickoff call/ })).toBeVisible({ timeout: 2_000 });

  // The move persisted (AC12).
  await a.reload();
  await expect(list(a, 'In progress').getByRole('button', { name: /Kickoff call/ })).toBeVisible();
  await expect(list(a, 'To do').getByRole('button', { name: /Kickoff call/ })).toHaveCount(0);

  // Open the card and comment; B's tile picks up the comment count live.
  await list(a, 'In progress').getByRole('button', { name: /Kickoff call/ }).click();
  const modal = a.getByTestId('card-modal');
  await expect(modal.getByTestId('card-title')).toHaveText('Kickoff call');
  await modal.getByLabel('Write a comment').fill('Agenda is in the brief.');
  await modal.getByRole('button', { name: 'Comment' }).click();
  await expect(modal.getByTestId('comment').filter({ hasText: 'Agenda is in the brief.' })).toBeVisible();
  await expect(list(b, 'In progress').getByTestId('comment-count')).toHaveText(/1/, { timeout: 2_000 });
});
