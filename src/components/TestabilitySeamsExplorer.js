import { t, onLocaleChange } from '../i18n/index.js';
import { SEAM_SNIPPET } from '../data/testabilityModels.js';

// Design-for-testability seams explorer.
//
// Takes one untestable `charge()` function and lets the learner apply, one at a
// time, the four Feathers seams that make each pinned dependency substitutable.
// Applying a fix rewrites the code fragment to its seam version, raises the
// testability meter, unlocks a concrete "what a test can now do" capability, and
// names the seam type + the test double it enables — cross-linking the existing
// test-doubles explorer rather than re-teaching it.

// ── capability i18n keys unlocked by each fix (id → key) ──────────────
// Kept next to the engine so testabilityOf stays a single source of truth and
// the unit test can assert the keys without loading i18n.
const CAPABILITY_KEY = {
  global: 'tsm.cap.global',
  newdep: 'tsm.cap.newdep',
  clock: 'tsm.cap.clock',
  random: 'tsm.cap.random',
};

// ── pure engine (exported for tests) ─────────────────────────────────
//
// testabilityOf(appliedIds) → { score, applied, remaining, capabilities }
//   • applied      — the anti-pattern ids fixed, deduped, in fixture order
//   • remaining    — the ids not yet fixed, in fixture order
//   • score        — applied.length / total anti-patterns (0..1)
//   • capabilities — the capability i18n key unlocked by each applied fix,
//                    in fixture order
// Deterministic; never mutates its input.
export function testabilityOf(appliedIds = []) {
  const wanted = new Set(appliedIds);
  const order = SEAM_SNIPPET.antipatterns.map((ap) => ap.id);
  const applied = order.filter((id) => wanted.has(id));
  const remaining = order.filter((id) => !wanted.has(id));
  const capabilities = applied.map((id) => CAPABILITY_KEY[id]);
  return {
    score: applied.length / SEAM_SNIPPET.antipatterns.length,
    applied,
    remaining,
    capabilities,
  };
}

// ── code fragments (before/after per anti-pattern line) ───────────────
// The shared frame of the function plus, for each anti-pattern, the untestable
// line and its seam-applied replacement. Rendered read-only.
const CODE_HEAD_BEFORE = 'function charge(amount) {';
const CODE_HEAD_AFTER = 'function charge(deps, amount) {';
const CODE_TAIL = '  return gw.charge(cfg.merchant, amount, at, id);';
const CODE_FRAGMENTS = {
  global: { before: '  const cfg = Config.instance();', after: '  const cfg = deps.config;' },
  newdep: { before: '  const gw = new PaymentGateway();', after: '  const gw = deps.gateway;' },
  clock: { before: '  const at = Date.now();', after: '  const at = deps.clock.now();' },
  random: { before: '  const id = Math.random().toString(36);', after: '  const id = deps.rng.id();' },
};

// ── state ────────────────────────────────────────────────────────────

const state = {
  applied: new Set(), // ids of anti-patterns whose fix has been applied
};

let root;

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

// ── rendering ─────────────────────────────────────────────────────────

function renderCode() {
  const headApplied = SEAM_SNIPPET.antipatterns.every((ap) => state.applied.has(ap.id));
  const head = headApplied ? CODE_HEAD_AFTER : CODE_HEAD_BEFORE;

  const lines = SEAM_SNIPPET.antipatterns.map((ap) => {
    const on = state.applied.has(ap.id);
    const frag = CODE_FRAGMENTS[ap.id];
    const code = on ? frag.after : frag.before;
    const chipKey = on ? 'tsm.status.applied' : `tsm.ap.${ap.id}.chip`;
    const btnKey = on ? 'tsm.toggle.revert' : 'tsm.toggle.fix';
    return `<div class="tsm-code-line${on ? ' tsm-code-line--fixed' : ' tsm-code-line--smell'}">
      <code class="tsm-code-text">${esc(code)}</code>
      <span class="tsm-chip${on ? ' tsm-chip--fixed' : ''}">${esc(t(chipKey))}</span>
      <button type="button" class="tsm-fix-btn${on ? ' tsm-fix-btn--on' : ''}"
        data-tsm-fix="${esc(ap.id)}" data-testid="seams-fix-${esc(ap.id)}"
        aria-pressed="${on ? 'true' : 'false'}">${esc(t(btnKey))}</button>
    </div>`;
  }).join('');

  return `<div class="tsm-code" data-testid="seams-code">
    <div class="tsm-code-line tsm-code-line--frame"><code class="tsm-code-text">${esc(head)}</code></div>
    ${lines}
    <div class="tsm-code-line tsm-code-line--frame"><code class="tsm-code-text">${esc(CODE_TAIL)}</code></div>
    <div class="tsm-code-line tsm-code-line--frame"><code class="tsm-code-text">}</code></div>
  </div>`;
}

function renderMeter(model) {
  const pct = Math.round(model.score * 100);
  return `<div class="tsm-meter" data-testid="seams-meter">
    <div class="tsm-meter-head">
      <span class="tsm-meter-label">${esc(t('tsm.meter.label'))}</span>
      <span class="tsm-score" data-testid="seams-score">${pct}%</span>
    </div>
    <div class="tsm-meter-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
      <div class="tsm-meter-fill" style="width:${pct}%"></div>
    </div>
    <p class="tsm-meter-caption">${esc(t('tsm.meter.caption', { n: model.applied.length, total: SEAM_SNIPPET.antipatterns.length }))}</p>
  </div>`;
}

function renderCapabilities(model) {
  const items = model.capabilities.length
    ? model.capabilities.map((key) => `<li class="tsm-cap-item">${esc(t(key))}</li>`).join('')
    : `<li class="tsm-cap-empty">${esc(t('tsm.capabilities.empty'))}</li>`;
  return `<div class="tsm-cap" data-testid="seams-capabilities">
    <h3 class="tsm-cap-title">${esc(t('tsm.capabilities.title'))}</h3>
    <ul class="tsm-cap-list">${items}</ul>
  </div>`;
}

function renderCrosswalk() {
  const rows = SEAM_SNIPPET.antipatterns.map((ap) => {
    const on = state.applied.has(ap.id);
    return `<tr class="tsm-xrow${on ? ' tsm-xrow--applied' : ''}" data-testid="seams-xrow-${esc(ap.id)}">
      <td class="tsm-x-ap">${esc(t(`tsm.ap.${ap.id}.name`))}</td>
      <td class="tsm-x-seam">${esc(t(`tsm.seam.${ap.seam}`))}</td>
      <td class="tsm-x-double">${esc(t(`tsm.double.${ap.double}`))}</td>
      <td class="tsm-x-status">${esc(on ? t('tsm.status.applied') : t('tsm.status.before'))}</td>
    </tr>`;
  }).join('');
  return `<div class="tsm-xwalk" data-testid="seams-crosswalk">
    <h3 class="tsm-xwalk-title">${esc(t('tsm.crosswalk.title'))}</h3>
    <table class="tsm-xtable">
      <thead><tr>
        <th>${esc(t('tsm.crosswalk.antipattern'))}</th>
        <th>${esc(t('tsm.crosswalk.seam'))}</th>
        <th>${esc(t('tsm.crosswalk.double'))}</th>
        <th>${esc(t('tsm.crosswalk.status'))}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <a class="tsm-doubles-link" href="?explorer=test-doubles" data-testid="seams-doubles-link">
      ${esc(t('tsm.doubles.link'))}
    </a>
  </div>`;
}

function render() {
  const model = testabilityOf([...state.applied]);
  const done = model.applied.length === SEAM_SNIPPET.antipatterns.length;
  root.innerHTML = `
    <div class="tsm-wrap" data-testid="seams-explorer">
      <h2 class="tsm-title">${esc(t('tsm.title'))}</h2>
      <p class="tsm-desc">${esc(t('tsm.desc'))}</p>
      <div class="tsm-body">
        <div class="tsm-left">
          <h3 class="tsm-col-title">${esc(t('tsm.code.title'))}</h3>
          ${renderCode()}
        </div>
        <div class="tsm-right">
          ${renderMeter(model)}
          ${renderCapabilities(model)}
          ${renderCrosswalk()}
        </div>
      </div>
      ${done ? `<p class="tsm-capstone" data-testid="seams-capstone">${esc(t('tsm.capstone'))}</p>` : ''}
    </div>`;
  bindEvents();
}

function bindEvents() {
  root.querySelectorAll('[data-tsm-fix]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.tsmFix;
      if (state.applied.has(id)) state.applied.delete(id);
      else state.applied.add(id);
      render();
    });
  });
}

export function createTestabilitySeamsExplorer() {
  state.applied = new Set();

  root = document.createElement('div');
  onLocaleChange(() => render());
  render();
  return root;
}
