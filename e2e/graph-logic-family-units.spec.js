import { test, expect } from '@playwright/test';

test('graph unit view: structural shows 2 criteria, no editor', async ({ page }) => {
  await page.goto('/?explorer=graph-structural');
  await expect(page.getByTestId('unit-app')).toBeVisible();
  await expect(page.locator('[data-testid^="criterion-"]')).toHaveCount(2);
  await expect(page.getByTestId('graph-editor-card')).toHaveCount(0);
  await expect(page.getByTestId('ex-select')).toBeVisible();
});

test('graph dataflow shows DFG, path does not', async ({ page }) => {
  await page.goto('/?explorer=graph-dataflow');
  await expect(page.getByTestId('graph-dfg-card')).toBeVisible();
  await page.goto('/?explorer=graph-path');
  await expect(page.getByTestId('graph-dfg-card')).toHaveCount(0);
});

test('logic dnf shows K-map, basic shows truth table only', async ({ page }) => {
  await page.goto('/?explorer=logic-dnf');
  await expect(page.getByTestId('logic-kmap-f')).toBeVisible();
  await page.goto('/?explorer=logic-basic');
  await expect(page.getByTestId('logic-truth-table')).toBeVisible();
  await expect(page.getByTestId('logic-kmap-f')).toHaveCount(0);
});

test('integrated graph section shows a tab bar defaulting to Complete', async ({ page }) => {
  await page.goto('/?view=all&section=graph');
  await expect(page.getByTestId('graph-tab-row')).toBeVisible();
  await expect(page.getByTestId('graph-editor-card')).toBeVisible(); // full tab default
});

test('regression: graph-coverage full deeplink still works with Quiz', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage');
  await expect(page.getByTestId('unit-quiz-btn')).toBeVisible();
  await expect(page.getByTestId('graph-editor-card')).toBeVisible();
});
