import { expect, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';

export const list = (page: Page, name: string) => page.getByRole('region', { name: `List ${name}` });

export interface Account {
  email: string;
  password: string;
  boardUrl: string;
  /** Board id taken from the board URL. */
  boardId: string;
}

/** Signup → onboarding steps 1–2 → lands on the new project's board with the three default lists. */
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
  await page.getByLabel('Client name').fill('Acme');
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page).toHaveURL(/\/w\/[^/]+\/p\/[^/]+\/b\/[^/]+$/);
  // Below 640px only the selected list is shown, so count columns rather than visible regions.
  await expect(page.getByTestId('list-column')).toHaveCount(3);
  await expect(list(page, 'To do')).toBeVisible();

  const boardUrl = page.url();
  const boardId = new URL(boardUrl).pathname.split('/').pop() ?? '';
  return { page, account: { email, password, boardUrl, boardId } };
}
