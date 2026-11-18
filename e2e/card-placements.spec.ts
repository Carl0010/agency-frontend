import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { accept, ownerApi, skipTour } from './access-helpers';
import { list, signupToBoard } from './helpers';
import type { Board, CardTile, Page as ApiPage, Project } from '../src/lib/types';

/**
 * One card in several projects (docs/CARD_PLACEMENTS.md in the API repository), against the real API.
 * The owner's onboarding project plays Website; Q4 Launch is created beside it.
 */
const desktop = { viewport: { width: 1440, height: 1000 } };
const tile = (page: Page, cardId: string) => page.locator(`[data-testid="card-tile"][data-card-id="${cardId}"]`);
const drawer = (page: Page) => page.getByTestId('card-drawer');

async function world(browser: Browser, request: APIRequestContext) {
  const { page: owner, account } = await signupToBoard(browser, desktop);
  const call = await ownerApi(request, account);
  const parts = new URL(account.boardUrl).pathname.split('/');
  const workspaceId = parts[2]!;
  const web = await call<Project>('GET', `/projects/${parts[4]}`);
  const webBoard = await call<Board>('GET', `/boards/${web.defaultBoardId}`);
  const launch = await call<Project>('POST', `/workspaces/${workspaceId}/projects`, { name: 'Q4 Launch' });
  const launchBoard = await call<Board>('GET', `/boards/${launch.defaultBoardId}`);
  const card = await call<CardTile>('POST', `/lists/${webBoard.lists[0]!.id}/cards`, { title: 'Write launch blog post' });
  const webUrl = `/w/${workspaceId}/p/${web.id}/b/${web.defaultBoardId}`;
  const launchUrl = `/w/${workspaceId}/p/${launch.id}/b/${launch.defaultBoardId}`;
  /** An agency member who sees only the given project. */
  const member = async (name: string, projectId: string) => {
    const email = `${name.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
    await call('POST', `/workspaces/${workspaceId}/members/invites`, { email, role: 'member' });
    const page = await accept(browser, email, name);
    // Accepted, so active: until then nobody can assign or mention them.
    await expect(page.getByRole('heading', { name: 'No projects shared with you yet' })).toBeVisible();
    const roster = await call<ApiPage<{ userId: string; email: string }>>('GET', `/workspaces/${workspaceId}/members`);
    const id = roster.data.find((person) => person.email === email)!.userId;
    await call('PUT', `/projects/${projectId}/members/${id}`, { access: 'edit' });
    return { page, id };
  };
  const place = (cardId: string, listId: string) => call<CardTile>('POST', `/cards/${cardId}/placements`, { listId });
  return { owner, account, call, workspaceId, web, webBoard, launch, launchBoard, card, webUrl, launchUrl, member, place };
}

async function addToProject(page: Page, verb: 'Add to project' | 'Move to project', projectName: string, listName: string) {
  await drawer(page).getByRole('button', { name: verb, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: verb, exact: true });
  await dialog.getByRole('combobox', { name: 'Project', exact: true }).selectOption({ label: projectName });
  await expect(dialog.getByRole('combobox', { name: 'List', exact: true }).getByRole('option', { name: listName })).toHaveCount(1);
  await dialog.getByRole('combobox', { name: 'List', exact: true }).selectOption({ label: listName });
  await dialog.getByRole('button', { name: verb, exact: true }).click();
  return dialog;
}

test('a card added to a second project shows on both boards with its home key, and moves on one board only', async ({ browser, request }) => {
  const { owner, web, launch, launchBoard, card, webUrl, launchUrl } = await world(browser, request);
  const ref = `${web.key}-${card.number}`;
  await owner.goto(`${webUrl}/c/${card.id}`);
  await expect(drawer(owner).getByTestId('card-key')).toHaveText(ref);
  await addToProject(owner, 'Add to project', 'Q4 Launch', launchBoard.lists[1]!.name);
  await expect(owner.getByTestId('toast').filter({ hasText: 'Added to Q4 Launch.' })).toBeVisible();
  const placements = drawer(owner).getByTestId('card-placement');
  await expect(placements).toHaveCount(2);
  await expect(placements.first()).toContainText(web.name);
  await expect(placements.first()).toContainText('Home');
  await expect(placements.nth(1)).toContainText('Q4 Launch');
  await expect(tile(owner, card.id).getByTestId('card-also-in')).toHaveAttribute('aria-label', 'Also in 1 other project');

  // The Launch board draws it in its own list, under the home key.
  await placements.nth(1).getByRole('link').click();
  await expect(owner).toHaveURL(new RegExp(`/p/${launch.id}/b/${launch.defaultBoardId}/c/${card.id}`));
  await expect(list(owner, launchBoard.lists[1]!.name).getByTestId('card-tile-key')).toHaveText(ref);
  await expect(drawer(owner).getByTestId('card-key')).toHaveText(ref);

  // A move on Launch leaves Website alone.
  await drawer(owner).getByLabel('Move to list').selectOption({ label: launchBoard.lists[2]!.name });
  await expect(list(owner, launchBoard.lists[2]!.name).locator(`[data-card-id="${card.id}"]`)).toHaveCount(1);
  await owner.goto(webUrl);
  await expect(list(owner, 'To do').locator(`[data-card-id="${card.id}"]`)).toHaveCount(1);
  await owner.goto(launchUrl);
  await expect(list(owner, launchBoard.lists[2]!.name).locator(`[data-card-id="${card.id}"]`)).toHaveCount(1);
  await owner.context().close();
});

test('adding to a project with guests asks first; the guest sees the card without the other projects', async ({ browser, request }) => {
  const { owner, call, web, launch, launchBoard, card, webUrl } = await world(browser, request);
  const guestEmail = `placement-guest-${Date.now()}@example.test`;
  await call('POST', `/projects/${launch.id}/guests`, { email: guestEmail, access: 'comment' });
  const guest = await accept(browser, guestEmail, 'Gus Guest');
  await expect(guest).toHaveURL(new RegExp(`/portal/${launch.id}$`));

  await owner.goto(`${webUrl}/c/${card.id}`);
  const dialog = await addToProject(owner, 'Add to project', 'Q4 Launch', launchBoard.lists[0]!.name);
  const ask = owner.getByRole('alertdialog', { name: 'Guests will see this card' });
  await expect(ask).toContainText('1 guest of Q4 Launch will see this card and its comments.');
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeVisible();
  await expect(drawer(owner).getByTestId('card-placement')).toHaveCount(1);
  await guest.reload();
  await expect(guest.getByTestId('portal-card')).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Add to project', exact: true }).click();
  await owner.getByRole('alertdialog', { name: 'Guests will see this card' }).getByRole('button', { name: 'Add to project' }).click();
  await expect(drawer(owner).getByTestId('card-placement')).toHaveCount(2);

  await guest.reload();
  const portalTile = guest.getByTestId('portal-card').filter({ hasText: 'Write launch blog post' });
  await expect(portalTile.getByTestId('card-tile-key')).toHaveText(`${web.key}-${card.number}`);
  await expect(portalTile.getByTestId('card-also-in')).toHaveCount(0);
  await portalTile.click();
  await expect(guest.getByTestId('portal-card-detail')).toContainText(`${web.key}-${card.number}`);
  await expect(guest.locator('body')).not.toContainText(web.name);
  await owner.context().close(); await guest.context().close();
});

test('removing from a project, making another project home, and transferring', async ({ browser, request }) => {
  const { owner, call, web, webBoard, launch, launchBoard, card, webUrl, launchUrl, place } = await world(browser, request);
  await place(card.id, launchBoard.lists[0]!.id);
  await owner.goto(`${webUrl}/c/${card.id}`);
  const placements = drawer(owner).getByTestId('card-placement');
  await expect(placements).toHaveCount(2);
  await expect(placements.first().getByRole('button')).toHaveCount(0);

  // Launch becomes home: the card takes a Launch number.
  await drawer(owner).getByRole('button', { name: 'Make Q4 Launch the home' }).click();
  await expect(drawer(owner).getByTestId('card-key')).toHaveText(new RegExp(`^${launch.key}-\\d+$`));
  await expect(placements.first()).toContainText('Q4 Launch');
  await expect(placements.first()).toContainText('Home');
  await expect(tile(owner, card.id).getByTestId('card-tile-key')).toHaveText(new RegExp(`^${launch.key}-`));

  // Website is no longer home, so it can be left; the drawer follows the card to Launch.
  await drawer(owner).getByRole('button', { name: `Remove from ${web.name}` }).click();
  await owner.getByRole('alertdialog', { name: `Remove from ${web.name}?` }).getByRole('button', { name: 'Remove from project' }).click();
  await expect(owner).toHaveURL(new RegExp(`${launchUrl}/c/${card.id}`));
  await expect(drawer(owner).getByTestId('card-placement')).toHaveCount(1);
  await owner.goto(webUrl);
  await expect(tile(owner, card.id)).toHaveCount(0);

  // A transfer places, rehomes and leaves the old home in one step.
  const other = await call<CardTile>('POST', `/lists/${webBoard.lists[0]!.id}/cards`, { title: 'Press kit' });
  await owner.goto(`${webUrl}/c/${other.id}`);
  await addToProject(owner, 'Move to project', 'Q4 Launch', launchBoard.lists[1]!.name);
  await expect(owner).toHaveURL(new RegExp(`${launchUrl}/c/${other.id}`));
  await expect(drawer(owner).getByTestId('card-key')).toHaveText(new RegExp(`^${launch.key}-\\d+$`));
  await expect(list(owner, launchBoard.lists[1]!.name).locator(`[data-card-id="${other.id}"]`)).toHaveCount(1);
  await owner.goto(webUrl);
  await expect(tile(owner, other.id)).toHaveCount(0);
  await owner.context().close();
});

test('a person who sees only the second project opens the card there from a notification', async ({ browser, request }) => {
  const { owner, call, workspaceId, web, launch, launchBoard, card, place, member } = await world(browser, request);
  await place(card.id, launchBoard.lists[0]!.id);
  const mia = await member('Mia', launch.id);
  await call('POST', `/cards/${card.id}/assignees/${mia.id}`);
  await mia.page.goto(`/w/${workspaceId}/inbox`); await skipTour(mia.page);
  const notification = mia.page.getByRole('link').filter({ hasText: 'Write launch blog post' }).first();
  await expect(async () => {
    await mia.page.reload();
    await expect(notification).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await notification.click();
  await expect(mia.page).toHaveURL(new RegExp(`/p/${launch.id}/b/${launch.defaultBoardId}/c/${card.id}`));
  await expect(drawer(mia.page).getByTestId('card-key')).toHaveText(`${web.key}-${card.number}`);
  const placements = drawer(mia.page).getByTestId('card-placement');
  await expect(placements).toHaveCount(1);
  await expect(placements).toContainText('Q4 Launch');
  // The home is out of sight: nothing that would change it is offered.
  await expect(drawer(mia.page).getByRole('button', { name: /Make .* the home/ })).toHaveCount(0);
  await expect(drawer(mia.page).getByRole('button', { name: 'Move to project', exact: true })).toHaveCount(0);
  await expect(mia.page.locator('body')).not.toContainText(web.name);

  // A link into the project Mia cannot see lands in the one she can.
  await mia.page.goto(`/w/${workspaceId}/p/${web.id}/b/${web.defaultBoardId}/c/${card.id}`);
  await expect(mia.page).toHaveURL(new RegExp(`/p/${launch.id}/b/${launch.defaultBoardId}/c/${card.id}`));
  await owner.context().close(); await mia.page.context().close();
});

test('assignee and mention pickers offer people who see the card only in a project the viewer cannot see', async ({ browser, request }) => {
  const { owner, web, launch, launchBoard, card, webUrl, place, member } = await world(browser, request);
  const ann = await member('Ann', web.id);
  const bob = await member('Bob', launch.id);
  await place(card.id, launchBoard.lists[0]!.id);
  await ann.page.goto(`${webUrl}/c/${card.id}`); await skipTour(ann.page);
  const detail = drawer(ann.page);
  await expect(detail.getByTestId('card-placement')).toHaveCount(1);

  await detail.getByRole('button', { name: 'Assign members' }).click();
  await detail.getByRole('checkbox', { name: 'Bob' }).click();
  await expect(detail.getByRole('checkbox', { name: 'Bob' })).toBeChecked();

  const composer = detail.getByLabel('Write a comment');
  await composer.fill('@Bo');
  await ann.page.getByRole('listbox', { name: 'Mention a teammate' }).getByRole('option', { name: 'Bob' }).click();
  await detail.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(detail.getByTestId('comment').filter({ hasText: 'Bob' })).toBeVisible();

  // The inline List assignment offers Bob too.
  await ann.page.goto(`${webUrl}?view=list`);
  await ann.page.getByRole('button', { name: `Assign members for ${web.key}-${card.number}` }).first().click();
  await expect(ann.page.getByRole('dialog', { name: `Assignees for ${web.key}-${card.number}` }).getByRole('button', { name: 'Bob' })).toHaveAttribute('aria-pressed', 'true');
  await expect(ann.page.locator('body')).not.toContainText('Q4 Launch');
  await owner.context().close(); await ann.page.context().close(); await bob.page.context().close();
});

const shot = { fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' } as const;

test('placement controls in both themes and at mobile width', async ({ browser, request }, info) => {
  const { owner, call, webBoard, launch, launchBoard, card, webUrl, place } = await world(browser, request);
  await place(card.id, launchBoard.lists[1]!.id);
  await call('POST', `/projects/${launch.id}/guests`, { email: `preview-guest-${Date.now()}@example.test`, access: 'comment' });
  const guestEmail = `preview-guest-active-${Date.now()}@example.test`;
  await call('POST', `/projects/${launch.id}/guests`, { email: guestEmail, access: 'comment' });
  const guest = await accept(browser, guestEmail, 'Preview Guest');
  await expect(guest).toHaveURL(new RegExp(`/portal/${launch.id}$`));

  await owner.emulateMedia({ colorScheme: 'light' });
  await owner.goto(`${webUrl}/c/${card.id}`);
  await expect(drawer(owner).getByTestId('card-placement')).toHaveCount(2);
  await expect(tile(owner, card.id).getByTestId('card-also-in')).toBeVisible();
  await owner.screenshot({ path: info.outputPath('placements-drawer-light.png'), ...shot });

  // Dark: a second card going to Launch, whose guest has to be confirmed.
  await owner.emulateMedia({ colorScheme: 'dark' });
  const other = await call<CardTile>('POST', `/lists/${webBoard.lists[0]!.id}/cards`, { title: 'Press kit' });
  await owner.goto(`${webUrl}/c/${other.id}`);
  await drawer(owner).getByRole('button', { name: 'Add to project', exact: true }).click();
  const dialog = owner.getByRole('dialog', { name: 'Add to project', exact: true });
  await dialog.getByRole('combobox', { name: 'Project', exact: true }).selectOption({ label: 'Q4 Launch' });
  await dialog.getByRole('combobox', { name: 'List', exact: true }).selectOption({ label: launchBoard.lists[1]!.name });
  await owner.screenshot({ path: info.outputPath('placements-add-dark.png'), ...shot });
  await dialog.getByRole('button', { name: 'Add to project', exact: true }).click();
  const ask = owner.getByRole('alertdialog', { name: 'Guests will see this card' });
  await expect(ask).toContainText('1 guest of Q4 Launch');
  await owner.screenshot({ path: info.outputPath('placements-guests-dark.png'), ...shot });
  await ask.getByRole('button', { name: 'Cancel' }).click();

  const mobile = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark', storageState: await owner.context().storageState() })).newPage();
  await mobile.goto(`${webUrl}/c/${card.id}`); await skipTour(mobile);
  await expect(drawer(mobile).getByTestId('card-placement')).toHaveCount(2);
  await drawer(mobile).getByTestId('card-placements').scrollIntoViewIfNeeded();
  expect(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await mobile.screenshot({ path: info.outputPath('placements-drawer-mobile-dark.png'), ...shot });
  await owner.context().close(); await mobile.context().close(); await guest.context().close();
});
