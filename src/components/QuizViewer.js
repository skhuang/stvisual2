// Quiz overlay: practice mode (check-per-question) and test mode
// (submit-at-end), recent-attempt resume/review. Ported from dsvisual
// js/quiz.js; adapted to ESM + stvisual i18n + lazily created overlay.
import { t as tApp, getLocale } from '../i18n/index.js';
import { QUIZ_RENDERED } from '../data/quizRendered.js';
import { gradeQuestion } from '../utils/quizGrade.js';
import { QuizAttempts } from '../utils/quizAttempts.js';
import { pickDeck, mixSeed, difficultyReady } from '../utils/quizDeck.js';

let overlay = null, body = null, titleEl = null, langToggle = null, lastFocus = null;
let st = null;

function t(k, fb) { const v = tApp(k); return v !== k ? v : (fb || k); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function deckFor(id, lg, difficulty, seed) { return pickDeck(QUIZ_RENDERED, id, lg, difficulty, seed); }
function has(id) {
  const t = QUIZ_RENDERED[id];
  if (!t) return false;
  return ['en', 'zh'].some((lg) => t[lg] && Object.values(t[lg]).some((b) => b && b.length));
}
function modeLabel(m) { return m === 'test' ? t('quiz.test', 'Test') : t('quiz.practice', 'Practice'); }
function fmtTime(ms) {
  try {
    const d = new Date(ms);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
function isDone(a) { return a.status === 'completed' || (a.status == null && a.finishedAt); }

function ensureRefs() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.id = 'quiz-viewer';
  overlay.className = 'quizviewer-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="quizviewer-panel" role="dialog" aria-modal="true" aria-labelledby="quiz-viewer-title" tabindex="-1">
      <header class="quizviewer-head">
        <h2 id="quiz-viewer-title"></h2>
        <div class="quizviewer-head-tools">
          <button type="button" id="quiz-lang-toggle" class="btn secondary" data-testid="quiz-lang-toggle"></button>
          <button type="button" class="btn secondary" data-quiz-close data-testid="quiz-close" aria-label="${esc(t('common.close', 'Close'))}">×</button>
        </div>
      </header>
      <div id="quiz-viewer-body" class="quizviewer-body"></div>
    </div>`;
  document.body.appendChild(overlay);
  body = overlay.querySelector('#quiz-viewer-body');
  titleEl = overlay.querySelector('#quiz-viewer-title');
  langToggle = overlay.querySelector('#quiz-lang-toggle');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest?.('[data-quiz-close]')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (overlay && !overlay.hidden && e.key === 'Escape') close();
  });
  body.addEventListener('click', onBodyClick);
  body.addEventListener('change', (e) => {
    if (!st || st.phase !== 'start') return;
    if (e.target?.name === 'qdiff') { st.difficulty = e.target.value; st.seed = null; renderStart(); }
  });
  langToggle.addEventListener('click', () => {
    if (!st) return;
    st.lang = st.lang === 'zh' ? 'en' : 'zh';
    const qs = deckFor(st.quizId, st.lang, st.difficulty, st.seed);
    if (qs.length) st.questions = qs;
    langToggle.textContent = st.lang === 'zh' ? '中' : 'EN';
    rerender();
  });
}

function open(quizId) {
  ensureRefs();
  const lg = getLocale() === 'zh' ? 'zh' : 'en';
  if (!has(quizId)) return;
  lastFocus = document.activeElement;
  st = { quizId, id: null, status: null, lang: lg, mode: 'practice', difficulty: 'easy', seed: null,
    questions: [], idx: 0, given: [], checked: [],
    startedAt: Date.now(), phase: 'start', readonly: false, result: null };
  titleEl.textContent = t('btn.quiz', 'Quiz');
  langToggle.textContent = st.lang === 'zh' ? '中' : 'EN';
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  rerender();
  overlay.querySelector('.quizviewer-panel').focus();
}

function close() {
  if (!overlay) return;
  if (st && st.phase === 'quiz' && st.status === 'in-progress') autosave();
  overlay.hidden = true;
  document.body.style.overflow = '';
  st = null;
  if (lastFocus?.focus) lastFocus.focus();
}

function gradeAll() {
  let correct = 0;
  const per = st.questions.map((q, idx) => {
    const r = gradeQuestion(q, st.given[idx]);
    if (r.isCorrect) correct++;
    return { qIndex: idx, type: q.type, isCorrect: r.isCorrect };
  });
  return { correct, per };
}

function autosave() {
  if (!st || !st.id) return;
  const g = gradeAll();
  QuizAttempts.upsert(localStorage, st.quizId, {
    id: st.id, quizId: st.quizId, mode: st.mode, lang: st.lang, status: 'in-progress',
    difficulty: st.difficulty, seed: st.seed,
    idx: st.idx, given: st.given, checked: st.checked, startedAt: st.startedAt,
    finishedAt: null, total: st.questions.length, correct: g.correct, perQuestion: g.per,
  }, st.difficulty);
}

function rerender() {
  if (!st) return;
  if (st.phase === 'start') renderStart();
  else if (st.phase === 'summary') renderSummary();
  else renderQuestion();
}

function recentRow(a) {
  const done = isDone(a);
  const deck = deckFor(st.quizId, a.lang, a.difficulty ?? st.difficulty, a.seed);
  const stale = !done && (!a.given || a.given.length !== deck.length);
  const meta = done ? `${a.correct}/${a.total}` : `${t('quiz.question', 'Q')} ${(a.idx || 0) + 1}/${a.total}`;
  const badge = done ? t('quiz.review', 'Review') : (stale ? t('quiz.inprogress', 'In progress') : t('quiz.resume', 'Resume'));
  const inner = `<span class="qr-mode">${esc(modeLabel(a.mode))}</span> <span class="qr-score">${esc(meta)}</span> <span class="qr-time">${esc(fmtTime(a.finishedAt || a.startedAt))}</span> <span class="qr-act">${esc(badge)}</span>`;
  if (done) return `<li><button type="button" class="quiz-recent-row" data-act="review" data-id="${a.id}" data-testid="quiz-recent-review">${inner}</button></li>`;
  if (stale) return `<li><span class="quiz-recent-row stale">${inner}</span></li>`;
  return `<li><button type="button" class="quiz-recent-row" data-act="resume" data-id="${a.id}" data-testid="quiz-recent-resume">${inner}</button></li>`;
}

function bucketCount(difficulty) {
  const seed = difficulty === 'mixed' ? (st.seed ?? 0) : undefined;
  return deckFor(st.quizId, st.lang, difficulty, seed).length;
}

function renderStart() {
  const diffs = ['easy', 'medium', 'hard', 'mixed'];
  const recent = QuizAttempts.recentFor(localStorage, st.quizId, 10, st.difficulty);
  const legacy = QuizAttempts.recentFor(localStorage, st.quizId, 10); // old flat key
  const count = bucketCount(st.difficulty);
  const ready = difficultyReady(QUIZ_RENDERED, st.quizId, st.lang, st.difficulty, st.difficulty === 'mixed' ? 0 : undefined);
  body.innerHTML =
    `<div class="quiz-start">
      <div class="quiz-diff" role="radiogroup" aria-label="${esc(t('quiz.difficulty', 'Difficulty'))}" data-testid="quiz-diff">
        ${diffs.map((d) => `<label class="quiz-diff-opt"><input type="radio" name="qdiff" value="${d}"${st.difficulty === d ? ' checked' : ''}> ${esc(t('quiz.diff.' + d, d))}</label>`).join('')}
      </div>
      <p class="quiz-count">${count} ${t('quiz.questions', 'questions')}</p>
      <div class="quiz-mode" role="radiogroup" aria-label="${esc(t('quiz.mode', 'Mode'))}">
        <label class="quiz-mode-opt"><input type="radio" name="qmode" value="practice"${st.mode === 'practice' ? ' checked' : ''}> ${t('quiz.practice', 'Practice')}</label>
        <label class="quiz-mode-opt"><input type="radio" name="qmode" value="test"${st.mode === 'test' ? ' checked' : ''}> ${t('quiz.test', 'Test')}</label>
      </div>
      ${ready
        ? `<button type="button" class="btn primary" data-act="begin" data-testid="quiz-begin">${t('quiz.begin', 'Begin')}</button>`
        : `<p class="quiz-comingsoon" data-testid="quiz-comingsoon">${t('quiz.comingSoon', 'More questions coming soon for this set.')}</p>`}
      <div class="quiz-recent" data-testid="quiz-recent"><h4>${t('quiz.recent', 'Recent attempts')}</h4>
        ${recent.length ? `<ul>${recent.map(recentRow).join('')}</ul>` : `<p class="quiz-recent-empty">${t('quiz.recent.empty', 'No attempts yet')}</p>`}
      </div>
      ${legacy.length ? `<div class="quiz-recent quiz-recent-legacy"><h4>${t('quiz.unclassified', 'Earlier attempts')}</h4><ul>${legacy.map(recentRow).join('')}</ul></div>` : ''}
    </div>`;
}

function renderAnswers(q, given, disabled, res) {
  if (q.type === 'shortanswer') {
    return `<input type="text" class="quiz-sa" data-testid="quiz-sa" value="${esc(given || '')}"${disabled ? ' disabled' : ''}>`;
  }
  const multi = (q.type === 'multichoice' && !q.single);
  return q.answers.map((a, idx) => {
    const sel = multi ? (Array.isArray(given) && given.includes(idx)) : (given === idx);
    let cls = 'quiz-ans';
    if (res) { if (a.fraction > 0) cls += ' correct'; if (sel && a.fraction <= 0) cls += ' wrong'; }
    return `<label class="${cls}"><input type="${multi ? 'checkbox' : 'radio'}" name="qa" value="${idx}"${sel ? ' checked' : ''}${disabled ? ' disabled' : ''}> <span>${a.text}</span></label>`;
  }).join('');
}

function footButtons(i, checked) {
  const last = i === st.questions.length - 1;
  if (st.mode === 'practice') {
    if (!checked) return `<button type="button" class="btn primary" data-act="check" data-testid="quiz-check">${t('quiz.check', 'Check')}</button>`;
    return `<button type="button" class="btn primary" data-act="next" data-testid="quiz-next">${last ? t('quiz.finish', 'Finish') : t('quiz.next', 'Next')}</button>`;
  }
  let h = '';
  if (i > 0) h += `<button type="button" class="btn secondary" data-act="prev">${t('quiz.prev', 'Previous')}</button>`;
  if (!last) h += `<button type="button" class="btn primary" data-act="next">${t('quiz.next', 'Next')}</button>`;
  else h += `<button type="button" class="btn primary" data-act="submit" data-testid="quiz-submit">${t('quiz.submit', 'Submit')}</button>`;
  return h;
}

function renderQuestion() {
  const i = st.idx, q = st.questions[i], checked = st.checked[i], given = st.given[i];
  const res = (checked && st.mode === 'practice') ? gradeQuestion(q, given) : null;
  let html = `<div class="quiz-q" data-testid="quiz-q">
    <div class="quiz-q-head">${t('quiz.question', 'Question')} ${i + 1} / ${st.questions.length}</div>
    <div class="quiz-q-text">${q.text}</div>
    <div class="quiz-answers">${renderAnswers(q, given, checked && st.mode === 'practice', res)}</div>`;
  if (res) {
    html += `<div class="quiz-feedback ${res.isCorrect ? 'ok' : 'bad'}" data-testid="quiz-feedback">
      <strong>${res.isCorrect ? t('quiz.correct', 'Correct') : t('quiz.incorrect', 'Incorrect')}</strong>
      ${res.feedback ? `<div class="quiz-fb-text">${res.feedback}</div>` : ''}</div>`;
  }
  html += `<div class="quiz-foot">${footButtons(i, checked)}</div></div>`;
  body.innerHTML = html;
}

function collectAnswer() {
  const q = st.questions[st.idx];
  if (q.type === 'shortanswer') {
    const el = body.querySelector('.quiz-sa');
    st.given[st.idx] = el ? el.value : '';
    return;
  }
  const multi = (q.type === 'multichoice' && !q.single);
  const inputs = [...body.querySelectorAll('input[name="qa"]')];
  if (multi) st.given[st.idx] = inputs.filter((c) => c.checked).map((c) => +c.value);
  else {
    const sel = inputs.find((c) => c.checked);
    st.given[st.idx] = sel ? +sel.value : null;
  }
}

function finish() {
  const g = gradeAll();
  st.result = { total: st.questions.length, correct: g.correct };
  st.phase = 'summary';
  QuizAttempts.upsert(localStorage, st.quizId, {
    id: st.id || Date.now(), quizId: st.quizId, mode: st.mode, lang: st.lang,
    status: 'completed', difficulty: st.difficulty, seed: st.seed,
    idx: st.idx, given: st.given, checked: st.checked,
    startedAt: st.startedAt, finishedAt: Date.now(),
    total: st.questions.length, correct: g.correct, perQuestion: g.per,
  }, st.difficulty);
  renderSummary();
}

function renderSummary() {
  const r = st.result;
  let html = `<div class="quiz-summary" data-testid="quiz-summary">
    <h3>${t('quiz.score', 'Score')}: <span data-testid="quiz-score">${r.correct} / ${r.total}</span></h3>`;
  if (st.mode === 'test' && st.given.length === st.questions.length) {
    html += `<ol class="quiz-review">${st.questions.map((q, idx) => {
      const res = gradeQuestion(q, st.given[idx]);
      return `<li class="${res.isCorrect ? 'ok' : 'bad'}"><div class="quiz-q-text">${q.text}</div>
        <div class="quiz-review-line">${res.isCorrect ? t('quiz.correct', 'Correct') : t('quiz.incorrect', 'Incorrect')}</div>
        ${q.generalFeedback ? `<div class="quiz-fb-general">${q.generalFeedback}</div>` : ''}</li>`;
    }).join('')}</ol>`;
  }
  html += `<div class="quiz-foot">
    <button type="button" class="btn secondary" data-act="home">${t('quiz.home', 'Back')}</button>
    <button type="button" class="btn primary" data-act="retry" data-testid="quiz-retry">${t('quiz.retry', 'Retry')}</button>
  </div></div>`;
  body.innerHTML = html;
}

function resume(a) {
  const qs = deckFor(st.quizId, a.lang, a.difficulty ?? st.difficulty, a.seed);
  const given = a.given || [];
  if (!qs.length || given.length !== qs.length) return; // stale — ignore
  st = { quizId: st.quizId, id: a.id, status: 'in-progress', lang: a.lang, mode: a.mode,
    difficulty: a.difficulty, seed: a.seed,
    questions: qs, idx: Math.min(a.idx || 0, qs.length - 1), given: [...given],
    checked: [...(a.checked || new Array(qs.length).fill(false))],
    startedAt: a.startedAt || Date.now(), phase: 'quiz', readonly: false, result: null };
  langToggle.textContent = st.lang === 'zh' ? '中' : 'EN';
  renderQuestion();
}

function review(a) {
  const qs = deckFor(st.quizId, a.lang, a.difficulty ?? st.difficulty, a.seed);
  st = { quizId: st.quizId, id: a.id, status: 'completed', lang: a.lang, mode: a.mode,
    difficulty: a.difficulty, seed: a.seed,
    questions: qs, idx: 0, given: [...(a.given || [])], checked: [...(a.checked || [])],
    startedAt: a.startedAt, phase: 'summary', readonly: true,
    result: { total: a.total, correct: a.correct } };
  langToggle.textContent = st.lang === 'zh' ? '中' : 'EN';
  renderSummary();
}

function findAttempt(id) {
  const scoped = QuizAttempts.recentFor(localStorage, st.quizId, 10, st.difficulty);
  const legacy = QuizAttempts.recentFor(localStorage, st.quizId, 10);
  return [...scoped, ...legacy].find((a) => String(a.id) === String(id)) ?? null;
}

function onBodyClick(e) {
  const b = e.target.closest?.('[data-act]');
  if (!b || !st) return;
  const act = b.getAttribute('data-act');
  if (act === 'resume') { const a = findAttempt(b.getAttribute('data-id')); if (a) resume(a); return; }
  if (act === 'review') { const a = findAttempt(b.getAttribute('data-id')); if (a) review(a); return; }
  if (act === 'begin') {
    const m = body.querySelector('input[name="qmode"]:checked');
    const d = body.querySelector('input[name="qdiff"]:checked');
    st.mode = m ? m.value : 'practice';
    st.difficulty = d ? d.value : 'easy';
    st.seed = st.difficulty === 'mixed' ? mixSeed() : null;
    st.questions = deckFor(st.quizId, st.lang, st.difficulty, st.seed);
    if (!st.questions.length) { renderStart(); return; }
    st.phase = 'quiz'; st.idx = 0;
    st.given = new Array(st.questions.length).fill(null);
    st.checked = new Array(st.questions.length).fill(false);
    st.startedAt = Date.now(); st.id = Date.now(); st.status = 'in-progress';
    renderQuestion(); autosave(); return;
  }
  if (act === 'check') { collectAnswer(); st.checked[st.idx] = true; renderQuestion(); autosave(); return; }
  if (act === 'prev') { collectAnswer(); st.idx = Math.max(0, st.idx - 1); renderQuestion(); autosave(); return; }
  if (act === 'next') {
    collectAnswer();
    if (st.idx < st.questions.length - 1) { st.idx++; renderQuestion(); autosave(); }
    else finish();
    return;
  }
  if (act === 'submit') { collectAnswer(); finish(); return; }
  if (act === 'retry' || act === 'home') { open(st.quizId); }
}

export const QuizViewer = { open, close, has };
