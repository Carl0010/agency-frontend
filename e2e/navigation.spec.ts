import { expect, test } from '@playwright/test';
import { list, signupToBoard } from './helpers';

test('the sidebar owns workspace and project destinations while headers retain local actions', async ({ browser }, info) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 } });
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
  await expect(sidebar).toBeVisible();
  const rail = page.getByRole('complementary', { name: 'Module rail' });
  const modules = rail.getByRole('navigation', { name: 'Main modules' });
  await expect(rail).toBeVisible();
  expect((await rail.boundingBox())!.width).toBe(56);
  const [railBox, sidebarBox] = await Promise.all([rail.boundingBox(), sidebar.boundingBox()]);
  expect(railBox!.x + railBox!.width).toBe(sidebarBox!.x);
  await expect(modules.getByRole('link', { name: 'Projects', exact: true })).toHaveAttribute('aria-current', 'location');
  await expect(sidebar.getByRole('link', { name: 'Members', exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: 'Board', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(sidebar.getByTestId('internal-badge')).toHaveText('Internal');
  await expect(sidebar.getByRole('link', { name: 'View all projects' })).toHaveCount(0);
  await expect(sidebar.getByRole('button', { name: 'Add project', exact: true })).toBeVisible();
  await expect(page.getByTestId('workspace-header').getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeVisible();

  await sidebar.getByRole('link', { name: 'Team Internal' }).click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByTestId('channel-badge')).toHaveText('Internal');
  await expect(sidebar.getByRole('link', { name: 'Team Internal' })).toHaveAttribute('aria-current', 'page');
  await sidebar.getByRole('link', { name: 'Shared', exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByTestId('shared-reminder')).toBeVisible();

  await page.getByRole('button', { name: 'Search workspace' }).click();
  await expect(page.getByTestId('command-palette')).toBeVisible();
  await expect(page.getByLabel('Search cards, comments and messages')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('command-palette')).toHaveCount(0);
  await modules.getByRole('link', { name: 'Teams', exact: true }).click();
  await expect(page).toHaveURL(/\/teams$/);
  await expect(modules.getByRole('link', { name: 'Teams', exact: true })).toHaveAttribute('aria-current', 'location');
  const teamsNav = sidebar.getByRole('navigation', { name: 'Teams', exact: true });
  await expect(teamsNav.getByRole('link', { name: /^All teams/ })).toHaveAttribute('aria-current', 'page');
  await expect(sidebar.getByRole('link', { name: 'Members', exact: true })).toHaveCount(0);
  // Teams only: no create form, no member management. A new workspace starts empty.
  await expect(page.getByRole('button', { name: 'Create team' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'No teams yet' })).toBeVisible();
  await page.getByRole('link', { name: 'Create a team' }).click();
  await expect(page).toHaveURL(/\/settings\/teams$/);
  await page.getByLabel('Team name').fill('Design');
  await page.getByRole('button', { name: 'Create team' }).click();
  await expect(page.getByRole('link', { name: /^Design/ })).toBeVisible();
  await modules.getByRole('link', { name: 'Teams', exact: true }).click();
  await expect(page).toHaveURL(/\/teams$/);
  await page.getByRole('main').getByRole('link', { name: /^Design/ }).click();
  await expect(page).toHaveURL(/\/teams\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: 'Design', level: 1 })).toBeVisible();
  await expect(teamsNav.getByRole('link', { name: 'Design', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('main').getByRole('link', { name: 'All teams' })).toHaveAttribute('href', /\/teams$/);
  await page.screenshot({ path: info.outputPath('module-teams.png'), fullPage: true, style: 'nextjs-portal { visibility: hidden; }' });

  await modules.getByRole('link', { name: 'Admin console', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/members$/);
  const admin = sidebar.getByRole('navigation', { name: 'Admin console' });
  await expect(admin.getByText('Organization', { exact: true })).toBeVisible();
  await expect(admin.getByRole('link', { name: 'Members', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(admin.getByRole('link', { name: 'Teams', exact: true })).toBeVisible();
  await expect(admin.getByRole('link', { name: 'Billing', exact: true })).toBeVisible();
  await expect(modules.getByRole('link', { name: 'Admin console', exact: true })).toHaveAttribute('aria-current', 'location');
  await expect(sidebar.getByRole('navigation', { name: 'Projects', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('module-admin-console.png'), fullPage: true, style: 'nextjs-portal { visibility: hidden; }' });
  await admin.getByRole('link', { name: 'Teams', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/teams$/);
  await expect(page.getByRole('button', { name: 'Create team' })).toBeVisible();
  await modules.getByRole('link', { name: 'Inbox', exact: true }).click();
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(sidebar.getByRole('link', { name: 'All notifications' })).toHaveAttribute('aria-current', 'page');
  await expect(modules.getByRole('link', { name: 'Inbox', exact: true })).toHaveAttribute('aria-current', 'location');
  await modules.getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(sidebar.getByRole('link', { name: /^Projects/ })).toHaveAttribute('aria-current', 'page');
  await page.goto(account.boardUrl);
  await expect(list(page, 'To do')).toBeVisible();
  await page.screenshot({ path: info.outputPath('sidebar-desktop.png'), fullPage: true, style: 'nextjs-portal { visibility: hidden; }' });

  await sidebar.getByRole('link', { name: /^Projects/ }).click();
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Project name').fill('Northwind launch');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Northwind launch', exact: true })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Northwind launch', exact: true })).toHaveAttribute('aria-current', 'location');
  await expect(sidebar.getByRole('link', { name: 'Board', exact: true })).toHaveAttribute('aria-current', 'page');
  await sidebar.getByRole('link', { name: 'Shared', exact: true }).click();
  await expect(page.getByTestId('shared-reminder')).toBeVisible();
  await page.context().close();
});

test('mobile drawer traps focus, closes on navigation/Escape/backdrop, and hands off to search', async ({ browser }, info) => {
  const { page } = await signupToBoard(browser, { viewport: { width: 390, height: 844 } });
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  const drawer = page.getByRole('dialog', { name: 'Workspace navigation' });
  await expect(drawer).toHaveCount(0);
  await trigger.click();
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.screenshot({ path: info.outputPath('sidebar-mobile.png'), fullPage: true, style: 'nextjs-portal { visibility: hidden; }' });
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await drawer.getByRole('link', { name: 'Shared', exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(drawer).toHaveCount(0);
  await page.getByRole('button', { name: 'Search workspace' }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByTestId('command-palette')).toBeVisible();
  await expect(page.getByLabel('Search cards, comments and messages')).toBeFocused();
  await page.keyboard.press('Escape');

  await trigger.click();
  await page.keyboard.press('Control+k');
  await expect(drawer).toHaveCount(0);
  await expect(page.getByTestId('command-palette')).toBeVisible();
  await expect(page.getByLabel('Search cards, comments and messages')).toBeFocused();
  await page.keyboard.press('Escape');

  await trigger.click();
  const modules = drawer.getByRole('navigation', { name: 'Main modules' });
  expect(await drawer.getByTestId('module-rail').evaluate((element) => element.parentElement!.getBoundingClientRect().width)).toBe(56);
  await modules.getByRole('link', { name: 'Admin console', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/\/settings\/members$/);
  await trigger.click();
  await expect(modules.getByRole('link', { name: 'Admin console', exact: true })).toHaveAttribute('aria-current', 'location');
  await expect(drawer.getByRole('link', { name: 'Members', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(drawer.getByRole('link', { name: 'Board', exact: true })).toHaveCount(0);
  await modules.getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(drawer).toHaveCount(0);
  await trigger.click();
  await expect(drawer.getByRole('link', { name: 'Import', exact: true })).toBeVisible();
  await modules.getByRole('link', { name: 'Inbox', exact: true }).click();
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(drawer).toHaveCount(0);
  await trigger.click();
  await expect(drawer.getByRole('link', { name: 'All notifications' })).toBeVisible();
  await page.keyboard.press('Escape');

  await trigger.click();
  await page.mouse.click(385, 400);
  await expect(drawer).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await trigger.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Workspace sidebar' })).toBeVisible();
  await page.context().close();
});

test('log out and Your settings live in the account menu', async ({ browser }) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 } });
  const workspaceId = new URL(account.boardUrl).pathname.split('/')[2];
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
  await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(0);

  const trigger = sidebar.getByTestId('account-menu');
  await trigger.click();
  const menu = page.getByRole('menu', { name: /^Signed in as / });
  await expect(menu.getByRole('menuitem', { name: 'Your settings' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await menu.getByRole('menuitem', { name: 'Your settings' }).click();
  await expect(page).toHaveURL(`/w/${workspaceId}/me/notifications`);
  const nav = sidebar.getByRole('navigation', { name: 'Your settings' });
  await expect(nav.getByRole('link', { name: 'Notifications' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByText('Profile')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('preferences-grid')).toBeVisible();

  await nav.getByRole('link', { name: 'Appearance' }).click();
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: /Match system/ }).check();

  // The old workspace-settings URL still reaches the page.
  await page.goto(`/w/${workspaceId}/settings/notifications`);
  await expect(page).toHaveURL(`/w/${workspaceId}/me/notifications`);

  await sidebar.getByTestId('account-menu').click();
  await menu.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.context().close();
});
