import { test, expect } from '@playwright/test';

test('lab button opens statement, samples, and a disabled judge button', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage');
  await page.getByTestId('unit-lab-btn').click();
  await expect(page.getByTestId('lab-statement')).toBeVisible();
  await expect(page.getByTestId('lab-samples')).toBeVisible();
  const judge = page.getByTestId('lab-judge');
  await expect(judge).toBeDisabled();
  await expect(judge).toContainText(/coming soon|即將開放/);
});

test('lab language toggle swaps the statement', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage&lang=en');
  await page.getByTestId('unit-lab-btn').click();
  await expect(page.getByTestId('lab-statement')).toContainText('Prime path');
  await page.getByTestId('lab-lang-toggle').click();
  await expect(page.getByTestId('lab-statement')).toContainText('質數路徑');
});

test('units without labs show no lab button', async ({ page }) => {
  await page.goto('/?explorer=logic-coverage');
  await expect(page.getByTestId('unit-app')).toBeVisible();
  await expect(page.getByTestId('unit-lab-btn')).toHaveCount(0);
});
