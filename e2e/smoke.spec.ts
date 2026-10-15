import { expect, test } from '@playwright/test';
import { list, signupToBoard } from './helpers';

/**
 * Slice 1 smoke path: signup → onboarding → board, then a second browser on
 * the same board sees live updates while the first creates, moves (keyboard)
 * and comments on a card. Order survives a reload.
 */

test('signup to a commented card, live in a second browser', async ({ browser }) => {
  const { page: a, account } = await signupToBoard(browser);
  const { email, password, boardUrl } = account;
  for (const name of ['In progress', 'Done']) await expect(list(a, name)).toBeVisible();

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
  const drawer = a.getByTestId('card-drawer');
  await expect(drawer.getByTestId('card-title')).toHaveText('Kickoff call');
  await drawer.getByLabel('Write a comment').fill('Agenda is in the brief.');
  await drawer.getByRole('button', { name: 'Comment' }).click();
  await expect(drawer.getByTestId('comment').filter({ hasText: 'Agenda is in the brief.' })).toBeVisible();
  await expect(list(b, 'In progress').getByTestId('comment-count')).toHaveText(/1/, { timeout: 2_000 });
});
