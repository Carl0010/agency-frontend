import { createHash, randomBytes } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { Client } from 'pg';
import { signupToBoard, type Account } from './helpers';

/**
 * Slice 3 smoke path, the board demo in miniature: a member shares a project
 * with a client, the client lands in `/portal` and cannot see the Team
 * channel, the other project, or who is assigned; `/w/*` redirects them back
 * (AC1–3, AC9, AC13, AC18). Permission rules themselves are proven at the API
 * layer in `guests.int-spec.ts`; this checks the screens agree.
 */

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://agency:agency@127.0.0.1:55433/agency';

interface Auth {
  headers: Record<string, string>;
  userId: string;
}

async function login(request: APIRequestContext, account: Pick<Account, 'email' | 'password'>): Promise<Auth> {
  const res = await request.post('/api/v1/auth/login', { data: { email: account.email, password: account.password } });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { accessToken: string; user: { id: string } };
  return { headers: { Authorization: `Bearer ${body.accessToken}` }, userId: body.user.id };
}

async function call<T>(request: APIRequestContext, auth: Auth, method: 'get' | 'post', path: string, data: object = {}): Promise<T> {
  const res = method === 'get' ? await request.get(`/api/v1${path}`, { headers: auth.headers }) : await request.post(`/api/v1${path}`, { headers: auth.headers, data });
  expect(res.ok(), `${method} ${path} → ${res.status()}`).toBeTruthy();
  return (await res.json()) as T;
}

/**
 * Dev mail goes to the API's stdout, and only a hash of an invite token is
 * stored, so the test swaps in a token it knows for the pending guest invite.
 */
async function knownInviteToken(email: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    const res = await db.query(
      `UPDATE membership SET invite_token_hash = $1
        WHERE role = 'guest' AND status = 'invited' AND user_id = (SELECT id FROM "user" WHERE lower(email) = lower($2))`,
      [createHash('sha256').update(token).digest('hex'), email],
    );
    expect(res.rowCount).toBe(1);
  } finally {
    await db.end();
  }
  return token;
}

test('guest: invite from the guest panel, portal only, no Team channel, no assignees, no other projects', async ({ browser, request }) => {
  const { page: owner, account } = await signupToBoard(browser);
  const projectId = new URL(account.boardUrl).pathname.split('/')[4] ?? '';
  const base = account.boardUrl.replace(/\/b\/[^/]+$/, '');
  const slug = new URL(account.boardUrl).pathname.split('/')[2] ?? '';

  // Seed: an assigned card, one message per channel, and a second (unshared) project.
  const me = await login(request, account);
  const board = await call<{ lists: { id: string; name: string }[] }>(request, me, 'get', `/boards/${account.boardId}`);
  const todo = board.lists.find((l) => l.name === 'To do');
  if (!todo) throw new Error('no To do list');
  const card = await call<{ id: string }>(request, me, 'post', `/lists/${todo.id}/cards`, { title: 'Homepage hero copy' });
  await call(request, me, 'post', `/cards/${card.id}/assignees/${me.userId}`);
  const channels = await call<{ data: { id: string; kind: string }[] }>(request, me, 'get', `/projects/${projectId}/channels`);
  const internal = channels.data.find((c) => c.kind === 'internal');
  const client = channels.data.find((c) => c.kind === 'client');
  if (!internal || !client) throw new Error('missing default channels');
  await call(request, me, 'post', `/channels/${internal.id}/messages`, { body: 'Margin on this one is thin, keep it quiet' });
  await call(request, me, 'post', `/channels/${client.id}/messages`, { body: 'Hi Acme, first drafts land Friday' });
  const project = await call<{ workspaceId: string }>(request, me, 'get', `/projects/${projectId}`);
  await call(request, me, 'post', `/workspaces/${project.workspaceId}/projects`, { name: 'Other client retainer', clientName: 'Globex' });

  // AC18: member-side labels.
  await owner.goto(`${base}/chat`);
  await expect(owner.getByTestId('client-reminder')).toHaveText('Your client can read and post here.');
  await expect(owner.getByTestId('internal-badge')).toHaveText('Internal');

  // AC1: invite from the guest panel; guests take no seat.
  await owner.getByTestId('guests-button').click();
  const panel = owner.getByTestId('guest-panel');
  await expect(panel).toContainText("Guests don't use a seat");
  const guestEmail = `e2e-guest-${Date.now()}@example.test`;
  await panel.getByLabel('Guest email').fill(guestEmail);
  await panel.getByLabel('Access').selectOption('comment');
  await panel.getByRole('button', { name: 'Invite' }).click();
  await expect(panel.getByTestId('guest-row')).toContainText(`${guestEmail} · invited`);

  // AC2: the guest accepts and lands in the portal tree.
  const token = await knownInviteToken(guestEmail);
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(`/invite/${token}`);
  await expect(guest.getByRole('heading')).toContainText('shared Acme site rebuild with you');
  await guest.getByLabel('Your name').fill('Wile E. Client');
  await guest.getByLabel('Choose a password').fill('guest-password-123');
  await guest.getByRole('button', { name: 'Accept invite' }).click();
  await expect(guest).toHaveURL(new RegExp(`/portal/${projectId}$`));
  await expect(guest.getByTestId('portal-layout')).toBeVisible();
  await expect(guest.getByTestId('guest-chip')).toHaveText('Guest · Can comment');

  // AC9: the card is there, its assignee is not.
  const tile = guest.getByTestId('portal-card').filter({ hasText: 'Homepage hero copy' });
  await expect(tile).toBeVisible();
  await expect(tile.locator('[title^="E2E Owner"]')).toHaveCount(0);
  await tile.click();
  await expect(guest.getByTestId('portal-card-detail')).toBeVisible();
  await expect(guest.getByTestId('portal-card-detail')).not.toContainText('E2E Owner');

  // Only two tabs; the Client channel, never the Team channel (AC5 on screen).
  const tabs = guest.getByRole('navigation', { name: 'Project sections' }).getByRole('link');
  await expect(tabs).toHaveText(['Board', 'Chat']);
  await tabs.filter({ hasText: 'Chat' }).click();
  await expect(guest.getByTestId('message').filter({ hasText: 'first drafts land Friday' })).toBeVisible();
  await expect(guest.getByText('Margin on this one is thin')).toHaveCount(0);

  // AC13: no switcher with a single grant; the unshared project is not found.
  await expect(guest.getByTestId('portal-switcher')).toHaveCount(0);
  await expect(guest.locator('body')).not.toContainText('Other client retainer');

  // AC3: the workspace tree redirects a guest back to the portal…
  await guest.goto(`/w/${slug}/projects`);
  await expect(guest).toHaveURL(new RegExp(`/portal/${projectId}$`));
  await guest.goto(`${base}/team`);
  await expect(guest).toHaveURL(new RegExp(`/portal/${projectId}$`));
  await expect(guest.getByText('Margin on this one is thin')).toHaveCount(0);
  // AC12: the import wizard is workspace-only too.
  await guest.goto(`/w/${slug}/import`);
  await expect(guest).toHaveURL(new RegExp(`/portal/${projectId}$`));

  // …and the portal redirects a member back to the workspace.
  await owner.goto(`/portal/${projectId}`);
  await expect(owner).toHaveURL(new RegExp(`/w/${slug}/projects$`));
});
