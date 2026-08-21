# stvisual2 Shell Refactor — Unit View, Quiz Banks, Labs

**Date:** 2026-08-21
**Status:** Approved design, pre-implementation
**Scope:** UI shell only — no Explorer component internals change.

## Background

stvisual renders all course sections in one integrated page. Each section
stacks (or tabs) several Explorers with section chrome around them, which is
too busy for classroom projection. dsvisual (the data-structures course
visualizer) solved this with: a category nav that shows one visualizer at a
time, a `viz-focus` fullscreen focus mode, Moodle-XML quiz banks per topic,
and a labs subsystem linking starter repos and a judge.

stvisual2 is a full-history fork of stvisual (created 2026-08-21). This spec
brings the dsvisual presentation architecture to stvisual2 while keeping all
43 Explorer components and the integrated page intact.

## Decisions (user-approved)

- **Route A:** keep the stvisual codebase (Vite, components, i18n, Firebase);
  refactor only the UI shell.
- All **43 Explorers** are included in the new nav / unit view.
- **Quiz:** dsvisual-style Moodle-XML banks + build pipeline; seed 5 core
  units now, rest later. Embedded per-Explorer self-test quizzes stay.
- **Labs:** dsvisual-style subsystem; judge button is disabled
  ("coming soon") — no judge integration yet.
- Original integrated page is preserved behind an explicit entry.

## 1. Explorer registry

New `src/data/explorerRegistry.js`: a flat list of all 43 Explorers,
one entry per unit:

```js
{ id: 'graph-coverage',        // kebab-case, stable — quiz/lab key
  componentName: 'GraphCoverageExplorer',
  factory: createGraphCoverageExplorer,
  section: 'graph', tab: null, // location in the integrated page
  titleKey: 'section.graph.title' /* or explorer-specific key */ }
```

- Derived from `EXPLORER_TO_LOCATION` in `src/utils/urlRouter.js` — that map
  stays the single source of truth for component→location; the registry adds
  the kebab `id`, factory, and title key.
- The kebab `id` keys quiz banks (`quizzes/{en,zh}/<id>.xml`) and labs
  (`labs/labs.json` group key), mirroring dsvisual's method ids.
- A Vitest test asserts: registry covers every component in
  `EXPLORER_TO_LOCATION` (43 entries), ids are unique kebab-case, and every
  factory is callable.

## 2. Unit view (classroom demo mode)

`?explorer=<ComponentName>` renders a dedicated single-Explorer view instead
of scrolling the integrated page:

- Minimal header: unit title, language toggle, "back to overview" link.
- Only that Explorer is mounted; app footer and section chrome are absent.
- Toolbar: **⛶ fullscreen**, **Quiz** (shown only when a bank exists for the
  unit's id), **Lab** (shown only when a lab exists).
- Kebab id is also accepted (`?explorer=graph-coverage`); component-name
  links keep working.

**Focus mode** (ported from dsvisual's `viz-focus`):

- Toggling adds `body.viz-focus`; CSS hides all chrome and expands the
  Explorer container to `inset: 0`.
- Also requests `document.documentElement.requestFullscreen()` (with webkit
  fallback); exiting browser fullscreen exits focus mode and vice versa.
- Exit paths: Escape key, and a draggable floating "✕ Exit fullscreen"
  button (same pattern as dsvisual's `#viz-focus-exit`).

## 3. Navigation and the preserved integrated page

- Top nav becomes a dsvisual-style **category nav**: the 8 taxonomy
  categories from `SECTION_TAXONOMY`; hover/click opens a dropdown listing
  that category's Explorers; selecting one navigates to its unit view.
- The overview card grid (tag-chip filters, course packs, deeplinks) stays
  unchanged — its cards are per-*section* and keep navigating to the
  integrated page. Unit views are reached through the category-nav dropdowns
  (one link per Explorer) and by `?explorer=` deeplinks.
- The **integrated page is fully preserved**: a nav entry "整合檢視"
  (integrated view) reaches it; existing `?section=` / `?tab=` URLs behave
  exactly as today. Only `?explorer=` changes meaning (unit view instead of
  scroll-into-integrated-page) — this is the intended new behavior.
- URL scheme: `?view=all` forces the integrated page; absence of both
  `view` and `explorer` lands on the overview.

## 4. Quiz subsystem (dsvisual-style)

- **Banks:** `quizzes/en/<id>.xml` and `quizzes/zh/<id>.xml`, Moodle XML
  (same question types as dsvisual: `multichoice`, `truefalse`,
  `shortanswer`), importable into Moodle/E3 directly.
- **Build:** `scripts/build-quiz.mjs` — port of dsvisual's `build_quiz.js`
  (ESM, same sanitizer and parser rules) — emits `src/data/quizRendered.js`
  (a generated module; gitignored or committed following the repo's existing
  generated-file convention — decision: **committed**, matching dsvisual, so
  GitHub Pages builds don't need the XML step). Wired into `pages:prepare`
  and a `npm run build:quiz` script.
- **Viewer:** dsvisual's `quiz.js` / `quiz_grade.js` / `quiz_attempts.js`
  ported to ES modules as a `QuizViewer` overlay component (bilingual,
  keyboard-dismissable, per-attempt grading and localStorage attempt log).
- **Bank sharing:** a registry entry may set an optional `quizId` that
  overrides its own `id` for quiz lookup, so several related units can share
  one bank. The Quiz button opens the bank named by
  `entry.quizId ?? entry.id`.
- **Seed content (5 banks, both languages):**
  1. `graph-coverage` — GraphCoverageExplorer
  2. `logic-coverage` — LogicCoverageExplorer
  3. `mutation-testing` — SyntaxCoverageExplorer; shared (via `quizId`) with
     MutationScoreExplorer and EquivalentMutantExplorer
  4. `boundary-value-equivalence` — shared by BoundaryValueExplorer and
     EquivalenceClassExplorer
  5. `symbolic-execution` — SymbolicExecutionExplorer
- Embedded self-test quizzes inside Explorer components are untouched and
  coexist.

## 5. Lab subsystem (dsvisual-style)

- `labs/labs.json` maps unit id → lab list
  (`{ slug, repoUrl?, judgeUrl? }`).
- `labs/<slug>/` holds `statement.en.md`, `statement.zh.md`, and
  `samples.json` (in/out pairs).
- `scripts/build-labs.mjs` (port of dsvisual `build_labs.js`) emits
  `src/data/labRendered.js` (committed, same convention as quiz).
- `LabViewer` overlay: bilingual statement, samples, difficulty; the judge
  button is always rendered **disabled with "coming soon"** (dsvisual
  already has this state) until a judge URL is provided later.
- Seed: **one** demo lab on the graph-coverage topic to prove the pipeline.

## 6. Shell decomposition

`src/app.js` (1665 lines) is split as part of this work:

- `src/views/unitView.js` — unit view rendering + focus mode wiring
- `src/views/integratedView.js` — current sections/tabs page (moved, not
  rewritten); its existing `renderNav()` gains the per-unit dropdown links
  (a separate `shell/nav.js` split was considered and dropped — it would
  churn integrated-view internals without serving the feature)
- `src/app.js` — boot, routing dispatch (`overview | unit | integrated`),
  locale plumbing

No Explorer component file is modified.

## 7. Error handling

- Unknown `?explorer=` id → overview with a dismissible "unit not found"
  notice (no crash, no blank page).
- Missing quiz/lab data for a unit → the button simply doesn't render.
- `requestFullscreen` rejection (e.g., iframe or user gesture rules) →
  focus mode still applies via CSS class alone (dsvisual behaves the same).
- Malformed quiz XML → `build-quiz.mjs` fails the build with the file name
  and reason (never emits a partial bank silently).

## 8. Testing

- **Vitest:** registry completeness (43 units, unique kebab ids);
  `parseAppLocation`/`serializeLocation` round-trip for the new
  `view`/`explorer` semantics; `build-quiz.mjs` parsing (fixture XML →
  expected JSON, sanitizer strips scripts/handlers); grading logic.
- **Playwright:** unit view renders exactly one Explorer; fullscreen toggle
  adds/removes `viz-focus` and the exit button works; Quiz overlay opens,
  grades an attempt, closes on Escape; Lab overlay shows statement +
  disabled judge button; integrated page regression (`?section=`/`?tab=`
  URLs unchanged); overview card → unit view navigation.

## Out of scope (YAGNI)

- No changes inside any Explorer component.
- No changes to Firestore/cloud features, Teacher Dashboard, SlideViewer,
  or private Drive decks.
- No judge integration (button stays "coming soon").
- No quiz banks beyond the 5 seeds; no labs beyond the 1 demo.
