import { describe, it, expect, beforeEach } from 'vitest';
import {
  testabilityOf,
  createTestabilitySeamsExplorer,
} from '../components/TestabilitySeamsExplorer.js';
import { SEAM_SNIPPET } from '../data/testabilityModels.js';

const ALL_IDS = SEAM_SNIPPET.antipatterns.map((ap) => ap.id); // ['global','newdep','clock','random']

describe('testabilityOf (design-for-testability seams engine)', () => {
  it('empty input → score 0, nothing applied, all remaining, no capabilities', () => {
    const r = testabilityOf([]);
    expect(r.score).toBe(0);
    expect(r.applied).toEqual([]);
    expect(r.remaining).toEqual(ALL_IDS);
    expect(r.capabilities).toEqual([]);
  });

  it('one fix → score 0.25 and exactly one capability', () => {
    const r = testabilityOf(['clock']);
    expect(r.score).toBe(0.25);
    expect(r.applied).toEqual(['clock']);
    expect(r.capabilities).toEqual(['tsm.cap.clock']);
    expect(r.capabilities).toHaveLength(1);
  });

  it('all four fixes → score 1 and four capabilities', () => {
    const r = testabilityOf(ALL_IDS);
    expect(r.score).toBe(1);
    expect(r.applied).toEqual(ALL_IDS);
    expect(r.remaining).toEqual([]);
    expect(r.capabilities).toHaveLength(4);
  });

  it('is order-independent: output is always in fixture order', () => {
    const r = testabilityOf(['random', 'global', 'clock', 'newdep']);
    expect(r.applied).toEqual(ALL_IDS);
    expect(r.capabilities).toEqual([
      'tsm.cap.global', 'tsm.cap.newdep', 'tsm.cap.clock', 'tsm.cap.random',
    ]);
  });

  it('dedupes repeated ids and ignores unknown ids; does not mutate input', () => {
    const input = ['clock', 'clock', 'nope'];
    const r = testabilityOf(input);
    expect(r.applied).toEqual(['clock']);
    expect(r.score).toBe(0.25);
    expect(input).toEqual(['clock', 'clock', 'nope']); // unchanged
  });
});

describe('createTestabilitySeamsExplorer (mount smoke)', () => {
  let root;
  beforeEach(() => {
    root = createTestabilitySeamsExplorer();
    document.body.innerHTML = '';
    document.body.appendChild(root);
  });

  it('mounts an element containing the seams-explorer root', () => {
    expect(root.querySelector('[data-testid="seams-explorer"]')).toBeTruthy();
  });

  it('shows the meter, capabilities panel and the test-doubles link', () => {
    expect(root.querySelector('[data-testid="seams-score"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="seams-capabilities"]')).toBeTruthy();
    const link = root.querySelector('[data-testid="seams-doubles-link"]');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('?explorer=test-doubles');
  });

  it('toggling a fix raises the score readout', () => {
    expect(root.querySelector('[data-testid="seams-score"]').textContent).toContain('0%');
    root.querySelector('[data-testid="seams-fix-clock"]').click();
    expect(root.querySelector('[data-testid="seams-score"]').textContent).toContain('25%');
  });
});
