// e2e/nav-unit-links.spec.js
import { test, expect } from '@playwright/test';

test('category panel lists per-unit links that open the unit view', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-category-graph-model').hover();
  const link = page.getByTestId('nav-unit-graph-coverage');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByTestId('unit-app')).toBeVisible();
  await expect(page).toHaveURL(/explorer=GraphCoverageExplorer/);
});

test('section buttons in the panel still switch integrated sections', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-category-graph-model').hover();
  await page.getByTestId('nav-btn-graph').click();
  await expect(page.getByTestId('section-graph')).toBeVisible();
});
