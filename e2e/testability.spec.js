import { test, expect } from '@playwright/test';

test('controllability-observability unit mounts one explorer', async ({ page }) => {
  await page.goto('/?explorer=controllability-observability');
  await expect(page.getByTestId('unit-main')).toBeVisible();
  await expect(page.locator('[data-testid="unit-main"] > *')).toHaveCount(1);
  await expect(page.getByTestId('co-explorer')).toBeVisible();
  await expect(page.getByTestId('co-graph')).toBeVisible();
  // Default (controllability) mode shows the controllability readout.
  await expect(page.getByTestId('co-controllability')).toContainText('3/5');
});

test('switching to observability mode and toggling the probe updates the readout', async ({ page }) => {
  await page.goto('/?explorer=controllability-observability');

  await page.getByTestId('co-mode-observability').click();
  const readout = page.getByTestId('co-observability');
  await expect(readout).toBeVisible();
  await expect(readout).toContainText('1/5');

  // Add a probe to JAMMED — 'green' was shared with UNLOCKED, so both become
  // unique and observability climbs 1/5 -> 3/5.
  await page.getByTestId('co-probe-toggle').check();
  await expect(page.getByTestId('co-observability')).toContainText('3/5');
});

test('testability-seams unit mounts and applying a fix raises the score', async ({ page }) => {
  await page.goto('/?explorer=testability-seams');
  await expect(page.getByTestId('unit-main')).toBeVisible();
  await expect(page.locator('[data-testid="unit-main"] > *')).toHaveCount(1);
  await expect(page.getByTestId('seams-explorer')).toBeVisible();

  const score = page.getByTestId('seams-score');
  await expect(score).toContainText('0%');

  // Applying the clock seam raises the meter from 0% to 25%.
  await page.getByTestId('seams-fix-clock').click();
  await expect(score).toContainText('25%');
});
