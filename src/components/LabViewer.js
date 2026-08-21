// Lab overlay: bilingual statement, sample I/O, repo link (when present)
// and an always-disabled "Practice on judge (coming soon)" button — no
// judge integration exists yet by design.
import { t as tApp, getLocale } from '../i18n/index.js';
import { LAB_RENDERED } from '../data/labRendered.js';

let overlay = null, body = null, lang = 'en', state = null;

function t(k, fb) { const v = tApp(k); return v !== k ? v : (fb || k); }
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function has(unitId) { return Boolean(LAB_RENDERED[unitId]?.length); }

function ensureRefs() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.id = 'lab-viewer';
  overlay.className = 'quizviewer-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="quizviewer-panel labviewer-panel" role="dialog" aria-modal="true" tabindex="-1">
      <header class="quizviewer-head">
        <h2>${esc(t('btn.lab', 'Lab'))}</h2>
        <div class="quizviewer-head-tools">
          <button type="button" id="lab-lang-toggle" class="btn secondary" data-testid="lab-lang-toggle"></button>
          <button type="button" class="btn secondary" data-lab-close data-testid="lab-close" aria-label="${esc(t('common.close', 'Close'))}">×</button>
        </div>
      </header>
      <div id="lab-viewer-body"></div>
    </div>`;
  document.body.appendChild(overlay);
  body = overlay.querySelector('#lab-viewer-body');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest?.('[data-lab-close]')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (overlay && !overlay.hidden && e.key === 'Escape') close();
  });
  overlay.querySelector('#lab-lang-toggle').addEventListener('click', () => {
    lang = lang === 'zh' ? 'en' : 'zh';
    render();
  });
}

function sampleBlock(s, i) {
  return `<div class="lab-sample">
    <div class="lab-sample-col"><strong>#${i + 1} in</strong><pre><code>${esc(s.in)}</code></pre></div>
    <div class="lab-sample-col"><strong>out</strong><pre><code>${esc(s.out)}</code></pre></div>
  </div>`;
}

function render() {
  if (!state) return;
  const lab = state.lab;
  const title = lang === 'zh' ? lab.titleZh : lab.titleEn;
  const stmt = lab.statementHtml[lang] || lab.statementHtml.en;
  const meta = [];
  if (lab.difficulty) meta.push(t('lab.difficulty', 'Difficulty') + ' ' + '★'.repeat(lab.difficulty));
  if (lab.week) meta.push(t('lab.week', 'Week') + ' ' + lab.week);
  const repoBtn = lab.repoUrl
    ? `<a class="btn primary" data-testid="lab-open-repo" href="${lab.repoUrl}" target="_blank" rel="noopener">${t('lab.openRepo', 'Open practice repo')} ↗</a>`
    : '';
  const judgeBtn = `<button type="button" class="btn secondary" data-testid="lab-judge" aria-disabled="true" disabled>${t('lab.judgeSoon', 'Practice on judge (coming soon)')}</button>`;
  body.innerHTML =
    `<div class="lab-head"><h3>${esc(title)}</h3><div class="lab-meta">${meta.map(esc).join(' · ')}</div></div>
     <div class="lab-statement" data-testid="lab-statement">${stmt}</div>
     <h4>${t('lab.samples', 'Samples')}</h4>
     <div class="lab-samples" data-testid="lab-samples">${lab.samples.map(sampleBlock).join('')}</div>
     <div class="lab-actions">${repoBtn} ${judgeBtn}</div>`;
  overlay.querySelector('#lab-lang-toggle').textContent = lang === 'zh' ? 'EN' : '中';
}

function open(unitId) {
  const arr = LAB_RENDERED[unitId];
  if (!arr?.length) return;
  ensureRefs();
  lang = getLocale() === 'zh' ? 'zh' : 'en';
  state = { unitId, lab: arr[0] }; // pilot: first problem per unit
  render();
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  overlay.querySelector('.quizviewer-panel').focus();
}

function close() {
  if (overlay) { overlay.hidden = true; document.body.style.overflow = ''; }
  state = null;
}

export const LabViewer = { open, close, has };
