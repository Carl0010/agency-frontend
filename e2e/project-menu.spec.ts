import { expect, test } from '@playwright/test';
import { signupToBoard } from './helpers';

test('sidebar creates and edits a project through its own menu, preserving failed input', async ({ browser }, info) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 } });
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
  await sidebar.getByRole('button', { name: 'Add project', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'New project', exact: true });
  await create.getByLabel('Project name').fill('Northwind launch');

  await create.getByRole('radio', { name: 'rocket', exact: true }).check();
  await create.getByRole('radio', { name: 'rocket', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(create.getByRole('radio', { name: 'folder', exact: true })).toBeChecked();
  await page.keyboard.press('ArrowLeft');
  await expect(create.getByRole('radio', { name: 'rocket', exact: true })).toBeChecked();
  await create.getByRole('radio', { name: 'violet', exact: true }).check();
  await page.route('**/api/v1/workspaces/*/projects', async (route) => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 403, json: { error: { code: 'READ_ONLY', message: 'This workspace is read-only.' } } });
    else await route.continue();
  });
  await create.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(create.getByText('This workspace is read-only.')).toBeVisible();
  await expect(create.getByLabel('Project name')).toHaveValue('Northwind launch');
  await page.unroute('**/api/v1/workspaces/*/projects');
  await create.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(create).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Northwind launch', exact: true })).toBeVisible();
  await sidebar.getByRole('button', { name: 'Project actions for Northwind launch' }).click();
  const menu = page.getByRole('group', { name: 'Northwind launch actions' });
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape'); await expect(menu).toBeHidden();
  await sidebar.getByRole('button', { name: 'Project actions for Northwind launch' }).click();
  await menu.getByRole('button', { name: 'Edit project', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit project', exact: true });
  await expect(editor.getByRole('radio', { name: 'violet', exact: true })).toBeChecked();
  await expect(editor.getByRole('radio', { name: 'rocket', exact: true })).toBeChecked();
  await editor.getByLabel('Project name').fill('Northwind release');

  await editor.getByRole('radio', { name: 'teal', exact: true }).check();
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await expect(editor).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: 'Northwind release', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Northwind release', exact: true })).toBeVisible();
  await page.reload();
  await sidebar.getByRole('button', { name: 'Project actions for Northwind release' }).click();
  await page.getByRole('group', { name: 'Northwind release actions' }).getByRole('button', { name: 'Edit project', exact: true }).click();
  await expect(editor.getByRole('radio', { name: 'teal', exact: true })).toBeChecked();
  await expect(editor.getByLabel('Project name')).toHaveValue('Northwind release');
  await page.screenshot({ path: info.outputPath('project-editor.png'), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  await page.context().close();
});

test('mobile project editor returns to navigation on cancel and closes after creation', async ({ browser }) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 390, height: 844 } });
  const drawer = page.getByRole('dialog', { name: 'Workspace navigation' });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await drawer.getByRole('button', { name: 'Add project', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'New project', exact: true });
  await expect(editor.getByLabel('Project name')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(editor).toHaveCount(0); await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Add project', exact: true })).toBeFocused();
  await drawer.getByRole('button', { name: 'Add project', exact: true }).click();
  await editor.getByLabel('Project name').fill('Mobile project');
  await editor.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Mobile project', exact: true })).toBeVisible();
  await page.context().close();
});
