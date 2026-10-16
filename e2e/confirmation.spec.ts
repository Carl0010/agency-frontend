import { expect, test, type Page } from '@playwright/test';
import { list, signupToBoard } from './helpers';

async function archiveDialog(page: Page) {
  await list(page, 'To do').getByRole('button', { name: 'List actions for To do' }).click();
  await page.getByRole('group', { name: 'Actions for To do', exact: true }).getByRole('button', { name: 'Archive list', exact: true }).click();
  return page.getByRole('alertdialog', { name: 'Archive list?', exact: true });
}

test('app confirmation owns focus and dismissal and sends no mutation until acceptance', async ({ browser }, info) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  const nativeDialogs: string[] = [];
  page.on('dialog', (dialog) => { nativeDialogs.push(dialog.type()); void dialog.dismiss(); });
  const deletes: string[] = [];
  page.on('request', (request) => { if (request.method() === 'DELETE' && request.url().includes('/lists/')) deletes.push(request.url()); });
  let modal = await archiveDialog(page);
  const cancel = modal.getByRole('button', { name: 'Cancel', exact: true });
  const accept = modal.getByRole('button', { name: 'Archive list', exact: true });
  await expect(cancel).toBeFocused();
  await expect(modal).toContainText('“To do” and its 0 cards will be archived.');
  await cancel.press('Shift+Tab');
  await expect(modal.getByRole('button', { name: 'Close confirmation' })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(accept).toBeFocused();
  await page.keyboard.press('Tab'); await expect(modal.getByRole('button', { name: 'Close confirmation' })).toBeFocused();
  await page.screenshot({ path: info.outputPath('confirmation-light.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0);
  await expect(list(page, 'To do').getByRole('button', { name: 'List actions for To do' })).toBeFocused();
  expect(deletes).toHaveLength(0);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  modal = await archiveDialog(page);
  await page.screenshot({ path: info.outputPath('confirmation-dark.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(modal).toHaveCount(0);
  modal = await archiveDialog(page);
  await page.mouse.click(5, 400); await expect(modal).toHaveCount(0);
  expect(deletes).toHaveLength(0);
  modal = await archiveDialog(page);
  await modal.getByRole('button', { name: 'Archive list', exact: true }).click();
  await expect(list(page, 'To do')).toHaveCount(0);
  expect(deletes).toHaveLength(1); expect(nativeDialogs).toEqual([]);
  await page.context().close();
});

test('failed archive stays visible and can be retried through the app confirmation', async ({ browser }) => {
  const { page } = await signupToBoard(browser);
  await page.route('**/api/v1/lists/*', async (route) => {
    if (route.request().method() === 'DELETE') await route.fulfill({ status: 500, json: { error: { code: 'internal', message: 'Could not archive this list.' } } });
    else await route.continue();
  });
  const modal = await archiveDialog(page);
  await modal.getByRole('button', { name: 'Archive list', exact: true }).click();
  await expect(modal).toHaveCount(0); await expect(list(page, 'To do')).toBeVisible();
  await expect(page.getByTestId('toast').filter({ hasText: 'Could not archive this list.' })).toBeVisible();
  await page.unroute('**/api/v1/lists/*');
  await archiveDialog(page);
  await modal.getByRole('button', { name: 'Archive list', exact: true }).click();
  await expect(list(page, 'To do')).toHaveCount(0);
  await page.context().close();
});

test('mobile confirmation above a card drawer cancels independently and preserves readable controls', async ({ browser }, info) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const todo = list(page, 'To do');
  await todo.getByTestId('add-card-end').click();
  await todo.getByLabel('Card title').fill('Review the client brief'); await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
  await todo.getByRole('button', { name: /Review the client brief/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Card details' });
  await drawer.getByRole('textbox', { name: 'Write a comment' }).fill('Keep this feedback until confirmed.');
  await drawer.getByRole('button', { name: 'Comment', exact: true }).click();
  const comment = drawer.getByTestId('comment').filter({ hasText: 'Keep this feedback until confirmed.' });
  await comment.getByRole('button', { name: 'Delete', exact: true }).click();
  const modal = page.getByRole('alertdialog', { name: 'Delete comment?', exact: true });
  await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  expect(await modal.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  for (const button of await modal.getByRole('button').all()) {
    const box = (await button.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: info.outputPath('confirmation-mobile.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0); await expect(drawer).toBeVisible(); await expect(comment).toBeVisible();
  await comment.getByRole('button', { name: 'Delete', exact: true }).click();
  await modal.getByRole('button', { name: 'Delete comment', exact: true }).click();
  await expect(drawer.getByTestId('comment-tombstone')).toBeVisible();
  await expect(drawer).toBeVisible();
  await page.context().close();
});
