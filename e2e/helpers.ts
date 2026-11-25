import { expect, type Browser, type BrowserContextOptions, type Locator, type Page } from '@playwright/test';

export const list = (page: Page, name: string) => page.getByRole('region', { name: `List ${name}`, exact: true }).or(page.getByRole('rowgroup', { name: `List ${name}`, exact: true }));

/** Picks an option in a Quiet Pro Select or Combobox: opens the field, then clicks the option in the open menu. */
export async function choose(field: Locator, option: string) {
  await field.click();
  await field.page().getByRole('listbox').getByRole('option', { name: option, exact: true }).click();
}

/** "Group by" sits in the board's View and filters panel; this opens the panel when it is closed. */
export async function groupBy(page: Page) {
  const panel = page.getByTestId('filter-panel');
  if (!(await panel.isVisible())) await page.getByRole('button', { name: 'Filters', exact: true }).click();
  return panel.getByRole('combobox', { name: 'Group by', exact: true });
}

export interface Account {
  email: string;
  password: string;
  boardUrl: string;
  /** Board id taken from the board URL. */
  boardId: string;
}

/** Signup → onboarding (name, project, skip invites, start empty) → the new project's board with the three default lists. */
export async function signupToBoard(browser: Browser, options: BrowserContextOptions = {}): Promise<{ page: Page; account: Account }> {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `e2e-${stamp}@example.test`;
  const password = 'e2e-password-123';

  const page = await (await browser.newContext(options)).newPage();
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('E2E Owner');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel('Agency name').fill(`E2E Agency ${stamp}`);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Project name').fill('Acme site rebuild');
  await page.getByRole('button', { name: 'Create project' }).click();
  // Steps 3–4 (Slice 4): no invites, start with the empty default board.
  await page.getByRole('heading', { name: 'Invite your team' }).waitFor();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: /Start empty/ }).click();
  await expect(page).toHaveURL(/\/w\/[^/]+\/p\/[^/]+\/b\/[^/]+$/);
  // The coach-mark tour is covered in onboarding.spec.ts; other specs start without it.
  await page.getByTestId('coach-mark').getByRole('button', { name: 'Skip tour' }).click();
  await expect(page.getByTestId('coach-mark')).toHaveCount(0);
  // Below 640px columns sit side by side and swipe, so count columns rather than visible regions.
  await expect(page.getByTestId('list-column')).toHaveCount(3);
  await expect(list(page, 'To do')).toBeVisible();

  const boardUrl = page.url();
  const boardId = new URL(boardUrl).pathname.split('/').pop() ?? '';
  return { page, account: { email, password, boardUrl, boardId } };
}

/** Dark mode for screenshots: Match system is the default theme, so follow an OS switch to dark. */
export async function darkTheme(page: Page) {
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
}
