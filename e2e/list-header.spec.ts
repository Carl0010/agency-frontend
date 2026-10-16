import { expect, test, type Locator, type Page } from '@playwright/test';
import { list, signupToBoard } from './helpers';

async function order(page: Page) {
  return await page.getByTestId('list-column').evaluateAll((columns) => columns.map((column) => column.getAttribute('aria-label')));
}
async function dragHeader(page: Page, source: Locator, destination: Locator, padding = false) {
  const [from, to] = await Promise.all([source.boundingBox(), destination.boundingBox()]);
  if (!from || !to) throw new Error('List headers must be visible');
  const x = from.x + from.width / 2;
  const y = padding ? from.y + 5 : from.y + from.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 12, y, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
}

async function populateProgress(page: Page) {
  const progress = list(page, 'In progress');
  await progress.getByTestId('add-card-end').click();
  for (const name of ['Review the client brief', 'Prepare the launch checklist', 'Check the final assets']) {
    await progress.getByLabel('Card title').fill(name);
    await progress.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(progress.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
  await progress.getByRole('button', { name: 'Cancel', exact: true }).click();
  return progress;
}

test('board canvas is distinct from the sidebar in light and dark themes', async ({ browser }, info) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  const canvas = page.getByTestId('board-canvas');
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    const [workColor, navColor] = await Promise.all([canvas.evaluate((element) => getComputedStyle(element).backgroundColor), sidebar.evaluate((element) => getComputedStyle(element).backgroundColor)]);
    expect(workColor).not.toBe(navColor); expect(workColor).not.toBe('rgba(0, 0, 0, 0)');
    await page.screenshot({ path: info.outputPath(`board-canvas-${theme}.png`), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  }
  await page.context().close();
});

test('header padding and title both reorder columns while controls retain normal behavior', async ({ browser }) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 } });
  const todo = list(page, 'To do');
  const progress = await populateProgress(page);
  expect((await progress.boundingBox())!.height).toBeGreaterThan((await todo.boundingBox())!.height);
  await expect(page.getByRole('button', { name: /^Move list/ })).toHaveCount(0);
  await dragHeader(page, todo.getByTestId('list-header'), progress.getByTestId('list-header'), true);
  await expect.poll(() => order(page)).toEqual(['List In progress', 'List To do', 'List Done']);
  await expect(page.getByRole('textbox', { name: 'List name', exact: true })).toHaveCount(0);
  await page.reload();
  await expect.poll(() => order(page)).toEqual(['List In progress', 'List To do', 'List Done']);
  await dragHeader(page, todo.getByRole('button', { name: 'To do', exact: true }), progress.getByTestId('list-header'));
  await expect.poll(() => order(page)).toEqual(['List To do', 'List In progress', 'List Done']);
  await expect(page.getByRole('textbox', { name: 'List name', exact: true })).toHaveCount(0);
  await todo.getByRole('button', { name: 'List actions for To do' }).click();
  const menu = page.getByRole('group', { name: 'Actions for To do', exact: true });
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: 'Rename', exact: true }).click();
  const name = todo.getByRole('textbox', { name: 'List name', exact: true });
  await name.fill('Upcoming'); await page.keyboard.press('Enter');
  await expect(list(page, 'Upcoming')).toBeVisible();
  await list(page, 'Upcoming').getByRole('button', { name: 'Upcoming', exact: true }).click();
  await expect(list(page, 'Upcoming').getByRole('textbox', { name: 'List name', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await page.getByRole('searchbox', { name: 'Search by card name' }).fill('Review');
  await expect(list(page, 'Upcoming').getByRole('button', { name: 'Upcoming', exact: true })).not.toHaveAttribute('aria-roledescription', 'sortable');
  await dragHeader(page, list(page, 'Upcoming').getByTestId('list-header'), progress.getByTestId('list-header'), true);
  await expect.poll(() => order(page)).toEqual(['List Upcoming', 'List In progress', 'List Done']);
  await page.context().close();
});

test('header title supports keyboard reorder, Escape cancellation and API failure recovery', async ({ browser }) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 } });
  // Column height is content-driven: the neighbor must also be reachable when taller.
  await populateProgress(page);
  const title = list(page, 'To do').getByRole('button', { name: 'To do', exact: true });
  const todoId = await list(page, 'To do').getAttribute('data-list-id');
  await title.click({ trial: true });
  await title.focus(); await page.keyboard.press('Space');
  await expect(title).toHaveAttribute('aria-pressed', 'true');
  // aria-pressed updates before DnD's first measurement; wait for its initial target.
  await expect(page.getByRole('status')).toContainText(`over droppable area list:${todoId}`);
  const progressId = await list(page, 'In progress').getAttribute('data-list-id');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('status')).toContainText(`over droppable area list:${progressId}`);
  await page.keyboard.press('Escape');
  await expect(title).not.toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => order(page)).toEqual(['List To do', 'List In progress', 'List Done']);
  await title.click({ trial: true });
  await title.focus(); await page.keyboard.press('Space');
  await expect(title).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toContainText(`over droppable area list:${todoId}`);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('status')).toContainText(`over droppable area list:${progressId}`);
  await page.keyboard.press('Space');
  await expect.poll(() => order(page)).toEqual(['List In progress', 'List To do', 'List Done']);
  await expect(page.getByRole('textbox', { name: 'List name', exact: true })).toHaveCount(0);
  await page.route('**/api/v1/lists/*/position', (route) => route.fulfill({ status: 500, json: { error: { code: 'internal', message: 'Please try again.' } } }));
  await title.click({ trial: true });
  await title.focus(); await page.keyboard.press('Space');
  await expect(title).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toContainText(`over droppable area list:${todoId}`);
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('status')).toContainText(`over droppable area list:${progressId}`);
  await page.keyboard.press('Space');
  await expect(page.getByTestId('toast')).toContainText("Couldn't move the list");
  await expect.poll(() => order(page)).toEqual(['List In progress', 'List To do', 'List Done']);
  await page.reload();
  await expect.poll(() => order(page)).toEqual(['List In progress', 'List To do', 'List Done']);
  await page.context().close();
});
