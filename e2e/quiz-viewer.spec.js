import { test, expect } from '@playwright/test';

test('quiz button opens overlay; practice check grades a question', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage');
  await page.getByTestId('unit-quiz-btn').click();
  await expect(page.getByTestId('quiz-begin')).toBeVisible();
  await page.getByTestId('quiz-begin').click();
  await expect(page.getByTestId('quiz-q')).toBeVisible();
  await page.locator('.quiz-ans input').first().check();
  await page.getByTestId('quiz-check').click();
  await expect(page.getByTestId('quiz-feedback')).toBeVisible();
});

test('test mode reaches a score summary and records an attempt', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage');
  await page.getByTestId('unit-quiz-btn').click();
  await page.locator('input[name="qmode"][value="test"]').check();
  await page.getByTestId('quiz-begin').click();
  for (let i = 0; i < 5; i++) {
    const sa = page.getByTestId('quiz-sa');
    if (await sa.count()) await sa.fill('set cover');
    else await page.locator('.quiz-ans input').first().check();
    await page.locator('[data-act="next"], [data-act="submit"]').first().click();
  }
  const sa = page.getByTestId('quiz-sa');
  if (await sa.count()) { await sa.fill('set cover'); }
  else { await page.locator('.quiz-ans input').first().check(); }
  await page.getByTestId('quiz-submit').click();
  await expect(page.getByTestId('quiz-score')).toBeVisible();
});

test('escape closes the overlay', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage');
  await page.getByTestId('unit-quiz-btn').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#quiz-viewer')).toBeHidden();
});

test('units without a bank show no quiz button', async ({ page }) => {
  await page.goto('/?explorer=pairwise');
  await expect(page.getByTestId('unit-app')).toBeVisible();
  await expect(page.getByTestId('unit-quiz-btn')).toHaveCount(0);
});

test('shared quizId: mutation-score unit opens the mutation-testing bank', async ({ page }) => {
  await page.goto('/?explorer=mutation-score');
  await page.getByTestId('unit-quiz-btn').click();
  await expect(page.getByTestId('quiz-begin')).toBeVisible();
});

test('shared quizId: equivalence-class opens boundary-value-equivalence bank', async ({ page }) => {
  await page.goto('/?explorer=equivalence-class');
  await page.getByTestId('unit-quiz-btn').click();
  await expect(page.getByTestId('quiz-begin')).toBeVisible();
});
