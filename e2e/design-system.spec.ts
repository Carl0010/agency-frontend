import { expect, test } from '@playwright/test';
import { list, signupToBoard, touchBox } from './helpers';

test('shared form controls retain focus, reduced motion and mobile touch targets', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  const email = page.getByLabel('Email');
  const submit = page.getByRole('button', { name: 'Log in', exact: true });
  await email.focus();
  await expect(email).toBeFocused();
  await expect(email).not.toHaveCSS('box-shadow', 'none');
  expect((await email.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // Filled buttons are 40px tall on phones; an invisible 2px margin above and below keeps 44px to touch.
  expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  expect((await touchBox(submit)).height).toBeGreaterThanOrEqual(44);
  await expect(email).toHaveCSS('font-size', '16px');
  await expect(submit).toHaveCSS('transition-duration', '1e-05s');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('login-mobile.png'), fullPage: true });
});

test('workspace and board use the system without breaking the narrow layout', async ({ browser }, info) => {
  const { page, account } = await signupToBoard(browser, { viewport: { width: 1440, height: 1000 } });
  const column = list(page, 'To do');
  await column.getByTestId('add-card-end').click();
  await page.getByLabel('Card title').fill('Review the new client brief');
  await page.keyboard.press('Enter');
  await expect(column.getByTestId('card-tile')).toContainText('Review the new client brief');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: info.outputPath('board-desktop.png'), fullPage: true });

  const workspaceId = new URL(account.boardUrl).pathname.split('/')[2];
  await page.goto(`/w/${workspaceId}/projects`);
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Project navigation' }).getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
  await page.screenshot({ path: info.outputPath('projects-desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('projects-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto(account.boardUrl);
  // Phones swipe between full-height columns; the next one peeks in at the edge.
  await expect(list(page, 'To do')).toBeInViewport();
  await expect(list(page, 'In progress')).toBeInViewport();
  await expect(list(page, 'Done')).not.toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('board-mobile.png'), fullPage: true });
  await page.context().close();
});
