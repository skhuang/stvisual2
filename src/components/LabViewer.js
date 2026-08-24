// Lab overlay: bilingual statement, sample I/O, repo link (when present),
// and — for a lab wired to a dsjudge METRIC problem — a "Submit tests" upload
// that sends the student's own pytest suite to the judge and shows the measured
// result. Labs without `judgeProblemId` keep the disabled "coming soon" button.
import { t as tApp, getLocale } from '../i18n/index.js';
import { LAB_RENDERED } from '../data/labRendered.js';
import { QuizAttempts } from '../utils/quizAttempts.js';

let overlay = null, body = null, lang = 'en', state = null;

// Recent judge attempts reuse the quiz attempt log (same cap, same corruption
// tolerance) under a lab-scoped id, so there is one storage helper, not two.
const attemptId = (slug) => 'lab:' + slug;

const POLL_INTERVAL_MS = 1500;
const POLL_TRIES = 120;

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

// --------------------------------------------------------------------------
// Judge submission (metric labs)
// --------------------------------------------------------------------------
function judgeBaseOf(lab) { return String(lab.judgeBase || '').replace(/\/$/, ''); }

function setJudgeStatus(html, cls) {
  const el = overlay?.querySelector('#lab-judge-result');
  if (el) el.innerHTML = `<div class="lab-judge-status ${cls || ''}">${html}</div>`;
}

function renderVerdict(s) {
  // score/verdict + the judge's SAFE message (for a metric lab, the coverage
  // aggregate). Everything is escaped: it is server text, not markup.
  const v = esc(s.verdict || '?');
  const msg = s.message
    ? `<pre class="lab-judge-msg" data-testid="lab-judge-message">${esc(s.message)}</pre>` : '';
  return `<strong class="v-${v}" data-testid="lab-judge-verdict">${v} ${esc(s.score)}/${esc(s.max_score)}</strong>${msg}`;
}

function recordAttempt(lab, s) {
  QuizAttempts.record(localStorage, attemptId(lab.slug), {
    id: s.submission_id, verdict: s.verdict, score: s.score,
    max_score: s.max_score, at: Date.now(),
  });
}

async function pollSubmission(lab, sid) {
  const base = judgeBaseOf(lab);
  for (let i = 0; i < POLL_TRIES; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    let r;
    try {
      r = await fetch(`${base}/bank/submission/${encodeURIComponent(sid)}`,
        { headers: { Accept: 'application/json' }, credentials: 'include' });
    } catch { continue; }          // transient: keep polling, don't fail the run
    if (!r.ok) continue;
    const s = await r.json();
    if (s.status === 'done') {
      recordAttempt(lab, s);
      setJudgeStatus(renderVerdict(s), 'done');
      return;
    }
  }
  setJudgeStatus(esc(t('lab.judgeSlow', 'Still grading — check back shortly.')), 'pending');
}

async function submitTests(lab, file) {
  const base = judgeBaseOf(lab);
  const fd = new FormData();
  fd.append('file', file, file.name);
  let r;
  try {
    r = await fetch(`${base}/bank/${encodeURIComponent(lab.judgeProblemId)}/submit`,
      { method: 'POST', body: fd, credentials: 'include' });
  } catch {
    setJudgeStatus(esc(t('lab.judgeOffline', 'Could not reach the judge.')), 'error');
    return;
  }
  if (!r.ok) {
    const why = r.status === 429
      ? t('lab.judgeRateLimited', 'Too many submissions — slow down.')
      : t('lab.judgeRejected', 'The judge rejected this submission.');
    setJudgeStatus(`${esc(why)} (${esc(r.status)})`, 'error');
    return;
  }
  const { submission_id: sid } = await r.json();
  setJudgeStatus(esc(t('lab.judgeWaiting', 'Grading…')) + ` #${esc(sid)}`, 'pending');
  await pollSubmission(lab, sid);
}

function judgePanel(lab) {
  if (!lab.judgeProblemId) {
    return `<button type="button" class="btn secondary" data-testid="lab-judge" aria-disabled="true" disabled>${t('lab.judgeSoon', 'Practice on judge (coming soon)')}</button>`;
  }
  return `<div class="lab-judge" data-testid="lab-judge-panel">
      <input type="file" accept=".py" data-testid="lab-test-file" id="lab-test-file"
             aria-label="${esc(t('lab.testFile', 'Your pytest file'))}">
      <button type="button" class="btn primary" data-testid="lab-submit-tests">${esc(t('lab.submitTests', 'Submit tests'))}</button>
      <div id="lab-judge-result" data-testid="lab-judge-result"></div>
    </div>`;
}

function wireJudge(lab) {
  const btn = overlay.querySelector('[data-testid="lab-submit-tests"]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const input = overlay.querySelector('[data-testid="lab-test-file"]');
    const file = input?.files?.[0];
    if (!file) {
      setJudgeStatus(esc(t('lab.judgePickFile', 'Choose a test_*.py file first.')), 'error');
      return;
    }
    btn.disabled = true;
    setJudgeStatus(esc(t('lab.judgeSending', 'Uploading…')), 'pending');
    try {
      await submitTests(lab, file);
    } finally {
      btn.disabled = false;
    }
  });
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
  body.innerHTML =
    `<div class="lab-head"><h3>${esc(title)}</h3><div class="lab-meta">${meta.map(esc).join(' · ')}</div></div>
     <div class="lab-statement" data-testid="lab-statement">${stmt}</div>
     <h4>${t('lab.samples', 'Samples')}</h4>
     <div class="lab-samples" data-testid="lab-samples">${lab.samples.map(sampleBlock).join('')}</div>
     <div class="lab-actions">${repoBtn} ${judgePanel(lab)}</div>`;
  overlay.querySelector('#lab-lang-toggle').textContent = lang === 'zh' ? 'EN' : '中';
  wireJudge(lab);
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
