import { expect, test, type Page } from '@playwright/test';
import { ownerApi } from './access-helpers';
import { signupToBoard } from './helpers';

const pill = (page: Page) => page.getByTestId('board-project-header').getByTestId('project-status');

test('project status: create, change from the header by keyboard, filters, sidebar and archive', async ({ browser, request }) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 } });
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
  const workspaceId = new URL(account.boardUrl).pathname.split('/')[2] ?? '';
  const projectId = new URL(account.boardUrl).pathname.split('/')[4] ?? '';

  // AC1: a new project starts In progress; one created as Planned shows Planned.
  await expect(pill(page)).toHaveText('In progress');
  await sidebar.getByRole('button', { name: 'Add project', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'New project', exact: true });
  await expect(create.getByLabel('Status')).toHaveValue('in_progress');
  await create.getByLabel('Project name').fill('Spring campaign');
  await create.getByLabel('Status').selectOption('planned');
  await create.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Spring campaign', exact: true })).toBeVisible();
  await expect(pill(page)).toHaveText('Planned');
  await expect(sidebar.getByRole('link', { name: /Spring campaign/ })).toContainText('Planned');

  // AC2: change it from the header menu with the keyboard; it survives a reload.
  await page.goto(account.boardUrl);
  await pill(page).focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu', { name: 'Project status' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitemradio', { name: 'In progress' })).toBeFocused();
  await expect(menu.getByRole('menuitemradio', { name: 'In progress' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(pill(page)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(menu.getByRole('menuitemradio', { name: 'In progress' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitemradio', { name: 'On hold' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(pill(page)).toHaveText('On hold');
  await expect(sidebar.getByRole('link', { name: /Acme site rebuild/ })).toContainText('On hold');
  await page.reload();
  await expect(pill(page)).toHaveText('On hold');
  await expect(pill(page)).toHaveAttribute('title', /^Since \d{1,2} \w{3}$/);

  // AC3: Completed leaves the sidebar groups and the default Open filter.
  await pill(page).click();
  await menu.getByRole('menuitemradio', { name: 'Completed' }).click();
  await expect(pill(page)).toHaveText('Completed');
  await expect(sidebar.getByRole('link', { name: /Acme site rebuild/ })).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: /Spring campaign/ })).toBeVisible();
  await page.goto(`/w/${workspaceId}/projects`);
  const filters = page.getByRole('group', { name: 'Filter projects by status' });
  await expect(filters.getByRole('button', { name: 'Open', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const rows = page.getByRole('main').getByRole('listitem');
  await expect(rows.filter({ hasText: 'Spring campaign' })).toBeVisible();
  await expect(rows.filter({ hasText: 'Acme site rebuild' })).toHaveCount(0);
  await filters.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page).toHaveURL(/status=completed/);
  await expect(rows.filter({ hasText: 'Acme site rebuild' }).getByTestId('project-status')).toHaveText('Completed');
  await expect(rows.filter({ hasText: 'Spring campaign' })).toHaveCount(0);
  await filters.getByRole('button', { name: 'Cancelled', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No cancelled projects' })).toBeVisible();
  await filters.getByRole('button', { name: 'All', exact: true }).click();
  await expect(rows).toHaveCount(2);

  // AC4: archive and restore keep the status.
  const api = await ownerApi(request, account);
  await api('POST', `/projects/${projectId}/archive`);
  await api('POST', `/projects/${projectId}/restore`);
  await page.goto(account.boardUrl);
  await expect(pill(page)).toHaveText('Completed');

  // AC6/AC7: a lapsed (402) or failed save reverts the pill and shows the error; retry works.
  await page.route(new RegExp(`/api/v1/projects/${projectId}$`), async (route) => {
    if (route.request().method() === 'PATCH') await route.fulfill({ status: 402, json: { error: { code: 'subscription_inactive', message: 'This workspace is read-only.' } } });
    else await route.continue();
  });
  await pill(page).click();
  await menu.getByRole('menuitemradio', { name: 'Cancelled' }).click();
  await expect(page.getByTestId('toast').filter({ hasText: 'This workspace is read-only.' })).toBeVisible();
  await expect(pill(page)).toHaveText('Completed');
  await page.unroute(new RegExp(`/api/v1/projects/${projectId}$`));
  await pill(page).click();
  await menu.getByRole('menuitemradio', { name: 'Cancelled' }).click();
  await expect(pill(page)).toHaveText('Cancelled');
  await page.reload();
  await expect(pill(page)).toHaveText('Cancelled');
  await page.context().close();
});

test('project status on a phone: header pill and menu', async ({ browser }) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 390, height: 844 } });
  await expect(pill(page)).toBeVisible();
  await pill(page).click();
  const menu = page.getByRole('menu', { name: 'Project status' });
  await expect(menu).toBeInViewport();
  await menu.getByRole('menuitemradio', { name: 'Planned' }).click();
  await expect(pill(page)).toHaveText('Planned');
  await page.context().close();
});
