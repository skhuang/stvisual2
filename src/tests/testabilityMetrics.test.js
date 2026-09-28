import { describe, it, expect, beforeEach } from 'vitest';
import {
  cyclomatic,
  coupling,
  cohesionPenalty,
  testabilityHardness,
  addDependency,
  splitUnit,
  highestLeverageFix,
  createTestabilityMetricsExplorer,
} from '../components/TestabilityMetricsExplorer.js';
import { METRICS_MODULE } from '../data/testabilityModels.js';

const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

describe('cyclomatic / coupling / cohesionPenalty (per-unit metrics)', () => {
  it('cyclomatic = decisions + 1 for every unit', () => {
    const expected = {
      checkout: 7, validateCart: 4, applyDiscount: 3,
      chargePayment: 5, sendReceipt: 4, formatMoney: 1,
    };
    for (const u of METRICS_MODULE.units) {
      expect(cyclomatic(u), u.id).toBe(expected[u.id]);
    }
  });

  it('coupling reports exact fan-in / fan-out per unit', () => {
    const c = coupling(METRICS_MODULE);
    expect(c.checkout).toEqual({ fanIn: 0, fanOut: 4 });
    expect(c.validateCart).toEqual({ fanIn: 1, fanOut: 0 });
    expect(c.applyDiscount).toEqual({ fanIn: 1, fanOut: 1 });
    expect(c.chargePayment).toEqual({ fanIn: 1, fanOut: 1 });
    expect(c.sendReceipt).toEqual({ fanIn: 1, fanOut: 1 });
    expect(c.formatMoney).toEqual({ fanIn: 3, fanOut: 0 });
  });

  it('cohesionPenalty = responsibility count', () => {
    const expected = {
      checkout: 4, validateCart: 2, applyDiscount: 1,
      chargePayment: 2, sendReceipt: 1, formatMoney: 1,
    };
    for (const u of METRICS_MODULE.units) {
      expect(cohesionPenalty(u), u.id).toBe(expected[u.id]);
    }
  });
});

describe('testabilityHardness (ranking on the fixed module)', () => {
  const ranked = testabilityHardness(METRICS_MODULE);

  it('ranks by score DESC, id ASC on ties', () => {
    expect(ranked.map((r) => r.id)).toEqual([
      'checkout', 'chargePayment', 'sendReceipt', 'applyDiscount', 'validateCart', 'formatMoney',
    ]);
    expect(ranked.map((r) => r.score)).toEqual([19, 9, 7, 6, 6, 2]);
  });

  it('top unit is the orchestrator checkout with score 19, dominated by fan-out', () => {
    expect(ranked[0].id).toBe('checkout');
    expect(ranked[0].score).toBe(19);
    expect(ranked[0].reason).toBe('tmx.reason.fanout');
  });

  it('every row carries exact per-metric values', () => {
    const m = byId(ranked);
    expect(m.checkout).toMatchObject({ cyclomatic: 7, fanIn: 0, fanOut: 4, cohesionPenalty: 4, score: 19 });
    expect(m.chargePayment).toMatchObject({ cyclomatic: 5, fanIn: 1, fanOut: 1, cohesionPenalty: 2, score: 9 });
    expect(m.sendReceipt).toMatchObject({ cyclomatic: 4, fanIn: 1, fanOut: 1, cohesionPenalty: 1, score: 7 });
    expect(m.applyDiscount).toMatchObject({ cyclomatic: 3, fanIn: 1, fanOut: 1, cohesionPenalty: 1, score: 6 });
    expect(m.validateCart).toMatchObject({ cyclomatic: 4, fanIn: 1, fanOut: 0, cohesionPenalty: 2, score: 6 });
    expect(m.formatMoney).toMatchObject({ cyclomatic: 1, fanIn: 3, fanOut: 0, cohesionPenalty: 1, score: 2 });
  });

  it('the tie (applyDiscount 6, validateCart 6) breaks by id ascending', () => {
    const i = ranked.findIndex((r) => r.id === 'applyDiscount');
    expect(ranked[i + 1].id).toBe('validateCart');
  });

  it('highestLeverageFix points at checkout with the fan-out fix', () => {
    const fix = highestLeverageFix(METRICS_MODULE);
    expect(fix.unitId).toBe('checkout');
    expect(fix.fixKey).toBe('tmx.fix.fanout');
  });
});

describe('addDependency (raises the target fan-in and the source score)', () => {
  it('adds a new edge, raising the callee fan-in and the caller score, without mutation', () => {
    const before = coupling(METRICS_MODULE);
    const beforeScore = byId(testabilityHardness(METRICS_MODULE));
    const next = addDependency(METRICS_MODULE, 'validateCart', 'formatMoney');

    const c = coupling(next);
    // callee (target) fan-in rises 3 -> 4
    expect(before.formatMoney.fanIn).toBe(3);
    expect(c.formatMoney.fanIn).toBe(4);
    // caller (source) score rises via fan-out: 6 -> 8
    const nextScore = byId(testabilityHardness(next));
    expect(beforeScore.validateCart.score).toBe(6);
    expect(nextScore.validateCart.score).toBe(8);
    expect(nextScore.validateCart.fanOut).toBe(1);

    // original module untouched
    expect(METRICS_MODULE.calls).toHaveLength(7);
    expect(next.calls).toHaveLength(8);
  });

  it('is a no-op copy when the edge already exists (no duplicate)', () => {
    const next = addDependency(METRICS_MODULE, 'checkout', 'validateCart');
    expect(next.calls).toHaveLength(7);
    expect(next).not.toBe(METRICS_MODULE);
  });
});

describe('splitUnit (splitting lowers the split unit hardness)', () => {
  it('splitting checkout replaces it with two smaller units, both easier than the original', () => {
    const originalHardest = byId(testabilityHardness(METRICS_MODULE)).checkout.score; // 19
    const next = splitUnit(METRICS_MODULE, 'checkout');

    const ids = next.units.map((u) => u.id);
    expect(ids).not.toContain('checkout');
    expect(ids).toContain('checkout-a');
    expect(ids).toContain('checkout-b');

    const m = byId(testabilityHardness(next));
    // deterministic split: a = ceil(6/2)=3 decisions -> cyclo 4, b = floor -> 4 too
    expect(m['checkout-a'].score).toBe(12);
    expect(m['checkout-b'].score).toBe(10);
    // both halves strictly easier than the original 19
    expect(m['checkout-a'].score).toBeLessThan(originalHardest);
    expect(m['checkout-b'].score).toBeLessThan(originalHardest);

    // original module untouched
    expect(METRICS_MODULE.units.some((u) => u.id === 'checkout')).toBe(true);
    expect(METRICS_MODULE.calls).toHaveLength(7);
  });

  it('returns an unchanged copy for a missing id', () => {
    const next = splitUnit(METRICS_MODULE, 'nope');
    expect(next.units).toHaveLength(METRICS_MODULE.units.length);
    expect(next).not.toBe(METRICS_MODULE);
  });
});

describe('createTestabilityMetricsExplorer (mount smoke)', () => {
  let root;
  beforeEach(() => {
    root = createTestabilityMetricsExplorer();
    document.body.innerHTML = '';
    document.body.appendChild(root);
  });

  it('mounts an element containing the metrics-explorer root, heatmap and hardest readout', () => {
    expect(root.querySelector('[data-testid="metrics-explorer"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="metrics-heatmap"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="metrics-hardest"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="metrics-cell-checkout"]')).toBeTruthy();
  });

  it('clicking a cell shows its metric breakdown', () => {
    root.querySelector('[data-testid="metrics-cell-checkout"]').click();
    const card = root.querySelector('[data-testid="metrics-breakdown"]');
    expect(card.textContent).toContain('checkout');
  });

  it('splitting the hardest unit lowers the readout score', () => {
    expect(root.querySelector('[data-testid="metrics-hardest"]').textContent).toContain('19');
    root.querySelector('[data-testid="metrics-split"]').click();
    const readout = root.querySelector('[data-testid="metrics-hardest"]').textContent;
    expect(readout).not.toContain('19');
    expect(readout).toContain('12'); // new hardest = checkout-a
  });
});
