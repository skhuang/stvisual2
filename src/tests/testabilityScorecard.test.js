import { describe, it, expect, beforeEach } from 'vitest';
import {
  scorecard,
  applyFix,
  gradeFor,
  STRUCT_CAP,
  DET_TOTAL,
  createTestabilityScorecardExplorer,
} from '../components/TestabilityScorecardExplorer.js';
import { SCORECARD_FIXTURE } from '../data/testabilityModels.js';
import { testabilityHardness } from '../components/TestabilityMetricsExplorer.js';

const byId = (perSignal) => Object.fromEntries(perSignal.map((s) => [s.id, s]));

describe('scorecard — exact signal values on SCORECARD_FIXTURE', () => {
  const card = scorecard(SCORECARD_FIXTURE);
  const sig = byId(card.perSignal);

  // Documented constants
  it('uses STRUCT_CAP = 25 and DET_TOTAL = 4', () => {
    expect(STRUCT_CAP).toBe(25);
    expect(DET_TOTAL).toBe(4);
  });

  it('controllability = 0.6 (3 of 5 turnstile states reachable)', () => {
    expect(sig.controllability.score).toBeCloseTo(0.6, 10);
  });

  it('observability = 0.2 (only PASSED has a unique output, no probes)', () => {
    expect(sig.observability.score).toBeCloseTo(0.2, 10);
  });

  it('seam = 0 (no seams injected initially)', () => {
    expect(sig.seam.score).toBe(0);
  });

  it('structural = 1 - hardest/25 = 0.24 (hardest checkout scores 19)', () => {
    const hardest = testabilityHardness(SCORECARD_FIXTURE.module)[0].score;
    expect(hardest).toBe(19);
    expect(sig.structural.score).toBeCloseTo(1 - 19 / 25, 10); // 0.24
    expect(sig.structural.score).toBeCloseTo(0.24, 10);
  });

  it('determinism = 1 - 2/4 = 0.5 (clock + random present)', () => {
    expect(sig.determinism.score).toBeCloseTo(0.5, 10);
  });

  it('overall = mean of the 5 signals = 0.308, grade F', () => {
    expect(card.overall).toBeCloseTo((0.6 + 0.2 + 0 + 0.24 + 0.5) / 5, 10); // 0.308
    expect(card.overall).toBeCloseTo(0.308, 10);
    expect(card.grade).toBe('F');
  });

  it('each signal carries its label key and deep-link target explorer', () => {
    expect(sig.controllability.teachesExplorer).toBe('controllability-observability');
    expect(sig.observability.teachesExplorer).toBe('controllability-observability');
    expect(sig.seam.teachesExplorer).toBe('testability-seams');
    expect(sig.structural.teachesExplorer).toBe('testability-metrics');
    expect(sig.determinism.teachesExplorer).toBe('flaky-diagnosis');
    expect(sig.determinism.label).toBe('tsc.signal.determinism');
  });
});

describe('scorecard — topFixes ordering (3 lowest, ascending)', () => {
  const card = scorecard(SCORECARD_FIXTURE);

  it('lists seam (0) < observability (0.2) < structural (0.24)', () => {
    expect(card.topFixes.map((f) => f.signalId)).toEqual([
      'seam', 'observability', 'structural',
    ]);
  });

  it('maps each fix to its fixKey and teaching explorer', () => {
    expect(card.topFixes[0]).toEqual({ signalId: 'seam', fixKey: 'tsc.fix.seam', explorer: 'testability-seams' });
    expect(card.topFixes[1]).toEqual({ signalId: 'observability', fixKey: 'tsc.fix.observability', explorer: 'controllability-observability' });
    expect(card.topFixes[2]).toEqual({ signalId: 'structural', fixKey: 'tsc.fix.structural', explorer: 'testability-metrics' });
  });
});

describe('gradeFor — letter thresholds', () => {
  it('A≥0.85, B≥0.70, C≥0.55, D≥0.40, else F', () => {
    expect(gradeFor(0.90)).toBe('A');
    expect(gradeFor(0.85)).toBe('A');
    expect(gradeFor(0.70)).toBe('B');
    expect(gradeFor(0.55)).toBe('C');
    expect(gradeFor(0.40)).toBe('D');
    expect(gradeFor(0.39)).toBe('F');
    expect(gradeFor(0)).toBe('F');
  });
});

describe('applyFix — deterministic, non-mutating re-grade', () => {
  it("inject-clock raises seam AND determinism, re-grading F -> D", () => {
    const before = scorecard(SCORECARD_FIXTURE);
    expect(before.grade).toBe('F');

    const fixed = applyFix(SCORECARD_FIXTURE, 'inject-clock');
    // new fixture, base untouched
    expect(fixed).not.toBe(SCORECARD_FIXTURE);
    expect(SCORECARD_FIXTURE.appliedSeams).toEqual([]);
    expect(SCORECARD_FIXTURE.nondeterminism).toEqual(['clock', 'random']);
    expect(fixed.appliedSeams).toContain('clock');
    expect(fixed.nondeterminism).toEqual(['random']);

    const after = scorecard(fixed);
    const b = byId(before.perSignal);
    const a = byId(after.perSignal);
    // seam 0 -> 0.25 (1 of 4 seams)
    expect(a.seam.score).toBeCloseTo(0.25, 10);
    expect(a.seam.score).toBeGreaterThan(b.seam.score);
    // determinism 0.5 -> 0.75 (1 of 4 sources remaining)
    expect(a.determinism.score).toBeCloseTo(0.75, 10);
    expect(a.determinism.score).toBeGreaterThan(b.determinism.score);
    // overall climbs and grade improves F -> D
    expect(after.overall).toBeGreaterThan(before.overall);
    expect(after.grade).toBe('D');
  });

  it('inject-rng raises seam and removes random from nondeterminism', () => {
    const fixed = applyFix(SCORECARD_FIXTURE, 'inject-rng');
    expect(fixed.appliedSeams).toContain('random');
    expect(fixed.nondeterminism).toEqual(['clock']);
  });

  it('add-probe raises observability without touching seams/nondeterminism', () => {
    const before = scorecard(SCORECARD_FIXTURE);
    const fixed = applyFix(SCORECARD_FIXTURE, 'add-probe');
    expect(fixed.probes.length).toBe(1);
    expect(fixed.appliedSeams).toEqual([]);
    expect(fixed.nondeterminism).toEqual(['clock', 'random']);
    const after = scorecard(fixed);
    expect(byId(after.perSignal).observability.score)
      .toBeGreaterThan(byId(before.perSignal).observability.score);
  });

  it('inject-config / inject-gateway extend appliedSeams only', () => {
    expect(applyFix(SCORECARD_FIXTURE, 'inject-config').appliedSeams).toContain('global');
    expect(applyFix(SCORECARD_FIXTURE, 'inject-gateway').appliedSeams).toContain('newdep');
    expect(applyFix(SCORECARD_FIXTURE, 'inject-config').nondeterminism).toEqual(['clock', 'random']);
  });

  it('an unknown fix id yields an unchanged copy', () => {
    const fixed = applyFix(SCORECARD_FIXTURE, 'nope');
    expect(fixed).not.toBe(SCORECARD_FIXTURE);
    expect(fixed.appliedSeams).toEqual([]);
    expect(fixed.probes).toEqual([]);
    expect(fixed.nondeterminism).toEqual(['clock', 'random']);
  });
});

describe('createTestabilityScorecardExplorer (mount smoke)', () => {
  let root;
  beforeEach(() => {
    root = createTestabilityScorecardExplorer();
    document.body.innerHTML = '';
    document.body.appendChild(root);
  });

  it('mounts the explorer root, grade badge, signal bars and fix list', () => {
    expect(root.querySelector('[data-testid="score-explorer"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="score-grade"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="score-signal-seam"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="score-fixes"]')).toBeTruthy();
    // initial grade is F
    expect(root.querySelector('[data-testid="score-grade"]').getAttribute('data-grade')).toBe('F');
  });

  it('applying inject-clock re-renders and raises the grade to D', () => {
    root.querySelector('[data-testid="score-apply-inject-clock"]').click();
    expect(root.querySelector('[data-testid="score-grade"]').getAttribute('data-grade')).toBe('D');
  });
});
