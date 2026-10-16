import { expect, test } from '@playwright/test';
import { openSectionFromNav } from './helpers/navigation.js';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { window.localStorage.setItem('stvisual.locale', 'zh'); } catch { /* ignore */ }
  });
});

test.describe('Graph Coverage Browser Tests', () => {
  test('supports advanced criteria and generated test paths', async ({ page }) => {
    await page.goto('/index.html');
    await openSectionFromNav(page, 'graph');

    await page.getByTestId('criterion-edge-pair').click();
    await expect(page.getByTestId('requirement-list')).toContainText('S -> A -> B');

    await page.getByTestId('criterion-complete-path').click();
    await expect(page.getByTestId('requirement-list')).toContainText('S -> A -> B -> D -> E -> T');

    await expect(page.getByTestId('graph-test-path-card')).toBeVisible();
    await expect(page.getByTestId('test-path-list')).toContainText('T1:');
    await expect(page.getByTestId('test-path-meta')).toContainText('Covered Requirements:');
  });

  test('recomputes requirements and test paths after graph editing', async ({ page }) => {
    await page.goto('/index.html');
    await openSectionFromNav(page, 'graph');

    await page.getByTestId('graph-nodes-input').fill([
      'S,Start,80,170',
      'A,A,220,170',
      'T,End,360,170',
    ].join('\n'));

    await page.getByTestId('graph-edges-input').fill([
      'S-A,S,A',
      'A-T,A,T',
    ].join('\n'));

    await page.getByTestId('graph-start-input').fill('S');
    await page.getByTestId('graph-end-input').fill('T');

    await expect(page.getByTestId('graph-editor-status')).toContainText('Graph 已同步更新');
    await expect(page.getByTestId('requirement-list').locator('li')).toHaveCount(3);
    await expect(page.getByTestId('test-path-list')).toContainText('S -> A -> T');
    await expect(page.getByTestId('test-path-meta')).toContainText('Covered Requirements: 3 / 3');
  });

  test('highlights selected test paths on the graph (multi-select)', async ({ page }) => {
    await page.goto('/?explorer=graph-coverage');

    // complete-path yields multiple end-to-end paths to toggle.
    await page.getByTestId('criterion-complete-path').click();

    const chip1 = page.getByTestId('test-path-1');
    const chip2 = page.getByTestId('test-path-2');
    await expect(chip1).toBeVisible();
    await expect(chip2).toBeVisible();

    // Toggle the first path: chip becomes pressed, legend appears, and the
    // canvas gains path-highlighted elements (stable data hook, color-agnostic).
    await chip1.click();
    await expect(chip1).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('graph-path-legend')).toBeVisible();
    // SVG geometry: assert presence by count (raw <line>/<path> read as "hidden").
    await expect(page.locator('[data-path-highlight]').first()).toBeAttached();
    expect(await page.locator('[data-path-highlight]').count()).toBeGreaterThan(0);

    // Toggle a second path: both chips pressed.
    await chip2.click();
    await expect(chip1).toHaveAttribute('aria-pressed', 'true');
    await expect(chip2).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('graph-path-legend')).toBeVisible();

    // Toggling the first path off un-presses it.
    await chip1.click();
    await expect(chip1).toHaveAttribute('aria-pressed', 'false');
    await expect(chip2).toHaveAttribute('aria-pressed', 'true');
  });

  test('path selection highlights source lines and covered requirements (program with source)', async ({ page }) => {
    await page.goto('/?explorer=graph-coverage');

    // Switch to a program that carries source code (nodes get sourceLine).
    await page.getByTestId('program-example-select').selectOption('triangle-problem');
    await expect(page.getByTestId('program-source-code')).toBeVisible();

    // A criterion that yields end-to-end test paths to toggle.
    await page.getByTestId('criterion-complete-path').click();

    const chip1 = page.getByTestId('test-path-1');
    await expect(chip1).toBeVisible();
    await chip1.click();
    await expect(chip1).toHaveAttribute('aria-pressed', 'true');

    // Source lines along the path are tinted in the path's color...
    await expect(page.locator('[data-path-src]').first()).toBeAttached();
    expect(await page.locator('[data-path-src]').count()).toBeGreaterThan(0);

    // ...and at least one Test Requirements row shows a cover accent.
    await expect(page.locator('[data-path-cover]').first()).toBeAttached();
    expect(await page.locator('[data-path-cover]').count()).toBeGreaterThan(0);
  });

  test('path selection on the source-less default sample still marks covered requirements', async ({ page }) => {
    await page.goto('/?explorer=graph-coverage');

    // Default CFG Sample has no source code.
    await expect(page.getByTestId('program-source-empty')).toBeVisible();

    const chip1 = page.getByTestId('test-path-1');
    await expect(chip1).toBeVisible();
    await chip1.click();
    await expect(chip1).toHaveAttribute('aria-pressed', 'true');

    // Covered requirement rows still get the accent...
    await expect(page.locator('[data-path-cover]').first()).toBeAttached();
    expect(await page.locator('[data-path-cover]').count()).toBeGreaterThan(0);

    // ...and the source panel keeps its empty-state message (no crash, no [data-path-src]).
    await expect(page.getByTestId('program-source-empty')).toBeVisible();
    expect(await page.locator('[data-path-src]').count()).toBe(0);
  });

  test('data-flow criterion yields requirements on the default sample (real variable data)', async ({ page }) => {
    await page.goto('/?explorer=graph-coverage');

    // The default CFG sample now carries per-node variable data (sourceText),
    // so the all-uses data-flow criterion produces concrete requirement rows.
    await page.locator('[data-criterion="all-uses"]').click();

    await expect(page.locator('[data-requirement-id]').first()).toBeAttached();
    expect(await page.locator('[data-requirement-id]').count()).toBeGreaterThan(0);

    // With variables present the empty-state hint must NOT appear.
    await expect(page.getByTestId('dataflow-empty-hint')).toHaveCount(0);
  });

  test('selecting a data-flow requirement highlights its def→use on the DFG and marks endpoints on the CFG', async ({ page }) => {
    await page.goto('/?explorer=graph-coverage');

    await page.locator('[data-criterion="all-uses"]').click();

    const firstRequirement = page.locator('[data-requirement-id]').first();
    await expect(firstRequirement).toBeAttached();
    await firstRequirement.click();

    // The DFG canvas now has exactly the active def→use edge marked.
    const activeEdge = page.locator('[data-dfg-active="1"]');
    await expect(activeEdge.first()).toBeAttached();
    expect(await activeEdge.count()).toBe(1);

    // The CFG canvas marks the def and use endpoints (color-agnostic class hooks).
    await expect(page.locator('.graph-node--def').first()).toBeAttached();
    expect(await page.locator('.graph-node--def').count()).toBeGreaterThan(0);
    await expect(page.locator('.graph-node--use').first()).toBeAttached();
    expect(await page.locator('.graph-node--use').count()).toBeGreaterThan(0);

    // The def/use text badges are rendered on both canvases.
    await expect(page.getByTestId('graph-node-def').first()).toBeAttached();
    await expect(page.getByTestId('graph-node-use').first()).toBeAttached();
    await expect(page.getByTestId('dfg-node-def').first()).toBeAttached();
    await expect(page.getByTestId('dfg-node-use').first()).toBeAttached();
  });

  test('CFG nodes can be dragged to reposition, and the new coords persist', async ({ page }) => {
    await page.goto('/?explorer=graph-coverage');

    // Node D sits in the centre of the default graph — a reliable drag target.
    const nodeD = page.getByTestId('graph-node-D').locator('circle');
    await expect(nodeD).toBeAttached();
    await nodeD.scrollIntoViewIfNeeded();
    const before = await nodeD.evaluate((c) => ({ cx: +c.getAttribute('cx'), cy: +c.getAttribute('cy') }));

    // Drag the node right+down on screen.
    const box = await nodeD.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 100, startY + 40, { steps: 10 });
    await page.mouse.up();

    // After drop the node has moved (one authoritative re-render has happened).
    const after = await page.getByTestId('graph-node-D').locator('circle')
      .evaluate((c) => ({ cx: +c.getAttribute('cx'), cy: +c.getAttribute('cy') }));
    expect(after.cx).toBeGreaterThan(before.cx);
    expect(after.cy).toBeGreaterThan(before.cy);

    // The move is synced into the Graph Editor's node coordinates.
    const nodesText = await page.getByTestId('graph-nodes-input').inputValue();
    const row = nodesText.split('\n').find((line) => line.startsWith('D,'));
    expect(row).toBeTruthy();
    expect(Number(row.split(',')[2])).toBe(after.cx);
  });
});
