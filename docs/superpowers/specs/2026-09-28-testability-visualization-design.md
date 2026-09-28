# Testability Visualization Design

Status: draft for review · Author: skhuang (with Claude) · 2026-09-28

## Goal

Teach **testability** — how easy software is to test — as an interactive
topic in the stvisual2 software-testing course app. Today testability appears
only as passing mentions inside a handful of slide decks; there is no explorer,
section, deck, or quiz for it.

This spec adds a **`testability` section** with **four explorers** (as tabs),
each following the app's house style: a self-contained component with a
`create…Explorer()` factory, exported pure helpers, an i18n prefix (en +
Traditional Chinese), a concrete worked example, and answers derived from an
explicit model (never hand-waved). It also specifies full **topic parity**:
per-method slide decks, difficulty-tiered quiz banks, and the unit-view
slides/quiz wiring, so testability reaches the same completeness as every other
topic in the catalog.

Success criteria:
- A learner can open `/?explorer=controllability-observability` (and the three
  siblings) and interactively build intuition for what makes code testable.
- Each explorer's numbers/verdicts are reproducible from an explicit model and
  covered by unit tests on exported pure functions.
- The four units appear under a new **Testability** section in the integrated
  view, each with Slides + Quiz buttons on its unit page (Lab optional/future).
- en/zh parity throughout; strict quiz build passes; CI green.

## Context

### The concept

Testability is classically defined (Freedman; Binder; control-theory roots) as
**controllability + observability**:
- **Controllability** — can a test drive the software into the states/inputs it
  needs to exercise? Hidden state, unreachable branches, and hard-coded
  dependencies reduce it.
- **Observability** — can a test see the effects it needs to check? Side
  effects, swallowed errors, and missing return values/outputs reduce it.

Around that core sit the *practical* levers a developer controls:
- **Design-for-testability seams** (Feathers): dependency injection, injecting
  the clock and RNG, extracting interfaces — each turning an untestable
  dependency into a place a test can substitute a double.
- **Structural metrics**: cyclomatic complexity, coupling (fan-in/out), and
  cohesion correlate with how hard a unit is to test in isolation.
- **Nondeterminism**: timing/order/async/network/animation/data flakiness (see
  the existing `flaky-diagnosis` explorer) is a testability tax.

The family teaches the core (explorer 1), the actionable design skill (explorer
2), the structural signals (explorer 3), and a capstone that aggregates them
into a diagnosis (explorer 4).

### Repository patterns this follows

- **Explorer component**: `src/components/<Name>Explorer.js` — imports
  `{ t, getLocale }` from `../i18n/index.js`; exports pure helpers (for tests)
  and a factory `create<Name>Explorer()` returning a mounted-ready DOM element;
  owns its own interaction (stvisual2 explorers do **not** use dsvisual's
  VizKit/buildFrameControls — each renders and steps itself). Optional
  `<Name>Explorer.css`.
- **Registration**:
  - `src/data/explorerFactories.js` — `import` + `FACTORY_BY_COMPONENT` entry.
  - `src/data/explorerUnits.js` — one `EXPLORER_UNITS` entry per unit
    (`{ id, componentName }`, plus `quizId`/`slideId` where they differ).
  - `src/utils/urlRouter.js` — `EXPLORER_TO_LOCATION[Component] = { section, tab }`
    and the section's tab table (`SECTION_TABS`), so `?section=testability&tab=…`
    and `?explorer=<id>` both resolve. The companion test asserts 1:1 coverage
    of `EXPLORER_TO_LOCATION` ↔ `EXPLORER_UNITS`.
  - Section label + nav entry + i18n `section.testability.*`.
- **Unit view** already renders Slides → Quiz → Lab buttons gated by
  `hasSlideDeck(slideDeckIdForUnit(id))` / `QuizViewer.has(quizId ?? id)` /
  `LabViewer.has(id)`.
- **Slides**: `docs/slides/NN-*.{en,zh-TW}.md` (Marp) → `build:slide-decks` →
  `src/data/slideDecks.generated.js`; each deck `{ id, num, section, … }`.
- **Quiz**: `quizzes/{en,zh}/<id>.xml` (Moodle XML, 3 category markers ×
  easy/medium/hard × 15) → `build:quiz` → `src/data/quizRendered.js`;
  `quizzes/in-progress.json` gates strict validation.
- Every content change rebuilds `src/standalone.js` (CI `standalone-bundle`
  fails if stale). CI also runs vitest + Playwright.

### The new section

Add section id **`testability`** with four tabs. Tabs (ordered as a learning
path): `co` → `seams` → `metrics` → `score`.

| Tab | Unit id | Component |
| --- | --- | --- |
| `co` | `controllability-observability` | `ControllabilityObservabilityExplorer` |
| `seams` | `testability-seams` | `TestabilitySeamsExplorer` |
| `metrics` | `testability-metrics` | `TestabilityMetricsExplorer` |
| `score` | `testability-scorecard` | `TestabilityScorecardExplorer` |

---

## Explorer 1 — Controllability & Observability

**Unit** `controllability-observability` · **component**
`ControllabilityObservabilityExplorer.js` · **i18n prefix** `tco.*`

### Model (engine)

A tiny System-Under-Test is an explicit finite model, defined as data:

```
SUT = {
  inputs:  ['a', 'b', 'reset'],          // the test's available levers
  states:  ['S0','S1','S2','S3','FAULT'],// internal states (some hidden)
  hidden:  ['S2'],                        // states not directly reachable-marked
  start:   'S0',
  trans:   [ {from,to,on} … ],            // deterministic transition relation
  outputs: { S0:'ok', S1:'ok', S2:'ok', S3:'done', FAULT:'ok' }, // OBSERVABLE projection
}
```

Two exported pure functions drive the explorer:

- `reachableStates(sut)` → the set of internal states reachable from `start`
  using only `inputs` (BFS over `trans`). **Controllability** = |reachable ∩
  targetable| / |targetable|. States that no input sequence can reach are the
  teaching point (e.g. a state gated by a hidden precondition).
- `observableFaults(sut)` → for each state, whether injecting a fault there
  changes any **observable output** on some reachable path. **Observability** =
  |states whose fault is detectable at an output| / |states|. The `FAULT` state
  mapping to output `'ok'` is the teaching point: a fault that never surfaces.

Both are deterministic and unit-tested against the fixed example.

### Interaction

- **Controllability mode**: the learner picks a **target state** and builds an
  input sequence; the viz animates the walk over the state graph and marks
  reached vs unreachable. A readout: "reached S3 in 3 steps · S2 unreachable
  (no input drives S1→S2) · controllability 3/4."
- **Observability mode**: the learner injects a fault into a chosen state; the
  viz highlights whether it propagates to a *different* observable output on any
  reachable path. Readout: "fault in FAULT invisible — output stays `ok` ·
  observability 3/5."
- A toggle "add a probe / return value" edits `outputs` to expose a hidden
  state, visibly raising observability — showing that observability is a design
  choice.

### Rendering

State graph as an SVG (nodes = states, edges = labelled transitions), reusing
the app's viewBox-SVG fit pattern so it scales in focus mode. Reachable nodes
filled, unreachable dashed, fault node flagged; the observable-output row shown
beneath. Step controls for the input-sequence walk.

---

## Explorer 2 — Design-for-testability seams

**Unit** `testability-seams` · **component** `TestabilitySeamsExplorer.js` ·
**i18n prefix** `tsm.*`

### Model (data)

One worked snippet (rendered as read-only annotated code, en/zh comments) with
four named anti-patterns, each with a fix, seam type, and enabled double:

| Anti-pattern | Fix (seam) | Seam type (Feathers) | Enables (double) |
| --- | --- | --- | --- |
| global/singleton `Config` | inject `config` param | object seam | stub/fake |
| hard-coded `new PaymentGateway()` | inject collaborator / interface | object seam | mock/stub |
| real clock `Date.now()` | inject a `clock` | object seam | fake clock |
| real `Math.random()` | inject a seeded `rng` | object seam | seeded fake |

Exported pure helper `testabilityOf(fixesApplied)` → `{ score, capabilities }`:
score = fraction of anti-patterns removed; `capabilities` = the list of
"things a test can now do" unlocked by the applied fixes (e.g. "assert on a
fixed timestamp", "force the gateway to fail"). Deterministic, unit-tested.

### Interaction

Four toggles (one per anti-pattern). Toggling a fix:
- rewrites the shown code fragment to the seam version (before/after diff),
- raises the **testability meter**,
- adds the unlocked capability to the "what a test can now do" panel,
- names the seam type and cross-links the matching **test double** in the
  existing `test-doubles` explorer (link, not a re-teach).

Capstone message when all four are applied: the function is now a pure-ish unit
with every dependency substitutable.

### Rendering

Two-column: annotated code (with per-line anti-pattern chips) on the left, the
meter + capabilities + seam/double crosswalk on the right. No new graph needed.

---

## Explorer 3 — Testability metrics heatmap

**Unit** `testability-metrics` · **component** `TestabilityMetricsExplorer.js` ·
**i18n prefix** `tmx.*`

### Model (engine)

A small **module** = a set of units (functions) with:
- a mini control-flow descriptor per unit → **cyclomatic complexity**
  `M = E − N + 2` (or `decisions + 1` from an explicit decision count),
- a **call/dependency graph** among units → **fan-in** / **fan-out**,
- a declared responsibility-set per unit → a **cohesion** proxy
  (shared-responsibility ratio; LCOM-style, simplified and explicit).

Exported pure helpers: `cyclomatic(unit)`, `coupling(graph)` →
`{unit: {fanIn, fanOut}}`, `cohesionProxy(unit)`, and
`testabilityHardness(module)` → per-unit score combining the three with a
documented, fixed weighting, returning a ranked list with a **reason string**
("high fan-out (5) + complexity 8 → many collaborators to stub, many paths to
cover"). All deterministic and unit-tested.

### Interaction

- Heatmap grid of units coloured by hardness; click a unit → its metric
  breakdown + reason.
- Two edits that update the ranking live: **add/remove a dependency** (changes
  coupling) and **split a unit** (halves complexity, adds a collaborator) —
  demonstrating the coupling-vs-complexity trade-off.
- Readout: hardest unit + the single highest-leverage fix.

### Rendering

Heatmap (CSS grid) + a small dependency graph (SVG) + the selected-unit metric
card. Uses the sequential palette conventions (accessible in light/dark).

---

## Explorer 4 — Testability scorecard / diagnosis (capstone)

**Unit** `testability-scorecard` · **component**
`TestabilityScorecardExplorer.js` · **i18n prefix** `tsc.*`

### Model (engine)

Given a chosen example (reuse explorer 1's SUT + explorer 2's snippet +
explorer 3's module, or a bundled composite fixture), aggregate five signals
into a scorecard:

| Signal | Source | Teaches-link |
| --- | --- | --- |
| Controllability % | `reachableStates` (explorer 1 engine) | co |
| Observability % | `observableFaults` (explorer 1 engine) | co |
| Seam coverage % | `testabilityOf` (explorer 2 engine) | seams |
| Structural hardness | `testabilityHardness` (explorer 3 engine) | metrics |
| Nondeterminism sources | count from a declared list | `flaky-diagnosis` |

Exported pure helper `scorecard(fixture)` → `{ perSignal, grade, topFixes }`
with a documented rubric (weights + letter thresholds) and a prioritized fix
list (highest score delta first). Deterministic, unit-tested; **reuses the
other explorers' exported engines** rather than re-deriving.

### Interaction

- A single readout: per-signal bars + an overall grade (A–F) + the top 3
  prioritized fixes, each linking to the explorer that teaches it.
- Apply-a-fix toggles (mirroring the sub-explorers) re-grade live, so the
  learner sees the score climb as they address the biggest levers first.

### Rendering

Scorecard panel: signal bars, grade badge, fix list with deep-links
(`?explorer=…`). No new graph engine — it composes the others.

---

## Wiring

For each of the 4 components:

1. **`src/data/explorerFactories.js`** — `import { create…Explorer }` and add to
   `FACTORY_BY_COMPONENT`.
2. **`src/data/explorerUnits.js`** — add `EXPLORER_UNITS` entries:
   - `{ id: 'controllability-observability', componentName: 'ControllabilityObservabilityExplorer' }`
   - `{ id: 'testability-seams', componentName: 'TestabilitySeamsExplorer' }`
   - `{ id: 'testability-metrics', componentName: 'TestabilityMetricsExplorer' }`
   - `{ id: 'testability-scorecard', componentName: 'TestabilityScorecardExplorer' }`
3. **`src/utils/urlRouter.js`** — add the `testability` section to `SECTION_TABS`
   with tabs `['co','seams','metrics','score']` (default `co`) and four
   `EXPLORER_TO_LOCATION` entries.
4. **Section nav + label** — register the section in the integrated view's
   section list/order and add `section.testability.label` (en/zh). Suggested
   order: after `advanced` / near the quality-oriented topics (final placement
   confirmed during implementation).
5. **i18n** — `tco.*`, `tsm.*`, `tmx.*`, `tsc.*` key blocks (en + zh),
   `btn`-level nothing new (Slides/Quiz already exist), plus
   `section.testability.*`.

## Downstream parity (in scope — same spec, later phases)

To match every other topic:

1. **Slide decks** — four Marp decks `docs/slides/66-controllability-observability`,
   `67-design-for-testability`, `68-testability-metrics`,
   `69-testability-scorecard` (`.en.md` + `.zh-TW.md`), added to the `DECKS`
   table in `scripts/build-slide-decks.mjs` with `section: 'testability'`; run
   `build:slide-decks`. Deck ids should match the unit ids where possible so
   `slideDeckIdForUnit` needs no override; otherwise add overrides in
   `src/data/unitSlideDecks.js`. Update its invariant test (every unit resolves
   to a real deck).
2. **Quiz banks** — `quizzes/{en,zh}/<id>.xml` for all four unit ids, 3 markers
   × 15 (易/中/難), en/zh parallel by order, grounded in each explorer's model;
   gate under `quizzes/in-progress.json` while authoring, then empty to validate
   strict. (Follows the established quiz-bank recipe.)
3. **Unit-view buttons** — automatic once decks + banks exist (ids match), so no
   `unitView` change; verify Slides + Quiz appear.
4. **Labs** — out of scope for now (no lab unless a later request adds one).

## File structure

```
src/components/
  ControllabilityObservabilityExplorer.js   (+ .css)
  TestabilitySeamsExplorer.js               (+ .css)
  TestabilityMetricsExplorer.js             (+ .css)
  TestabilityScorecardExplorer.js           (+ .css)
src/data/
  testabilityModels.js        # shared fixtures: SUT, seam snippet, metrics module, composite
src/tests/
  controllabilityObservability.test.js
  testabilitySeams.test.js
  testabilityMetrics.test.js
  testabilityScorecard.test.js
e2e/
  testability.spec.js         # mount + basic step smoke for the 4 explorers
docs/slides/  66..69 *.en.md / *.zh-TW.md
quizzes/en/ , quizzes/zh/     4 banks
```

Shared example fixtures live in `src/data/testabilityModels.js` so the scorecard
can reuse explorers 1–3 without duplication and tests can import one source of
truth.

## Testing

- **Unit (vitest)** on every exported pure helper: `reachableStates` /
  `observableFaults` (controllability & observability counts on the fixed SUT,
  incl. the unreachable state and the invisible fault); `testabilityOf` (score +
  unlocked capabilities per fix subset); `cyclomatic` / `coupling` /
  `cohesionProxy` / `testabilityHardness` (exact numbers + ranking + reason on
  the fixed module); `scorecard` (per-signal values, grade thresholds, fix
  ordering) — including that it agrees with the sub-engines it composes.
- **e2e (Playwright)** `testability.spec.js`: each explorer mounts
  (`unit-main` has one child), a core interaction updates the readout (drive to a
  state; toggle a seam raises the meter; select a unit shows metrics; apply a fix
  re-grades), and focus mode toggles.
- **Router coverage test** stays green (4 new units ↔ 4 new locations).
- **Content builds**: `build:quiz --strict`, `build:slide-decks`,
  `build:standalone` (bundle in sync; `cloudConfig.js` untouched).
- Correctness audit of the quiz banks per the established recipe.

## Phasing

1. **Phase 1 — section + explorer 1** (`co`): the core definition, the new
   `testability` section, router/nav/i18n. Ships the smallest complete slice.
2. **Phase 2 — explorers 2 & 3** (`seams`, `metrics`): the actionable skill and
   the structural signals.
3. **Phase 3 — explorer 4** (`scorecard`): capstone composing 1–3.
4. **Phase 4 — parity**: 4 slide decks, 4 quiz banks, `unitSlideDecks` mapping +
   invariant test, strict build, audit.

Each phase is its own PR (main is protected). Phase 1 is independently useful.

## Out of scope

- Lab exercises for these units (add later if requested).
- Real static analysis of user-supplied code — all models are curated fixtures,
  in keeping with every other explorer.
- Porting to the old `stvisual` fork.
- Reworking the existing `test-doubles` / `flaky-diagnosis` explorers — the
  family links to them rather than duplicating.
