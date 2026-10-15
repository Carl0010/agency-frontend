import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { list, signupToBoard } from './helpers';

/**
 * Slice 3 import smoke path (§7.1): upload the committed fixture CSV, see the
 * preview and the member-mapping screen with nothing written yet (AC19), map
 * a member, run the job to completion through the progress page (AC32), then
 * read the summary, the drop report and report.csv (AC25, AC28). Every §7.2
 * row is proven in the API's own tests; this checks the screens drive them.
 */

const FIXTURE = path.resolve(__dirname, '../../api/test/fixtures/trello/board.csv');

test('import: CSV upload → preview + mapping → progress → summary and report.csv', async ({ browser }) => {
  const { page, account } = await signupToBoard(browser);
  const slug = new URL(account.boardUrl).pathname.split('/')[2] ?? '';

  await page.goto(`/w/${slug}/projects`);
  await page.getByRole('link', { name: 'Import from Trello' }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${slug}/import$`));

  // AC19: counts and the mapping screen, before anything is written.
  await page.getByLabel('Trello CSV export').setInputFiles(FIXTURE);
  const preview = page.getByTestId('import-preview');
  await expect(preview.getByTestId('import-summary')).toContainText('4 lists');
  await expect(preview.getByTestId('import-summary')).toContainText('4 unmatched members');
  await expect(preview).toContainText('arrive as one archive comment');
  const rows = preview.getByTestId('member-map-row');
  await expect(rows).toHaveCount(4);
  await page.goto(`/w/${slug}/projects`);
  const projectList = page.getByRole('main');
  await expect(projectList.getByRole('link', { name: /Acme site rebuild/ })).toBeVisible();
  await expect(projectList.getByRole('link', { name: /Acme Website Relaunch/ })).toHaveCount(0);

  // Back to the wizard: map one Trello member to the owner, leave the others unassigned (AC24).
  await page.goto(`/w/${slug}/import`);
  await page.getByLabel('Trello CSV export').setInputFiles(FIXTURE);
  await page.getByLabel('Match Dana Scully').selectOption({ label: 'E2E Owner' });
  await expect(page.getByLabel('New project name')).toHaveValue('Acme Website Relaunch');
  await page.getByRole('button', { name: 'Start import' }).click();

  // AC32: the job page polls GET /imports/:id until it finishes.
  await expect(page).toHaveURL(new RegExp(`/w/${slug}/import/[0-9a-f-]{36}$`));
  await expect(page.getByTestId('import-status')).toHaveAttribute('data-status', 'succeeded', { timeout: 30_000 });
  await expect(page.getByRole('progressbar', { name: 'Import progress' })).toHaveAttribute('aria-valuenow', '100');

  // AC25 / AC28: created vs updated, and every §7.4 category listed.
  await expect(page.getByTestId('count-Lists')).toContainText('4');
  await expect(page.getByTestId('drop-row')).toHaveCount(16);
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download report.csv' }).click()]);
  const csv = await readFile(await file.path(), 'utf8');
  expect(csv.split('\r\n')[0]).toBe('entity,trello_id,name,outcome,detail');
  expect(csv).toContain('Walter Skinner');

  // The imported project opens on its board.
  await page.getByRole('link', { name: 'Open Acme Website Relaunch' }).click();
  await expect(page).toHaveURL(/\/w\/[^/]+\/p\/[^/]+\/b\/[^/]+$/);
  await expect(list(page, 'Backlog')).toBeVisible();
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
  await expect(sidebar.getByRole('link', { name: 'Acme Website Relaunch', exact: true })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Board', exact: true })).toHaveAttribute('aria-current', 'page');
});

/**
 * AC20 on screen. Trello itself is not reachable from CI, so its two
 * server-proxied calls are stubbed; the API side is covered in
 * `imports.int-spec.ts`. Checks the token is read from Trello's redirect,
 * wiped from the URL, and only ever sent in a request body.
 */
test('import: Connect Trello → token off the URL → board picker → preview', async ({ browser }) => {
  const { page, account } = await signupToBoard(browser);
  const slug = new URL(account.boardUrl).pathname.split('/')[2] ?? '';
  const token = 'f'.repeat(64);

  await page.route('**/api/v1/workspaces/*/imports/trello/boards', (route) =>
    route.fulfill({ json: { data: [{ id: 'abcdef0123456789abcdef01', name: 'Globex retainer', dateLastActivity: '2026-10-01T10:00:00.000Z' }], nextCursor: null } }),
  );
  const previews: unknown[] = [];
  await page.route('**/api/v1/workspaces/*/imports/preview', async (route) => {
    previews.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        source: 'trello_api',
        boardName: 'Globex retainer',
        counts: { lists: 21, cards: 10, archivedCards: 0, comments: 0, labels: 0, checklists: 0, attachments: 0, attachmentsAsFiles: 0, attachmentsAsLinks: 0, members: 0, unmatchedMembers: 0 },
        summary: '21 lists, 10 cards, 0 comments, 0 attachments as links, 0 unmatched members',
        members: [],
        limit: { limit: 'lists', actual: 21, max: 20, message: 'This board has 21 lists; an import can bring in at most 20.' },
        dropped: [],
        notices: [],
      },
    });
  });

  await page.goto(`/w/${slug}/import#token=${token}`);
  await expect(page.getByTestId('trello-boards')).toContainText('Globex retainer');
  expect(page.url()).not.toContain(token);

  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByTestId('import-summary')).toContainText('21 lists');
  expect(previews).toEqual([{ source: 'trello_api', boardId: 'abcdef0123456789abcdef01', trelloToken: token }]);
  // AC26 on screen: an over-limit board names the limit and cannot be submitted.
  await expect(page.getByTestId('import-limit')).toContainText('at most 20');
  await expect(page.getByRole('button', { name: 'Start import' })).toBeDisabled();
});
