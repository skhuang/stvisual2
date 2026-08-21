# Split Graph & Logic Coverage into Classroom Family Units

**Date:** 2026-08-22
**Status:** Approved design, pre-implementation
**Scope:** Decompose two dense explorers into focused, one-concept-per-screen units for fullscreen classroom demo — reusing the existing explorer logic via a preset mechanism. The full explorers are preserved.

## Background

`GraphCoverageExplorer` (1061 lines) and `LogicCoverageExplorer` (1126 lines) each cram many concepts into one screen:

- **Graph** — an 8-criterion switcher (Node, Edge, Prime Path, Edge-Pair, Complete Path, All-Defs, All-Uses, All-DU-Paths) plus a CFG canvas, live graph editor, source-upload→CFG generation, a data-flow graph (DFG) panel, requirement/path generation, greedy set-cover optimization, and embedded lab/quiz panels.
- **Logic** — a 14-criterion switcher (PC, CC, CoC, GACC, CACC, RACC, GICC, RICC, IC, UTPC, MUTPC, NFPC, MNFPC, CUTPNFP) plus predicate input, truth table, K-maps, implicant highlighting, and lab/quiz panels.

For projecting a single concept in class this is too busy. This spec carves each into per-family units, each showing one concept family with its 2–3 related criteria and the classroom-noise chrome hidden — while keeping the complete explorers intact.

## Decisions (user-approved)

- **Granularity:** one *concept family* per unit (3 graph + 4 logic = 7 new units); a unit still lets you compare the 2–3 criteria in its family.
- **Build strategy:** hybrid — reuse the existing explorer via a `preset` parameter for all 7 now; hand-crafting bespoke lean visuals for the highest-value families is a *later phase, out of scope here*.
- **Integration:** `graph` and `logic` become tabbed sections (like `blackbox`); each family is a tab **and** a registry unit (nav dropdown + `?explorer=` both reach it). The existing full explorer is preserved as the "Complete" tab.

## 1. Unit carving

### Graph section (`graph`) — becomes tabbed, 4 tabs

| tab id | unit id | pseudo-component | criteria subset | chrome |
|---|---|---|---|---|
| `structural` | `graph-structural` | `GraphStructuralExplorer` | `node`, `edge` | CFG + subset switcher + requirements/paths |
| `path` | `graph-path` | `GraphPathExplorer` | `prime-path`, `edge-pair`, `complete-path` | CFG + subset switcher + requirements/paths |
| `dataflow` | `graph-dataflow` | `GraphDataflowExplorer` | `all-defs`, `all-uses`, `all-du-paths` | CFG **+ DFG card** + subset switcher + requirements/paths |
| `full` | `graph-coverage` *(kept)* | `GraphCoverageExplorer` | all 8 | everything (editor, upload, optimization, lab, quiz) |

### Logic section (`logic`) — becomes tabbed, 5 tabs

| tab id | unit id | pseudo-component | criteria subset | chrome |
|---|---|---|---|---|
| `basic` | `logic-basic` | `LogicBasicExplorer` | `pc`, `cc`, `coc` | predicate display + subset switcher + truth table |
| `active` | `logic-active-clause` | `LogicActiveClauseExplorer` | `gacc`, `cacc`, `racc` | predicate + switcher + truth table (determination highlighting) |
| `inactive` | `logic-inactive-clause` | `LogicInactiveClauseExplorer` | `gicc`, `ricc` | predicate + switcher + truth table |
| `dnf` | `logic-dnf` | `LogicDnfExplorer` | `ic`, `utpc`, `mutpc`, `nfpc`, `mnfpc`, `cutpnfp` | predicate + switcher + **K-maps** |
| `full` | `logic-coverage` *(kept)* | `LogicCoverageExplorer` | all 14 | everything (input, lab, quiz) |

The kept `graph-coverage` / `logic-coverage` units retain their `?explorer=` deeplinks, quiz banks (`quizzes/{en,zh}/graph-coverage.xml`, `logic-coverage.xml`), and the graph demo lab.

## 2. Preset mechanism (reuse)

`createGraphCoverageExplorer(opts = {})` and `createLogicCoverageExplorer(opts = {})` gain an optional `opts.preset` (a string id). A preset is resolved against a config table declared **inside each component module**:

```js
// GraphCoverageExplorer.js
const GRAPH_PRESETS = {
  structural: { criteria: ['node', 'edge'],                              showDfg: false },
  path:       { criteria: ['prime-path', 'edge-pair', 'complete-path'],  showDfg: false },
  dataflow:   { criteria: ['all-defs', 'all-uses', 'all-du-paths'],      showDfg: true  },
};
```

When `opts.preset` names a valid config, the component runs in **focus mode**:

- The criterion switcher renders only `config.criteria`; `criterionId` initializes to `config.criteria[0]`.
- The DFG card renders only when `config.showDfg` (dataflow), and is hidden otherwise. (In the full explorer the DFG always renders — unchanged.)
- These render blocks are **hidden**: `graph-source-card` (example/upload), `graph-editor-card` (Graph Editor), and the lab/quiz start controls (`graph-quiz-start`, `graph-lab-reflect-start`, `graph-lab-metric`) plus their panels. The greedy set-cover optimization *metrics* panel is hidden; the requirement/path list stays (it is the concept being taught).
- No `opts.preset` (or an unknown value) → the current full explorer, byte-for-byte behavior. Unknown preset falls back to full with a `console.warn`.

Logic mirrors this:

```js
// LogicCoverageExplorer.js
const LOGIC_PRESETS = {
  basic:    { criteria: ['pc', 'cc', 'coc'],                       view: 'truth' },
  active:   { criteria: ['gacc', 'cacc', 'racc'],                  view: 'truth' },
  inactive: { criteria: ['gicc', 'ricc'],                          view: 'truth' },
  dnf:      { criteria: ['ic','utpc','mutpc','nfpc','mnfpc','cutpnfp'], view: 'kmap' },
};
```

- Switcher limited to `config.criteria`; initial criterion = first of the subset.
- `view: 'truth'` presets hide the K-map region; the `view: 'kmap'` preset (dnf) keeps the K-maps and de-emphasizes the raw truth table — the K-map is the teaching surface there. The predicate input control is replaced by a read-only predicate display in focus mode (the example predicate is fixed for a clean demo); lab/quiz controls hidden.

Family-unit factories are thin thunks, defined in `explorerFactories.js`:

```js
GraphStructuralExplorer: () => createGraphCoverageExplorer({ preset: 'structural' }),
LogicDnfExplorer:        () => createLogicCoverageExplorer({ preset: 'dnf' }),
// … etc.
```

**Constraint:** the preset must be additive — the full explorers' existing behavior, tests, and every existing `data-testid` stay unchanged when `opts.preset` is absent. Focus-mode hiding is by not-rendering the block (or a `hidden`/`display:none` wrapper), never by deleting shared code paths.

## 3. Registry / router / nav / i18n wiring

### `src/data/explorerUnits.js`
Add 7 entries after their section's existing full unit, e.g.:
```js
{ id: 'graph-structural', componentName: 'GraphStructuralExplorer' },
{ id: 'graph-path',       componentName: 'GraphPathExplorer' },
{ id: 'graph-dataflow',   componentName: 'GraphDataflowExplorer' },
{ id: 'logic-basic',            componentName: 'LogicBasicExplorer' },
{ id: 'logic-active-clause',    componentName: 'LogicActiveClauseExplorer' },
{ id: 'logic-inactive-clause',  componentName: 'LogicInactiveClauseExplorer' },
{ id: 'logic-dnf',              componentName: 'LogicDnfExplorer' },
```

### `src/data/explorerFactories.js`
Add the 7 preset-thunk factories (above). No new imports beyond the two existing `create*` factories.

### `src/utils/urlRouter.js`
- `EXPLORER_TO_LOCATION`: change `GraphCoverageExplorer` → `{ section:'graph', tab:'full' }` and `LogicCoverageExplorer` → `{ section:'logic', tab:'full' }`; add the 7 pseudo-components with their `{section, tab}` (per §1 tables).
- `TAB_SECTIONS`: add
  ```js
  graph: { tabs: ['structural', 'path', 'dataflow', 'full'], default: 'full' },
  logic: { tabs: ['basic', 'active', 'inactive', 'dnf', 'full'], default: 'full' },
  ```
  Default `full` preserves today's integrated-page and `?section=graph` behavior.

### `src/utils/unitTitles.js`
Add to `TAB_LABEL_PREFIX`: `graph: 'graph.tab'`, `logic: 'logic.tab'`.

### `src/i18n/dict.js`
Add tab labels (EN + Traditional Chinese) under both locales:
- `graph.tab.structural` = "Structural Coverage" / "結構覆蓋"
- `graph.tab.path` = "Path Coverage" / "路徑覆蓋"
- `graph.tab.dataflow` = "Data-Flow Coverage" / "資料流覆蓋"
- `graph.tab.full` = "Complete (all criteria)" / "完整（所有準則）"
- `logic.tab.basic` = "Basic (PC / CC / CoC)" / "基本（PC / CC / CoC）"
- `logic.tab.active` = "Active Clause (GACC / CACC / RACC)" / "主動子句（GACC / CACC / RACC）"
- `logic.tab.inactive` = "Inactive Clause (GICC / RICC)" / "非主動子句（GICC / RICC）"
- `logic.tab.dnf` = "DNF / K-map (IC … CUTPNFP)" / "DNF / K-map（IC … CUTPNFP）"
- `logic.tab.full` = "Complete (all criteria)" / "完整（所有準則）"

### `src/views/integratedView.js`
Convert the `graph` and `logic` section slots from single-component mounts to tabbed rendering, following the existing per-section tab-array pattern (e.g. `blackboxTabs`). Each tab entry is `{ id, key, component }` where `component` is produced by the matching preset factory (or the full factory for `full`). Wire tab switching with the section's existing tab-panel show/hide + `syncUrl` mechanics. The default tab is `full`, so an unchanged first paint shows the complete explorer.

## 4. Quiz / lab handling

- The `full` tabs keep their existing quiz banks and (graph) demo lab, unchanged.
- Family units carry **no dedicated quiz or lab** initially (the Quiz/Lab buttons simply don't render, per existing `QuizViewer.has`/`LabViewer.has` gating). Optional `quizId`-sharing of the full bank by family units is explicitly **deferred** (YAGNI).

## 5. Out of scope (this spec)

- Bespoke hand-crafted lean visuals for high-value families (the hybrid follow-up phase) — a later spec once the preset units ship.
- New quiz banks / labs for the family units.
- Any change to the full explorers' behavior when `preset` is absent.
- Other sections (blackbox, mbt, etc.) — untouched.

## 6. Error handling

- Unknown `opts.preset` → full explorer + `console.warn` (never a blank render).
- A preset whose `criteria` reference an unknown criterion id → filtered out; if the subset becomes empty, fall back to full (guarded, with a warn) so a typo can't ship an empty switcher. A test enforces every preset's criteria exist in `graphCoverageCriteria` / `logicCoverageCriteria`.
- `?explorer=<unknown>` and `?section=graph&tab=<invalid>` keep their existing router behavior (unknown-explorer notice / tab validity gating).

## 7. Testing

**Vitest**
- Registry: the 7 new units resolve to callable factories (extends the existing `explorerUnits.test.js` coverage assertion, which will now compare against the enlarged `EXPLORER_TO_LOCATION`); ids are unique kebab-case.
- Router: `unitsForSection('graph')` → `[graph-structural, graph-path, graph-dataflow, graph-coverage]` and `unitsForSection('logic')` → `[logic-basic, logic-active-clause, logic-inactive-clause, logic-dnf, logic-coverage]`, in tab order.
- Titles: `unitTitle` resolves each new unit to its distinct family label in EN **and** ZH (extends `unitTitles.test.js`).
- Preset config validity: every id in `GRAPH_PRESETS`/`LOGIC_PRESETS` `criteria` exists in the corresponding criteria data.
- Preset smoke: `createGraphCoverageExplorer({preset:'structural'})` returns a DOM element whose criterion switcher contains exactly the subset's chips (2) and none of the hidden chrome blocks (`graph-source-card`, `graph-editor-card`); `createLogicCoverageExplorer({preset:'dnf'})` renders K-maps and only its 6 chips. A no-arg call still renders the full switcher (regression guard).

**Playwright**
- `?explorer=graph-structural` unit view: exactly the 2 structural chips, no editor/upload/optimization; CFG present.
- `?explorer=graph-dataflow`: DFG card visible; `?explorer=graph-path`: DFG card absent.
- `?explorer=logic-dnf`: K-maps visible; `?explorer=logic-basic`: truth table visible, K-maps hidden.
- Integrated `?view=all&section=graph` shows a tab bar (structural/path/dataflow/full) defaulting to the full explorer; switching tabs swaps content.
- Regression: `?explorer=graph-coverage` and `?explorer=logic-coverage` still render the full explorer with their Quiz button; existing graph/logic e2e specs pass.

## Files touched

- Modify: `src/components/GraphCoverageExplorer.js`, `src/components/LogicCoverageExplorer.js` (add preset config + focus-mode gating; additive).
- Modify: `src/data/explorerUnits.js`, `src/data/explorerFactories.js`, `src/utils/urlRouter.js`, `src/utils/unitTitles.js`, `src/i18n/dict.js`, `src/views/integratedView.js`.
- Modify/regenerate: `src/standalone.js` (esbuild bundle), and `scripts/prepare-pages.mjs` needs no change (components/ already copied).
- Tests: extend `src/tests/explorerUnits.test.js`, `src/tests/unitTitles.test.js`; add `src/tests/coveragePresets.test.js`; add `e2e/graph-logic-family-units.spec.js`.
