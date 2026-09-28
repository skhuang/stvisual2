import { t, onLocaleChange } from '../i18n/index.js';
import { SCORECARD_FIXTURE } from '../data/testabilityModels.js';
import {
  controllability,
  observability,
  observableStates,
  withProbe,
} from './ControllabilityObservabilityExplorer.js';
import { testabilityOf } from './TestabilitySeamsExplorer.js';
import { testabilityHardness } from './TestabilityMetricsExplorer.js';

// Testability scorecard / diagnosis — the capstone of the Testability section.
//
// It does NOT re-derive anything: it COMPOSES the three sibling explorers'
// exported pure engines into five normalized signals (higher = more testable),
// averages them into an overall grade (A–F), and lists the top-3 lowest signals
// as prioritized fixes, each deep-linking to the explorer that teaches it.

// ── documented constants ─────────────────────────────────────────────
// STRUCT_CAP: the structural-hardness score treated as "as bad as it gets" when
//   normalizing testabilityHardness()[0].score into a 0..1 signal. The fixture's
//   hardest unit (checkout) scores 19, so structural = 1 - 19/25 = 0.24.
export const STRUCT_CAP = 25;
// DET_TOTAL: the full catalogue of nondeterminism sources the determinism signal
//   is normalized against. With 2 of 4 present, determinism = 1 - 2/4 = 0.5.
export const DET_TOTAL = 4;

// Grade thresholds on the overall (mean) score, checked high→low.
export const GRADE_THRESHOLDS = [
  { grade: 'A', min: 0.85 },
  { grade: 'B', min: 0.70 },
  { grade: 'C', min: 0.55 },
  { grade: 'D', min: 0.40 },
  { grade: 'F', min: 0 },
];

// Fixed signal order — also the tie-break precedence for topFixes.
const SIGNAL_ORDER = ['controllability', 'observability', 'seam', 'structural', 'determinism'];

// Per-signal metadata: the label i18n key and the deep-link target explorer that
// teaches that signal.
const SIGNAL_META = {
  controllability: { labelKey: 'tsc.signal.controllability', explorer: 'controllability-observability' },
  observability:   { labelKey: 'tsc.signal.observability',   explorer: 'controllability-observability' },
  seam:            { labelKey: 'tsc.signal.seam',            explorer: 'testability-seams' },
  structural:      { labelKey: 'tsc.signal.structural',      explorer: 'testability-metrics' },
  determinism:     { labelKey: 'tsc.signal.determinism',     explorer: 'flaky-diagnosis' },
};

// Apply-fix ids → the seam id they inject (add to appliedSeams). The probe fix is
// handled separately since it edits observability, not seams.
const FIX_TO_SEAM = {
  'inject-config':  'global',
  'inject-gateway': 'newdep',
  'inject-clock':   'clock',
  'inject-rng':     'random',
};

// Deterministic order in which UI-selected fixes are folded onto the base
// fixture, so re-grading is reproducible regardless of click order.
const FIX_ORDER = ['inject-config', 'inject-gateway', 'inject-clock', 'inject-rng', 'add-probe'];

// ── pure engine (exported for tests) ─────────────────────────────────

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

// The next shared-output state to probe: the first state (in sut.states order)
// whose observable output is still shared with another state and that is not yet
// probed. Returns null when nothing is left to disambiguate.
function nextProbeTarget(sut, probes) {
  const observable = new Set(observableStates(sut));
  const already = new Set(probes);
  for (const s of sut.states) {
    if (!observable.has(s) && !already.has(s)) return s;
  }
  return null;
}

// The SUT with every probe in `probes` applied via the co explorer's withProbe,
// each given a fresh unique output so a previously-shared state becomes visible.
function sutWithProbes(sut, probes = []) {
  return probes.reduce((acc, id) => withProbe(acc, id, `probe:${id}`), sut);
}

// The five normalized signals (0..1, higher = more testable) for a fixture.
function signalScores(fx) {
  const hardest = testabilityHardness(fx.module)[0].score;
  const present = fx.nondeterminism.length;
  return {
    controllability: controllability(fx.sut).ratio,
    observability: observability(sutWithProbes(fx.sut, fx.probes)).ratio,
    seam: testabilityOf(fx.appliedSeams).score,
    structural: clamp(1 - hardest / STRUCT_CAP, 0, 1),
    determinism: clamp(1 - present / DET_TOTAL, 0, 1),
  };
}

export function gradeFor(overall) {
  for (const { grade, min } of GRADE_THRESHOLDS) {
    if (overall >= min) return grade;
  }
  return 'F';
}

// scorecard(fx) → { perSignal, overall, grade, topFixes }
//   perSignal — [{ id, label, score, teachesExplorer }] in SIGNAL_ORDER
//   overall   — arithmetic mean of the five signal scores
//   grade     — letter from GRADE_THRESHOLDS
//   topFixes  — the 3 lowest signals (score ASC; tie-break by SIGNAL_ORDER),
//               each { signalId, fixKey, explorer }
// Deterministic; never mutates its input.
export function scorecard(fx) {
  const scores = signalScores(fx);
  const perSignal = SIGNAL_ORDER.map((id) => ({
    id,
    label: SIGNAL_META[id].labelKey,
    score: scores[id],
    teachesExplorer: SIGNAL_META[id].explorer,
  }));
  const overall = SIGNAL_ORDER.reduce((sum, id) => sum + scores[id], 0) / SIGNAL_ORDER.length;
  const grade = gradeFor(overall);

  const rank = (id) => SIGNAL_ORDER.indexOf(id);
  const topFixes = [...perSignal]
    .sort((a, b) => (a.score - b.score) || (rank(a.id) - rank(b.id)))
    .slice(0, 3)
    .map((sig) => ({
      signalId: sig.id,
      fixKey: `tsc.fix.${sig.id}`,
      explorer: sig.teachesExplorer,
    }));

  return { perSignal, overall, grade, topFixes };
}

// applyFix(fx, fixId) → a NEW fixture with the fix applied. Deterministic and
// non-mutating:
//   • inject-clock  — injects the clock seam AND removes 'clock' from nondeterminism
//   • inject-rng    — injects the rng seam   AND removes 'random' from nondeterminism
//   • inject-config — injects the config seam (appliedSeams only)
//   • inject-gateway— injects the gateway seam (appliedSeams only)
//   • add-probe     — adds the next shared-output state to probes (observability)
// An already-applied seam / probe, or an unknown fixId, yields an unchanged copy.
export function applyFix(fx, fixId) {
  const next = {
    sut: fx.sut,
    module: fx.module,
    appliedSeams: [...fx.appliedSeams],
    probes: [...fx.probes],
    nondeterminism: [...fx.nondeterminism],
  };

  if (fixId === 'add-probe') {
    const target = nextProbeTarget(fx.sut, fx.probes);
    if (target) next.probes.push(target);
    return next;
  }

  const seam = FIX_TO_SEAM[fixId];
  if (!seam) return next;
  if (!next.appliedSeams.includes(seam)) next.appliedSeams.push(seam);
  if (fixId === 'inject-clock') next.nondeterminism = next.nondeterminism.filter((s) => s !== 'clock');
  if (fixId === 'inject-rng') next.nondeterminism = next.nondeterminism.filter((s) => s !== 'random');
  return next;
}

// Build the effective fixture from the base by folding the selected fix ids in a
// fixed order, so the live re-grade is reproducible regardless of click order.
function fixtureFor(appliedFixIds) {
  return FIX_ORDER
    .filter((id) => appliedFixIds.has(id))
    .reduce((f, id) => applyFix(f, id), SCORECARD_FIXTURE);
}

// The apply-fix toggles the UI offers (order = FIX_ORDER).
const FIX_TOGGLES = [
  { id: 'inject-config',  labelKey: 'tsc.apply.config' },
  { id: 'inject-gateway', labelKey: 'tsc.apply.gateway' },
  { id: 'inject-clock',   labelKey: 'tsc.apply.clock' },
  { id: 'inject-rng',     labelKey: 'tsc.apply.rng' },
  { id: 'add-probe',      labelKey: 'tsc.apply.probe' },
];

// ── state ────────────────────────────────────────────────────────────

const state = {
  applied: new Set(), // fix ids toggled on
};

let root;

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

// ── rendering ─────────────────────────────────────────────────────────

function renderGrade(card) {
  return `<div class="tsc-grade" data-testid="score-grade" data-grade="${esc(card.grade)}">
    <span class="tsc-grade-badge tsc-grade-badge--${esc(card.grade)}">${esc(card.grade)}</span>
    <div class="tsc-grade-meta">
      <span class="tsc-grade-label">${esc(t('tsc.grade.label'))}</span>
      <span class="tsc-grade-overall">${esc(t('tsc.grade.overall', { pct: Math.round(card.overall * 100) }))}</span>
    </div>
  </div>`;
}

function renderSignals(card) {
  const bars = card.perSignal.map((sig) => {
    const pct = Math.round(sig.score * 100);
    return `<li class="tsc-signal" data-testid="score-signal-${esc(sig.id)}">
      <div class="tsc-signal-head">
        <span class="tsc-signal-label">${esc(t(sig.label))}</span>
        <span class="tsc-signal-pct">${pct}%</span>
      </div>
      <div class="tsc-signal-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
        <div class="tsc-signal-fill tsc-signal-fill--lvl${Math.round(sig.score * 4)}" style="width:${pct}%"></div>
      </div>
    </li>`;
  }).join('');
  return `<div class="tsc-signals" data-testid="score-signals">
    <h3 class="tsc-col-title">${esc(t('tsc.signals.title'))}</h3>
    <ul class="tsc-signal-list">${bars}</ul>
  </div>`;
}

function renderFixes(card) {
  const items = card.topFixes.map((fix, i) => `
    <li class="tsc-fix" data-testid="score-fix-${esc(fix.signalId)}">
      <span class="tsc-fix-rank">${i + 1}</span>
      <span class="tsc-fix-text">${esc(t(fix.fixKey))}</span>
      <a class="tsc-fix-link" href="?explorer=${esc(fix.explorer)}"
        data-testid="score-fix-link-${esc(fix.signalId)}">${esc(t('tsc.fix.link'))}</a>
    </li>`).join('');
  return `<div class="tsc-fixes" data-testid="score-fixes">
    <h3 class="tsc-col-title">${esc(t('tsc.fixes.title'))}</h3>
    <ol class="tsc-fix-list">${items}</ol>
  </div>`;
}

function renderToggles() {
  const btns = FIX_TOGGLES.map((f) => {
    const on = state.applied.has(f.id);
    return `<button type="button"
      class="tsc-apply-btn${on ? ' tsc-apply-btn--on' : ''}"
      data-tsc-fix="${esc(f.id)}" data-testid="score-apply-${esc(f.id)}"
      aria-pressed="${on ? 'true' : 'false'}">${esc(t(f.labelKey))}</button>`;
  }).join('');
  return `<div class="tsc-toggles" data-testid="score-toggles">
    <span class="tsc-toggles-label">${esc(t('tsc.apply.title'))}</span>
    <div class="tsc-toggle-row">${btns}</div>
  </div>`;
}

function render() {
  const card = scorecard(fixtureFor(state.applied));
  root.innerHTML = `
    <div class="tsc-wrap" data-testid="score-explorer">
      <h2 class="tsc-title">${esc(t('tsc.title'))}</h2>
      <p class="tsc-desc">${esc(t('tsc.desc'))}</p>
      ${renderGrade(card)}
      ${renderToggles()}
      <div class="tsc-body">
        <div class="tsc-left">${renderSignals(card)}</div>
        <div class="tsc-right">${renderFixes(card)}</div>
      </div>
    </div>`;
  bindEvents();
}

function bindEvents() {
  root.querySelectorAll('[data-tsc-fix]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.tscFix;
      if (state.applied.has(id)) state.applied.delete(id);
      else state.applied.add(id);
      render();
    });
  });
}

export function createTestabilityScorecardExplorer() {
  state.applied = new Set();

  root = document.createElement('div');
  onLocaleChange(() => render());
  render();
  return root;
}
