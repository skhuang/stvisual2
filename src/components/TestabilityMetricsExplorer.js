import { t, onLocaleChange } from '../i18n/index.js';
import { METRICS_MODULE } from '../data/testabilityModels.js';

// Testability metrics heatmap explorer.
//
// A small checkout module is scored per-unit for how hard it is to test in
// isolation, combining three structural signals into one hardness score:
//   score = cyclomatic + 2*fanOut + cohesionPenalty
// The learner reads the heatmap, inspects a unit's breakdown, and applies two
// edits — add a dependency (raises coupling) and split the hardest unit (trades
// complexity for a new, smaller collaborator) — watching the ranking update.

// ── pure engine (exported for tests) ─────────────────────────────────

// Cyclomatic complexity of a unit from its explicit decision count: M = d + 1.
export function cyclomatic(unit) {
  return unit.decisions + 1;
}

// Coupling over the whole module: { [unitId]: { fanIn, fanOut } }.
//   fanIn  = number of call edges whose `to`   is the unit (callers)
//   fanOut = number of call edges whose `from` is the unit (callees)
export function coupling(module) {
  const out = {};
  for (const u of module.units) out[u.id] = { fanIn: 0, fanOut: 0 };
  for (const c of module.calls) {
    if (out[c.from]) out[c.from].fanOut += 1;
    if (out[c.to]) out[c.to].fanIn += 1;
  }
  return out;
}

// Cohesion proxy (LCOM-style, simplified): more declared responsibilities ⇒
// lower cohesion ⇒ higher penalty. Penalty == responsibility count.
export function cohesionPenalty(unit) {
  return unit.responsibilities.length;
}

// The three weighted contributions to the score, so both testabilityHardness and
// the dominant-contributor pick share one definition.
function contributions(unit, cpl) {
  return {
    complexity: cyclomatic(unit),          // weight 1
    fanout: 2 * cpl.fanOut,                 // weight 2
    cohesion: cohesionPenalty(unit),        // weight 1
  };
}

// Dominant contributor = the largest of the three weighted contributions.
// Ties are broken by a fixed precedence complexity > fanout > cohesion so the
// reason string is deterministic. Returns an i18n reason key.
function dominantReasonKey(contrib) {
  const order = ['complexity', 'fanout', 'cohesion'];
  let best = order[0];
  for (const k of order) {
    if (contrib[k] > contrib[best]) best = k;
  }
  return `tmx.reason.${best}`;
}

// Per-unit hardness for the whole module, sorted by score DESC then id ASC.
// Each row: { id, cyclomatic, fanIn, fanOut, cohesionPenalty, score, reason }.
//   score = cyclomatic + 2*fanOut + cohesionPenalty
export function testabilityHardness(module) {
  const cpl = coupling(module);
  const rows = module.units.map((u) => {
    const c = cpl[u.id];
    const contrib = contributions(u, c);
    const cyc = cyclomatic(u);
    const coh = cohesionPenalty(u);
    return {
      id: u.id,
      cyclomatic: cyc,
      fanIn: c.fanIn,
      fanOut: c.fanOut,
      cohesionPenalty: coh,
      score: cyc + 2 * c.fanOut + coh,
      reason: dominantReasonKey(contrib),
    };
  });
  rows.sort((a, b) => (b.score - a.score) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return rows;
}

// Returns a NEW module with a directed call edge from→to added. No mutation, and
// no duplicate edge (an identical from/to pair is a no-op copy).
export function addDependency(module, fromId, toId) {
  const exists = module.calls.some((c) => c.from === fromId && c.to === toId);
  const calls = exists ? module.calls.map((c) => ({ ...c })) : [...module.calls.map((c) => ({ ...c })), { from: fromId, to: toId }];
  return { units: module.units.map((u) => ({ ...u, responsibilities: [...u.responsibilities] })), calls };
}

// Returns a NEW module with `id` split into two smaller units, to show that
// splitting lowers per-unit hardness. Deterministic split rule:
//   • ids            → `${id}-a` (primary) and `${id}-b` (extracted helper)
//   • decisions      → a = ceil(d/2), b = floor(d/2)   (halved complexity)
//   • responsibilities → a = even indices, b = odd indices (partitioned)
//   • outgoing edges (from===id) → distributed by original index: even→a, odd→b
//   • incoming edges (to===id)   → redirected to a (the primary entry point)
//   • one internal edge a→b is added (a delegates to the extracted helper)
//   • self-edges (from===id && to===id) are dropped
// A missing id returns an unchanged copy.
export function splitUnit(module, id) {
  const target = module.units.find((u) => u.id === id);
  if (!target) {
    return {
      units: module.units.map((u) => ({ ...u, responsibilities: [...u.responsibilities] })),
      calls: module.calls.map((c) => ({ ...c })),
    };
  }
  const aId = `${id}-a`;
  const bId = `${id}-b`;
  const d = target.decisions;
  const respA = target.responsibilities.filter((_, i) => i % 2 === 0);
  const respB = target.responsibilities.filter((_, i) => i % 2 === 1);
  const unitA = { id: aId, decisions: Math.ceil(d / 2), responsibilities: respA };
  const unitB = { id: bId, decisions: Math.floor(d / 2), responsibilities: respB };

  const units = [];
  for (const u of module.units) {
    if (u.id === id) { units.push(unitA, unitB); }
    else { units.push({ ...u, responsibilities: [...u.responsibilities] }); }
  }

  const calls = [];
  let outIndex = 0;
  for (const c of module.calls) {
    if (c.from === id && c.to === id) continue; // drop self-edge
    if (c.from === id) {
      const from = (outIndex % 2 === 0) ? aId : bId;
      outIndex += 1;
      calls.push({ from, to: c.to });
    } else if (c.to === id) {
      calls.push({ from: c.from, to: aId });
    } else {
      calls.push({ ...c });
    }
  }
  calls.push({ from: aId, to: bId }); // a delegates to the extracted helper

  return { units, calls };
}

// The single highest-leverage fix for the module = address the hardest unit's
// dominant contributor. Returns { unitId, reason, fixKey }.
export function highestLeverageFix(module) {
  const ranked = testabilityHardness(module);
  const hardest = ranked[0];
  const kind = hardest.reason.replace('tmx.reason.', '');
  return { unitId: hardest.id, reason: hardest.reason, fixKey: `tmx.fix.${kind}` };
}

// ── state ────────────────────────────────────────────────────────────

const state = {
  module: null,
  selected: null,     // selected unit id for the breakdown card
  addFrom: null,      // pending "add dependency" source
  addTo: null,        // pending "add dependency" target
};

let root;

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function cloneBase() {
  return {
    units: METRICS_MODULE.units.map((u) => ({ ...u, responsibilities: [...u.responsibilities] })),
    calls: METRICS_MODULE.calls.map((c) => ({ ...c })),
  };
}

// ── rendering ─────────────────────────────────────────────────────────

// Bucket a score into 0..4 for the sequential heatmap colour.
function level(score, maxScore) {
  if (maxScore <= 0) return 0;
  return Math.round((score / maxScore) * 4);
}

function renderHeatmap(ranked, maxScore) {
  const cells = ranked.map((r) => {
    const lvl = level(r.score, maxScore);
    const sel = state.selected === r.id ? ' metrics-cell--selected' : '';
    return `<button type="button" class="metrics-cell metrics-cell--lvl${lvl}${sel}"
      data-metrics-cell="${esc(r.id)}" data-testid="metrics-cell-${esc(r.id)}"
      aria-pressed="${state.selected === r.id ? 'true' : 'false'}"
      title="${esc(r.id)} · ${esc(t('tmx.card.score'))} ${r.score}">
      <span class="metrics-cell-name">${esc(r.id)}</span>
      <span class="metrics-cell-score">${r.score}</span>
    </button>`;
  }).join('');
  return `<div class="metrics-heatmap-wrap">
    <h3 class="metrics-col-title">${esc(t('tmx.heatmap.title'))}</h3>
    <div class="metrics-heatmap" data-testid="metrics-heatmap" role="list">${cells}</div>
    <p class="metrics-heatmap-legend">${esc(t('tmx.heatmap.legend'))}</p>
  </div>`;
}

// Fixed-ish layout for the dependency graph. Units not in the map are laid out
// on a fallback row so a split module still renders.
const GRAPH_POS = {
  checkout:      { x: 110, y: 190 },
  validateCart:  { x: 350, y: 55 },
  applyDiscount: { x: 350, y: 145 },
  chargePayment: { x: 350, y: 235 },
  sendReceipt:   { x: 350, y: 325 },
  formatMoney:   { x: 575, y: 190 },
};
const NODE_R = 30;
const GVB_W = 680, GVB_H = 380;

function posFor(id, idx, total) {
  if (GRAPH_POS[id]) return GRAPH_POS[id];
  // Fallback: spread unknown (e.g. split) units along a lower band.
  const x = 90 + (idx / Math.max(1, total - 1)) * (GVB_W - 180);
  return { x, y: 360 };
}

function renderGraph(module) {
  const idx = new Map(module.units.map((u, i) => [u.id, i]));
  const pos = new Map(module.units.map((u, i) => [u.id, posFor(u.id, i, module.units.length)]));

  const arrowId = 'metrics-arrow';
  const defs = `<defs><marker id="${arrowId}" viewBox="0 0 8 6" refX="7" refY="3"
    markerWidth="8" markerHeight="6" orient="auto-start-reverse">
    <path d="M0,0 L0,6 L8,3 z" fill="var(--app-text-muted, #6b7280)"/></marker></defs>`;

  const edges = module.calls.map((c) => {
    const from = pos.get(c.from), to = pos.get(c.to);
    if (!from || !to) return '';
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len, uy = dy / len;
    const x1 = from.x + ux * NODE_R, y1 = from.y + uy * NODE_R;
    const x2 = to.x - ux * NODE_R, y2 = to.y - uy * NODE_R;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
      stroke="var(--app-text-muted, #6b7280)" stroke-width="1.4" marker-end="url(#${arrowId})"/>`;
  }).join('');

  const nodes = module.units.map((u) => {
    const p = pos.get(u.id);
    const sel = state.selected === u.id ? ' metrics-gnode--selected' : '';
    return `<g class="metrics-gnode${sel}" data-metrics-node="${esc(u.id)}" data-testid="metrics-node-${esc(u.id)}">
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${NODE_R}"/>
      <text x="${p.x.toFixed(1)}" y="${(p.y + 3).toFixed(1)}" text-anchor="middle" font-size="10" class="metrics-gnode-label">${esc(u.id)}</text>
    </g>`;
  }).join('');
  void idx;

  return `<div class="metrics-graph-wrap">
    <h3 class="metrics-col-title">${esc(t('tmx.graph.title'))}</h3>
    <svg viewBox="0 0 ${GVB_W} ${GVB_H}" class="metrics-graph" data-testid="metrics-graph"
      xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"
      aria-label="${esc(t('tmx.graph.aria'))}">${defs}${edges}${nodes}</svg>
  </div>`;
}

function renderBreakdown(ranked) {
  const row = ranked.find((r) => r.id === state.selected);
  if (!row) {
    return `<div class="metrics-breakdown metrics-breakdown--empty" data-testid="metrics-breakdown">
      <p class="metrics-empty">${esc(t('tmx.card.empty'))}</p>
    </div>`;
  }
  const lines = [
    ['tmx.card.cyclomatic', row.cyclomatic],
    ['tmx.card.fanIn', row.fanIn],
    ['tmx.card.fanOut', row.fanOut],
    ['tmx.card.cohesion', row.cohesionPenalty],
  ].map(([key, val]) => `<li class="metrics-metric">
      <span class="metrics-metric-label">${esc(t(key))}</span>
      <span class="metrics-metric-val">${val}</span>
    </li>`).join('');
  return `<div class="metrics-breakdown" data-testid="metrics-breakdown">
    <h3 class="metrics-card-title">${esc(row.id)}</h3>
    <ul class="metrics-metric-list">${lines}</ul>
    <div class="metrics-card-score">
      <span class="metrics-card-score-label">${esc(t('tmx.card.score'))}</span>
      <span class="metrics-card-score-val">${row.score}</span>
    </div>
    <p class="metrics-card-reason">${esc(t(row.reason, { cyclomatic: row.cyclomatic, fanOut: row.fanOut, cohesion: row.cohesionPenalty }))}</p>
  </div>`;
}

function renderHardest(module) {
  const ranked = testabilityHardness(module);
  const hardest = ranked[0];
  const fix = highestLeverageFix(module);
  return `<div class="metrics-hardest" data-testid="metrics-hardest">
    <span class="metrics-hardest-tag">${esc(t('tmx.hardest.tag'))}</span>
    <strong class="metrics-hardest-unit">${esc(hardest.id)}</strong>
    <span class="metrics-hardest-score">${esc(t('tmx.card.score'))} ${hardest.score}</span>
    <p class="metrics-hardest-fix">${esc(t('tmx.hardest.fix', { unit: hardest.id }))} ${esc(t(fix.fixKey))}</p>
  </div>`;
}

function renderControls(module) {
  const opts = (selected) => module.units.map((u) =>
    `<option value="${esc(u.id)}"${selected === u.id ? ' selected' : ''}>${esc(u.id)}</option>`).join('');
  const from = state.addFrom ?? module.units[0]?.id;
  const to = state.addTo ?? module.units[module.units.length - 1]?.id;
  return `<div class="metrics-controls" data-testid="metrics-controls">
    <div class="metrics-adddep">
      <span class="metrics-ctl-label">${esc(t('tmx.control.addDep'))}</span>
      <select class="metrics-select" data-metrics-from aria-label="${esc(t('tmx.control.from'))}">${opts(from)}</select>
      <span class="metrics-arrow-txt">→</span>
      <select class="metrics-select" data-metrics-to aria-label="${esc(t('tmx.control.to'))}">${opts(to)}</select>
      <button type="button" class="metrics-btn" data-metrics-add data-testid="metrics-add-dep">${esc(t('tmx.control.addBtn'))}</button>
    </div>
    <button type="button" class="metrics-btn metrics-btn--split" data-metrics-split data-testid="metrics-split">
      ${esc(t('tmx.control.split'))}
    </button>
    <button type="button" class="metrics-btn metrics-btn--reset" data-metrics-reset data-testid="metrics-reset">
      ${esc(t('tmx.control.reset'))}
    </button>
  </div>`;
}

function render() {
  const module = state.module;
  const ranked = testabilityHardness(module);
  const maxScore = ranked.reduce((m, r) => Math.max(m, r.score), 0);
  root.innerHTML = `
    <div class="metrics-wrap" data-testid="metrics-explorer">
      <h2 class="metrics-title">${esc(t('tmx.title'))}</h2>
      <p class="metrics-desc">${esc(t('tmx.desc'))}</p>
      ${renderHardest(module)}
      ${renderControls(module)}
      <div class="metrics-body">
        <div class="metrics-left">
          ${renderHeatmap(ranked, maxScore)}
          ${renderGraph(module)}
        </div>
        <div class="metrics-right">
          ${renderBreakdown(ranked)}
        </div>
      </div>
    </div>`;
  bindEvents();
}

function bindEvents() {
  root.querySelectorAll('[data-metrics-cell]').forEach((btn) => {
    btn.addEventListener('click', () => { state.selected = btn.dataset.metricsCell; render(); });
  });
  root.querySelectorAll('[data-metrics-node]').forEach((g) => {
    g.addEventListener('click', () => { state.selected = g.dataset.metricsNode; render(); });
  });
  const fromSel = root.querySelector('[data-metrics-from]');
  const toSel = root.querySelector('[data-metrics-to]');
  fromSel?.addEventListener('change', () => { state.addFrom = fromSel.value; });
  toSel?.addEventListener('change', () => { state.addTo = toSel.value; });
  root.querySelector('[data-metrics-add]')?.addEventListener('click', () => {
    const from = state.addFrom ?? fromSel?.value;
    const to = state.addTo ?? toSel?.value;
    if (from && to && from !== to) state.module = addDependency(state.module, from, to);
    render();
  });
  root.querySelector('[data-metrics-split]')?.addEventListener('click', () => {
    const hardest = testabilityHardness(state.module)[0];
    if (hardest) {
      state.module = splitUnit(state.module, hardest.id);
      state.selected = null;
      state.addFrom = null;
      state.addTo = null;
    }
    render();
  });
  root.querySelector('[data-metrics-reset]')?.addEventListener('click', () => {
    state.module = cloneBase();
    state.selected = null;
    state.addFrom = null;
    state.addTo = null;
    render();
  });
}

export function createTestabilityMetricsExplorer() {
  state.module = cloneBase();
  state.selected = null;
  state.addFrom = null;
  state.addTo = null;

  root = document.createElement('div');
  onLocaleChange(() => render());
  render();
  return root;
}
