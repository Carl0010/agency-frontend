import { expect, test } from '@playwright/test';
import { signupToBoard } from './helpers';
import { ownerApi } from './access-helpers';
import type { Board, CardTile } from '../src/lib/types';

test('formatted comments, the pinned comment box, Comments/Activity tabs and the autosaving description', async ({ browser, request }) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 1440, height: 900 } });
  const call = await ownerApi(request, account);
  const board = await call<Board>('GET', `/boards/${account.boardId}`);
  const card = await call<CardTile>('POST', `/lists/${board.lists[0]!.id}/cards`, { title: 'Homepage copy' });
  await page.goto(`${account.boardUrl}/c/${card.id}`);
  const drawer = page.getByTestId('card-drawer-content');

  // Description: formatting, saved as Markdown without a Save button.
  await drawer.getByRole('textbox', { name: 'Description', exact: true }).click();
  await page.keyboard.type('Goals for the ');
  await drawer.getByRole('button', { name: 'Bold' }).click();
  await page.keyboard.type('new homepage');
  await expect(drawer.getByTestId('description-status')).toHaveText('Saved', { timeout: 5_000 });
  expect((await call<{ description: string }>('GET', `/cards/${card.id}`)).description.trim()).toBe('Goals for the **new homepage**');

  // The comment box is pinned to the bottom of the card and one line tall until focused.
  const composer = drawer.getByTestId('comment-composer');
  const box = (await composer.boundingBox())!;
  const panel = (await drawer.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBe(Math.round(panel.y + panel.height));
  await expect(composer.getByRole('toolbar', { name: 'Formatting' })).toHaveCount(0);
  await composer.getByRole('textbox', { name: 'Write a comment' }).click();
  await expect(composer.getByRole('toolbar', { name: 'Formatting' })).toBeVisible();
  expect((await composer.boundingBox())!.height).toBeGreaterThan(box.height + 100);

  await page.keyboard.type('Looks ');
  await composer.getByRole('button', { name: 'Italic' }).click();
  await page.keyboard.type('great');
  await composer.getByRole('button', { name: 'Italic' }).click();
  await page.keyboard.type(' ');
  await composer.getByRole('button', { name: 'Strikethrough' }).click();
  await page.keyboard.type('ship it');
  await composer.getByRole('button', { name: 'Comment', exact: true }).click();

  const comment = drawer.getByTestId('comment');
  await expect(comment).toHaveCount(1);
  await expect(comment.locator('em')).toHaveText('great');
  await expect(comment.locator('del')).toHaveText('ship it');
  const stored = await call<{ data: { body: string }[] }>('GET', `/cards/${card.id}/comments`);
  expect(stored.data[0]?.body).toBe('Looks *great* ~~ship it~~');
  await expect(composer.getByRole('toolbar', { name: 'Formatting' })).toHaveCount(0);

  // Activity lists what happened, oldest first.
  await drawer.getByRole('tab', { name: 'Activity' }).click();
  await expect(drawer.getByTestId('card-activity').getByRole('listitem')).toHaveText([/created this card/, /commented/]);
  await drawer.getByRole('tab', { name: /Comments/ }).click();
  await expect(comment).toBeVisible();
  await page.context().close();
});
