import { expect, test, type APIRequestContext, type Locator } from '@playwright/test';
import { list, signupToBoard, type Account } from './helpers';

/**
 * Board behaviour the smoke path doesn't reach: the 375px layout (AC23),
 * keyboard-drag cancel (AC14) and the failed-move snap-back (AC12).
 */

interface BoardView {
  lists: { id: string; name: string }[];
}

/** A bearer token for seeding through the API, from a session separate from the page's. */
async function token(request: APIRequestContext, account: Account): Promise<{ headers: Record<string, string>; userId: string }> {
  const res = await request.post('/api/v1/auth/login', { data: { email: account.email, password: account.password } });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { accessToken: string; user: { id: string } };
  return { headers: { Authorization: `Bearer ${body.accessToken}` }, userId: body.user.id };
}

async function post<T>(request: APIRequestContext, headers: Record<string, string>, path: string, data: object = {}): Promise<T> {
  const res = await request.post(`/api/v1${path}`, { headers, data });
  expect(res.ok(), `${path} → ${res.status()}`).toBeTruthy();
  return (await res.json()) as T;
}

/** Cards carrying every piece of tile meta, so clipping would hide something. */
async function seedRichCards(request: APIRequestContext, account: Account, count: number): Promise<void> {
  const { headers, userId } = await token(request, account);
  const board = (await (await request.get(`/api/v1/boards/${account.boardId}`, { headers })).json()) as BoardView;
  const todo = board.lists.find((l) => l.name === 'To do');
  if (!todo) throw new Error('no To do list');
  const due = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  for (let i = 1; i <= count; i++) {
    const card = await post<{ id: string }>(request, headers, `/lists/${todo.id}/cards`, {
      title: `Rich card ${i} with a title long enough to wrap onto a second line on a phone`,
      description: 'Has a description.',
      dueAt: due,
    });
    await post(request, headers, `/cards/${card.id}/assignees/${userId}`);
    const checklist = await post<{ id: string }>(request, headers, `/cards/${card.id}/checklists`, { title: 'Steps' });
    await post(request, headers, `/checklists/${checklist.id}/items`, { text: 'First step' });
    await post(request, headers, `/cards/${card.id}/comments`, { body: 'A comment.' });
  }
}

/** True when `inner`'s box lies within `outer`'s box. */
async function within(inner: Locator, outer: Locator): Promise<boolean> {
  const [i, o] = await Promise.all([inner.boundingBox(), outer.boundingBox()]);
  if (!i || !o) return false;
  return i.x >= o.x - 0.5 && i.y >= o.y - 0.5 && i.x + i.width <= o.x + o.width + 0.5 && i.y + i.height <= o.y + o.height + 0.5;
}

/**
 * Every visible control in `scope` offers a ≥ 44px touch target. A checkbox
 * or input wrapped in a `<label>` counts the label, since tapping it toggles.
 */
async function smallTargets(scope: Locator): Promise<string[]> {
  return scope.evaluate((root) => {
    const out: string[] = [];
    for (const el of root.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [role="button"]')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
      const target = (el.closest('label') ?? el).getBoundingClientRect();
      const height = Math.max(box.height, target.height);
      const width = Math.max(box.width, target.width);
      if (height < 44 || width < 44) {
        out.push(`${el.tagName.toLowerCase()}[${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? ''}] ${Math.round(width)}x${Math.round(height)}`);
      }
    }
    return out;
  });
}

test('at 375px, card tiles keep their full content and the card sheet has 44px targets (AC23)', async ({ browser, request }) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });
  await seedRichCards(request, account, 6);
  await page.reload();

  const tiles = list(page, 'To do').getByTestId('card-tile');
  await expect(tiles).toHaveCount(6);
  for (const tile of await tiles.all()) {
    await tile.scrollIntoViewIfNeeded();
    // Due pill, checklist and comment meta, and the assignee avatar all sit inside the tile.
    for (const meta of [tile.getByTestId('due-pill'), tile.getByTestId('checklist-badge'), tile.getByTestId('comment-count'), tile.getByTitle('E2E Owner')]) {
      expect(await within(meta, tile), 'tile meta is clipped').toBe(true);
    }
    const box = await tile.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(60);
  }
  // Tiles stack without overlapping once scrolled into place.
  const spans = await tiles.evaluateAll((els) => els.map((e) => ({ top: (e as HTMLElement).offsetTop, height: (e as HTMLElement).offsetHeight })));
  spans.slice(1).forEach((span, i) => expect(span.top).toBeGreaterThanOrEqual((spans[i]?.top ?? 0) + (spans[i]?.height ?? 0)));

  // Card detail: full-screen sheet; inline title edit and the due "Done" box are tappable.
  await tiles.first().click();
  const sheet = page.getByTestId('card-modal');
  await expect(sheet.getByTestId('card-title')).toBeVisible();
  await sheet.getByTestId('card-title').click();
  await expect(sheet.getByLabel('Card title')).toBeFocused();
  expect(await smallTargets(sheet)).toEqual([]);
});

test('Esc cancels a keyboard drag and leaves the card where it was (AC14)', async ({ browser, request }) => {
  const { page, account } = await signupToBoard(browser);
  await seedRichCards(request, account, 1);
  await page.reload();

  const tile = list(page, 'To do').getByRole('button', { name: /Rich card 1/ });
  await tile.focus();
  await page.keyboard.press('Space');
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(list(page, 'In progress').getByRole('button', { name: /Rich card 1/ })).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(list(page, 'To do').getByRole('button', { name: /Rich card 1/ })).toBeVisible();
  await expect(list(page, 'In progress').getByRole('button', { name: /Rich card 1/ })).toHaveCount(0);
  await page.reload();
  await expect(list(page, 'To do').getByRole('button', { name: /Rich card 1/ })).toBeVisible();
});

test('a failed move snaps the card back and shows a toast (AC12)', async ({ browser, request }) => {
  const { page, account } = await signupToBoard(browser);
  await seedRichCards(request, account, 1);
  await page.reload();

  await page.route('**/api/v1/cards/*/move', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'internal', message: 'Server error.' } }) }),
  );
  const tile = list(page, 'To do').getByRole('button', { name: /Rich card 1/ });
  await tile.focus();
  await page.keyboard.press('Space');
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(list(page, 'In progress').getByRole('button', { name: /Rich card 1/ })).toBeVisible();
  await page.keyboard.press('Space');

  await expect(page.getByTestId('toast')).toContainText("Couldn't move the card");
  await expect(list(page, 'To do').getByRole('button', { name: /Rich card 1/ })).toBeVisible();
  await expect(list(page, 'In progress').getByRole('button', { name: /Rich card 1/ })).toHaveCount(0);

  // UI and DB agree: the reload shows it in To do too.
  await page.unroute('**/api/v1/cards/*/move');
  await page.reload();
  await expect(list(page, 'To do').getByRole('button', { name: /Rich card 1/ })).toBeVisible();
});
