# Quiz Difficulty Banks — Design Spec

**Date:** 2026-08-23
**Status:** Draft (awaiting user review)
**Repo:** stvisual2

## Problem

The quiz subsystem has 5 topic banks (`graph-coverage`, `logic-coverage`,
`mutation-testing`, `boundary-value-equivalence`, `symbolic-execution`), each
with only ~6–7 questions authored as Moodle XML in `quizzes/{en,zh}/`. This is
too few per topic, and there is no difficulty structure. Some explorers have no
bank at all; the current model does not scale to the app's 69 explorers.

We want each topic to be split into four categories — **易 / 中 / 難 / 混和**
(easy / medium / hard / mixed) — with **15 questions per category**, each usable
in both **practice** and **test** modes, still authored/exported as Moodle XML.

## Decisions (from brainstorming)

1. **Granularity — hybrid rollout.** The data model + build + viewer are built
   once, correctly, for the full difficulty taxonomy. A first batch of *core
   topics* is authored to completion; remaining topics fill in progressively
   through the same pipeline without blocking the build.
2. **Pools — shared 15 per category.** Practice and test are two *modes over the
   same 15 questions* per category (unchanged from today's mode mechanic). No
   separate practice/test pools.
3. **Categories — easy / medium / hard authored; 混和 derived.** Only
   `easy/medium/hard` are authored (15 each = 45 per topic per language). **混和
   is never stored** — the viewer synthesizes it at runtime by seeded sampling
   (5 easy / 5 medium / 5 hard) from the three authored buckets.
4. **Authoring — hybrid.** Computable question families (boundary values, logic
   truth-tables, graph path/DU counts, mutation-operator outcomes) are produced
   by parametric templates with computed answers; conceptual / scenario /
   synthesis questions are hand-drafted XML (Claude drafts → user reviews).
5. **Encoding — Approach A: Moodle `category` blocks, one file per topic.**
   Difficulty is expressed with native `<question type="category">` markers so
   the files import into a real Moodle question bank with the difficulty
   categories intact.
6. **Difficulty tokens — canonical English `easy/medium/hard`** in the category
   path (language-neutral, identical in en/zh files). UI labels are localized to
   易/中/難/混和 via i18n; canonical `mixed` is UI-only.

## Architecture

### Data flow (unchanged seam, richer shape)

```
quizzes/{en,zh}/<topic>.xml        (hand XML + template-generated XML)
        │  build-quiz.mjs  (now honors category markers)
        ▼
src/data/quizRendered.js           (committed, generated)
        │  imported by
        ▼
QuizViewer.js  →  difficulty selector + practice/test modes
```

### Moodle XML layout (per topic file)

Each `quizzes/{lang}/<topic>.xml` contains three category markers, each followed
by its 15 questions:

```xml
<quiz>
  <question type="category">
    <category><text>$course$/top/Graph Coverage/easy</text></category>
  </question>
  <!-- 15 easy questions … -->
  <question type="category">
    <category><text>$course$/top/Graph Coverage/medium</text></category>
  </question>
  <!-- 15 medium questions … -->
  <question type="category">
    <category><text>$course$/top/Graph Coverage/hard</text></category>
  </question>
  <!-- 15 hard questions … -->
</quiz>
```

- The topic display name (`Graph Coverage`) is the segment before the level; the
  **level is the last path segment** and must be one of `easy|medium|hard`.
- Files remain one-per-topic-per-language. The topic **id** stays the filename
  stem (`graph-coverage`), as today.

### Generated data shape (`quizRendered.js`)

Before:

```js
{ "graph-coverage": { en: [...], zh: [...] } }
```

After:

```js
{ "graph-coverage": {
    en: { easy: [ …15 ], medium: [ …15 ], hard: [ …15 ] },
    zh: { easy: [ …15 ], medium: [ …15 ], hard: [ …15 ] } } }
```

`混和` is **not** a key here — synthesized at runtime.

## Components

### `scripts/build-quiz.mjs`

- `parseQuizXml` returns questions **grouped by category level** instead of a
  flat array. It walks questions in document order; a `type="category"` question
  whose path ends in `easy|medium|hard` sets the current bucket; each following
  supported question is appended to the current bucket.
- A category marker whose last segment is not a known level is an error (guards
  typos like `.../Easy` or `.../simple`).
- Questions appearing before any level marker → build error (no silent drop).
- `buildAll` produces the nested `{id:{lang:{easy,medium,hard}}}` shape.
- **Validations** (throw, matching today's fail-fast style):
  - each topic exposes exactly `easy/medium/hard` in **both** en and zh;
  - no duplicate level marker within a file.
- **Soft count check:** each bucket *should* have 15. Warn by default; a
  `--strict` flag (used in CI once a topic is declared done) turns the 15-count
  into a hard error. This lets partially-authored topics stay in the tree during
  the progressive rollout without breaking `pages:build`.

### `scripts/quiz-templates/` (new)

One generator module per computable family; each exports a function returning an
array of Moodle `<question>` XML strings for a given level and seed:

| Family | Module | Computed content |
|--------|--------|------------------|
| Boundary value / equivalence | `boundary.mjs` | on/off/in/out points for a range predicate; correct classification |
| Logic truth-tables | `logic.mjs` | predicate → truth rows, which clause is active/inactive, MC/DC pairs |
| Graph path / DU counts | `graph.mjs` | prime-path / edge-pair / DU-pair counts on a generated small CFG |
| Mutation outcomes | `mutation.mjs` | apply an operator to a snippet; killed/equivalent/live outcome |

- Generators reuse `src/utils/randomInput.js` (`makeRng`, `randInt`, `pick`) for
  reproducibility; a fixed seed per (topic, level, index) makes regeneration
  deterministic and diffs stable.
- Each generated question has exactly one `fraction="100"` answer, plausible
  distractors, and `generalfeedback` explaining the computation.
- Difficulty knobs per family (e.g. range width, clause count ≤ 4 per the
  existing logic-render budget, CFG size) scale easy→hard.
- Output is written into the topic XML under the matching level marker (a small
  `--emit` mode), then hand-reviewed; the committed source of truth remains the
  XML files, not the generator invocation.

### `src/components/QuizViewer.js`

- Home screen adds a **difficulty selector** (radio row or segmented control):
  易 / 中 / 難 / 混和, defaulting to 易. Rendered next to the existing
  practice/test radios.
- `deckFor(quizId, lang, difficulty, seed)`:
  - `easy|medium|hard` → returns that bucket's 15 (in authored order).
  - `mixed` → seeded sample of 5+5+5 from the three buckets via `makeRng(seed)`;
    the seed is generated on "Begin" and persisted in the attempt so resume /
    review reproduces the identical 15.
- Practice/test mode logic is unchanged (operates on whatever 15 `deckFor`
  returns).
- Missing bucket / topic not yet authored → a friendly "coming soon" state
  rather than a crash (supports progressive rollout).
- New i18n keys: `quiz.diff.easy`, `quiz.diff.medium`, `quiz.diff.hard`,
  `quiz.diff.mixed` (en + zh).

### `src/utils/quizAttempts.js`

- Attempt records gain a `difficulty` field; 混和 attempts also store `seed`.
- The "recent attempts" grouping key becomes `quizId + difficulty`.
- **Legacy migration:** attempts stored under the old flat shape (no
  `difficulty`) are surfaced under an "unclassified" label rather than dropped —
  no destructive migration, no data loss.

## Initial "fully done" batch

The existing **5 topics** — graph-coverage, logic-coverage, mutation-testing,
boundary-value-equivalence, symbolic-execution — are migrated (current ~7 flat
questions distributed into buckets) and expanded to 45 each (15/15/15). They
exercise all four template families and the full pipeline. Additional topics are
added later via the identical pipeline; the soft-15 check keeps them from
blocking `pages:build` until declared done (then added to the `--strict` set).

## Error handling

- Build: unknown level token, question before first marker, missing bucket, or
  en/zh bucket mismatch → hard error with the offending file/topic named.
- Viewer: unknown/absent bucket → "coming soon" state, no throw.
- 混和 with a bucket <5 questions → sample with replacement down-weighted, or
  fall back to "needs more questions" if total <15; never crash.

## Testing

- `src/tests/buildQuiz.test.js`: category grouping; unknown-level error;
  pre-marker-question error; en/zh parity; nested output shape; `--strict`
  15-count enforcement.
- `src/tests/quizTemplates.test.js` (new): each generator emits parseable XML
  with exactly one `fraction="100"`; computed answer verified against
  independent hand math for a fixed seed; determinism (same seed → same output).
- `src/tests/quizAttempts.test.js`: difficulty-keyed records; 混和 seed
  round-trip; legacy-attempt migration.
- New viewer-level unit coverage: `deckFor` mixed sampling is deterministic for a
  given seed and draws 5/5/5.
- `e2e/quiz-viewer.spec.js`: select a difficulty, begin, verify 15 questions,
  practice + test paths.

## Out of scope

- Judge/grading-server integration (labs' "coming soon" button is untouched).
- Authoring banks for all 69 explorers now (progressive; only the core batch is
  completed in this effort).
- Separate practice/test question pools (explicitly rejected — shared 15).

## Rollout / build interaction

- `pages:build` runs `build:quiz` first; the soft-15 default keeps in-progress
  topics from breaking the deploy.
- Reminder (existing gotcha): running `inject-env` locally blanks
  `src/config/cloudConfig.js` — `git checkout -- src/config/cloudConfig.js`
  before committing.
