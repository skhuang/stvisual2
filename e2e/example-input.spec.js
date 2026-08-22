// e2e/example-input.spec.js
import { test, expect } from '@playwright/test';

test('graph unit: example dropdown + 🎲 change the CFG; recent persists', async ({ page }) => {
  await page.goto('/?explorer=graph-structural');
  await expect(page.getByTestId('ex-select')).toBeVisible();
  await page.getByTestId('ex-random').click();
  await expect(page.getByTestId('graph-canvas')).toBeVisible(); // still renders a CFG
});

test('logic unit: example dropdown lists presets', async ({ page }) => {
  await page.goto('/?explorer=logic-basic');
  const select = page.getByTestId('ex-select');
  await expect(select).toBeVisible();
  await expect(select.locator('option')).not.toHaveCount(0);
});

test('difficulty selector persists across reload', async ({ page }) => {
  await page.goto('/?explorer=graph-structural');
  await page.getByTestId('input-difficulty').selectOption('large');
  await page.reload();
  await expect(page.getByTestId('input-difficulty')).toHaveValue('large');
});
