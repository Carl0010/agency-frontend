import { expect, test, type Page } from '@playwright/test';

// Presentation-only fixtures keep motion/focus checks independent of the pending
// backend contract upgrade. Real-API navigation journeys remain separate.
async function workspace(page: Page) {
  const person = { id: 'owner', name: 'Motion Owner', avatarUrl: null, active: true };
  const project = { id: 'project', workspaceId: 'workspace', name: 'Motion project', teamIds: [], access: 'admin', starredByMe: false, key: 'MP', color: 'green', icon: 'folder', defaultBoardId: 'board', archivedAt: null, createdAt: '2026-10-16T00:00:00Z' };
  const card = { id: 'card', listId: 'list', boardId: 'board', projectId: 'project', number: 1, title: 'Review motion', position: 1, hasDescription: false, dueAt: null, dueCompletedAt: null, archivedAt: null, assignees: [], labels: [], commentCount: 0, attachmentCount: 0, checklistDone: 0, checklistTotal: 0 };
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let json: unknown = { data: [], nextCursor: null };
    if (path === '/auth/refresh') json = { accessToken: 'presentation-fixture', user: { ...person, email: 'motion@example.test', timezone: 'UTC', emailVerified: true, tourCompletedAt: '2026-10-16T00:00:00Z' } };
    else if (path === '/workspaces/by-slug/motion') json = { id: 'workspace', name: 'Motion workspace', slug: 'motion', onboardingState: {}, role: 'member', subscription: { status: 'active', trialEndsAt: null }, setup: null, createdAt: '2026-10-16T00:00:00Z' };
    else if (path === '/workspaces/workspace/projects') json = { data: [project], nextCursor: null };
    else if (path === '/projects/project') json = project;
    else if (path === '/boards/board') json = { id: 'board', name: 'Board', projectId: 'project', project, boards: null, lists: [{ id: 'list', name: 'To do', position: 1, cards: [card] }] };
    else if (path === '/cards/card') json = { ...card, key: 'MP', description: null, listName: 'To do', createdAt: '2026-10-16T00:00:00Z', createdBy: person, checklists: [], attachments: [] };
    else if (path === '/notifications') json = { data: [], nextCursor: null, unreadCount: 0 };
    await route.fulfill({ json });
  });
  await page.goto('/w/motion/p/project/b/board');
  await expect(page.getByTestId('card-tile')).toBeVisible();
}

async function widths(page: Page, selector: string, action: () => Promise<unknown>, measure: 'width' | 'translate' = 'width') {
  const samples = page.locator('body').evaluate(async (_, { target, measure }) => {
    const values: number[] = [];
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const sample = () => {
        const element = document.querySelector(target);
        if (element) values.push(measure === 'width' ? element.getBoundingClientRect().width : new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
        if (performance.now() - started < 500) requestAnimationFrame(sample);
        else resolve();
      };
      sample();
    });
    return values;
  }, { target: selector, measure });
  await action();
  return samples;
}

test('desktop sidebar resizes smoothly and rapid toggles settle without hidden focus targets', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await workspace(page);
  const sidebar = page.locator('#desktop-sidebar');
  const closing = await widths(page, '#desktop-sidebar', () => page.getByRole('button', { name: 'Close sidebar' }).click());
  expect(closing.some((width) => width > 1 && width < 255)).toBe(true);
  await expect(sidebar).toHaveAttribute('inert', '');
  expect((await sidebar.boundingBox())!.width).toBe(0);
  const opening = await widths(page, '#desktop-sidebar', () => page.getByRole('button', { name: 'Open sidebar' }).click());
  expect(opening.some((width) => width > 1 && width < 255)).toBe(true);
  await page.getByRole('button', { name: 'Close sidebar' }).evaluate(async (element: HTMLButtonElement) => {
    element.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    element.click();
  });
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(256);
  await expect(sidebar).not.toHaveAttribute('inert');
});

test('card inspector animates both directions, including history, and restores board focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await workspace(page);
  const tile = page.getByTestId('card-tile');
  const frame = page.getByTestId('card-drawer-frame');
  const drawer = page.getByRole('dialog', { name: 'Card details' });
  const opening = await widths(page, '.card-drawer-frame', () => tile.click());
  expect(opening.some((width) => width > 1 && width < 511)).toBe(true);
  await expect(drawer.getByTestId('card-title')).toHaveText('Review motion');
  await expect(drawer).toBeFocused();
  const closing = await widths(page, '.card-drawer-frame', () => drawer.getByRole('button', { name: 'Close card' }).click());
  expect(closing.some((width) => width > 1 && width < 511)).toBe(true);
  await expect(frame).toHaveCount(0);
  await expect(tile).toBeFocused();
  await tile.click();
  await expect(drawer).toBeVisible();
  const back = await widths(page, '.card-drawer-frame', () => page.goBack());
  expect(back.some((width) => width > 1 && width < 511)).toBe(true);
  await expect(frame).toHaveCount(0);
  await page.goForward();
  await expect(drawer.getByTestId('card-title')).toHaveText('Review motion');
  await drawer.focus();
  await page.keyboard.press('Escape');
  await expect(frame).toHaveCount(0);
  await expect(tile).toBeFocused();
});

test('mobile navigation slides out without blocking search and the inspector releases covered controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await workspace(page);
  const navigation = page.getByTestId('navigation-drawer');
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  await trigger.click();
  await expect(navigation).toBeVisible();
  await expect.poll(() => navigation.evaluate((element) => getComputedStyle(element).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
  const closing = await widths(page, '.navigation-drawer', () => page.keyboard.press('Escape'), 'translate');
  expect(closing.some((offset) => offset < -1 && offset > -319)).toBe(true);
  await expect(trigger).toBeFocused();
  await expect(navigation).toBeHidden();
  await trigger.click();
  await page.keyboard.press('Control+k');
  await expect(page.getByLabel('Search cards, comments and messages')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(navigation).toBeHidden();
  await page.getByTestId('card-tile').click();
  const drawer = page.getByRole('dialog', { name: 'Card details' });
  await expect(drawer.getByTestId('card-title')).toBeVisible();
  await expect(page.locator('#board-view')).toBeHidden();
  await drawer.getByRole('button', { name: 'Close card' }).click();
  await expect(page.getByTestId('card-drawer-frame')).toHaveCount(0);
  await expect(page.getByTestId('card-tile')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('reduced motion settles panels immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await workspace(page);
  await page.getByRole('button', { name: 'Close sidebar' }).click();
  await expect.poll(() => page.locator('#desktop-sidebar').evaluate((element) => element.getBoundingClientRect().width)).toBe(0);
  await page.getByTestId('card-tile').click();
  const drawer = page.getByRole('dialog', { name: 'Card details' });
  await expect(drawer.getByTestId('card-title')).toBeVisible();
  expect(await drawer.evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThan(0.001);
  await drawer.getByRole('button', { name: 'Close card' }).click();
  await expect(page.getByTestId('card-drawer-frame')).toHaveCount(0);
});
