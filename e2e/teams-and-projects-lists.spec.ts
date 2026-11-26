import { expect, test } from '@playwright/test';
import { accept, ownerApi } from './access-helpers';
import { signupToBoard } from './helpers';

test('teams list: person cards, search, people filter, team tabs; projects list: people and search', async ({ browser, request }, info) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 } });
  const call = await ownerApi(request, account);
  const workspaceId = new URL(account.boardUrl).pathname.split('/')[2]!;
  const design = await call<{ id: string }>('POST', `/workspaces/${workspaceId}/teams`, { name: 'Design' });
  await call('POST', `/workspaces/${workspaceId}/teams`, { name: 'Marketing' });
  const email = `priya-${Date.now()}@example.test`;
  await call('POST', `/workspaces/${workspaceId}/members/invites`, { email, role: 'member', teamIds: [design.id] });
  const member = await accept(browser, email, 'Priya Shah');
  await member.context().close();

  await page.goto(`/w/${workspaceId}/teams`);
  const rows = page.getByTestId('team-row');
  await expect(rows).toHaveCount(2);
  const designRow = rows.filter({ hasText: 'Design' });
  await expect(designRow).toContainText('Priya Shah');
  // A person card: avatar, name and email, and nothing else.
  await designRow.getByRole('button', { name: 'Priya Shah', exact: true }).hover();
  const card = page.getByTestId('person-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Priya Shah');
  await expect(card).toContainText(email);
  await expect(card.getByRole('button')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('teams-list.png'), style: 'nextjs-portal { visibility: hidden; }' });
  await page.mouse.move(5, 500);
  await expect(card).toHaveCount(0);

  const search = page.getByRole('searchbox', { name: 'Search for teams or people' });
  await search.fill('market');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Marketing');
  await search.fill('priya');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Design');
  await search.fill('');
  await expect(rows).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Filter by people' }).click();
  await page.getByRole('listbox').getByRole('option', { name: /^Priya Shah/ }).click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/people=/);
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Design');

  await rows.getByRole('link', { name: 'Design', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/teams/${design.id}$`));
  const sections = page.getByRole('navigation', { name: 'Team sections' });
  await expect(sections.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  await expect(sections.getByText('Team chat')).toHaveAttribute('aria-disabled', 'true');
  await expect(sections.getByText('Team chat')).toContainText('Soon');
  await expect(page.getByRole('list', { name: 'People in Design' }).getByRole('button')).toHaveCount(2);
  await page.screenshot({ path: info.outputPath('team-overview.png'), style: 'nextjs-portal { visibility: hidden; }' });
  await page.getByRole('link', { name: 'View all 2' }).click();
  await expect(page).toHaveURL(/\?tab=members$/);
  await expect(page.getByTestId('team-member-row').filter({ hasText: 'Priya Shah' })).toContainText(email);

  await call('POST', `/workspaces/${workspaceId}/projects`, { name: 'Spring campaign' });
  await page.goto(`/w/${workspaceId}/projects`);
  const projects = page.getByTestId('project-row');
  await expect(projects).toHaveCount(2);
  await expect(projects.filter({ hasText: 'Acme site rebuild' }).getByTestId('person-avatar')).toHaveCount(1);
  await expect(page.getByText('Joined')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('projects-list.png'), style: 'nextjs-portal { visibility: hidden; }' });
  await page.getByRole('searchbox', { name: 'Find a project' }).fill('spring');
  await expect(projects).toHaveCount(1);
  await expect(projects).toContainText('Spring campaign');
  await page.getByRole('searchbox', { name: 'Find a project' }).fill('zzz');
  await expect(page.getByRole('heading', { name: 'No projects match' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(projects).toHaveCount(2);
  // Anywhere in the row outside its avatars and menu opens the board.
  await projects.filter({ hasText: 'Spring campaign' }).click({ position: { x: 300, y: 20 } });
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]+\/b\/[0-9a-f-]+/);
  await page.context().close();
});
