# Quiz Difficulty Banks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the quiz subsystem so every topic bank is split into easy/medium/hard categories (15 questions each) plus a runtime-sampled 混和 category, authored/exported as Moodle XML, usable in both practice and test modes.

**Architecture:** Difficulty is encoded with native Moodle `<question type="category">` markers whose path ends in `easy|medium|hard`. `build-quiz.mjs` groups questions by marker into `{id:{lang:{easy,medium,hard}}}`. The viewer gains a difficulty selector; 混和 is synthesized at runtime by seeded index-sampling (5/5/5) from the three authored buckets. Rollout is progressive: the build tolerates partially-authored topics by default and enforces completeness only under `--strict`.

**Tech Stack:** Vanilla ES modules, Vite, Vitest (jsdom), Playwright (Chromium), fast-xml-parser, Moodle XML.

**Spec:** `docs/superpowers/specs/2026-08-23-quiz-difficulty-banks-design.md`

## Global Constraints

- Difficulty tokens in the category path are canonical English: `easy`, `medium`, `hard` (identical in en and zh files). `mixed` is UI-only, never stored.
- Each authored bucket holds 15 questions; 混和 samples 5 easy + 5 medium + 5 hard = 15.
- Practice and test are modes over the same 15 questions per category (no separate pools).
- Generated files are committed and never hand-edited: `src/data/quizRendered.js` (built by `scripts/build-quiz.mjs`). Source of truth is `quizzes/{en,zh}/*.xml`.
- `npm install` requires `--legacy-peer-deps`. Full unit suite must stay green (`npm run test:run`).
- Running `inject-env` locally blanks `src/config/cloudConfig.js`; run `git checkout -- src/config/cloudConfig.js` before committing if you invoke `pages:build`.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Do not push/merge/deploy without an explicit request from the user (main is shared/public).

---

## File Structure

**Modify:**
- `scripts/build-quiz.mjs` — parse category markers, group by level, nested output, validations, `--strict`.
- `src/components/QuizViewer.js` — `deckFor(id, lang, difficulty, seed)`, difficulty selector, 混和 sampling, difficulty/seed in attempts, coming-soon + legacy list.
- `src/utils/quizAttempts.js` — difficulty-keyed storage + legacy read.
- `src/i18n/dict.js` — `quiz.diff.*`, `quiz.comingSoon`, `quiz.unclassified` (en + zh).
- `quizzes/{en,zh}/*.xml` — migrate the 5 existing banks to category markers and expand to 45 each.
- `src/tests/buildQuiz.test.js`, `src/tests/quizAttempts.test.js` — extend.
- `e2e/quiz-viewer.spec.js` — difficulty selector flow.

**Create:**
- `scripts/quiz-templates/boundary.mjs`, `logic.mjs`, `graph.mjs`, `mutation.mjs`, `index.mjs` — parametric question generators.
- `src/tests/quizTemplates.test.js` — generator correctness/determinism.
- `src/tests/quizDeck.test.js` — `deckFor`/mixed-sampling determinism (extract the pure helper for testability; see Task 4).

---

# Phase 1 — Infrastructure (topic-independent)

## Task 1: build-quiz groups questions by category marker

**Files:**
- Modify: `scripts/build-quiz.mjs`
- Test: `src/tests/buildQuiz.test.js`

**Interfaces:**
- Produces: `parseQuizXml(xml)` now returns `{ easy: Question[], medium: Question[], hard: Question[] }` (only buckets that appear are present). `buildAll()` returns `{ [id]: { en: LevelMap, zh: LevelMap } }` where `LevelMap = {easy?,medium?,hard?}`.
- `Question` shape is unchanged (`{type,name,text,answers,generalFeedback,single?,usecase?}`).
- `LEVELS = ['easy','medium','hard']` exported.

- [ ] **Step 1: Write failing tests** in `src/tests/buildQuiz.test.js` (add to existing file):

```js
import { describe, it, expect } from 'vitest';
import { parseQuizXml, LEVELS } from '../../scripts/build-quiz.mjs';

const cat = (path) => `<question type="category"><category><text>${path}</text></category></question>`;
const mc = (name) => `<question type="multichoice"><name><text>${name}</text></name>`
  + `<questiontext format="html"><text><![CDATA[<p>${name}?</p>]]></text></questiontext><single>true</single>`
  + `<answer fraction="100"><text>yes</text></answer><answer fraction="0"><text>no</text></answer></question>`;
const wrap = (inner) => `<?xml version="1.0"?><quiz>${inner}</quiz>`;

describe('parseQuizXml category grouping', () => {
  it('groups questions under the preceding level marker', () => {
    const xml = wrap(cat('$course$/top/Graph Coverage/easy') + mc('e1') + mc('e2')
      + cat('$course$/top/Graph Coverage/hard') + mc('h1'));
    const g = parseQuizXml(xml);
    expect(g.easy.map((q) => q.name)).toEqual(['e1', 'e2']);
    expect(g.hard.map((q) => q.name)).toEqual(['h1']);
    expect(g.medium).toBeUndefined();
  });

  it('throws on a question before any level marker', () => {
    expect(() => parseQuizXml(wrap(mc('orphan')))).toThrow(/before.*category|no category/i);
  });

  it('throws on an unknown level token', () => {
    expect(() => parseQuizXml(wrap(cat('$course$/top/X/simple') + mc('q')))).toThrow(/level|simple/i);
  });

  it('throws on a duplicate level marker in one file', () => {
    const xml = wrap(cat('$course$/top/X/easy') + mc('a') + cat('$course$/top/X/easy') + mc('b'));
    expect(() => parseQuizXml(xml)).toThrow(/duplicate/i);
  });

  it('exports canonical levels', () => {
    expect(LEVELS).toEqual(['easy', 'medium', 'hard']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/buildQuiz.test.js -t "category grouping"`
Expected: FAIL (`parseQuizXml` returns a flat array; `LEVELS` undefined).

- [ ] **Step 3: Implement the grouping parser.** In `scripts/build-quiz.mjs`:

Add near the top (after imports):

```js
export const LEVELS = ['easy', 'medium', 'hard'];

function categoryLevel(q) {
  // q is a <question type="category">; return its last path segment.
  const text = rawText(q.category);          // e.g. "$course$/top/Graph Coverage/easy"
  const seg = String(text).split('/').map((s) => s.trim()).filter(Boolean).pop();
  return seg || '';
}
```

Replace `parseQuizXml` with a grouping version:

```js
export function parseQuizXml(xml) {
  const doc = parser.parse(xml);
  const questions = doc?.quiz?.question ?? [];
  const groups = {};
  let current = null;
  const seen = new Set();
  for (const q of questions) {
    if (q['@_type'] === 'category') {
      const level = categoryLevel(q);
      if (!LEVELS.includes(level)) {
        throw new Error(`quiz: unknown difficulty level "${level}" (expected ${LEVELS.join('/')})`);
      }
      if (seen.has(level)) throw new Error(`quiz: duplicate "${level}" category marker`);
      seen.add(level);
      current = level;
      groups[level] = groups[level] || [];
      continue;
    }
    const norm = normQuestion(q);
    if (!norm) continue;                       // unsupported type — skip silently as before
    if (!current) throw new Error('quiz: question appears before any category marker');
    groups[current].push(norm);
  }
  return groups;
}
```

- [ ] **Step 4: Run the category-grouping tests**

Run: `npx vitest run src/tests/buildQuiz.test.js -t "category grouping"`
Expected: PASS.

- [ ] **Step 5: Update `buildLang`/`buildAll` for the nested shape.** In `scripts/build-quiz.mjs`:

```js
function buildLang(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.xml')).sort()) {
    const id = f.replace(/\.xml$/, '');
    const groups = parseQuizXml(fs.readFileSync(path.join(dir, f), 'utf8'));
    const total = LEVELS.reduce((n, lv) => n + (groups[lv]?.length || 0), 0);
    if (!total) throw new Error(`quiz: no supported questions in ${dir}/${f}`);
    out[id] = groups;
  }
  return out;
}

export function buildAll() {
  const en = buildLang(path.join(ROOT, 'quizzes', 'en'));
  const zh = buildLang(path.join(ROOT, 'quizzes', 'zh'));
  const rendered = {};
  for (const id of [...new Set([...Object.keys(en), ...Object.keys(zh)])].sort()) {
    rendered[id] = { en: en[id] || {}, zh: zh[id] || {} };
  }
  return rendered;
}
```

- [ ] **Step 6: Migrate the 5 existing XML files to markers (keeps the real build green).** For each of the 10 files `quizzes/{en,zh}/{graph-coverage,logic-coverage,mutation-testing,boundary-value-equivalence,symbolic-execution}.xml`: the files already start with one `<question type="category">` whose path is e.g. `$course$/top/Graph Coverage`. Append `/easy` to that path segment so the existing ~7 questions land in the `easy` bucket for now (medium/hard filled in Phase 3). Example edit in `quizzes/en/graph-coverage.xml`:

```xml
    <category><text>$course$/top/Graph Coverage/easy</text></category>
```

Do the same (append `/easy`) in all 10 files.

- [ ] **Step 7: Rebuild and verify the generated data shape**

Run: `npm run build:quiz && node -e "import('./src/data/quizRendered.js').then(m=>console.log(JSON.stringify(Object.keys(m.QUIZ_RENDERED['graph-coverage'].en))))"`
Expected: prints `["easy"]` and `build:quiz` succeeds.

- [ ] **Step 8: Run the full build-quiz test file**

Run: `npx vitest run src/tests/buildQuiz.test.js`
Expected: PASS (existing tests may reference the flat shape — update those assertions to the grouped shape as part of this step; e.g. a test that did `parseQuizXml(...).length` becomes `parseQuizXml(...).easy.length`).

- [ ] **Step 9: Commit**

```bash
git add scripts/build-quiz.mjs src/tests/buildQuiz.test.js src/data/quizRendered.js quizzes/
git commit -m "feat(quiz): group questions by difficulty category marker"
```

---

## Task 2: en/zh bucket parity + `--strict` completeness check

**Files:**
- Modify: `scripts/build-quiz.mjs`
- Test: `src/tests/buildQuiz.test.js`

**Interfaces:**
- Produces: `validate(rendered, { strict })` — throws on parity/completeness violations; returns `{ warnings: string[] }`. Called by `buildAll` (parity always; completeness only when `strict`). CLI passes `strict` when invoked with `--strict`.

- [ ] **Step 1: Write failing tests**:

```js
import { validate } from '../../scripts/build-quiz.mjs';

describe('quiz validate', () => {
  const q = { type: 'multichoice', name: 'x', text: '', answers: [{ text: 'a', fraction: 100 }], generalFeedback: '' };
  const bucket = (n) => Array.from({ length: n }, () => q);

  it('throws when en and zh expose different buckets', () => {
    const r = { t: { en: { easy: bucket(1) }, zh: { easy: bucket(1), hard: bucket(1) } } };
    expect(() => validate(r, { strict: false })).toThrow(/parity|en.*zh/i);
  });

  it('warns (not throws) on <15 without strict', () => {
    const r = { t: { en: { easy: bucket(3) }, zh: { easy: bucket(3) } } };
    const { warnings } = validate(r, { strict: false });
    expect(warnings.join('\n')).toMatch(/easy.*3\/15|15/);
  });

  it('throws on incomplete buckets under strict', () => {
    const r = { t: { en: { easy: bucket(15) }, zh: { easy: bucket(15) } } };
    expect(() => validate(r, { strict: true })).toThrow(/medium|hard|15/i);
  });

  it('passes a complete topic under strict', () => {
    const full = { easy: bucket(15), medium: bucket(15), hard: bucket(15) };
    expect(() => validate({ t: { en: full, zh: full } }, { strict: true })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tests/buildQuiz.test.js -t "quiz validate"`
Expected: FAIL (`validate` not exported).

- [ ] **Step 3: Implement `validate` and wire it in:**

```js
export function validate(rendered, { strict } = {}) {
  const warnings = [];
  for (const [id, langs] of Object.entries(rendered)) {
    const enB = Object.keys(langs.en || {}).sort();
    const zhB = Object.keys(langs.zh || {}).sort();
    if (enB.join(',') !== zhB.join(',')) {
      throw new Error(`quiz: ${id} en/zh bucket parity mismatch (en=${enB} zh=${zhB})`);
    }
    for (const lang of ['en', 'zh']) {
      for (const lv of LEVELS) {
        const n = langs[lang]?.[lv]?.length || 0;
        if (n !== 15) {
          const msg = `quiz: ${id} ${lang}/${lv} has ${n}/15`;
          if (strict) throw new Error(msg);
          if (n > 0 && n < 15) warnings.push(msg);
        }
      }
      if (strict) {
        for (const lv of LEVELS) {
          if (!(langs[lang]?.[lv]?.length)) throw new Error(`quiz: ${id} ${lang} missing ${lv} bucket`);
        }
      }
    }
  }
  return { warnings };
}
```

In the CLI block, after `const rendered = buildAll();`:

```js
  const strict = process.argv.includes('--strict');
  const { warnings } = validate(rendered, { strict });
  warnings.forEach((w) => console.warn('WARN', w));
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/tests/buildQuiz.test.js -t "quiz validate"`
Expected: PASS.

- [ ] **Step 5: Verify the real build warns but does not fail** (topics currently only have `easy`)

Run: `npm run build:quiz`
Expected: succeeds; prints `WARN quiz: graph-coverage en/easy has 7/15` (or similar) and no throw.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-quiz.mjs src/tests/buildQuiz.test.js
git commit -m "feat(quiz): en/zh bucket parity + --strict completeness check"
```

---

## Task 3: difficulty-keyed attempt storage + legacy read

**Files:**
- Modify: `src/utils/quizAttempts.js`
- Test: `src/tests/quizAttempts.test.js`

**Interfaces:**
- Produces: `key(quizId, difficulty)` → `stvisual:quiz:attempts:<quizId>` when `difficulty` is null/undefined (legacy), else `...:<quizId>:<difficulty>`. `recentFor(storage, quizId, limit, difficulty)`, `record(storage, quizId, attempt, difficulty)`, `upsert(storage, quizId, attempt, difficulty)`, `clearFor(storage, quizId, difficulty)` all take an optional trailing `difficulty`. Legacy calls (no difficulty) keep reading/writing the old key, so pre-existing attempts remain visible.

- [ ] **Step 1: Write failing tests** (add to `src/tests/quizAttempts.test.js`):

```js
it('keys attempts by quizId + difficulty', () => {
  const s = new MemStorage(); // existing test helper; if absent, use a Map-backed stub
  QuizAttempts.upsert(s, 'graph-coverage', { id: 1, correct: 3, total: 15 }, 'easy');
  QuizAttempts.upsert(s, 'graph-coverage', { id: 2, correct: 9, total: 15 }, 'hard');
  expect(QuizAttempts.recentFor(s, 'graph-coverage', 10, 'easy').map((a) => a.id)).toEqual([1]);
  expect(QuizAttempts.recentFor(s, 'graph-coverage', 10, 'hard').map((a) => a.id)).toEqual([2]);
});

it('reads legacy attempts when difficulty is omitted', () => {
  const s = new MemStorage();
  s.setItem('stvisual:quiz:attempts:graph-coverage', JSON.stringify([{ id: 9, correct: 1, total: 6 }]));
  expect(QuizAttempts.recentFor(s, 'graph-coverage', 10).map((a) => a.id)).toEqual([9]);
  expect(QuizAttempts.recentFor(s, 'graph-coverage', 10, 'easy')).toEqual([]);
});
```

(If `MemStorage` does not already exist in the file, add a small stub:
`class MemStorage { constructor(){this.m=new Map();} getItem(k){return this.m.has(k)?this.m.get(k):null;} setItem(k,v){this.m.set(k,v);} removeItem(k){this.m.delete(k);} }`)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tests/quizAttempts.test.js -t "difficulty"`
Expected: FAIL (current `key` ignores difficulty).

- [ ] **Step 3: Implement.** Rewrite `src/utils/quizAttempts.js` signatures:

```js
function key(quizId, difficulty) {
  const base = 'stvisual:quiz:attempts:' + quizId;
  return difficulty ? base + ':' + difficulty : base;
}
function recentFor(storage, quizId, limit, difficulty) {
  try {
    const raw = storage.getItem(key(quizId, difficulty));
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, limit || 10);
  } catch { return []; }
}
function record(storage, quizId, attempt, difficulty) {
  try {
    const arr = recentFor(storage, quizId, 100, difficulty);
    arr.unshift(attempt);
    storage.setItem(key(quizId, difficulty), JSON.stringify(arr.slice(0, 10)));
  } catch { /* ignore */ }
}
function upsert(storage, quizId, attempt, difficulty) {
  try {
    const arr = recentFor(storage, quizId, 100, difficulty);
    const i = arr.findIndex((a) => a && a.id === attempt.id);
    if (i >= 0) arr[i] = attempt; else arr.unshift(attempt);
    storage.setItem(key(quizId, difficulty), JSON.stringify(arr.slice(0, 10)));
  } catch { /* ignore */ }
}
function clearFor(storage, quizId, difficulty) { try { storage.removeItem(key(quizId, difficulty)); } catch { /* ignore */ } }
export const QuizAttempts = { key, record, upsert, recentFor, clearFor };
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/tests/quizAttempts.test.js`
Expected: PASS (existing tests still pass — legacy calls unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/utils/quizAttempts.js src/tests/quizAttempts.test.js
git commit -m "feat(quiz): difficulty-keyed attempt storage with legacy read"
```

---

## Task 4: `deckFor` with difficulty + deterministic 混和 sampling

**Files:**
- Create: `src/utils/quizDeck.js`
- Modify: `src/components/QuizViewer.js`
- Test: `src/tests/quizDeck.test.js`

**Interfaces:**
- Produces (in `src/utils/quizDeck.js`):
  - `pickDeck(rendered, id, lang, difficulty, seed)` → `Question[]` (pure; testable without DOM).
    - `easy|medium|hard`: returns `rendered[id][lang][difficulty]` (falling back to `en` when the chosen lang bucket is empty), or `[]` if absent.
    - `mixed`: seeded sample of 5 indices from each of easy/medium/hard (via `makeRng(seed)` + `shuffle`), mapped into the chosen language buckets so en/zh stay parallel; returns `[]` if any bucket is missing or the three total < 15 (Task 5 renders "coming soon" in that case).
  - `mixSeed()` → a fresh integer seed (`Date.now()`-free is not required here; this runs in the browser, so `Date.now()` is fine).
- Consumes: `makeRng`, `shuffle` from `src/utils/randomInput.js`.

- [ ] **Step 1: Write failing tests** in `src/tests/quizDeck.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { pickDeck } from '../utils/quizDeck.js';

const bucket = (lang, lv) => Array.from({ length: 15 }, (_, i) => ({ name: `${lang}-${lv}-${i}`, type: 'multichoice', answers: [] }));
const rendered = {
  t: {
    en: { easy: bucket('en', 'easy'), medium: bucket('en', 'medium'), hard: bucket('en', 'hard') },
    zh: { easy: bucket('zh', 'easy'), medium: bucket('zh', 'medium'), hard: bucket('zh', 'hard') },
  },
};

describe('pickDeck', () => {
  it('returns the requested bucket for a fixed level', () => {
    expect(pickDeck(rendered, 't', 'en', 'easy').map((q) => q.name)).toEqual(bucket('en', 'easy').map((q) => q.name));
  });

  it('mixed draws 5+5+5 = 15', () => {
    const d = pickDeck(rendered, 't', 'en', 'mixed', 123);
    expect(d).toHaveLength(15);
    expect(d.filter((q) => q.name.includes('-easy-'))).toHaveLength(5);
    expect(d.filter((q) => q.name.includes('-medium-'))).toHaveLength(5);
    expect(d.filter((q) => q.name.includes('-hard-'))).toHaveLength(5);
  });

  it('mixed is deterministic for a given seed', () => {
    const a = pickDeck(rendered, 't', 'en', 'mixed', 42).map((q) => q.name);
    const b = pickDeck(rendered, 't', 'en', 'mixed', 42).map((q) => q.name);
    expect(a).toEqual(b);
  });

  it('mixed keeps en/zh parallel for the same seed', () => {
    const en = pickDeck(rendered, 't', 'en', 'mixed', 7).map((q) => q.name.replace('en-', ''));
    const zh = pickDeck(rendered, 't', 'zh', 'mixed', 7).map((q) => q.name.replace('zh-', ''));
    expect(en).toEqual(zh);
  });

  it('returns [] when a bucket is missing', () => {
    const partial = { t: { en: { easy: bucket('en', 'easy') }, zh: { easy: bucket('zh', 'easy') } } };
    expect(pickDeck(partial, 't', 'en', 'mixed', 1)).toEqual([]);
    expect(pickDeck(partial, 't', 'en', 'hard')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tests/quizDeck.test.js`
Expected: FAIL (`src/utils/quizDeck.js` does not exist).

- [ ] **Step 3: Implement `src/utils/quizDeck.js`:**

```js
import { makeRng, shuffle } from './randomInput.js';

export const LEVELS = ['easy', 'medium', 'hard'];

function bucketFor(rendered, id, lang, lv) {
  const topic = rendered[id];
  if (!topic) return [];
  const b = topic[lang]?.[lv];
  if (b && b.length) return b;
  const en = topic.en?.[lv];
  return (en && en.length) ? en : [];
}

export function mixSeed() { return (Date.now() >>> 0) ^ Math.floor(Math.random() * 2 ** 32); }

export function pickDeck(rendered, id, lang, difficulty, seed) {
  if (difficulty !== 'mixed') {
    return bucketFor(rendered, id, lang, difficulty);
  }
  // Sample 5 indices per level from a canonical bucket length, then map into the
  // chosen language so en/zh stay parallel for the same seed.
  const rng = makeRng(seed);
  const out = [];
  for (const lv of LEVELS) {
    const src = bucketFor(rendered, id, lang, lv);
    if (src.length < 5) return [];
    const idxs = shuffle(rng, src.map((_, i) => i)).slice(0, 5).sort((a, b) => a - b);
    idxs.forEach((i) => out.push(src[i]));
  }
  return out.length === 15 ? out : [];
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/tests/quizDeck.test.js`
Expected: PASS.

- [ ] **Step 5: Rewire QuizViewer's `deckFor` onto `pickDeck`.** In `src/components/QuizViewer.js`, add the import and replace `deckFor`/`has`:

```js
import { pickDeck, mixSeed } from '../utils/quizDeck.js';
// ...
function deckFor(id, lg, difficulty, seed) { return pickDeck(QUIZ_RENDERED, id, lg, difficulty, seed); }
function has(id) {
  const t = QUIZ_RENDERED[id];
  if (!t) return false;
  return ['en', 'zh'].some((lg) => t[lg] && Object.values(t[lg]).some((b) => b && b.length));
}
```

(Callers of `deckFor` are updated in Task 5; this step only changes the definition + import. The suite may briefly show QuizViewer callers passing too few args — that is fixed in Task 5. Do not run e2e between Tasks 4 and 5.)

- [ ] **Step 6: Run the unit suite (excluding e2e)**

Run: `npx vitest run src/tests/quizDeck.test.js src/tests/buildQuiz.test.js src/tests/quizAttempts.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/quizDeck.js src/tests/quizDeck.test.js src/components/QuizViewer.js
git commit -m "feat(quiz): deckFor difficulty + deterministic mixed sampling"
```

---

## Task 5: QuizViewer difficulty selector, wiring, coming-soon, legacy list, i18n

**Files:**
- Modify: `src/components/QuizViewer.js`, `src/i18n/dict.js`
- Test: `e2e/quiz-viewer.spec.js` (updated in Task 6; manual verify here)

**Interfaces:**
- Consumes: `deckFor(id, lang, difficulty, seed)`, `mixSeed()` (Task 4); `QuizAttempts.*(…, difficulty)` (Task 3).
- Produces: `st` gains `difficulty` (`'easy'|'medium'|'hard'|'mixed'`, default `'easy'`) and `seed` (int, only for mixed). Attempt records carry `difficulty` and (for mixed) `seed`.

- [ ] **Step 1: Add i18n keys.** In `src/i18n/dict.js`, in the **en** block next to line ~2528:

```js
    'quiz.difficulty': 'Difficulty',
    'quiz.diff.easy': 'Easy', 'quiz.diff.medium': 'Medium', 'quiz.diff.hard': 'Hard', 'quiz.diff.mixed': 'Mixed',
    'quiz.comingSoon': 'More questions coming soon for this set.',
    'quiz.unclassified': 'Earlier attempts',
```

In the **zh** block near line ~5447:

```js
    'quiz.difficulty': '難度',
    'quiz.diff.easy': '易', 'quiz.diff.medium': '中', 'quiz.diff.hard': '難', 'quiz.diff.mixed': '混和',
    'quiz.comingSoon': '此難度題目陸續增補中。',
    'quiz.unclassified': '先前的作答紀錄',
```

- [ ] **Step 2: Defer question selection to Begin; add difficulty to `st`.** In `open(quizId)`, remove the eager `deckFor` and the early return on empty; initialize difficulty:

```js
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
```

- [ ] **Step 3: Render the difficulty selector + count + coming-soon + legacy list in `renderStart`:**

```js
function bucketCount(difficulty) {
  const seed = difficulty === 'mixed' ? (st.seed ?? 0) : undefined;
  return deckFor(st.quizId, st.lang, difficulty, seed).length;
}

function renderStart() {
  const diffs = ['easy', 'medium', 'hard', 'mixed'];
  const recent = QuizAttempts.recentFor(localStorage, st.quizId, 10, st.difficulty);
  const legacy = QuizAttempts.recentFor(localStorage, st.quizId, 10); // old flat key
  const count = deckFor(st.quizId, st.lang, st.difficulty, st.difficulty === 'mixed' ? 0 : undefined).length;
  const ready = count >= 15 || (st.difficulty !== 'mixed' && count > 0);
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
```

- [ ] **Step 4: Handle difficulty radio change** (re-render count/begin state). In `onBodyClick`, add near the top after resolving `act` — but radios fire `change`, not a `data-act` click; add a dedicated listener in `ensureRefs` after `body.addEventListener('click', onBodyClick);`:

```js
  body.addEventListener('change', (e) => {
    if (!st || st.phase !== 'start') return;
    if (e.target?.name === 'qdiff') { st.difficulty = e.target.value; st.seed = null; renderStart(); }
  });
```

- [ ] **Step 5: Build the deck on Begin, threading difficulty + seed.** In `onBodyClick`, replace the `begin` branch:

```js
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
```

- [ ] **Step 6: Thread difficulty/seed through save, resume, review, lang-toggle.**

In `autosave` and `finish`, add `difficulty: st.difficulty, seed: st.seed` to the attempt object and pass `st.difficulty` as the 4th arg to `QuizAttempts.upsert(localStorage, st.quizId, {…}, st.difficulty)`.

In the lang-toggle handler, rebuild questions with difficulty + seed:

```js
    const qs = deckFor(st.quizId, st.lang, st.difficulty, st.seed);
    if (qs.length) st.questions = qs;
```

In `resume(a)` and `review(a)`, read difficulty/seed from the attempt and rebuild:

```js
  const qs = deckFor(st.quizId, a.lang, a.difficulty, a.seed);
```

and set `difficulty: a.difficulty, seed: a.seed` on the reconstructed `st`.

In `findAttempt`, search the difficulty-scoped list first, then fall back to the legacy list:

```js
function findAttempt(id) {
  const scoped = QuizAttempts.recentFor(localStorage, st.quizId, 10, st.difficulty);
  const legacy = QuizAttempts.recentFor(localStorage, st.quizId, 10);
  return [...scoped, ...legacy].find((a) => String(a.id) === String(id)) ?? null;
}
```

- [ ] **Step 7: Add minimal CSS** for `.quiz-diff` / `.quiz-diff-opt` / `.quiz-comingsoon` in `src/components/QuizViewer.css` (mirror the existing `.quiz-mode`/`.quiz-mode-opt` rules; coming-soon muted text).

- [ ] **Step 8: Manual smoke in the dev app.**

Run: `npm run dev` then open a quiz. Verify: difficulty row shows 易/中/難/混和; selecting 中 or 難 (currently empty) shows the coming-soon note and hides Begin; 易 shows the count and Begin works; a completed 易 attempt appears under Recent, and it does not appear when 難 is selected.

- [ ] **Step 9: Run the unit suite**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/QuizViewer.js src/components/QuizViewer.css src/i18n/dict.js
git commit -m "feat(quiz): difficulty selector, mixed seed, coming-soon, legacy attempts"
```

---

## Task 6: e2e for the difficulty selector

**Files:**
- Modify: `e2e/quiz-viewer.spec.js`

- [ ] **Step 1: Add a spec** that opens a quiz, asserts the difficulty radiogroup (`[data-testid="quiz-diff"]`) is present, selects `easy`, clicks `[data-testid="quiz-begin"]`, and asserts a question renders (`[data-testid="quiz-q"]`). Add a second assertion that selecting a currently-empty difficulty (`medium`) shows `[data-testid="quiz-comingsoon"]` and hides `[data-testid="quiz-begin"]`. Follow the existing spec's setup (server on `localhost:4174`, single Playwright run — see the repo gotcha).

- [ ] **Step 2: Run e2e**

Run: `npm run serve &` then `npm run test:browser -- quiz-viewer` (run ONE Playwright at a time; kill the server after).
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/quiz-viewer.spec.js
git commit -m "test(quiz): e2e difficulty selector + coming-soon"
```

---

# Phase 2 — Parametric templates

Each template module exports `generate(level, seed, count)` → `string[]` of Moodle `<question>` XML fragments (no `<quiz>` wrapper, no category marker). A shared helper renders a multichoice question so all families share escaping/structure.

## Task 7: shared XML helper + boundary/equivalence template

**Files:**
- Create: `scripts/quiz-templates/index.mjs`, `scripts/quiz-templates/boundary.mjs`
- Test: `src/tests/quizTemplates.test.js`

**Interfaces:**
- Produces (`index.mjs`): `mcQuestion({ name, prompt, correct, distractors, general })` → Moodle `<question type="multichoice">` XML string with one `fraction="100"` answer and the rest `fraction="0"`, answers shuffled by a passed rng. `esc(s)` for XML/CDATA-safe text.
- Produces (`boundary.mjs`): `generate(level, seed, count)` → `count` questions about on/off/in/out points of a numeric range predicate. Difficulty scales the predicate (easy: single `x <= N`; medium: closed interval; hard: compound / open-closed mix).

- [ ] **Step 1: Write failing tests** in `src/tests/quizTemplates.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { generate as boundary } from '../../scripts/quiz-templates/boundary.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', cdataPropName: '__cdata', isArray: (n) => n === 'answer' });
const parseOne = (xml) => parser.parse(`<quiz>${xml}</quiz>`).quiz.question;

describe('boundary template', () => {
  it('produces the requested count of parseable questions', () => {
    const qs = boundary('easy', 1, 5);
    expect(qs).toHaveLength(5);
    qs.forEach((x) => expect(parseOne(x)['@_type']).toBe('multichoice'));
  });
  it('has exactly one correct answer per question', () => {
    boundary('medium', 2, 5).forEach((x) => {
      const correct = parseOne(x).answer.filter((a) => a['@_fraction'] === '100');
      expect(correct).toHaveLength(1);
    });
  });
  it('is deterministic for a fixed seed', () => {
    expect(boundary('hard', 3, 5)).toEqual(boundary('hard', 3, 5));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tests/quizTemplates.test.js`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `scripts/quiz-templates/index.mjs`:**

```js
import { shuffle } from '../../src/utils/randomInput.js';

export function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function mcQuestion(rng, { name, prompt, correct, distractors, general }) {
  const answers = shuffle(rng, [
    { text: correct, f: 100 },
    ...distractors.map((d) => ({ text: d, f: 0 })),
  ]);
  const ans = answers.map((a) => `<answer fraction="${a.f}"><text>${esc(a.text)}</text></answer>`).join('');
  return `<question type="multichoice"><name><text>${esc(name)}</text></name>`
    + `<questiontext format="html"><text><![CDATA[<p>${prompt}</p>]]></text></questiontext>`
    + `<single>true</single>${ans}`
    + (general ? `<generalfeedback><text>${esc(general)}</text></generalfeedback>` : '')
    + `</question>`;
}
```

- [ ] **Step 4: Implement `scripts/quiz-templates/boundary.mjs`:**

```js
import { makeRng, randInt } from '../../src/utils/randomInput.js';
import { mcQuestion } from './index.mjs';

// Ask "which value is an ON point / OFF point / interior / exterior of the predicate".
export function generate(level, seed, count = 15) {
  const rng = makeRng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const n = randInt(rng, 5, 50);
    // easy: x <= n. medium: lo <= x <= hi. hard: lo < x <= hi.
    let pred, on, off, inside, outside;
    if (level === 'easy') {
      pred = `x ≤ ${n}`; on = n; off = n + 1; inside = n - 1; outside = n + 2;
    } else {
      const hi = n + randInt(rng, 3, 20);
      if (level === 'hard') { pred = `${n} &lt; x ≤ ${hi}`; on = n + 1; off = n; inside = n + 2; outside = hi + 1; }
      else { pred = `${n} ≤ x ≤ ${hi}`; on = n; off = n - 1; inside = n + 1; outside = hi + 1; }
    }
    const ask = ['ON point (boundary, satisfies)', 'OFF point (just outside)'][i % 2];
    const correct = ask.startsWith('ON') ? on : off;
    out.push(mcQuestion(rng, {
      name: `Boundary ${level} ${i + 1}`,
      prompt: `For the predicate <code>${pred}</code>, which value is an <strong>${ask}</strong>?`,
      correct: String(correct),
      distractors: [inside, outside, ask.startsWith('ON') ? off : on].map(String),
      general: `On/off points sit immediately either side of the boundary; interior/exterior points are further away.`,
    }));
  }
  return out;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/tests/quizTemplates.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/quiz-templates/index.mjs scripts/quiz-templates/boundary.mjs src/tests/quizTemplates.test.js
git commit -m "feat(quiz): boundary/equivalence question template"
```

---

## Task 8: logic truth-table template

**Files:**
- Create: `scripts/quiz-templates/logic.mjs`
- Test: `src/tests/quizTemplates.test.js` (extend)

**Interfaces:**
- Produces: `generate(level, seed, count)` — questions about a boolean predicate (≤4 clauses per the existing render budget): count true rows, identify an active clause for a row, or an MC/DC-style independence pair. Difficulty scales clause count (easy: 2, medium: 3, hard: 4).

- [ ] **Step 1: Write failing tests** (extend `quizTemplates.test.js`): mirror Task 7's three checks (count, exactly-one-correct, determinism) plus one correctness check: for a fixed seed the stated "number of satisfying rows" equals an independent recomputation of the predicate over all 2^n assignments.

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/tests/quizTemplates.test.js -t "logic"` → FAIL.

- [ ] **Step 3: Implement `logic.mjs`** using `makeRng`, building a predicate from clause letters and `&&`/`||`, evaluating all `2^n` rows to compute the correct count and to find active clauses; emit via `mcQuestion`. Cap `n<=4`.

- [ ] **Step 4: Run to verify pass.** `npx vitest run src/tests/quizTemplates.test.js -t "logic"` → PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/quiz-templates/logic.mjs src/tests/quizTemplates.test.js
git commit -m "feat(quiz): logic truth-table question template"
```

---

## Task 9: graph path/DU-count template

**Files:**
- Create: `scripts/quiz-templates/graph.mjs`
- Test: `src/tests/quizTemplates.test.js` (extend)

**Interfaces:**
- Produces: `generate(level, seed, count)` — questions on a generated small CFG: number of edges, edge-pairs (length-2 paths), or prime-path/DU-pair counts. Difficulty scales node/branch count. The generator computes the true counts by graph traversal so the correct answer is exact.

- [ ] **Step 1: Write failing tests** (extend): count, exactly-one-correct, determinism, plus a correctness spot-check on a hand-computed tiny CFG (e.g. a 3-node if-graph has exactly 3 edges → the generator's stated edge count matches).

- [ ] **Step 2: Run to verify failure.** FAIL.

- [ ] **Step 3: Implement `graph.mjs`** generating an adjacency list, computing edge/edge-pair counts by enumeration; emit via `mcQuestion`.

- [ ] **Step 4: Run to verify pass.** PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/quiz-templates/graph.mjs src/tests/quizTemplates.test.js
git commit -m "feat(quiz): graph path/DU-count question template"
```

---

## Task 10: mutation-operator outcome template

**Files:**
- Create: `scripts/quiz-templates/mutation.mjs`
- Test: `src/tests/quizTemplates.test.js` (extend)

**Interfaces:**
- Produces: `generate(level, seed, count)` — questions presenting a small snippet + a mutation operator (e.g. `>` → `>=`, `+` → `-`, statement deletion) and asking the outcome (killed by a given test / equivalent mutant / lives). Difficulty scales snippet/operator subtlety (hard leans on equivalent-mutant recognition).

- [ ] **Step 1: Write failing tests** (extend): count, exactly-one-correct, determinism.

- [ ] **Step 2: Run to verify failure.** FAIL.

- [ ] **Step 3: Implement `mutation.mjs`** with a fixed table of (snippet, operator, test-input, outcome) parameterized cases; select/vary by rng; emit via `mcQuestion`.

- [ ] **Step 4: Run to verify pass.** PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/quiz-templates/mutation.mjs src/tests/quizTemplates.test.js
git commit -m "feat(quiz): mutation-operator outcome question template"
```

---

# Phase 3 — Author the 5 core topics to 45 each

Each authoring task fills one topic's `easy/medium/hard` buckets to 15 questions in **both** en and zh, then makes the topic pass `--strict`. Use the matching template for the computable share and hand-draft the rest (concept / scenario / synthesis). **Claude drafts the XML; the user reviews before the task's commit.**

**Authoring recipe (applies to Tasks 11–15):**
1. Generate the template share into the topic file under each level marker:
   `node -e "import('./scripts/quiz-templates/<family>.mjs').then(m=>console.log(m.generate('easy',<seed>,8).join('\n')))"` and paste the output under the `.../easy` marker (repeat medium/hard). Aim ~8 templated + ~7 hand-drafted per bucket.
2. Hand-draft the remaining questions in the existing house style — every answer has `<feedback>`, and each question has `<generalfeedback>`. Example of the required style (one full hard question):

```xml
<question type="multichoice">
  <name><text>Prime path subsumption</text></name>
  <questiontext format="html"><text><![CDATA[<p>On a graph with at least one edge, which criterion is subsumed by Prime Path Coverage?</p>]]></text></questiontext>
  <single>true</single>
  <answer fraction="100"><text>Edge-Pair Coverage</text><feedback><text>Correct — prime paths of length ≥2 cover all length-≤2 subpaths.</text></feedback></answer>
  <answer fraction="0"><text>Complete Path Coverage</text><feedback><text>Complete path coverage is generally infeasible and is not subsumed.</text></feedback></answer>
  <answer fraction="0"><text>All-DU-Paths</text><feedback><text>Data-flow criteria are not subsumed by structural prime-path coverage.</text></feedback></answer>
  <answer fraction="0"><text>None</text><feedback><text>Prime path coverage does subsume edge and edge-pair coverage.</text></feedback></answer>
  <generalfeedback><text>Prime path coverage subsumes edge-pair and edge coverage; it does not subsume data-flow or complete-path criteria.</text></generalfeedback>
</question>
```
3. Keep en and zh **parallel** (same question order/meaning per bucket) so 混和 index-sampling lines up.
4. Verify the topic: `node scripts/build-quiz.mjs --strict` must pass with no warning for this topic.

## Task 11: graph-coverage → 45

**Files:**
- Modify: `quizzes/en/graph-coverage.xml`, `quizzes/zh/graph-coverage.xml`
- Template: `scripts/quiz-templates/graph.mjs`

- [ ] **Step 1:** Add `medium` and `hard` category markers to both files (the `easy` marker exists from Task 1).
- [ ] **Step 2:** Generate ~8 templated questions per bucket via `graph.mjs` and paste under each marker (both languages — templated text is English; hand-translate the zh copies to keep parity).
- [ ] **Step 3:** Hand-draft the remaining questions per bucket (concept/scenario) in both languages, following the recipe's style example.
- [ ] **Step 4: User review.** Present the drafted questions for review; apply edits.
- [ ] **Step 5: Verify** `node scripts/build-quiz.mjs --strict 2>&1 | grep graph-coverage` prints nothing (no warnings); `npm run build:quiz` regenerates `quizRendered.js`.
- [ ] **Step 6: Commit**

```bash
git add quizzes/en/graph-coverage.xml quizzes/zh/graph-coverage.xml src/data/quizRendered.js
git commit -m "content(quiz): graph-coverage easy/medium/hard (15 each)"
```

## Task 12: logic-coverage → 45

Same recipe; template = `logic.mjs`. Files: `quizzes/{en,zh}/logic-coverage.xml`. Verify + commit as Task 11 (`content(quiz): logic-coverage easy/medium/hard (15 each)`).

## Task 13: mutation-testing → 45

Same recipe; template = `mutation.mjs`. Files: `quizzes/{en,zh}/mutation-testing.xml`. Verify + commit (`content(quiz): mutation-testing easy/medium/hard (15 each)`).

## Task 14: boundary-value-equivalence → 45

Same recipe; template = `boundary.mjs`. Files: `quizzes/{en,zh}/boundary-value-equivalence.xml`. Verify + commit (`content(quiz): boundary-value-equivalence easy/medium/hard (15 each)`).

## Task 15: symbolic-execution → 45

Same recipe; mostly hand-drafted (path-condition / feasibility / constraint questions), optionally borrowing `graph.mjs` and `logic.mjs`. Files: `quizzes/{en,zh}/symbolic-execution.xml`. Verify + commit (`content(quiz): symbolic-execution easy/medium/hard (15 each)`).

## Task 16: enforce `--strict` in the build for the finished topics + finalize

**Files:**
- Modify: `package.json`, `docs` (README quiz note), `e2e/quiz-viewer.spec.js` (mixed-flow assertion)

- [ ] **Step 1:** Change `build:quiz` in `package.json` to run strict now that all 5 core topics are complete:

```json
    "build:quiz": "node scripts/build-quiz.mjs --strict",
```

(If any additional, still-incomplete topics have been added by then, keep them out of `--strict` by leaving their files out of the `quizzes/` tree until done, or gate per-topic — but as of this plan the only topics present are the 5 core ones.)

- [ ] **Step 2:** Add a mixed-mode e2e assertion: select 混和, Begin, assert 15 questions render.
- [ ] **Step 3: Run everything.**

Run: `npm run test:run && npm run build:quiz`
Expected: PASS, no warnings.

- [ ] **Step 4: Commit**

```bash
git add package.json e2e/quiz-viewer.spec.js README.md
git commit -m "chore(quiz): enforce --strict build; mixed-mode e2e; docs"
```

---

## Self-Review

**Spec coverage:**
- Data model / nested shape → Task 1. ✓
- Category-marker honoring, tokens, one-file-per-topic → Task 1. ✓
- Parity + soft/`--strict` 15-count → Task 2, enforced Task 16. ✓
- 混和 runtime 5/5/5 seeded sampling, seed persisted, en/zh parallel → Task 4 (`pickDeck`), persisted in Task 5. ✓
- Viewer difficulty selector, coming-soon, i18n labels → Task 5. ✓
- Attempts difficulty-keyed + legacy → Task 3 (storage) + Task 5 (viewer legacy list). ✓
- Parametric templates (4 families) → Tasks 7–10. ✓
- Hand-drafted XML, review gate → Phase 3 recipe + per-task user review. ✓
- Initial 5-topic batch → Tasks 11–15. ✓
- Testing (build, templates, attempts, deck, e2e) → Tasks 1–10, 16. ✓
- Out of scope (judge, all-69, separate pools) → respected. ✓

**Placeholder scan:** Tasks 8–10 describe generator internals in prose rather than full code, deliberately — each still has concrete tests (count/one-correct/determinism/correctness spot-check) that define done, and Task 7 supplies the full shared helper + one complete generator as the pattern to copy. Phase 3 authoring is content, not code; it carries a full worked example and exact verify commands. No `TBD`/`TODO`/"add error handling".

**Type consistency:** `LEVELS` = `['easy','medium','hard']` in both `build-quiz.mjs` (Task 1) and `quizDeck.js` (Task 4). `pickDeck(rendered,id,lang,difficulty,seed)` signature consistent between Task 4 definition and Task 5 callers. `QuizAttempts.*(…, difficulty)` trailing-arg signature consistent between Task 3 and Task 5. Generated shape `{id:{lang:{easy,medium,hard}}}` consistent across Tasks 1, 2, 4.
