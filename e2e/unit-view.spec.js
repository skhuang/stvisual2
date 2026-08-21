import { test, expect } from '@playwright/test';

test('unit view mounts one explorer without integrated chrome', async ({ page }) => {
  await page.goto('/?explorer=GraphCoverageExplorer');
  await expect(page.getByTestId('unit-main')).toBeVisible();
  await expect(page.getByTestId('app-nav')).toHaveCount(0);
  await expect(page.locator('[data-testid="unit-main"] > *')).toHaveCount(1);
});

test('kebab id deeplink works', async ({ page }) => {
  await page.goto('/?explorer=boundary-value');
  await expect(page.getByTestId('unit-app')).toBeVisible();
});

test('focus mode toggles and Escape exits', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage');
  await page.getByTestId('viz-focus-toggle').click();
  await expect(page.locator('body')).toHaveClass(/viz-focus/);
  await expect(page.locator('#viz-focus-exit')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/viz-focus/);
});

test('?view=all keeps the integrated page', async ({ page }) => {
  await page.goto('/?view=all&explorer=graph-coverage');
  await expect(page.getByTestId('app-nav')).toBeVisible();
});

test('unknown explorer shows overview with dismissible notice', async ({ page }) => {
  await page.goto('/?explorer=NopeExplorer');
  await expect(page.getByTestId('app-nav')).toBeVisible();
  const notice = page.getByTestId('unit-not-found');
  await expect(notice).toContainText('NopeExplorer');
  await notice.locator('button').click();
  await expect(notice).toHaveCount(0);
});
