import { createHash, randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import type { Account } from './helpers';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://agency:agency@127.0.0.1:55433/agency';
export async function ownerApi(request: APIRequestContext, account: Account) {
  const response = await request.post('/api/v1/auth/login', { data: { email: account.email, password: account.password } });
  expect(response.ok()).toBe(true);
  const { accessToken } = await response.json() as { accessToken: string };
  const headers = { Authorization: `Bearer ${accessToken}` };
  return async <T,>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, data?: object): Promise<T> => {
    const result = await request.fetch(`/api/v1${path}`, { method, headers, data });
    expect(result.ok(), `${method} ${path}: ${result.status()}`).toBe(true);
    return result.status() === 204 ? undefined as T : await result.json() as T;
  };
}
export async function accept(browser: Browser, email: string, name: string, mobile = false) {
  const token = randomBytes(32).toString('base64url');
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    const result = await db.query('UPDATE membership SET invite_token_hash = $1 WHERE status = \'invited\' AND user_id = (SELECT id FROM "user" WHERE lower(email) = lower($2))', [createHash('sha256').update(token).digest('hex'), email]);
    expect(result.rowCount).toBe(1);
  } finally { await db.end(); }
  const page = await (await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } })).newPage();
  await page.goto(`/invite/${token}`);
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Choose a password').fill('invitee-password-123');
  await page.getByRole('button', { name: 'Accept invite' }).click();
  return page;
}
export async function skipTour(page: Page) {
  const skip = page.getByTestId('coach-mark').getByRole('button', { name: 'Skip tour' });
  if (await skip.isVisible()) await skip.click();
}

