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
  for (let i = 0; i < 14; i++) {
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

// Every explorer in the catalog now ships a quiz bank, so group-theory —
// once the bankless example here — auto-wires a quiz button. The "no bank →
// no button" guard itself is covered catalog-independently in
// src/tests/quizViewerHas.test.js (QuizViewer.has()).
test('a formerly-bankless explorer now shows the quiz button', async ({ page }) => {
  await page.goto('/?explorer=group-theory');
  await expect(page.getByTestId('unit-app')).toBeVisible();
  await expect(page.getByTestId('unit-quiz-btn')).toBeVisible();
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

test('difficulty selector: easy is default and begins a quiz', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage');
  await page.getByTestId('unit-quiz-btn').click();
  await expect(page.getByTestId('quiz-diff')).toBeVisible();
  await expect(page.locator('input[name="qdiff"][value="easy"]')).toBeChecked();
  await expect(page.getByTestId('quiz-begin')).toBeVisible();
  await page.getByTestId('quiz-begin').click();
  await expect(page.getByTestId('quiz-q')).toBeVisible();
});

test('difficulty selector: medium is fully authored (15) and begins a quiz', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage');
  await page.getByTestId('unit-quiz-btn').click();
  await page.locator('input[name="qdiff"][value="medium"]').check();
  await expect(page.getByTestId('quiz-comingsoon')).toHaveCount(0);
  await expect(page.getByTestId('quiz-begin')).toBeVisible();
  await page.getByTestId('quiz-begin').click();
  await expect(page.getByTestId('quiz-q')).toBeVisible();
  await expect(page.locator('.quiz-q-head')).toContainText('/ 15');
});

test('difficulty selector: mixed samples 5/5/5 = 15 reachable questions', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage');
  await page.getByTestId('unit-quiz-btn').click();
  await page.locator('input[name="qdiff"][value="mixed"]').check();
  await page.locator('input[name="qmode"][value="test"]').check();
  await expect(page.getByTestId('quiz-begin')).toBeVisible();
  await page.getByTestId('quiz-begin').click();
  await expect(page.getByTestId('quiz-q')).toBeVisible();
  await expect(page.locator('.quiz-q-head')).toContainText('/ 15');
  for (let i = 0; i < 14; i++) {
    const sa = page.getByTestId('quiz-sa');
    if (await sa.count()) await sa.fill('set cover');
    else await page.locator('.quiz-ans input').first().check();
    await page.locator('[data-act="next"], [data-act="submit"]').first().click();
  }
  // The 15th (last) question is reachable and shows the correct counter.
  await expect(page.locator('.quiz-q-head')).toContainText('15 / 15');
  const sa = page.getByTestId('quiz-sa');
  if (await sa.count()) await sa.fill('set cover');
  else await page.locator('.quiz-ans input').first().check();
  await page.getByTestId('quiz-submit').click();
  await expect(page.getByTestId('quiz-score')).toContainText('/ 15');
});
