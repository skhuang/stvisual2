# dsvisual-style Example / Input System

**Date:** 2026-08-22
**Status:** Approved design, pre-implementation
**Scope:** Port dsvisual's example/input UX to stvisual2 as **shared, reusable modules**, then wire the Graph and Logic coverage explorers to it. Other explorers can adopt it later.
**Companion spec:** `2026-08-22-graph-logic-family-units-design.md` — the focus-mode family units use these example controls as their clean input surface (see §7).

## Background

dsvisual gives every interactive visualizer a compact, consistent input UX (see e.g. <https://skhuang.github.io/dsvisual/#m=graph-maxflow>):

1. **Examples dropdown** — a `<select>` with a placeholder, a "current-difficulty default" entry, named preset examples, and the user's recent inputs (localStorage, deduped, capped).
2. **Global difficulty setting** — `normal` / `special` / `edge` / `large`; visualizers read it and pick a matching default, and the 🎲 button generates a random input at that tier.
3. **Random 🎲 button** — per-domain random-input generators parameterized by difficulty.

stvisual2 has none of this. The Graph explorer instead uses a program-example select + JSON/source upload + a nodes/edges editor; the Logic explorer uses a free-text predicate input. This spec adds the dsvisual mechanism as shared modules and connects Graph + Logic to it.

## Decisions (user-approved)

- **Adoption scope:** build shared, extensible modules now; implement only the Graph and Logic domain generators this round.
- **Placement:** the **difficulty setting is global** (mirrors dsvisual), surfaced in the unit-view header and the integrated-view header; the **examples dropdown and 🎲 live inside each explorer**.
- **Recent history depth:** last **10** inputs (dsvisual defaults to 8).

## 1. Shared modules

### `src/utils/examplesStore.js` (ESM port of dsvisual `ExamplesStore`)
```
key(methodId) -> `stvisual:examples:${methodId}`
load(storage, methodId) -> Array<{ text: string }>   // newest first; corrupt storage -> []
save(storage, methodId, text, defaultText, cap = 10)  // skips '' and defaultText; dedupes; unshift; slice(0, cap)
```
`methodId` is per **input kind**, not per unit: all Graph family units share `graph`; all Logic units share `logic` (they edit the same CFG / predicate, so recent history is shared within a section).

### `src/utils/inputDifficulty.js` (new global state, mirrors i18n's shape)
```
SUPPORTED = ['normal', 'special', 'edge', 'large']   // default 'normal'
getInputDifficulty() -> string
setInputDifficulty(tier, { persist = true })         // persists to `stvisual:input-difficulty`, notifies listeners
onInputDifficultyChange(cb) -> unsubscribe
```
Persisted in localStorage; guarded reads/writes (private-mode safe). Changing it broadcasts a change event that explorers subscribe to (like `onLocaleChange`).

### `src/utils/randomInput.js` (shared RNG helpers + difficulty vocab)
Deterministic-friendly helpers so generators are testable:
```
makeRng(seed?) -> () => number      // mulberry32-style; seedable for tests, Math.random-seeded otherwise
randInt(rng, lo, hi), pick(rng, arr), uniqueInts(rng, n, lo, hi), shuffle(rng, arr)
DIFFICULTIES = ['normal', 'special', 'edge', 'large']
```
Domain generators live beside their data (below), consuming these helpers — no monolithic generator file (unlike dsvisual's 1165-line `random_input.js`); this keeps each domain independently testable.

### `src/components/ExampleControls.js` (+ `.css`) — shared UI builder
```
createExampleControls({ methodId, getDefaultText, presets, onLoad }) -> { element, refresh() }
```
Renders one control row: a `<select class="ex-select">` and a `🎲` button.
- Dropdown option order: placeholder (`example.pick`), **current-difficulty default** (`example.currentDefault`), named `presets` (`[{ value, label }]`), then recent entries from `examplesStore.load` (truncated to ~28 chars, default excluded).
- Selecting an option → `onLoad(text)`.
- 🎲 → `onLoad(randomFor(getInputDifficulty()))` where the explorer supplies the domain generator via `presets`/callback (see §3).
- `refresh()` rebuilds the recent list (called after an input is committed/saved).
- Testids: `ex-select`, `ex-random`.

## 2. Global difficulty selector UI

A `<select data-testid="input-difficulty">` with the four tiers (i18n labels `difficulty.normal|special|edge|large`) is added to:
- the **unit-view header** (`src/views/unitView.js`, in `.unit-tools`), and
- the **integrated-view header** (`src/views/integratedView.js`).

Both bind to `getInputDifficulty()` / `setInputDifficulty()`; a change re-renders the active explorer through the existing repaint path (explorers subscribe via `onInputDifficultyChange`). Label key `settings.difficulty`.

## 3. Domain generators

### `src/data/graphCoverageRandom.js`
```
presetForDifficulty(tier) -> { title, nodes, edges, startNodeId, endNodeId }  // deterministic default CFG per tier
randomGraph(tier, rng = makeRng()) -> same shape                              // random valid CFG at tier
graphToEdgesText(graph) / edgesTextToGraph(text)                             // reuse the explorer's existing serialize/parse
```
Tiers (every CFG is connected S→T, has ≥1 path):
- `normal` — 6–8 nodes, 1–2 decision branches, at most one back-edge (small loop).
- `large` — 10–14 nodes, several branches, 1–2 loops (exercises Prime Path / DU counts).
- `edge` — trivial: a straight-line S→…→T (no branches) or a single decision — the smallest interesting CFG.
- `special` — nested loops / diamond-heavy structure (stresses Complete-Path infeasibility and data-flow).

### `src/data/logicCoverageRandom.js`
```
presetForDifficulty(tier) -> { expression, bindings }
randomPredicate(tier, rng = makeRng()) -> { expression, bindings }
```
Tiers (clauses named `a,b,c,…`; expressions parse with the explorer's existing parser):
- `normal` — 3 clauses, mixed `&&`/`||`, one grouping, e.g. `(a && b) || c`.
- `large` — 5–6 clauses, mixed operators and nesting.
- `edge` — a single clause (`a`) — degenerate predicate.
- `special` — all-AND or all-OR, or a repeated clause (e.g. `a && b && a`) — highlights determination/DNF subtleties.

Generators return structured data; the explorer serializes to its editable input text (edges-text / expression) and feeds `ExampleControls`.

## 4. Graph explorer integration (`GraphCoverageExplorer.js`)

- Mount an `ExampleControls` instance (methodId `graph`) at the top of the input area. `presets` = the existing named program examples (`graphCoverageProgramExamples`, mapped to their generated CFG edges-text) plus a generated CFG for 🎲 via `graphCoverageRandom.randomGraph`.
- `getDefaultText` returns `graphToEdgesText(presetForDifficulty(getInputDifficulty()))`. On difficulty change (when the user hasn't manually edited — track a `userEdited` flag as dsvisual does) the CFG resets to the new tier's default.
- Committing an edited graph (existing editor apply path) calls `examplesStore.save(localStorage, 'graph', edgesText, defaultText, 10)` then `controls.refresh()`.
- **Focus/preset mode (family units):** the `ExampleControls` row *replaces* the hidden upload/editor chrome — it is the clean input surface for the focused units. Full explorer keeps its richer editor/upload in addition to the new controls row.

## 5. Logic explorer integration (`LogicCoverageExplorer.js`)

- Mount `ExampleControls` (methodId `logic`) above the predicate input. `presets` = existing `logicCoveragePredicates`; 🎲 via `logicCoverageRandom.randomPredicate`.
- `getDefaultText` = `presetForDifficulty(getInputDifficulty()).expression`; difficulty change resets the predicate unless user-edited.
- Committing a predicate saves to `examplesStore` (`logic`, cap 10) + `refresh()`.
- Focus-mode: the controls row is the clean input; the read-only predicate display from the family-units spec is replaced by this editable-with-presets control.

## 6. i18n

Add (EN + Traditional Chinese) under both locales:
- `example.pick` = "Examples…" / "範例…"
- `example.currentDefault` = "Current-difficulty default" / "目前難度預設"
- `example.random` (🎲 aria/title) = "Random input" / "隨機輸入"
- `settings.difficulty` = "Random-input difficulty" / "隨機輸入難度"
- `difficulty.normal|special|edge|large` = "Normal / Special / Edge case / Large" / "一般 / 特殊 / 邊界 / 大型"

## 7. Relationship to the family-units spec

The companion spec hides the Graph editor/upload and replaces the Logic input with a read-only display in focus mode. This spec supersedes that detail: **focus-mode input is the `ExampleControls` row** (dropdown + 🎲) bound to the global difficulty — a clean, classroom-friendly way to still switch inputs. The family-units spec will be amended with a one-line pointer here. Either spec can be implemented first, but the family-units focus-mode input should land together with, or after, these modules.

## 8. Error handling

- Corrupt/unavailable localStorage → `load` returns `[]`, `save`/`setInputDifficulty` no-op (never throw).
- Unknown difficulty tier passed to a generator → treat as `normal`.
- A random/preset generator must always return a *valid* input the explorer's parser accepts (connected CFG with start/end; parseable predicate). Tests enforce this.
- Selecting a recent entry whose text no longer parses (stale format) → the explorer surfaces its existing parse-error status; the entry is not auto-deleted.

## 9. Testing

**Vitest**
- `examplesStore`: newest-first, dedupe, cap-10, skip-default, corrupt-storage → `[]`.
- `inputDifficulty`: get/set/persist round-trip, change listener fires, unknown tier rejected, corrupt storage safe.
- `graphCoverageRandom` / `logicCoverageRandom`: for every tier, `presetForDifficulty` and `randomGraph`/`randomPredicate` (seeded rng) produce output the explorer's existing parser accepts; graphs are connected S→T; predicates parse to the expected clause-count range per tier.
- `ExampleControls`: dropdown contains placeholder + current-default + presets + recent (from a seeded store); 🎲 calls `onLoad`; `refresh()` reflects a new saved entry.

**Playwright**
- Graph unit: the example dropdown lists presets; selecting one changes the CFG; 🎲 produces a new CFG; changing the global difficulty changes the default CFG; an edited-then-committed graph appears in the dropdown's recent list after reload (localStorage persistence).
- Logic unit: same for predicates.
- Difficulty selector in the unit-view header persists across reload and is reflected by the explorer.

## 10. Out of scope

- Adopting the controls in explorers other than Graph/Logic (later, using the shared modules).
- Server/cloud sync of recent inputs (localStorage only, as dsvisual).
- Random generators for other domains.

## Files touched

- Create: `src/utils/examplesStore.js`, `src/utils/inputDifficulty.js`, `src/utils/randomInput.js`, `src/data/graphCoverageRandom.js`, `src/data/logicCoverageRandom.js`, `src/components/ExampleControls.js`, `src/components/ExampleControls.css`.
- Modify: `src/components/GraphCoverageExplorer.js`, `src/components/LogicCoverageExplorer.js`, `src/views/unitView.js`, `src/views/integratedView.js`, `src/i18n/dict.js`, `src/styles.css` (one `@import`).
- Regenerate: `src/standalone.js`. `scripts/prepare-pages.mjs` needs no change (utils/, data/, components/ already copied).
- Tests: `src/tests/examplesStore.test.js`, `src/tests/inputDifficulty.test.js`, `src/tests/coverageRandom.test.js`, `src/tests/exampleControls.test.js`, `e2e/example-input.spec.js`.
