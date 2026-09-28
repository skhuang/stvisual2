import { describe, it, expect } from 'vitest';
import {
  reachableStates,
  controllability,
  observableStates,
  observability,
  withProbe,
  driveTo,
  createControllabilityObservabilityExplorer,
} from '../components/ControllabilityObservabilityExplorer.js';
import { TURNSTILE_SUT } from '../data/testabilityModels.js';

describe('controllability & observability engine', () => {
  it('reachableStates covers LOCKED/UNLOCKED/PASSED only', () => {
    expect(new Set(reachableStates(TURNSTILE_SUT)))
      .toEqual(new Set(['LOCKED', 'UNLOCKED', 'PASSED']));
  });

  it('controllability is 3/5 = 0.6', () => {
    const c = controllability(TURNSTILE_SUT);
    expect(c.total).toBe(5);
    expect(c.reachable.length).toBe(3);
    expect(c.ratio).toBeCloseTo(0.6, 10);
  });

  it('observableStates is exactly [PASSED] (unique output)', () => {
    expect(observableStates(TURNSTILE_SUT)).toEqual(['PASSED']);
  });

  it('observability is 1/5 = 0.2', () => {
    const o = observability(TURNSTILE_SUT);
    expect(o.total).toBe(5);
    expect(o.observable).toEqual(['PASSED']);
    expect(o.ratio).toBeCloseTo(0.2, 10);
  });

  it('withProbe on JAMMED raises observability without mutating the original', () => {
    const probed = withProbe(TURNSTILE_SUT, 'JAMMED', 'grind');
    expect(probed).not.toBe(TURNSTILE_SUT);
    // original untouched
    expect(TURNSTILE_SUT.outputs.JAMMED).toBe('green');
    // 'green' was shared by UNLOCKED+JAMMED; giving JAMMED a distinct output
    // makes BOTH unique, so observability climbs 1/5 -> 3/5.
    const o = observability(probed);
    expect(new Set(o.observable)).toEqual(new Set(['PASSED', 'UNLOCKED', 'JAMMED']));
    expect(o.ratio).toBeCloseTo(0.6, 10);
  });

  it('driveTo PASSED is [coin, push]; MAINT is null', () => {
    expect(driveTo(TURNSTILE_SUT, 'PASSED')).toEqual(['coin', 'push']);
    expect(driveTo(TURNSTILE_SUT, 'MAINT')).toBeNull();
    expect(driveTo(TURNSTILE_SUT, 'JAMMED')).toBeNull();
    expect(driveTo(TURNSTILE_SUT, 'LOCKED')).toEqual([]); // start
  });
});

describe('ControllabilityObservabilityExplorer mount', () => {
  it('returns an element containing the co-explorer root', () => {
    const el = createControllabilityObservabilityExplorer();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.querySelector('[data-testid="co-explorer"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="co-controllability"]')).toBeTruthy();
  });
});
