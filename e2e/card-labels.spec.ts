import { expect, test } from '@playwright/test';
import { signupToBoard } from './helpers';
import { ownerApi } from './access-helpers';
import type { Board, CardTile } from '../src/lib/types';

test('labels: type to find one, or create a new one with its colour from the same field', async ({ browser, request }) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const call = await ownerApi(request, account);
  const board = await call<Board>('GET', `/boards/${account.boardId}`);
  const card = await call<CardTile>('POST', `/lists/${board.lists[0]!.id}/cards`, { title: 'Homepage copy' });
  await page.goto(`${account.boardUrl}/c/${card.id}`);

  const labels = page.getByRole('combobox', { name: 'Labels' });
  await labels.fill('Needs review');
  await page.getByRole('option', { name: 'Create “Needs review”' }).click();
  const dialog = page.getByRole('dialog', { name: 'New label' });
  await expect(dialog.getByLabel('Name')).toHaveValue('Needs review');
  await dialog.getByRole('radio', { name: 'purple' }).check();
  await dialog.getByRole('button', { name: 'Create label' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove Needs review' })).toBeAttached();

  // The label now exists: typing part of it finds it, and its exact name no longer offers Create.
  await labels.fill('need');
  await expect(page.getByRole('option', { name: 'Needs review' })).toBeVisible();
  await labels.fill('Needs review');
  await expect(page.getByRole('option', { name: /^Create/ })).toHaveCount(0);
  await page.context().close();
});
