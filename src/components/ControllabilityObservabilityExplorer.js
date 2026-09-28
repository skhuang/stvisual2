import { t, onLocaleChange } from '../i18n/index.js';
import { TURNSTILE_SUT } from '../data/testabilityModels.js';

// Controllability & Observability Explorer — the core testability definition.
//
// Controllability = can a test DRIVE the SUT into the state it needs to
// exercise? Observability = can a test SEE the effect it needs to check?
// Both are computed from the explicit TURNSTILE_SUT finite-state model, so the
// numbers on screen are reproducible and unit-tested.

// ── pure engine (exported for tests) ─────────────────────────────────

// BFS from sut.start over the input-driven transition relation. Returns the
// array of reachable states in discovery order.
export function reachableStates(sut) {
  const adj = new Map();
  for (const tr of sut.trans) {
    if (!adj.has(tr.from)) adj.set(tr.from, []);
    adj.get(tr.from).push(tr.to);
  }
  const seen = new Set([sut.start]);
  const order = [sut.start];
  const queue = [sut.start];
  while (queue.length) {
    const s = queue.shift();
    for (const next of adj.get(s) || []) {
      if (!seen.has(next)) {
        seen.add(next);
        order.push(next);
        queue.push(next);
      }
    }
  }
  return order;
}

export function controllability(sut) {
  const reachable = reachableStates(sut);
  const total = sut.states.length;
  return { reachable, total, ratio: reachable.length / total };
}

// A state is observable when a fault landing there yields a distinguishable
// output — i.e. its output value is UNIQUE across all states. Shared outputs
// mean an observer cannot tell those states apart.
export function observableStates(sut) {
  const counts = new Map();
  for (const s of sut.states) {
    const out = sut.outputs[s];
    counts.set(out, (counts.get(out) || 0) + 1);
  }
  return sut.states.filter((s) => counts.get(sut.outputs[s]) === 1);
}

export function observability(sut) {
  const observable = observableStates(sut);
  const total = sut.states.length;
  return { observable, total, ratio: observable.length / total };
}

// Returns a NEW sut (never mutates) with a distinguishing probe on `state`,
// so a previously-shared output becomes unique — the "observability is a
// design choice" lever.
export function withProbe(sut, state, distinctOutput) {
  return { ...sut, outputs: { ...sut.outputs, [state]: distinctOutput } };
}

// Shortest input sequence from start reaching `target` (BFS), or null when no
// input sequence can drive the SUT there.
export function driveTo(sut, target) {
  if (target === sut.start) return [];
  const adj = new Map();
  for (const tr of sut.trans) {
    if (!adj.has(tr.from)) adj.set(tr.from, []);
    adj.get(tr.from).push({ on: tr.on, to: tr.to });
  }
  const seen = new Set([sut.start]);
  const queue = [{ state: sut.start, path: [] }];
  while (queue.length) {
    const { state, path } = queue.shift();
    for (const edge of adj.get(state) || []) {
      if (seen.has(edge.to)) continue;
      const nextPath = [...path, edge.on];
      if (edge.to === target) return nextPath;
      seen.add(edge.to);
      queue.push({ state: edge.to, path: nextPath });
    }
  }
  return null;
}

// ── state ────────────────────────────────────────────────────────────

const state = {
  mode: 'controllability',   // 'controllability' | 'observability'
  target: 'PASSED',          // selected target for controllability
  probed: false,             // observability probe on JAMMED
};

let root;

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

// The SUT actually shown: base, or probed variant when the probe is on.
function currentSut() {
  return state.probed ? withProbe(TURNSTILE_SUT, 'JAMMED', 'grind') : TURNSTILE_SUT;
}

// Fixed layout for the five states.
const POS = {
  LOCKED:   { x: 110, y: 90 },
  UNLOCKED: { x: 330, y: 90 },
  PASSED:   { x: 550, y: 90 },
  JAMMED:   { x: 220, y: 280 },
  MAINT:    { x: 460, y: 280 },
};
const R = 42;
const VB_W = 660, VB_H = 370;

function renderGraph() {
  const sut = currentSut();
  const reach = new Set(reachableStates(sut));
  const observable = new Set(observableStates(sut));
  const path = state.mode === 'controllability' ? driveTo(sut, state.target) : null;
  // States visited along the drive path (for highlighting).
  const onPath = new Set([sut.start]);
  if (path) {
    let cur = sut.start;
    for (const inp of path) {
      const tr = sut.trans.find((tt) => tt.from === cur && tt.on === inp);
      if (tr) { onPath.add(tr.to); cur = tr.to; }
    }
  }

  const arrowId = 'co-arrow';
  const defs = `<defs><marker id="${arrowId}" viewBox="0 0 8 6" refX="7" refY="3"
      markerWidth="8" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--app-text-muted, #6b7280)"/>
    </marker></defs>`;

  const edges = sut.trans.map((tr) => {
    const from = POS[tr.from], to = POS[tr.to];
    if (!from || !to) return '';
    if (tr.from === tr.to) {
      const mx = from.x, my = from.y - R - 18;
      return `<path d="M${from.x - 14},${from.y - R + 4} Q${mx - 34},${my - 26} ${from.x + 14},${from.y - R + 4}"
        fill="none" stroke="var(--app-text-muted, #6b7280)" stroke-width="1.5" marker-end="url(#${arrowId})"/>
        <text x="${mx}" y="${my - 10}" text-anchor="middle" font-size="12" fill="var(--app-text-muted, #6b7280)">${esc(tr.on)}</text>`;
    }
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len, uy = dy / len;
    const x1 = from.x + ux * R, y1 = from.y + uy * R;
    const x2 = to.x - ux * R, y2 = to.y - uy * R;
    const perpX = -uy * 16, perpY = ux * 16;
    const mx = (x1 + x2) / 2 + perpX, my = (y1 + y2) / 2 + perpY;
    return `<path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}"
      fill="none" stroke="var(--app-text-muted, #6b7280)" stroke-width="1.5" marker-end="url(#${arrowId})"/>
      <text x="${mx}" y="${my - 5}" text-anchor="middle" font-size="12" fill="var(--app-text-muted, #6b7280)">${esc(tr.on)}</text>`;
  }).join('');

  const nodes = sut.states.map((s) => {
    const p = POS[s];
    if (!p) return '';
    const isReachable = reach.has(s);
    const isStart = s === sut.start;
    const classes = ['co-node'];
    if (isReachable) classes.push('co-node--reachable');
    else classes.push('co-node--unreachable');
    if (state.mode === 'controllability' && onPath.has(s)) classes.push('co-node--onpath');
    if (state.mode === 'controllability' && s === state.target) classes.push('co-node--target');
    if (state.mode === 'observability') {
      classes.push(observable.has(s) ? 'co-node--observable' : 'co-node--shared');
    }
    const dash = isReachable ? '' : ' stroke-dasharray="6 4"';
    const out = state.mode === 'observability'
      ? `<text x="${p.x}" y="${p.y + 17}" text-anchor="middle" font-size="11" class="co-node-out">「${esc(sut.outputs[s])}」</text>`
      : '';
    const startMark = isStart
      ? `<text x="${p.x}" y="${p.y - R - 6}" text-anchor="middle" font-size="11" class="co-start-mark">▶ ${esc(t('tco.start'))}</text>`
      : '';
    return `<g class="${classes.join(' ')}" data-testid="co-node-${esc(s)}">
      ${startMark}
      <circle cx="${p.x}" cy="${p.y}" r="${R}"${dash}/>
      <text x="${p.x}" y="${p.y - 2}" text-anchor="middle" font-size="12" class="co-node-label">${esc(s)}</text>
      ${out}
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 ${VB_W} ${VB_H}" class="co-graph" data-testid="co-graph"
    xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"
    aria-label="${esc(t('tco.graph.aria'))}">
    ${defs}${edges}${nodes}
  </svg>`;
}

function renderModeToggle() {
  const modes = [
    { id: 'controllability', key: 'tco.mode.controllability' },
    { id: 'observability',   key: 'tco.mode.observability' },
  ];
  return `<div class="co-modes" role="tablist" data-testid="co-modes">
    ${modes.map((m) => `
      <button type="button" role="tab"
        class="co-mode-btn${state.mode === m.id ? ' co-mode-btn--active' : ''}"
        aria-selected="${state.mode === m.id ? 'true' : 'false'}"
        data-co-mode="${m.id}" data-testid="co-mode-${m.id}">${esc(t(m.key))}</button>`).join('')}
  </div>`;
}

function renderControllabilityPanel() {
  const sut = currentSut();
  const c = controllability(sut);
  const pct = Math.round(c.ratio * 100);
  const path = driveTo(sut, state.target);
  const reachable = c.reachable.includes(state.target);
  const unreachable = sut.states.filter((s) => !c.reachable.includes(s));

  const targets = sut.states.map((s) => `
    <button type="button"
      class="co-target-btn${state.target === s ? ' co-target-btn--active' : ''}"
      data-co-target="${esc(s)}" data-testid="co-target-${esc(s)}">${esc(s)}</button>`).join('');

  const driveResult = reachable
    ? `<p class="co-drive co-drive--ok" data-testid="co-drive-result">
        ${esc(t('tco.drive.reached', { target: state.target, steps: path.length }))}
        <span class="co-seq">${path.length ? path.map((p) => `<span class="co-seq-step">${esc(p)}</span>`).join('') : `<em>${esc(t('tco.drive.alreadyStart'))}</em>`}</span>
      </p>`
    : `<p class="co-drive co-drive--bad" data-testid="co-drive-result">
        ${esc(t('tco.drive.unreachable', { target: state.target }))}
      </p>`;

  return `<div class="co-panel" data-testid="co-panel-controllability">
    <p class="co-panel-lead">${esc(t('tco.controllability.lead'))}</p>
    <div class="co-target-picker" data-testid="co-target-picker">
      <span class="co-picker-label">${esc(t('tco.target.pick'))}</span>
      ${targets}
    </div>
    ${driveResult}
    <div class="co-readout" data-testid="co-controllability">
      <strong>${esc(t('tco.controllability.readout', { n: c.reachable.length, total: c.total }))}</strong>
      <span class="co-ratio">${pct}%</span>
      <p class="co-readout-note">${esc(t('tco.controllability.gap', { states: unreachable.join(', ') }))}</p>
    </div>
  </div>`;
}

function renderObservabilityPanel() {
  const sut = currentSut();
  const o = observability(sut);
  const pct = Math.round(o.ratio * 100);
  const observableSet = new Set(o.observable);
  const shared = sut.states.filter((s) => !observableSet.has(s));

  const rows = sut.states.map((s) => {
    const isObs = observableSet.has(s);
    return `<li class="co-out-row${isObs ? ' co-out-row--observable' : ' co-out-row--shared'}">
      <span class="co-out-state">${esc(s)}</span>
      <span class="co-out-arrow">→</span>
      <span class="co-out-value">「${esc(sut.outputs[s])}」</span>
      <span class="co-out-tag">${esc(isObs ? t('tco.obs.unique') : t('tco.obs.shared'))}</span>
    </li>`;
  }).join('');

  return `<div class="co-panel" data-testid="co-panel-observability">
    <p class="co-panel-lead">${esc(t('tco.observability.lead'))}</p>
    <ul class="co-out-list" data-testid="co-out-list">${rows}</ul>
    <label class="co-probe" data-testid="co-probe">
      <input type="checkbox" data-testid="co-probe-toggle" ${state.probed ? 'checked' : ''}>
      ${esc(t('tco.probe.label'))}
    </label>
    <div class="co-readout" data-testid="co-observability">
      <strong>${esc(t('tco.observability.readout', { n: o.observable.length, total: o.total }))}</strong>
      <span class="co-ratio">${pct}%</span>
      <p class="co-readout-note">${esc(t('tco.observability.gap', { states: shared.join(', ') }))}</p>
    </div>
  </div>`;
}

function render() {
  root.innerHTML = `
    <div class="co-wrap" data-testid="co-explorer">
      <h2 class="co-title">${esc(t('tco.title'))}</h2>
      <p class="co-desc">${esc(t('tco.desc'))}</p>
      ${renderModeToggle()}
      <div class="co-body">
        <div class="co-graph-wrap">${renderGraph()}</div>
        ${state.mode === 'controllability' ? renderControllabilityPanel() : renderObservabilityPanel()}
      </div>
    </div>`;
  bindEvents();
}

function bindEvents() {
  root.querySelectorAll('[data-co-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.coMode;
      render();
    });
  });
  root.querySelectorAll('[data-co-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.target = btn.dataset.coTarget;
      render();
    });
  });
  root.querySelector('[data-testid="co-probe-toggle"]')?.addEventListener('change', (e) => {
    state.probed = e.target.checked;
    render();
  });
}

export function createControllabilityObservabilityExplorer() {
  state.mode = 'controllability';
  state.target = 'PASSED';
  state.probed = false;

  root = document.createElement('div');
  onLocaleChange(() => render());
  render();
  return root;
}
