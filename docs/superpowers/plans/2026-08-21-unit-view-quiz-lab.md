# Unit View + Quiz Banks + Labs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every stvisual2 Explorer a clean single-window "unit view" with a dsvisual-style fullscreen focus mode, category-nav unit links, a Moodle-XML quiz-bank pipeline (5 seed banks), and a labs subsystem with a "coming soon" judge button — while preserving the integrated page.

**Architecture:** Route A — Explorer components are untouched. A new unit registry (`explorerUnits.js` + `explorerFactories.js`) keys everything. `src/app.js` becomes a thin dispatcher: `?explorer=` → unit view, otherwise the existing integrated app (moved verbatim to `src/views/integratedView.js`). Quiz/lab data are generated ESM modules committed to the repo, built from `quizzes/*.xml` and `labs/` by Node scripts ported from dsvisual.

**Tech Stack:** Vanilla ES modules (no framework), Vite (build only — dev/e2e serve raw source over `python3 -m http.server 4173`), Vitest (jsdom), Playwright, `fast-xml-parser` (devDependency, build-time only).

**Spec:** `docs/superpowers/specs/2026-08-21-unit-view-quiz-lab-design.md`

## Global Constraints

- Do NOT modify any file in `src/components/` except to ADD the two new viewer components (`QuizViewer.js/.css`, `LabViewer.js/.css`). Explorer internals are off-limits.
- All new runtime modules must be browser-native ESM with **relative** import paths (the app runs unbundled via `python3 -m http.server`; bare specifiers break it). `fast-xml-parser` may only be imported by `scripts/*.mjs`.
- Generated files `src/data/quizRendered.js` and `src/data/labRendered.js` are **committed** (like dsvisual), never hand-edited; each starts with an `// AUTO-GENERATED` header.
- zh copy is Traditional Chinese (繁體中文).
- i18n: flat keys in `src/i18n/dict.js` under `messages.en` / `messages.zh`; `t(key, params)` interpolates `{name}` params and returns the key itself when missing.
- Explorer factories return a **DOM element** (e.g. `createGraphCoverageExplorer()` returns a `<div>`); mount by `appendChild`.
- Theme variables come from `src/App.css` `:root` (`--app-bg`, `--app-surface`, `--app-text`, `--app-border`, `--app-primary`, `--app-radius-md`, `--app-shadow-md`).
- Every task ends with `npx vitest run` green. Tasks 3–5 and 7–9 also run the Playwright suite (`npx playwright test`).
- Commit after every task (Conventional Commits, `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer).

---

### Task 1: Explorer unit registry

**Files:**
- Create: `src/data/explorerUnits.js`
- Create: `src/data/explorerFactories.js`
- Test: `src/tests/explorerUnits.test.js`

**Interfaces:**
- Consumes: `EXPLORER_TO_LOCATION` from `src/utils/urlRouter.js` (test only — `explorerUnits.js` itself imports nothing, so `urlRouter.js` may later import it without a cycle).
- Produces: `EXPLORER_UNITS` (array of `{ id, componentName, quizId? }`), `UNIT_BY_ID` (Map), `UNIT_BY_COMPONENT` (Map), `resolveUnit(param) → entry|null`; `FACTORY_BY_COMPONENT` (plain object componentName → factory function).

- [ ] **Step 1: Write the failing test**

```js
// src/tests/explorerUnits.test.js
import { describe, it, expect } from 'vitest';
import {
  EXPLORER_UNITS, UNIT_BY_ID, UNIT_BY_COMPONENT, resolveUnit,
} from '../data/explorerUnits.js';
import { FACTORY_BY_COMPONENT } from '../data/explorerFactories.js';
import { EXPLORER_TO_LOCATION } from '../utils/urlRouter.js';

describe('explorerUnits registry', () => {
  it('covers every EXPLORER_TO_LOCATION component exactly once', () => {
    const names = EXPLORER_UNITS.map((u) => u.componentName).sort();
    expect(names).toEqual(Object.keys(EXPLORER_TO_LOCATION).sort());
    expect(new Set(names).size).toBe(names.length);
  });

  it('has unique kebab-case ids', () => {
    const ids = EXPLORER_UNITS.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('resolveUnit accepts kebab id and ComponentName', () => {
    expect(resolveUnit('graph-coverage')?.componentName).toBe('GraphCoverageExplorer');
    expect(resolveUnit('GraphCoverageExplorer')?.id).toBe('graph-coverage');
    expect(resolveUnit('nope')).toBeNull();
    expect(UNIT_BY_ID.get('boundary-value').quizId).toBe('boundary-value-equivalence');
    expect(UNIT_BY_COMPONENT.get('MutationScoreExplorer').quizId).toBe('mutation-testing');
  });

  it('has a factory function for every unit', () => {
    for (const u of EXPLORER_UNITS) {
      expect(typeof FACTORY_BY_COMPONENT[u.componentName], u.componentName).toBe('function');
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tests/explorerUnits.test.js`
Expected: FAIL — cannot resolve `../data/explorerUnits.js`.

- [ ] **Step 3: Create `src/data/explorerUnits.js`**

```js
// One entry per Explorer unit. `id` is the stable kebab-case key used by
// unit-view deeplinks (?explorer=graph-coverage), quiz banks
// (quizzes/{en,zh}/<id>.xml) and labs (labs/labs.json). `quizId` (optional)
// redirects the unit's Quiz button to a shared bank.
// The companion test asserts 1:1 coverage of EXPLORER_TO_LOCATION.
export const EXPLORER_UNITS = [
  { id: 'testing-method-tree',    componentName: 'TestingMethodTree' },
  { id: 'testing-flow',           componentName: 'TestingFlow' },
  { id: 'defect-cost',            componentName: 'DefectCostExplorer' },
  { id: 'v-model',                componentName: 'VModelExplorer' },
  { id: 'testing-types-table',    componentName: 'TestingTypesTable' },
  { id: 'pyramid-adjuster',       componentName: 'PyramidAdjusterExplorer' },
  { id: 'graph-coverage',         componentName: 'GraphCoverageExplorer' },
  { id: 'logic-coverage',         componentName: 'LogicCoverageExplorer' },
  { id: 'code-coverage',          componentName: 'CodeCoverageExplorer' },
  { id: 'syntax-coverage',        componentName: 'SyntaxCoverageExplorer', quizId: 'mutation-testing' },
  { id: 'grammar-coverage',       componentName: 'GrammarCoverageExplorer' },
  { id: 'spec-mutation',          componentName: 'SpecMutationExplorer' },
  { id: 'symbolic-execution',     componentName: 'SymbolicExecutionExplorer' },
  { id: 'concolic-execution',     componentName: 'ConcolicExecutionExplorer' },
  { id: 'fuzz-testing',           componentName: 'FuzzTestingExplorer' },
  { id: 'test-generation',        componentName: 'TestGenerationExplorer' },
  { id: 'integration-testing',    componentName: 'IntegrationTestingExplorer' },
  { id: 'property-based-testing', componentName: 'PropertyBasedTestingExplorer' },
  { id: 'risk-based-testing',     componentName: 'RiskBasedTestingExplorer' },
  { id: 'boundary-value',         componentName: 'BoundaryValueExplorer', quizId: 'boundary-value-equivalence' },
  { id: 'equivalence-class',      componentName: 'EquivalenceClassExplorer', quizId: 'boundary-value-equivalence' },
  { id: 'input-space-partitioning', componentName: 'InputSpacePartitioningExplorer' },
  { id: 'decision-table',         componentName: 'DecisionTableExplorer' },
  { id: 'state-transition',       componentName: 'StateTransitionExplorer' },
  { id: 'pairwise',               componentName: 'PairwiseExplorer' },
  { id: 'cause-effect',           componentName: 'CauseEffectExplorer' },
  { id: 'metamorphic-testing',    componentName: 'MetamorphicTestingExplorer' },
  { id: 'exploratory-testing',    componentName: 'ExploratoryTestingExplorer' },
  { id: 'test-doubles',           componentName: 'TestDoublesExplorer' },
  { id: 'group-theory',           componentName: 'GroupTheoryExplorer' },
  { id: 'equivalent-mutant',      componentName: 'EquivalentMutantExplorer', quizId: 'mutation-testing' },
  { id: 'mutation-score',         componentName: 'MutationScoreExplorer', quizId: 'mutation-testing' },
  { id: 'llm-pipeline',           componentName: 'LLMPipelineExplorer' },
  { id: 'test-quality',           componentName: 'TestQualityExplorer' },
  { id: 'fault-directed-testing', componentName: 'FaultDirectedTestingExplorer' },
  { id: 'sailor-pipeline',        componentName: 'SAILORPipelineExplorer' },
  { id: 'bdd-gherkin',            componentName: 'BDDGherkinExplorer' },
  { id: 'use-case-derivation',    componentName: 'UseCaseDerivationExplorer' },
  { id: 'e2e-user-journey',       componentName: 'E2EUserJourneyExplorer' },
  { id: 'contract-testing',       componentName: 'ContractTestingExplorer' },
  { id: 'performance-load-profile', componentName: 'PerformanceLoadProfileExplorer' },
  { id: 'chaos-engineering',      componentName: 'ChaosEngineeringExplorer' },
  { id: 'atdd-cycle',             componentName: 'ATDDCycleExplorer' },
  { id: 'flaky-diagnosis',        componentName: 'FlakyDiagnosisExplorer' },
  { id: 'mbt-workflow',           componentName: 'MBTWorkflowExplorer' },
  { id: 'fsm-test-generation',    componentName: 'FSMTestGenerationExplorer' },
  { id: 'w-method-conformance',   componentName: 'WMethodConformanceExplorer' },
  { id: 'efsm-guarded-transition', componentName: 'EFSMGuardedTransitionExplorer' },
  { id: 'usage-model-statistical', componentName: 'UsageModelStatisticalExplorer' },
  { id: 'model-mutation',         componentName: 'ModelMutationExplorer' },
  { id: 'agile-quadrants',        componentName: 'AgileQuadrantsExplorer' },
  { id: 'sprint-cadence',         componentName: 'SprintCadenceExplorer' },
  { id: 'definition-gates',       componentName: 'DefinitionGatesExplorer' },
  { id: 'example-mapping',        componentName: 'ExampleMappingExplorer' },
  { id: 'continuous-testing-pipeline', componentName: 'ContinuousTestingPipelineExplorer' },
  { id: 'regression-debt',        componentName: 'RegressionDebtExplorer' },
  { id: 'program-slicing',        componentName: 'ProgramSlicingExplorer' },
  { id: 'slice-dicing',           componentName: 'SliceDicingExplorer' },
  { id: 'slice-coverage',         componentName: 'SliceCoverageExplorer' },
  { id: 'slice-regression',       componentName: 'SliceRegressionExplorer' },
  { id: 'tdd-cycle',              componentName: 'TddCycleExplorer' },
  { id: 'tdd-rules',              componentName: 'TddRulesExplorer' },
  { id: 'exploit-overflow',       componentName: 'ExploitOverflowExplorer' },
  { id: 'exploit-sqli',           componentName: 'ExploitSqliExplorer' },
  { id: 'exploit-cmdi',           componentName: 'ExploitCmdiExplorer' },
  { id: 'exploit-path',           componentName: 'ExploitPathExplorer' },
  { id: 'sbst-branch',            componentName: 'SbstBranchExplorer' },
  { id: 'sbst-compare',           componentName: 'SbstCompareExplorer' },
  { id: 'sbst-suite',             componentName: 'SbstSuiteExplorer' },
];

export const UNIT_BY_ID = new Map(EXPLORER_UNITS.map((u) => [u.id, u]));
export const UNIT_BY_COMPONENT = new Map(EXPLORER_UNITS.map((u) => [u.componentName, u]));

// Accepts a kebab id OR a ComponentName; null when unknown.
export function resolveUnit(param) {
  if (!param) return null;
  return UNIT_BY_ID.get(param) ?? UNIT_BY_COMPONENT.get(param) ?? null;
}
```

- [ ] **Step 4: Create `src/data/explorerFactories.js`**

Import every factory and export the lookup map. The import block mirrors the
one at the top of `src/app.js` — copy the names from there (they are all
`create<ComponentName>` from `../components/<ComponentName>.js`). Shape:

```js
// componentName → factory. The factory returns a mounted-ready DOM element.
import { createTestingMethodTree } from '../components/TestingMethodTree.js';
import { createTestingFlow } from '../components/TestingFlow.js';
import { createDefectCostExplorer } from '../components/DefectCostExplorer.js';
// … one import per EXPLORER_UNITS entry, exactly the names src/app.js imports …
import { createSbstSuiteExplorer } from '../components/SbstSuiteExplorer.js';

export const FACTORY_BY_COMPONENT = {
  TestingMethodTree: createTestingMethodTree,
  TestingFlow: createTestingFlow,
  DefectCostExplorer: createDefectCostExplorer,
  // … one line per unit …
  SbstSuiteExplorer: createSbstSuiteExplorer,
};
```

Fill in ALL 69 entries (the test fails on any gap). Cross-check each import
name against the import block in `src/app.js` — do not guess; if a name
differs from the `create<ComponentName>` pattern, use what `src/app.js` uses.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/tests/explorerUnits.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full unit suite, then commit**

Run: `npx vitest run`
Expected: all green.

```bash
git add src/data/explorerUnits.js src/data/explorerFactories.js src/tests/explorerUnits.test.js
git commit -m "feat(registry): explorer unit registry with kebab ids and factory map"
```

---

### Task 2: URL semantics — kebab ids, `?view=all`, unknown-explorer flag

**Files:**
- Modify: `src/utils/urlRouter.js` (the `?explorer=` block inside `parseAppLocation`, lines ~128–143)
- Test: `src/tests/urlRouterUnit.test.js` (new; existing router tests stay untouched)

**Interfaces:**
- Consumes: `resolveUnit` from Task 1.
- Produces: `parseAppLocation` additionally returns `unitId` (kebab id when `?explorer=` resolved), `view: 'all'` (when `?view=all`), `unknownExplorer` (raw param when unresolvable). `out.explorer` is always the **ComponentName** (normalized even when the URL used a kebab id). New export `unitsForSection(sectionId)` → ordered unit entries.

- [ ] **Step 1: Write the failing test**

```js
// src/tests/urlRouterUnit.test.js
import { describe, it, expect } from 'vitest';
import { parseAppLocation, unitsForSection } from '../utils/urlRouter.js';

describe('parseAppLocation unit-view semantics', () => {
  it('accepts a kebab unit id and normalizes to ComponentName', () => {
    const s = parseAppLocation('?explorer=graph-coverage', '');
    expect(s.explorer).toBe('GraphCoverageExplorer');
    expect(s.unitId).toBe('graph-coverage');
    expect(s.section).toBe('graph');
  });

  it('still accepts a ComponentName and adds unitId', () => {
    const s = parseAppLocation('?explorer=BoundaryValueExplorer', '');
    expect(s.explorer).toBe('BoundaryValueExplorer');
    expect(s.unitId).toBe('boundary-value');
    expect(s.section).toBe('blackbox');
    expect(s.tab).toBe('bva');
  });

  it('flags an unknown explorer and falls back to section/tab parsing', () => {
    const s = parseAppLocation('?explorer=NopeExplorer&section=logic', '');
    expect(s.explorer).toBeUndefined();
    expect(s.unknownExplorer).toBe('NopeExplorer');
    expect(s.section).toBe('logic');
  });

  it('parses ?view=all', () => {
    const s = parseAppLocation('?view=all&explorer=graph-coverage', '');
    expect(s.view).toBe('all');
    expect(s.explorer).toBe('GraphCoverageExplorer');
  });

  it('unitsForSection returns units in tab order', () => {
    const ids = unitsForSection('syntax').map((u) => u.id);
    expect(ids).toEqual(['syntax-coverage', 'grammar-coverage', 'spec-mutation']);
    expect(unitsForSection('graph').map((u) => u.id)).toEqual(['graph-coverage']);
    expect(unitsForSection('no-such-section')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tests/urlRouterUnit.test.js`
Expected: FAIL — `unitsForSection` not exported; kebab id not resolved.

- [ ] **Step 3: Modify `src/utils/urlRouter.js`**

Add at the top: `import { resolveUnit, EXPLORER_UNITS, UNIT_BY_COMPONENT } from '../data/explorerUnits.js';`

Replace the current `?explorer=` block inside `parseAppLocation` (the
`const explorer = params.get('explorer'); if (explorer && EXPLORER_TO_LOCATION[explorer]) { … } else { … }`
if/else) with:

```js
  // ?explorer= takes precedence over ?section/?tab. Accepts a ComponentName
  // or a kebab unit id; both normalize to ComponentName + unitId.
  const explorerRaw = params.get('explorer');
  const unit = resolveUnit(explorerRaw);
  if (explorerRaw && unit && EXPLORER_TO_LOCATION[unit.componentName]) {
    const loc = EXPLORER_TO_LOCATION[unit.componentName];
    out.explorer = unit.componentName;
    out.unitId = unit.id;
    out.section = loc.section;
    if (loc.tab) out.tab = loc.tab;
  } else {
    if (explorerRaw) out.unknownExplorer = explorerRaw;
    const sec = params.get('section');
    if (sec) out.section = sec;
    const tab = params.get('tab');
    // Only accept ?tab= if it's valid for the named section.
    if (tab && out.section && TAB_SECTIONS[out.section]?.tabs.includes(tab)) {
      out.tab = tab;
    }
  }

  // ?view=all forces the integrated page even when ?explorer= is present.
  if (params.get('view') === 'all') out.view = 'all';
```

Append at the bottom of the file:

```js
// ── unit helpers ─────────────────────────────────────────────────────

// Units belonging to a section, ordered by the section's tab order (units
// without a tab keep registry order). Powers the nav dropdown unit links.
export function unitsForSection(sectionId) {
  const units = EXPLORER_UNITS.filter(
    (u) => EXPLORER_TO_LOCATION[u.componentName]?.section === sectionId,
  );
  const tabs = TAB_SECTIONS[sectionId]?.tabs;
  if (!tabs) return units;
  const rank = (u) => {
    const t = EXPLORER_TO_LOCATION[u.componentName].tab;
    const i = tabs.indexOf(t);
    return i === -1 ? tabs.length : i;
  };
  return [...units].sort((a, b) => rank(a) - rank(b));
}

// Location info for a unit entry (section/tab), for title lookups.
export function locationForUnit(unit) {
  return EXPLORER_TO_LOCATION[unit.componentName] ?? null;
}
```

- [ ] **Step 4: Run the new test, then the whole unit suite**

Run: `npx vitest run src/tests/urlRouterUnit.test.js && npx vitest run`
Expected: PASS; no regressions (existing router tests only cover valid-name and section/tab paths, both preserved).

- [ ] **Step 5: Commit**

```bash
git add src/utils/urlRouter.js src/tests/urlRouterUnit.test.js
git commit -m "feat(router): kebab unit ids, ?view=all, unknown-explorer flag, unitsForSection"
```

---

### Task 3: Extract the integrated view; app.js becomes a dispatcher

**Files:**
- Create: `src/views/integratedView.js` (moved from `src/app.js`, content otherwise verbatim)
- Rewrite: `src/app.js` (thin dispatcher)
- Modify: `src/i18n/dict.js` (add `unit.notFound` keys)
- Test: `src/tests/appDispatch.test.js`

**Interfaces:**
- Consumes: `parseAppLocation` (Task 2).
- Produces: `renderIntegratedApp(container)` from `src/views/integratedView.js`; `renderApp(container)` re-exported from `src/app.js` with unchanged signature (so `src/main.js` and `src/standalone.*` keep working). A placeholder `renderUnitView` is NOT created here — until Task 4 lands the dispatcher routes everything to the integrated view (behavior identical to today, plus the not-found notice).

- [ ] **Step 1: Move the file, fix relative imports**

```bash
mkdir -p src/views
git mv src/app.js src/views/integratedView.js
sed -i '' -e "s|from './components/|from '../components/|g" \
          -e "s|from './utils/|from '../utils/|g" \
          -e "s|from './i18n/|from '../i18n/|g" \
          -e "s|from './data/|from '../data/|g" src/views/integratedView.js
```

Then in `src/views/integratedView.js` rename the export:
`export function renderApp(container)` → `export function renderIntegratedApp(container)`.
Check for stragglers: `grep -n "from './" src/views/integratedView.js` must return nothing.

- [ ] **Step 2: Write the failing dispatcher test**

```js
// src/tests/appDispatch.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { renderApp } from '../app.js';

describe('renderApp dispatch', () => {
  let container;
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
  });

  it('renders the integrated app on a bare URL', () => {
    renderApp(container);
    expect(container.querySelector('[data-testid="app-nav"]')).toBeTruthy();
  });

  it('renders the integrated app for ?view=all&explorer=…', () => {
    window.history.replaceState(null, '', '/?view=all&explorer=graph-coverage');
    renderApp(container);
    expect(container.querySelector('[data-testid="app-nav"]')).toBeTruthy();
  });

  it('shows a dismissible notice for an unknown ?explorer=', () => {
    window.history.replaceState(null, '', '/?explorer=NopeExplorer');
    renderApp(container);
    const notice = document.querySelector('[data-testid="unit-not-found"]');
    expect(notice).toBeTruthy();
    expect(notice.textContent).toContain('NopeExplorer');
    notice.querySelector('button').click();
    expect(document.querySelector('[data-testid="unit-not-found"]')).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/tests/appDispatch.test.js`
Expected: FAIL — `src/app.js` no longer exists (moved in Step 1).

- [ ] **Step 4: Write the new `src/app.js`**

```js
// Thin route dispatcher. `?explorer=` (without ?view=all) → unit view
// (Task 4; until then everything falls through to the integrated app).
import { parseAppLocation } from './utils/urlRouter.js';
import { t, setLocale } from './i18n/index.js';
import { renderIntegratedApp } from './views/integratedView.js';

function showUnitNotFound(rawId) {
  const notice = document.createElement('div');
  notice.className = 'unit-not-found';
  notice.dataset.testid = 'unit-not-found';
  notice.setAttribute('role', 'status');
  const msg = document.createElement('span');
  msg.textContent = t('unit.notFound', { id: rawId });
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = '×';
  dismiss.setAttribute('aria-label', t('common.close'));
  dismiss.addEventListener('click', () => notice.remove());
  notice.append(msg, dismiss);
  document.body.prepend(notice);
}

export function renderApp(container) {
  const state = parseAppLocation(
    globalThis.location?.search ?? '',
    globalThis.location?.hash ?? '',
  );
  // Apply a URL-supplied language before the first paint (the integrated
  // view repeats this harmlessly for its own repaint bookkeeping).
  if (state.lang) setLocale(state.lang, { persist: false });

  if (state.unknownExplorer) showUnitNotFound(state.unknownExplorer);

  // Task 4 inserts the unit-view branch here:
  // if (state.explorer && state.view !== 'all') { renderUnitView(container, state); return; }

  renderIntegratedApp(container);
}
```

(`common.close` already exists in the dict — the cloud drawer uses it.)

- [ ] **Step 5: Add dict keys**

In `src/i18n/dict.js`, add to `messages.en`:
```js
    'unit.notFound': 'Unknown unit "{id}" — showing the overview instead.',
```
and to `messages.zh`:
```js
    'unit.notFound': '找不到單元「{id}」，已改顯示總覽。',
```

Add minimal CSS at the end of `src/styles.css`:

```css
/* ── Unknown-unit notice (app.js dispatcher) ─────────────────────────── */
.unit-not-found {
  position: sticky; top: 0; z-index: 250;
  display: flex; align-items: center; justify-content: center; gap: 0.75rem;
  padding: 0.5rem 1rem;
  background: #fef3c7; color: #92400e; border-bottom: 1px solid #f59e0b;
  font-size: 0.9rem;
}
.unit-not-found button {
  border: 0; background: none; color: inherit; font-size: 1.1rem; cursor: pointer;
}
```

- [ ] **Step 6: Run unit + e2e suites**

Run: `npx vitest run`
Expected: PASS, including the moved integrated view's existing tests. If any test imports `renderApp` from a path like `../app.js`, it still resolves (we kept the export). If one imports internals from the old path, update its import to `../views/integratedView.js`.

Run: `npx playwright test`
Expected: PASS — pure move; `?explorer=` links to VALID explorers still reach the integrated view because Task 4's branch isn't active yet.

- [ ] **Step 7: Commit**

```bash
git add -A src/ && git commit -m "refactor(shell): move integrated app to views/, app.js becomes dispatcher"
```

---

### Task 4: Unit view + viz-focus fullscreen mode

**Files:**
- Create: `src/views/unitView.js`
- Create: `src/utils/vizFocus.js`
- Create: `src/utils/unitTitles.js`
- Modify: `src/app.js` (activate the unit-view branch)
- Modify: `src/i18n/dict.js`, `src/styles.css`
- Test: `src/tests/unitView.test.js`, `e2e/unit-view.spec.js`

**Interfaces:**
- Consumes: `resolveUnit`/`UNIT_BY_COMPONENT`, `FACTORY_BY_COMPONENT`, `locationForUnit`, `parseAppLocation`.
- Produces: `renderUnitView(container, urlState)`; `initVizFocus({ root })` (idempotent per page); `unitTitle(unit) → string`. Task 7/9 will append Quiz/Lab buttons into `.unit-tools` — keep that element's class stable.

- [ ] **Step 1: Write the failing unit test**

```js
// src/tests/unitView.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { renderUnitView } from '../views/unitView.js';
import { parseAppLocation } from '../utils/urlRouter.js';

function render(url) {
  window.history.replaceState(null, '', url);
  const container = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(container);
  renderUnitView(container, parseAppLocation(window.location.search, ''));
  return container;
}

describe('unit view', () => {
  beforeEach(() => { document.body.className = ''; });

  it('mounts exactly one explorer inside unit-main', () => {
    const c = render('/?explorer=graph-coverage');
    const main = c.querySelector('[data-testid="unit-main"]');
    expect(main).toBeTruthy();
    expect(main.children.length).toBe(1);
    expect(c.querySelector('[data-testid="app-nav"]')).toBeNull();
  });

  it('renders a back link to the overview and a fullscreen toggle', () => {
    const c = render('/?explorer=BoundaryValueExplorer');
    expect(c.querySelector('a.unit-back').getAttribute('href')).toBe('./');
    expect(c.querySelector('[data-testid="viz-focus-toggle"]')).toBeTruthy();
  });

  it('fullscreen toggle flips body.viz-focus; Escape exits', () => {
    const c = render('/?explorer=graph-coverage');
    c.querySelector('[data-testid="viz-focus-toggle"]').click();
    expect(document.body.classList.contains('viz-focus')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.body.classList.contains('viz-focus')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/tests/unitView.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/utils/unitTitles.js`**

```js
import { t } from '../i18n/index.js';
import { locationForUnit } from './urlRouter.js';

// Best available human title for a unit: the tab label
// (`<section>.tab.<tab>`) when the dict has one, else the section title.
export function unitTitle(unit) {
  const loc = locationForUnit(unit);
  if (!loc) return unit.id;
  if (loc.tab) {
    const key = `${loc.section}.tab.${loc.tab}`;
    const label = t(key);
    if (label !== key) return label;
  }
  const sKey = `section.${loc.section}.title`;
  const sTitle = t(sKey);
  return sTitle !== sKey ? sTitle : t(`section.${loc.section}`);
}
```

- [ ] **Step 4: Create `src/utils/vizFocus.js`** (port of dsvisual's `initVizFocus` + draggable exit button)

```js
// Fullscreen focus mode, ported from dsvisual. Toggled by any element with
// class .viz-focus-toggle; adds body.viz-focus (CSS hides chrome and expands
// the stage) and best-effort requests browser fullscreen. Exits on Escape,
// on the floating draggable ✕ button, or when browser fullscreen ends.
export function initVizFocus({ root = document } = {}) {
  const body = document.body;
  if (body.dataset.vizFocusWired === '1') return;
  body.dataset.vizFocusWired = '1';

  let exitBtn = document.getElementById('viz-focus-exit');
  if (!exitBtn) {
    exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.id = 'viz-focus-exit';
    exitBtn.className = 'viz-focus-exit';
    exitBtn.hidden = true;
    exitBtn.textContent = '✕';
    document.body.appendChild(exitBtn);
  }

  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const fsRequest = (el) => {
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    return fn ? fn.call(el) : null;
  };
  const fsExit = () => {
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fn) fn.call(document);
  };
  const setPressed = (on) => {
    document.querySelectorAll('.viz-focus-toggle').forEach((b) =>
      b.setAttribute('aria-pressed', on ? 'true' : 'false'));
  };
  const onKeydown = (e) => { if (e.key === 'Escape') exitFocus(); };

  function enterFocus() {
    if (body.classList.contains('viz-focus')) return;
    body.classList.add('viz-focus');
    exitBtn.hidden = false;
    exitBtn.style.left = ''; exitBtn.style.top = '';
    exitBtn.style.right = ''; exitBtn.style.bottom = '';
    setPressed(true);
    document.addEventListener('keydown', onKeydown);
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    try {
      const p = fsRequest(document.documentElement);
      if (p && p.then) p.then(() => {
        if (!body.classList.contains('viz-focus') && fsElement()) { try { fsExit(); } catch {} }
      }, () => {});
    } catch {}
  }
  function exitFocus() {
    if (!body.classList.contains('viz-focus')) return;
    body.classList.remove('viz-focus');
    exitBtn.hidden = true;
    setPressed(false);
    document.removeEventListener('keydown', onKeydown);
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    if (fsElement()) { try { fsExit(); } catch {} }
  }

  root.addEventListener('click', (e) => {
    if (e.target?.closest?.('.viz-focus-toggle')) {
      body.classList.contains('viz-focus') ? exitFocus() : enterFocus();
    }
  });
  exitBtn.addEventListener('click', () => {
    if (exitBtn.dataset.dragged === '1') { delete exitBtn.dataset.dragged; return; }
    exitFocus();
  });
  document.addEventListener('fullscreenchange', () => {
    if (!fsElement() && body.classList.contains('viz-focus')) exitFocus();
  });
  document.addEventListener('webkitfullscreenchange', () => {
    if (!fsElement() && body.classList.contains('viz-focus')) exitFocus();
  });
  makeExitDraggable(exitBtn);
}

// Drag anywhere so the exit button never blocks a viz's controls. A move past
// a 4px threshold sets data-dragged so the trailing click doesn't exit focus.
function makeExitDraggable(el) {
  let dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true; moved = false;
    const r = el.getBoundingClientRect();
    ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
    try { el.setPointerCapture(e.pointerId); } catch {}
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    moved = true;
    const nx = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, ox + dx));
    const ny = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, oy + dy));
    el.style.left = `${nx}px`; el.style.top = `${ny}px`;
    el.style.right = 'auto'; el.style.bottom = 'auto';
  });
  const end = () => { if (dragging && moved) el.dataset.dragged = '1'; dragging = false; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
```

- [ ] **Step 5: Create `src/views/unitView.js`**

```js
import { t, getLocale, setLocale, onLocaleChange, getSupportedLocales } from '../i18n/index.js';
import { UNIT_BY_COMPONENT } from '../data/explorerUnits.js';
import { FACTORY_BY_COMPONENT } from '../data/explorerFactories.js';
import { unitTitle } from '../utils/unitTitles.js';
import { initVizFocus } from '../utils/vizFocus.js';

// Single-Explorer classroom view: minimal header, one mounted explorer,
// fullscreen focus mode. Quiz/Lab buttons are appended by later features.
export function renderUnitView(container, urlState) {
  const unit = UNIT_BY_COMPONENT.get(urlState.explorer);
  if (!unit) return; // dispatcher guarantees resolution; belt-and-braces

  function paint() {
    const title = unitTitle(unit);
    document.title = `${title} · ${t('app.title')}`;
    container.innerHTML = `
      <div class="app unit-app" data-testid="unit-app">
        <header class="unit-header">
          <a class="unit-back" href="./">← ${t('unit.back')}</a>
          <h1 class="unit-title">${title}</h1>
          <div class="unit-tools">
            <div class="app-lang" role="group" aria-label="${t('app.lang.label')}">
              ${getSupportedLocales().map((loc) => `
                <button type="button" class="app-lang__btn${getLocale() === loc ? ' active' : ''}"
                        data-unit-lang="${loc}">${t(`app.lang.${loc}`)}</button>`).join('')}
            </div>
            <button type="button" class="btn secondary viz-focus-toggle"
                    data-testid="viz-focus-toggle" aria-pressed="false">
              ⛶ ${t('unit.fullscreen')}
            </button>
          </div>
        </header>
        <main class="unit-main" data-testid="unit-main"></main>
      </div>`;
    const factory = FACTORY_BY_COMPONENT[unit.componentName];
    container.querySelector('.unit-main').appendChild(factory());
    container.querySelectorAll('[data-unit-lang]').forEach((btn) =>
      btn.addEventListener('click', () => setLocale(btn.dataset.unitLang)));
  }

  paint();
  onLocaleChange(() => paint());
  initVizFocus({ root: container });
  const exitBtn = document.getElementById('viz-focus-exit');
  if (exitBtn) exitBtn.textContent = `✕ ${t('unit.exitFullscreen')}`;
}
```

- [ ] **Step 6: Activate the branch in `src/app.js`**

Add `import { renderUnitView } from './views/unitView.js';` and replace the
Task-4 placeholder comment with:

```js
  if (state.explorer && state.view !== 'all') {
    renderUnitView(container, state);
    return;
  }
```

- [ ] **Step 7: Dict keys and CSS**

`src/i18n/dict.js` — `messages.en`:
```js
    'unit.back': 'All units',
    'unit.fullscreen': 'Fullscreen',
    'unit.exitFullscreen': 'Exit fullscreen',
```
`messages.zh`:
```js
    'unit.back': '返回總覽',
    'unit.fullscreen': '全螢幕',
    'unit.exitFullscreen': '離開全螢幕',
```

End of `src/styles.css`:

```css
/* ── Unit view (single-Explorer classroom mode) ──────────────────────── */
.unit-app { max-width: 1400px; margin: 0 auto; padding: 1rem 1.5rem;
  display: flex; flex-direction: column; min-height: 100vh; gap: 1rem; }
.unit-header { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
.unit-back { color: var(--app-primary); text-decoration: none; font-weight: 600;
  white-space: nowrap; }
.unit-back:hover { text-decoration: underline; }
.unit-title { font-size: 1.35rem; color: var(--app-text-strong); flex: 1 1 auto; }
.unit-tools { display: flex; align-items: center; gap: 0.6rem; }
.unit-main { flex: 1 1 auto; min-height: 0; }

/* Focus mode: hide chrome, stage fills the viewport. */
body.viz-focus .unit-header,
body.viz-focus .unit-not-found { display: none; }
body.viz-focus .unit-main {
  position: fixed; inset: 0; z-index: 900; overflow: auto;
  background: var(--app-bg); padding: 0.5rem 0.75rem;
}
.viz-focus-exit {
  position: fixed; right: 18px; bottom: 18px; z-index: 1000;
  padding: 0.5rem 0.9rem; border-radius: 999px; border: 1px solid var(--app-border);
  background: var(--app-surface); color: var(--app-text);
  box-shadow: var(--app-shadow-md); cursor: grab; touch-action: none;
  font-size: 0.9rem;
}
.viz-focus-exit:active { cursor: grabbing; }
```

- [ ] **Step 8: Run the unit tests**

Run: `npx vitest run src/tests/unitView.test.js && npx vitest run`
Expected: PASS. (jsdom has no real fullscreen API — `fsRequest` returns null and the class toggle still works, matching the spec's degraded path.)

- [ ] **Step 9: Write the e2e spec**

```js
// e2e/unit-view.spec.js
import { test, expect } from '@playwright/test';

test('unit view mounts one explorer without integrated chrome', async ({ page }) => {
  await page.goto('/?explorer=GraphCoverageExplorer');
  await expect(page.getByTestId('unit-main')).toBeVisible();
  await expect(page.getByTestId('app-nav')).toHaveCount(0);
  await expect(page.locator('[data-testid="unit-main"] > *')).toHaveCount(1);
});

test('kebab id deeplink works', async ({ page }) => {
  await page.goto('/?explorer=boundary-value');
  await expect(page.getByTestId('unit-app')).toBeVisible();
});

test('focus mode toggles and Escape exits', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage');
  await page.getByTestId('viz-focus-toggle').click();
  await expect(page.locator('body')).toHaveClass(/viz-focus/);
  await expect(page.locator('#viz-focus-exit')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/viz-focus/);
});

test('?view=all keeps the integrated page', async ({ page }) => {
  await page.goto('/?view=all&explorer=graph-coverage');
  await expect(page.getByTestId('app-nav')).toBeVisible();
});

test('unknown explorer shows overview with dismissible notice', async ({ page }) => {
  await page.goto('/?explorer=NopeExplorer');
  await expect(page.getByTestId('app-nav')).toBeVisible();
  const notice = page.getByTestId('unit-not-found');
  await expect(notice).toContainText('NopeExplorer');
  await notice.locator('button').click();
  await expect(notice).toHaveCount(0);
});
```

- [ ] **Step 10: Run e2e, fix, commit**

Run: `npx playwright test e2e/unit-view.spec.js && npx playwright test`
Expected: all PASS. **Watch for regressions in `navigation-state.spec.js` / `accessibility-navigation.spec.js`**: any existing e2e that visits `?explorer=<name>` and asserts integrated-page behavior must be updated to use `?view=all&explorer=<name>` — the semantic change is the point of this feature; update those assertions, do not weaken the new ones.

```bash
git add -A src/ e2e/unit-view.spec.js && git add -u e2e/
git commit -m "feat(unit-view): single-explorer classroom view with viz-focus fullscreen"
```

---

### Task 5: Category-nav unit links

**Files:**
- Modify: `src/views/integratedView.js` (inside `renderNav()`, the `nav-category-panel` template)
- Modify: `src/styles.css`
- Test: `e2e/nav-unit-links.spec.js`

**Interfaces:**
- Consumes: `unitsForSection` (Task 2), `unitTitle` (Task 4).

- [ ] **Step 1: Write the failing e2e test**

```js
// e2e/nav-unit-links.spec.js
import { test, expect } from '@playwright/test';

test('category panel lists per-unit links that open the unit view', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-category-graph-model').hover();
  const link = page.getByTestId('nav-unit-graph-coverage');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByTestId('unit-app')).toBeVisible();
  await expect(page).toHaveURL(/explorer=GraphCoverageExplorer/);
});

test('section buttons in the panel still switch integrated sections', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-category-graph-model').hover();
  await page.getByTestId('nav-btn-graph').click();
  await expect(page.getByTestId('section-graph')).toBeVisible();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test e2e/nav-unit-links.spec.js`
Expected: first test FAILS (`nav-unit-graph-coverage` not found); second PASSES already.

- [ ] **Step 3: Extend `renderNav()`**

In `src/views/integratedView.js`, add imports:
`import { unitsForSection } from '../utils/urlRouter.js';` and
`import { unitTitle } from '../utils/unitTitles.js';`

Inside the `nav-category-panel` template, directly after each section's
`<button class="nav-btn…">…</button>` (the `cat.sectionIds.map((sectionId) => …)`
body), append the unit links. The mapped fragment becomes:

```js
                ${cat.sectionIds.map((sectionId) => `
                  <div class="nav-section-group">
                    <button
                      class="nav-btn${activeSection === sectionId ? ' active' : ''}"
                      data-testid="nav-btn-${sectionId}"
                      data-section="${sectionId}"
                      type="button"
                      role="menuitem"
                      aria-current="${activeSection === sectionId ? 'page' : 'false'}"
                    >
                      ${t(`section.${sectionId}`)}
                    </button>
                    ${unitsForSection(sectionId).length > 1 ? `
                      <div class="nav-unit-list" role="group">
                        ${unitsForSection(sectionId).map((u) => `
                          <a class="nav-unit-link" role="menuitem"
                             data-testid="nav-unit-${u.id}"
                             href="?explorer=${u.componentName}">${unitTitle(u)}</a>`).join('')}
                      </div>` : unitsForSection(sectionId).map((u) => `
                        <a class="nav-unit-link nav-unit-link--single" role="menuitem"
                           data-testid="nav-unit-${u.id}"
                           href="?explorer=${u.componentName}">⛶</a>`).join('')}
                  </div>`).join('')}
```

(Single-unit sections get a compact ⛶ link beside the section button; multi-
unit sections get an indented list. Keep the rest of `renderNav()` as is —
the existing click handler targets `.nav-btn[data-section]` and is unaffected
by the added anchors, which navigate natively.)

- [ ] **Step 4: CSS**

End of `src/styles.css`:

```css
/* ── Nav dropdown unit links ─────────────────────────────────────────── */
.nav-section-group { position: relative; display: flex; flex-direction: column; }
.nav-section-group > .nav-unit-link--single { position: absolute; right: 0.5rem; top: 0.25rem; }
.nav-unit-list { display: flex; flex-direction: column; padding-left: 1rem; }
.nav-unit-link {
  display: block; padding: 0.25rem 0.75rem; font-size: 0.85rem;
  color: var(--app-text-muted); text-decoration: none;
  border-radius: var(--app-radius-sm);
}
.nav-unit-link:hover { background: var(--app-surface-hover); color: var(--app-primary-strong); }
```

- [ ] **Step 5: Run e2e + unit suites, commit**

Run: `npx playwright test e2e/nav-unit-links.spec.js && npx playwright test && npx vitest run`
Expected: all PASS (hover/menu a11y specs may need the new anchors' `role="menuitem"` — already set).

```bash
git add src/views/integratedView.js src/styles.css e2e/nav-unit-links.spec.js
git commit -m "feat(nav): per-unit links in category dropdown panels"
```

---

### Task 6: Quiz build pipeline (`quizzes/*.xml` → `src/data/quizRendered.js`)

**Files:**
- Create: `scripts/build-quiz.mjs`
- Create: `src/data/quizRendered.js` (generated; initially empty object)
- Modify: `package.json` (devDependency + scripts)
- Test: `src/tests/buildQuiz.test.js`

**Interfaces:**
- Produces: `parseQuizXml(xml) → question[]`, `sanitize(html) → string` (named exports from the script for testing); generated module `export const QUIZ_RENDERED = { [quizId]: { en: [...], zh: [...] } }`. Question shape (dsvisual-compatible): `{ type: 'multichoice'|'truefalse'|'shortanswer', name, text, answers: [{ text, fraction, feedback }], generalFeedback, single?, usecase? }`.

- [ ] **Step 1: Install the parser**

```bash
npm install -D fast-xml-parser
```

- [ ] **Step 2: Write the failing test**

```js
// src/tests/buildQuiz.test.js
import { describe, it, expect } from 'vitest';
import { parseQuizXml, sanitize } from '../../scripts/build-quiz.mjs';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="category"><category><text>$course$/top/X</text></category></question>
  <question type="multichoice">
    <name><text>Q1</text></name>
    <questiontext format="html"><text><![CDATA[<p>Pick one</p>]]></text></questiontext>
    <single>true</single>
    <answer fraction="100"><text>right</text><feedback><text>yes</text></feedback></answer>
    <answer fraction="0"><text>wrong</text><feedback><text>no</text></feedback></answer>
    <generalfeedback><text>because</text></generalfeedback>
  </question>
  <question type="truefalse">
    <name><text>Q2</text></name>
    <questiontext format="html"><text><![CDATA[<p>True?</p>]]></text></questiontext>
    <answer fraction="100"><text>true</text></answer>
    <answer fraction="0"><text>false</text></answer>
  </question>
</quiz>`;

describe('build-quiz', () => {
  it('parses multichoice/truefalse and drops category rows', () => {
    const qs = parseQuizXml(XML);
    expect(qs).toHaveLength(2);
    expect(qs[0]).toMatchObject({
      type: 'multichoice', name: 'Q1', single: true, generalFeedback: 'because',
    });
    expect(qs[0].answers[0]).toEqual({ text: 'right', fraction: 100, feedback: 'yes' });
    expect(qs[1].type).toBe('truefalse');
  });

  it('sanitizes scripts, handlers and javascript: urls', () => {
    expect(sanitize('<p onclick="x()">a<script>bad()</script></p>'))
      .toBe('<p>a</p>');
    expect(sanitize('<a href="javascript:x">l</a>')).not.toContain('javascript:');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/tests/buildQuiz.test.js`
Expected: FAIL — script missing.

- [ ] **Step 4: Create `scripts/build-quiz.mjs`** (ESM port of dsvisual `build_quiz.js`; same parser options, sanitizer and normalization — only the module system and output differ)

```js
// Builds src/data/quizRendered.js from quizzes/{en,zh}/*.xml (Moodle XML).
// Supported question types: multichoice, truefalse, shortanswer.
// Usage: node scripts/build-quiz.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  cdataPropName: '__cdata',
  trimValues: true,
  parseTagValue: false,
  isArray: (name) => name === 'question' || name === 'answer',
});

function rawText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  const t = node.text !== undefined ? node.text : node;
  if (t == null) return '';
  if (typeof t === 'string') return t;
  if (t.__cdata !== undefined) return String(t.__cdata);
  if (t['#text'] !== undefined) return String(t['#text']);
  return '';
}

export function sanitize(html) {
  return String(html)
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

function normQuestion(q) {
  const type = q['@_type'];
  if (type !== 'multichoice' && type !== 'truefalse' && type !== 'shortanswer') return null;
  const answersRaw = q.answer || [];
  const answers = (Array.isArray(answersRaw) ? answersRaw : [answersRaw]).map((a) => ({
    text: sanitize(rawText(a)),
    fraction: parseFloat(a['@_fraction'] || '0') || 0,
    feedback: sanitize(rawText(a.feedback)),
  }));
  const out = {
    type,
    name: rawText(q.name),
    text: sanitize(rawText(q.questiontext)),
    answers,
    generalFeedback: sanitize(rawText(q.generalfeedback)),
  };
  if (type === 'multichoice') out.single = String(q.single) === 'true';
  if (type === 'shortanswer') out.usecase = String(q.usecase) === '1';
  return out;
}

export function parseQuizXml(xml) {
  const doc = parser.parse(xml);
  const questions = doc?.quiz?.question ?? [];
  return questions.map(normQuestion).filter(Boolean);
}

function buildLang(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.xml')).sort()) {
    const id = f.replace(/\.xml$/, '');
    const qs = parseQuizXml(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!qs.length) throw new Error(`quiz: no supported questions in ${dir}/${f}`);
    out[id] = qs;
  }
  return out;
}

export function buildAll() {
  const en = buildLang(path.join(ROOT, 'quizzes', 'en'));
  const zh = buildLang(path.join(ROOT, 'quizzes', 'zh'));
  const rendered = {};
  for (const id of [...new Set([...Object.keys(en), ...Object.keys(zh)])].sort()) {
    rendered[id] = { en: en[id] || [], zh: zh[id] || [] };
  }
  return rendered;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const rendered = buildAll();
  const file = path.join(ROOT, 'src', 'data', 'quizRendered.js');
  fs.writeFileSync(file,
    '// AUTO-GENERATED by scripts/build-quiz.mjs — do not edit by hand.\n'
    + '// Source of truth: quizzes/{en,zh}/*.xml\n'
    + 'export const QUIZ_RENDERED = ' + JSON.stringify(rendered, null, 2) + ';\n');
  console.log('Generated quiz banks:', Object.keys(rendered).join(', ') || '(none)');
}
```

Note the one behavior change vs dsvisual: a malformed/empty bank **throws**
(build fails loudly) instead of warning — per the spec's error-handling
section.

- [ ] **Step 5: Seed the empty generated module**

Create `src/data/quizRendered.js` by running the build with no XML present:

```bash
mkdir -p quizzes/en quizzes/zh && node scripts/build-quiz.mjs
```

Expected output: `Generated quiz banks: (none)` and the file contains
`export const QUIZ_RENDERED = {};`.

- [ ] **Step 6: Wire npm scripts**

In `package.json` `scripts`, add:
```json
    "build:quiz": "node scripts/build-quiz.mjs",
    "build:labs": "node scripts/build-labs.mjs",
```
and change `pages:prepare` to run them first:
```json
    "pages:prepare": "npm run build:quiz && npm run build:labs && npm run build:slide-decks && npm run inject-env && npm run build:standalone && node scripts/prepare-pages.mjs",
```
(`build:labs` lands in Task 9; until then it would fail if invoked — that is
fine because nothing calls `pages:prepare` in between; if the team's CI runs
it, create `scripts/build-labs.mjs` in Task 9 before pushing.)

Add empty dirs to git with `.gitkeep`:
```bash
touch quizzes/en/.gitkeep quizzes/zh/.gitkeep
```

- [ ] **Step 7: Run tests, commit**

Run: `npx vitest run src/tests/buildQuiz.test.js && npx vitest run`
Expected: PASS.

```bash
git add scripts/build-quiz.mjs src/data/quizRendered.js src/tests/buildQuiz.test.js package.json package-lock.json quizzes/
git commit -m "feat(quiz): Moodle-XML build pipeline generating src/data/quizRendered.js"
```

---

### Task 7: Quiz runtime (grader, attempts, QuizViewer) + first seed bank

**Files:**
- Create: `src/utils/quizGrade.js`, `src/utils/quizAttempts.js`
- Create: `src/components/QuizViewer.js`, `src/components/QuizViewer.css`
- Create: `quizzes/en/graph-coverage.xml`, `quizzes/zh/graph-coverage.xml`
- Modify: `src/views/unitView.js` (Quiz button), `src/i18n/dict.js`, `src/styles.css` (one `@import`)
- Regenerate: `src/data/quizRendered.js`
- Test: `src/tests/quizGrade.test.js`, `src/tests/quizAttempts.test.js`, `e2e/quiz-viewer.spec.js`

**Interfaces:**
- Consumes: `QUIZ_RENDERED` (Task 6), unit entry `quizId ?? id` (Task 1).
- Produces: `gradeQuestion(q, given) → { isCorrect, correctAnswers, feedback }`; `QuizAttempts = { record, upsert, recentFor, clearFor }` (all take `storage` first, keys `stvisual:quiz:attempts:<quizId>`); `QuizViewer = { open(quizId), close(), has(quizId) }` (singleton overlay appended to `document.body` on first `open`).

- [ ] **Step 1: Write failing grader tests**

```js
// src/tests/quizGrade.test.js
import { describe, it, expect } from 'vitest';
import { gradeQuestion } from '../utils/quizGrade.js';

const mc = {
  type: 'multichoice', single: true,
  answers: [
    { text: 'right', fraction: 100, feedback: 'yes' },
    { text: 'wrong', fraction: 0, feedback: 'no' },
  ],
  generalFeedback: 'gf',
};

describe('gradeQuestion', () => {
  it('grades single multichoice by best-fraction index', () => {
    expect(gradeQuestion(mc, 0)).toMatchObject({ isCorrect: true, correctAnswers: [0], feedback: 'yes' });
    expect(gradeQuestion(mc, 1).isCorrect).toBe(false);
    expect(gradeQuestion(mc, null).isCorrect).toBe(false);
  });

  it('grades multi-select: exact positive set, any negative kills', () => {
    const q = { type: 'multichoice', single: false, answers: [
      { text: 'a', fraction: 50 }, { text: 'b', fraction: 50 }, { text: 'c', fraction: -100 },
    ], generalFeedback: '' };
    expect(gradeQuestion(q, [0, 1]).isCorrect).toBe(true);
    expect(gradeQuestion(q, [0]).isCorrect).toBe(false);
    expect(gradeQuestion(q, [0, 1, 2]).isCorrect).toBe(false);
  });

  it('grades shortanswer case-insensitively with * wildcard', () => {
    const q = { type: 'shortanswer', usecase: false, answers: [
      { text: 'edge*coverage', fraction: 100 },
    ], generalFeedback: 'gf' };
    expect(gradeQuestion(q, 'Edge Pair Coverage').isCorrect).toBe(true);
    expect(gradeQuestion(q, 'node coverage').isCorrect).toBe(false);
    expect(gradeQuestion(q, '').isCorrect).toBe(false);
  });

  it('grades truefalse', () => {
    const q = { type: 'truefalse', answers: [
      { text: 'true', fraction: 100 }, { text: 'false', fraction: 0 },
    ], generalFeedback: '' };
    expect(gradeQuestion(q, 0).isCorrect).toBe(true);
  });
});
```

```js
// src/tests/quizAttempts.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { QuizAttempts } from '../utils/quizAttempts.js';

describe('QuizAttempts', () => {
  beforeEach(() => localStorage.clear());

  it('records newest-first and caps at 10', () => {
    for (let i = 0; i < 12; i++) {
      QuizAttempts.record(localStorage, 'graph-coverage', { id: i, correct: i });
    }
    const r = QuizAttempts.recentFor(localStorage, 'graph-coverage', 10);
    expect(r).toHaveLength(10);
    expect(r[0].id).toBe(11);
  });

  it('upsert replaces an attempt by id', () => {
    QuizAttempts.upsert(localStorage, 'x', { id: 7, correct: 1 });
    QuizAttempts.upsert(localStorage, 'x', { id: 7, correct: 5 });
    const r = QuizAttempts.recentFor(localStorage, 'x', 10);
    expect(r).toHaveLength(1);
    expect(r[0].correct).toBe(5);
  });

  it('survives corrupted storage', () => {
    localStorage.setItem('stvisual:quiz:attempts:bad', '{nope');
    expect(QuizAttempts.recentFor(localStorage, 'bad', 10)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/tests/quizGrade.test.js src/tests/quizAttempts.test.js`
Expected: FAIL — modules missing.

- [ ] **Step 3: Create `src/utils/quizGrade.js`** (straight ESM port of dsvisual `quiz_grade.js`)

```js
// Grades one quiz question. Ported from dsvisual js/quiz_grade.js.
function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function saMatch(given, answer, usecase) {
  let g = String(given == null ? '' : given).trim();
  let a = String(answer.text == null ? '' : answer.text).trim();
  if (g === '') return false;
  if (!usecase) { g = g.toLowerCase(); a = a.toLowerCase(); }
  const rx = new RegExp('^' + a.split('*').map(escRe).join('.*') + '$');
  return rx.test(g);
}

function bestIndex(answers) {
  let bi = -1, bf = 0;
  answers.forEach((a, i) => { if (a.fraction > bf) { bf = a.fraction; bi = i; } });
  return bi;
}

export function gradeQuestion(q, given) {
  if (q.type === 'shortanswer') {
    const isCorrect = q.answers.some((a) => a.fraction > 0 && saMatch(given, a, q.usecase));
    return {
      isCorrect,
      correctAnswers: q.answers.filter((a) => a.fraction > 0).map((a) => a.text),
      feedback: q.generalFeedback,
    };
  }
  if (q.type === 'truefalse' || (q.type === 'multichoice' && q.single)) {
    const ci = bestIndex(q.answers);
    const isCorrect = given === ci;
    const fb = (given != null && q.answers[given] && q.answers[given].feedback) || q.generalFeedback;
    return { isCorrect, correctAnswers: [ci], feedback: fb };
  }
  // multichoice, multiple answers: exact positive set; any negative pick kills.
  const sel = Array.isArray(given) ? [...given].sort((a, b) => a - b) : [];
  const correct = q.answers
    .map((a, i) => ({ i, f: a.fraction }))
    .filter((x) => x.f > 0).map((x) => x.i).sort((a, b) => a - b);
  const anyNeg = sel.some((i) => q.answers[i] && q.answers[i].fraction < 0);
  const isCorrect = !anyNeg && sel.length === correct.length && sel.every((v, k) => v === correct[k]);
  return { isCorrect, correctAnswers: correct, feedback: q.generalFeedback };
}
```

- [ ] **Step 4: Create `src/utils/quizAttempts.js`** (ESM port; storage key renamed to `stvisual:`)

```js
// localStorage-backed recent-attempt log (newest first, capped at 10).
// Ported from dsvisual js/quiz_attempts.js.
function key(quizId) { return 'stvisual:quiz:attempts:' + quizId; }

function recentFor(storage, quizId, limit) {
  try {
    const raw = storage.getItem(key(quizId));
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, limit || 10);
  } catch { return []; }
}

function record(storage, quizId, attempt) {
  try {
    const arr = recentFor(storage, quizId, 100);
    arr.unshift(attempt);
    storage.setItem(key(quizId), JSON.stringify(arr.slice(0, 10)));
  } catch { /* ignore quota/privacy errors */ }
}

function upsert(storage, quizId, attempt) {
  try {
    const arr = recentFor(storage, quizId, 100);
    const i = arr.findIndex((a) => a && a.id === attempt.id);
    if (i >= 0) arr[i] = attempt; else arr.unshift(attempt);
    storage.setItem(key(quizId), JSON.stringify(arr.slice(0, 10)));
  } catch { /* ignore */ }
}

function clearFor(storage, quizId) { try { storage.removeItem(key(quizId)); } catch { /* ignore */ } }

export const QuizAttempts = { key, record, upsert, recentFor, clearFor };
```

- [ ] **Step 5: Run grader/attempt tests**

Run: `npx vitest run src/tests/quizGrade.test.js src/tests/quizAttempts.test.js`
Expected: PASS.

- [ ] **Step 6: Create `src/components/QuizViewer.js`** (ESM port of dsvisual `js/quiz.js`; overlay DOM is created lazily instead of living in index.html; i18n via the app dict with English fallbacks)

```js
// Quiz overlay: practice mode (check-per-question) and test mode
// (submit-at-end), recent-attempt resume/review. Ported from dsvisual
// js/quiz.js; adapted to ESM + stvisual i18n + lazily created overlay.
import { t as tApp, getLocale } from '../i18n/index.js';
import { QUIZ_RENDERED } from '../data/quizRendered.js';
import { gradeQuestion } from '../utils/quizGrade.js';
import { QuizAttempts } from '../utils/quizAttempts.js';

let overlay = null, body = null, titleEl = null, langToggle = null, lastFocus = null;
let st = null;

function t(k, fb) { const v = tApp(k); return v !== k ? v : (fb || k); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function deckFor(id, lg) {
  const d = QUIZ_RENDERED[id];
  if (!d) return [];
  return (d[lg] && d[lg].length) ? d[lg] : (d.en || []);
}
function has(id) { return deckFor(id, 'en').length > 0 || deckFor(id, 'zh').length > 0; }
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
  langToggle.addEventListener('click', () => {
    if (!st) return;
    st.lang = st.lang === 'zh' ? 'en' : 'zh';
    const qs = deckFor(st.quizId, st.lang);
    if (qs.length) st.questions = qs;
    langToggle.textContent = st.lang === 'zh' ? '中' : 'EN';
    rerender();
  });
}

function open(quizId) {
  ensureRefs();
  const lg = getLocale() === 'zh' ? 'zh' : 'en';
  const qs = deckFor(quizId, lg);
  if (!qs.length) return;
  lastFocus = document.activeElement;
  st = { quizId, id: null, status: null, lang: lg, mode: 'practice', questions: qs, idx: 0,
    given: new Array(qs.length).fill(null), checked: new Array(qs.length).fill(false),
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
    idx: st.idx, given: st.given, checked: st.checked, startedAt: st.startedAt,
    finishedAt: null, total: st.questions.length, correct: g.correct, perQuestion: g.per,
  });
}

function rerender() {
  if (!st) return;
  if (st.phase === 'start') renderStart();
  else if (st.phase === 'summary') renderSummary();
  else renderQuestion();
}

function recentRow(a) {
  const done = isDone(a);
  const stale = !done && (!a.given || a.given.length !== st.questions.length);
  const meta = done ? `${a.correct}/${a.total}` : `${t('quiz.question', 'Q')} ${(a.idx || 0) + 1}/${a.total}`;
  const badge = done ? t('quiz.review', 'Review') : (stale ? t('quiz.inprogress', 'In progress') : t('quiz.resume', 'Resume'));
  const inner = `<span class="qr-mode">${esc(modeLabel(a.mode))}</span> <span class="qr-score">${esc(meta)}</span> <span class="qr-time">${esc(fmtTime(a.finishedAt || a.startedAt))}</span> <span class="qr-act">${esc(badge)}</span>`;
  if (done) return `<li><button type="button" class="quiz-recent-row" data-act="review" data-id="${a.id}" data-testid="quiz-recent-review">${inner}</button></li>`;
  if (stale) return `<li><span class="quiz-recent-row stale">${inner}</span></li>`;
  return `<li><button type="button" class="quiz-recent-row" data-act="resume" data-id="${a.id}" data-testid="quiz-recent-resume">${inner}</button></li>`;
}

function renderStart() {
  const recent = QuizAttempts.recentFor(localStorage, st.quizId, 10);
  body.innerHTML =
    `<div class="quiz-start">
      <p class="quiz-count">${st.questions.length} ${t('quiz.questions', 'questions')}</p>
      <div class="quiz-mode" role="radiogroup" aria-label="${esc(t('quiz.mode', 'Mode'))}">
        <label class="quiz-mode-opt"><input type="radio" name="qmode" value="practice"${st.mode === 'practice' ? ' checked' : ''}> ${t('quiz.practice', 'Practice')}</label>
        <label class="quiz-mode-opt"><input type="radio" name="qmode" value="test"${st.mode === 'test' ? ' checked' : ''}> ${t('quiz.test', 'Test')}</label>
      </div>
      <button type="button" class="btn primary" data-act="begin" data-testid="quiz-begin">${t('quiz.begin', 'Begin')}</button>
      <div class="quiz-recent" data-testid="quiz-recent"><h4>${t('quiz.recent', 'Recent attempts')}</h4>
        ${recent.length ? `<ul>${recent.map(recentRow).join('')}</ul>` : `<p class="quiz-recent-empty">${t('quiz.recent.empty', 'No attempts yet')}</p>`}
      </div>
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
    status: 'completed', idx: st.idx, given: st.given, checked: st.checked,
    startedAt: st.startedAt, finishedAt: Date.now(),
    total: st.questions.length, correct: g.correct, perQuestion: g.per,
  });
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
  const qs = deckFor(st.quizId, a.lang);
  const given = a.given || [];
  if (!qs.length || given.length !== qs.length) return; // stale — ignore
  st = { quizId: st.quizId, id: a.id, status: 'in-progress', lang: a.lang, mode: a.mode,
    questions: qs, idx: Math.min(a.idx || 0, qs.length - 1), given: [...given],
    checked: [...(a.checked || new Array(qs.length).fill(false))],
    startedAt: a.startedAt || Date.now(), phase: 'quiz', readonly: false, result: null };
  langToggle.textContent = st.lang === 'zh' ? '中' : 'EN';
  renderQuestion();
}

function review(a) {
  const qs = deckFor(st.quizId, a.lang);
  st = { quizId: st.quizId, id: a.id, status: 'completed', lang: a.lang, mode: a.mode,
    questions: qs, idx: 0, given: [...(a.given || [])], checked: [...(a.checked || [])],
    startedAt: a.startedAt, phase: 'summary', readonly: true,
    result: { total: a.total, correct: a.correct } };
  langToggle.textContent = st.lang === 'zh' ? '中' : 'EN';
  renderSummary();
}

function findAttempt(id) {
  return QuizAttempts.recentFor(localStorage, st.quizId, 10)
    .find((a) => String(a.id) === String(id)) ?? null;
}

function onBodyClick(e) {
  const b = e.target.closest?.('[data-act]');
  if (!b || !st) return;
  const act = b.getAttribute('data-act');
  if (act === 'resume') { const a = findAttempt(b.getAttribute('data-id')); if (a) resume(a); return; }
  if (act === 'review') { const a = findAttempt(b.getAttribute('data-id')); if (a) review(a); return; }
  if (act === 'begin') {
    const m = body.querySelector('input[name="qmode"]:checked');
    st.mode = m ? m.value : 'practice';
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
```

- [ ] **Step 7: Create `src/components/QuizViewer.css`** and import it

```css
.quizviewer-overlay {
  position: fixed; inset: 0; z-index: 1100;
  background: rgba(15, 23, 42, 0.55);
  display: flex; align-items: center; justify-content: center; padding: 1rem;
}
.quizviewer-panel {
  width: min(720px, 100%); max-height: 90vh; overflow: auto;
  background: var(--app-surface); color: var(--app-text);
  border-radius: var(--app-radius-lg); box-shadow: var(--app-shadow-lg);
  padding: 1.25rem;
}
.quizviewer-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.75rem; }
.quizviewer-head-tools { display: flex; gap: 0.5rem; }
.quiz-count { color: var(--app-text-muted); margin-bottom: 0.5rem; }
.quiz-mode { display: flex; gap: 1rem; margin-bottom: 0.75rem; }
.quiz-q-head { font-weight: 600; color: var(--app-text-muted); margin-bottom: 0.5rem; }
.quiz-q-text { margin-bottom: 0.75rem; }
.quiz-answers { display: flex; flex-direction: column; gap: 0.4rem; }
.quiz-ans { display: flex; gap: 0.5rem; align-items: baseline; padding: 0.45rem 0.6rem;
  border: 1px solid var(--app-border-muted); border-radius: var(--app-radius-md); cursor: pointer; }
.quiz-ans.correct { border-color: #16a34a; background: rgba(22, 163, 74, 0.08); }
.quiz-ans.wrong { border-color: #dc2626; background: rgba(220, 38, 38, 0.08); }
.quiz-sa { padding: 0.45rem 0.6rem; border: 1px solid var(--app-border); border-radius: var(--app-radius-md); width: 100%; }
.quiz-feedback { margin-top: 0.75rem; padding: 0.6rem 0.75rem; border-radius: var(--app-radius-md); }
.quiz-feedback.ok { background: rgba(22, 163, 74, 0.1); }
.quiz-feedback.bad { background: rgba(220, 38, 38, 0.1); }
.quiz-foot { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; }
.quiz-recent { margin-top: 1.25rem; }
.quiz-recent ul { list-style: none; display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.5rem; }
.quiz-recent-row { display: flex; gap: 0.75rem; width: 100%; text-align: left;
  padding: 0.4rem 0.6rem; border: 1px solid var(--app-border-muted);
  border-radius: var(--app-radius-md); background: var(--app-surface-muted); cursor: pointer; }
.quiz-recent-row.stale { opacity: 0.6; cursor: default; }
.quiz-recent-empty { color: var(--app-text-subtle); }
.quiz-review { margin-top: 0.75rem; padding-left: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
.quiz-review li.ok { border-left: 3px solid #16a34a; padding-left: 0.6rem; }
.quiz-review li.bad { border-left: 3px solid #dc2626; padding-left: 0.6rem; }
```

Add to the `@import` block at the top of `src/styles.css` (after the last
component import): `@import url('./components/QuizViewer.css');`

- [ ] **Step 8: Wire the Quiz button into the unit view**

In `src/views/unitView.js`, add imports:

```js
import { QuizViewer } from '../components/QuizViewer.js';
```

Inside `paint()`, after the fullscreen toggle inside `.unit-tools`, insert:

```js
            ${QuizViewer.has(unit.quizId ?? unit.id) ? `
              <button type="button" class="btn secondary" data-testid="unit-quiz-btn">
                ${t('btn.quiz')}
              </button>` : ''}
```

and after the lang-button wiring at the bottom of `paint()`:

```js
    container.querySelector('[data-testid="unit-quiz-btn"]')
      ?.addEventListener('click', () => QuizViewer.open(unit.quizId ?? unit.id));
```

- [ ] **Step 9: Add dict keys**

`messages.en`:
```js
    'btn.quiz': 'Quiz',
    'quiz.practice': 'Practice', 'quiz.test': 'Test', 'quiz.mode': 'Mode',
    'quiz.begin': 'Begin', 'quiz.check': 'Check', 'quiz.next': 'Next',
    'quiz.prev': 'Previous', 'quiz.submit': 'Submit', 'quiz.finish': 'Finish',
    'quiz.score': 'Score', 'quiz.retry': 'Retry', 'quiz.home': 'Back',
    'quiz.correct': 'Correct', 'quiz.incorrect': 'Incorrect',
    'quiz.question': 'Question', 'quiz.questions': 'questions',
    'quiz.recent': 'Recent attempts', 'quiz.recent.empty': 'No attempts yet',
    'quiz.review': 'Review', 'quiz.resume': 'Resume', 'quiz.inprogress': 'In progress',
```
`messages.zh`:
```js
    'btn.quiz': '自我測驗',
    'quiz.practice': '練習模式', 'quiz.test': '測驗模式', 'quiz.mode': '模式',
    'quiz.begin': '開始', 'quiz.check': '對答案', 'quiz.next': '下一題',
    'quiz.prev': '上一題', 'quiz.submit': '交卷', 'quiz.finish': '完成',
    'quiz.score': '得分', 'quiz.retry': '再測一次', 'quiz.home': '返回',
    'quiz.correct': '答對', 'quiz.incorrect': '答錯',
    'quiz.question': '第', 'quiz.questions': '題',
    'quiz.recent': '近期作答', 'quiz.recent.empty': '尚無作答紀錄',
    'quiz.review': '檢視', 'quiz.resume': '續答', 'quiz.inprogress': '作答中',
```

- [ ] **Step 10: Author the first seed bank — `quizzes/en/graph-coverage.xml`**

Six questions (4 multichoice / 1 truefalse / 1 shortanswer) on graph
coverage criteria, matching the GraphCoverageExplorer's concepts:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="category">
    <category><text>$course$/top/Graph Coverage</text></category>
  </question>
  <question type="multichoice">
    <name><text>Node vs edge coverage</text></name>
    <questiontext format="html"><text><![CDATA[<p>A test path set satisfies Node Coverage but not Edge Coverage. What must be true?</p>]]></text></questiontext>
    <single>true</single>
    <shuffleanswers>1</shuffleanswers>
    <answer fraction="100"><text>Every node is visited, but some edge is never traversed</text><feedback><text>Correct — edge coverage subsumes node coverage, not vice versa.</text></feedback></answer>
    <answer fraction="0"><text>Some node is never visited</text><feedback><text>Then node coverage would already fail.</text></feedback></answer>
    <answer fraction="0"><text>Every prime path is toured</text><feedback><text>Prime path coverage would imply edge coverage.</text></feedback></answer>
    <answer fraction="0"><text>The graph has no branches</text><feedback><text>With no branches, node coverage implies edge coverage.</text></feedback></answer>
    <generalfeedback><text>Edge coverage requires every edge; a branch can be skipped even when both its endpoints are visited via other paths.</text></generalfeedback>
  </question>
  <question type="multichoice">
    <name><text>Prime path definition</text></name>
    <questiontext format="html"><text><![CDATA[<p>A prime path is a simple path that:</p>]]></text></questiontext>
    <single>true</single>
    <answer fraction="100"><text>Is not a proper subpath of any other simple path</text><feedback><text>Correct — maximal simple paths.</text></feedback></answer>
    <answer fraction="0"><text>Starts at the entry node and ends at the exit node</text><feedback><text>That describes a complete test path, not a prime path.</text></feedback></answer>
    <answer fraction="0"><text>Visits every node exactly once</text><feedback><text>That is a Hamiltonian path.</text></feedback></answer>
    <answer fraction="0"><text>Contains no loops at all</text><feedback><text>A prime path may begin and end at the same node (a loop boundary).</text></feedback></answer>
    <generalfeedback><text>Prime paths are simple paths (no repeated nodes except possibly first = last) that are maximal — not proper subpaths of any other simple path.</text></generalfeedback>
  </question>
  <question type="multichoice">
    <name><text>Subsumption</text></name>
    <questiontext format="html"><text><![CDATA[<p>Which criterion subsumes Edge Coverage on a graph with at least one edge?</p>]]></text></questiontext>
    <single>true</single>
    <answer fraction="100"><text>Edge-Pair Coverage</text><feedback><text>Correct — covering every path of length ≤ 2 covers every length-1 path.</text></feedback></answer>
    <answer fraction="0"><text>Node Coverage</text><feedback><text>Node coverage is weaker than edge coverage.</text></feedback></answer>
    <answer fraction="0"><text>Statement Coverage</text><feedback><text>Statement coverage corresponds to node coverage.</text></feedback></answer>
    <answer fraction="0"><text>No criterion subsumes it</text><feedback><text>Edge-pair, prime path and complete path all do.</text></feedback></answer>
    <generalfeedback><text>Edge-pair coverage requires all length-≤2 paths, which includes every single edge.</text></generalfeedback>
  </question>
  <question type="multichoice">
    <name><text>DU pair</text></name>
    <questiontext format="html"><text><![CDATA[<p>In data-flow coverage, a DU pair for variable x is:</p>]]></text></questiontext>
    <single>true</single>
    <answer fraction="100"><text>A definition of x and a use of x reachable by a def-clear path</text><feedback><text>Correct.</text></feedback></answer>
    <answer fraction="0"><text>Any two statements that mention x</text><feedback><text>Mentions alone don't form a DU pair.</text></feedback></answer>
    <answer fraction="0"><text>Two consecutive assignments to x</text><feedback><text>The second assignment kills the first definition.</text></feedback></answer>
    <answer fraction="0"><text>A use of x followed by its definition</text><feedback><text>Order is definition first, then use.</text></feedback></answer>
    <generalfeedback><text>A DU pair (d, u) needs a path from d to u with no intervening redefinition of x — a def-clear path.</text></generalfeedback>
  </question>
  <question type="truefalse">
    <name><text>Complete path coverage feasibility</text></name>
    <questiontext format="html"><text><![CDATA[<p>Complete Path Coverage is infeasible on any control-flow graph that contains a loop.</p>]]></text></questiontext>
    <answer fraction="100"><text>true</text><feedback><text>Correct — a loop yields infinitely many paths.</text></feedback></answer>
    <answer fraction="0"><text>false</text><feedback><text>Loops create unbounded path counts, so complete path coverage cannot be finitely satisfied.</text></feedback></answer>
  </question>
  <question type="shortanswer">
    <name><text>Set-cover reduction</text></name>
    <questiontext format="html"><text><![CDATA[<p>stvisual reduces the selected test-path set with a greedy approximation of which classic problem? (two words)</p>]]></text></questiontext>
    <usecase>0</usecase>
    <answer fraction="100"><text>set cover*</text><feedback><text>Correct — greedy set cover.</text></feedback></answer>
    <answer fraction="100"><text>set-cover*</text><feedback><text>Correct.</text></feedback></answer>
    <generalfeedback><text>Choosing a minimal set of test paths covering all requirements is the (NP-hard) set-cover problem; the tool uses the greedy approximation.</text></generalfeedback>
  </question>
</quiz>
```

- [ ] **Step 11: Author `quizzes/zh/graph-coverage.xml`** — the same six
questions in Traditional Chinese. Same structure/fractions; translate all
`<questiontext>`, `<answer>`, `<feedback>`, `<generalfeedback>` texts. The
shortanswer keeps the English answer patterns (`set cover*`, `set-cover*`)
and its zh question text says 「請以英文兩個單字回答」.

- [ ] **Step 12: Rebuild, run all tests**

```bash
npm run build:quiz
npx vitest run
```
Expected: `Generated quiz banks: graph-coverage`; suite green.

- [ ] **Step 13: Write the e2e spec**

```js
// e2e/quiz-viewer.spec.js
import { test, expect } from '@playwright/test';

test('quiz button opens overlay; practice check grades a question', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage');
  await page.getByTestId('unit-quiz-btn').click();
  await expect(page.getByTestId('quiz-begin')).toBeVisible();
  await page.getByTestId('quiz-begin').click();
  await expect(page.getByTestId('quiz-q')).toBeVisible();
  await page.locator('.quiz-ans input').first().check();
  await page.getByTestId('quiz-check').click();
  await expect(page.getByTestId('quiz-feedback')).toBeVisible();
});

test('test mode reaches a score summary and records an attempt', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage');
  await page.getByTestId('unit-quiz-btn').click();
  await page.locator('input[name="qmode"][value="test"]').check();
  await page.getByTestId('quiz-begin').click();
  for (let i = 0; i < 5; i++) {
    const sa = page.getByTestId('quiz-sa');
    if (await sa.count()) await sa.fill('set cover');
    else await page.locator('.quiz-ans input').first().check();
    await page.locator('[data-act="next"], [data-act="submit"]').first().click();
  }
  const sa = page.getByTestId('quiz-sa');
  if (await sa.count()) { await sa.fill('set cover'); }
  else { await page.locator('.quiz-ans input').first().check(); }
  await page.getByTestId('quiz-submit').click();
  await expect(page.getByTestId('quiz-score')).toBeVisible();
});

test('escape closes the overlay', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage');
  await page.getByTestId('unit-quiz-btn').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#quiz-viewer')).toBeHidden();
});

test('units without a bank show no quiz button', async ({ page }) => {
  await page.goto('/?explorer=pairwise');
  await expect(page.getByTestId('unit-app')).toBeVisible();
  await expect(page.getByTestId('unit-quiz-btn')).toHaveCount(0);
});
```

- [ ] **Step 14: Run e2e, commit**

Run: `npx playwright test e2e/quiz-viewer.spec.js && npx playwright test`
Expected: PASS.

```bash
git add -A src/ quizzes/ e2e/quiz-viewer.spec.js
git commit -m "feat(quiz): QuizViewer overlay, grading/attempts, graph-coverage seed bank"
```

---

### Task 8: Remaining four seed quiz banks

**Files:**
- Create: `quizzes/en/logic-coverage.xml`, `quizzes/zh/logic-coverage.xml`
- Create: `quizzes/en/mutation-testing.xml`, `quizzes/zh/mutation-testing.xml`
- Create: `quizzes/en/boundary-value-equivalence.xml`, `quizzes/zh/boundary-value-equivalence.xml`
- Create: `quizzes/en/symbolic-execution.xml`, `quizzes/zh/symbolic-execution.xml`
- Regenerate: `src/data/quizRendered.js`
- Test: extend `e2e/quiz-viewer.spec.js`

Each bank follows the Task 7 Step 10 XML template exactly (category header +
6 questions: 4 `multichoice` single, 1 `truefalse`, 1 `shortanswer`; every
answer carries `feedback`, every question `generalfeedback`; zh files are
faithful Traditional-Chinese translations with English shortanswer patterns
noted in the stem).

- [ ] **Step 1: Author `logic-coverage` (en + zh)** — question specs:
  1. MC: Predicate Coverage requires each *predicate* to evaluate both true and false (distractors: each clause both ways = CC; all combinations = CoC; each path).
  2. MC: For p = a ∧ b, when does clause a *determine* p? Correct: when b is true (distractors: b false, always, never).
  3. MC: CACC vs RACC difference. Correct: RACC additionally fixes the minor clauses to identical values in the true/false pair (distractors about GACC/GICC/CoC).
  4. MC: CoC test count for a predicate with 3 independent clauses. Correct: 8 (distractors: 3, 4, 6).
  5. TF: "CACC is infeasible for a clause that cannot determine its predicate." → true.
  6. SA: Name the DNF-based criterion requiring each unique true point to be covered — answer patterns `UTPC` / `unique true point*`.

- [ ] **Step 2: Author `mutation-testing` (en + zh)** — question specs:
  1. MC: A mutant is *killed* when… Correct: some test distinguishes mutant output from original (distractors: compiles, crashes, is equivalent).
  2. MC: Mutation score formula. Correct: killed / (total − equivalent) (distractors without subtracting equivalents, etc.).
  3. MC: An *equivalent mutant* is… Correct: syntactically different but semantically identical on all inputs (distractors: identical text, dead code, crashing mutant).
  4. MC: Reachability–Infection–Propagation: which condition fails when the mutated statement executes but state never differs? Correct: infection (distractors: reachability, propagation, oracle).
  5. TF: "A test suite with 100% statement coverage always kills every non-equivalent mutant." → false.
  6. SA: The RIP-model letter for the corrupted state reaching output — patterns `propagation` / `propagat*`.

- [ ] **Step 3: Author `boundary-value-equivalence` (en + zh)** — question specs:
  1. MC: Valid equivalence classes for input 1..100. Correct: one valid class [1,100], two invalid (<1, >100) (distractor splits).
  2. MC: Standard BVA test values for [1,100]. Correct: 0,1,2,99,100,101 (distractors omitting off-points).
  3. MC: Why one value per equivalence class suffices. Correct: uniformity hypothesis — same class ⇒ same behavior (distractors: exhaustiveness, randomness, independence).
  4. MC: Weak vs strong equivalence-class testing. Correct: weak covers each class at least once, strong covers the cross-product (distractors reversed / about BVA).
  5. TF: "Off-points of a closed boundary lie just outside the domain." → true.
  6. SA: Name the fault type BVA targets — patterns `boundary*` / `off-by-one*`.

- [ ] **Step 4: Author `symbolic-execution` (en + zh)** — question specs:
  1. MC: A path condition is… Correct: conjunction of branch constraints along one path over symbolic inputs (distractors: concrete trace, coverage metric, CFG).
  2. MC: An infeasible path is detected when… Correct: its path condition is UNSAT (distractors: loop bound hit, timeout, division by zero).
  3. MC: Main scalability obstacle. Correct: path explosion (distractors: memory leaks, oracle problem, flaky tests).
  4. MC: The role of the SMT/constraint solver. Correct: produce concrete inputs satisfying a path condition (distractors: run tests, mutate code, measure coverage).
  5. TF: "Concolic execution uses a concrete run to simplify constraints symbolic execution cannot solve." → true.
  6. SA: Name the tool component that decides path-condition satisfiability — patterns `solver` / `SMT*` / `constraint solver*`.

- [ ] **Step 5: Rebuild and verify all five banks load**

```bash
npm run build:quiz
```
Expected: `Generated quiz banks: boundary-value-equivalence, graph-coverage, logic-coverage, mutation-testing, symbolic-execution`.

Run: `npx vitest run` — green.

- [ ] **Step 6: Extend the e2e spec** — append to `e2e/quiz-viewer.spec.js`:

```js
test('shared quizId: mutation-score unit opens the mutation-testing bank', async ({ page }) => {
  await page.goto('/?explorer=mutation-score');
  await page.getByTestId('unit-quiz-btn').click();
  await expect(page.getByTestId('quiz-begin')).toBeVisible();
});

test('shared quizId: equivalence-class opens boundary-value-equivalence bank', async ({ page }) => {
  await page.goto('/?explorer=equivalence-class');
  await page.getByTestId('unit-quiz-btn').click();
  await expect(page.getByTestId('quiz-begin')).toBeVisible();
});
```

- [ ] **Step 7: Run e2e, commit**

Run: `npx playwright test e2e/quiz-viewer.spec.js`
Expected: PASS.

```bash
git add quizzes/ src/data/quizRendered.js e2e/quiz-viewer.spec.js
git commit -m "feat(quiz): seed banks — logic-coverage, mutation-testing, boundary-value-equivalence, symbolic-execution"
```

---

### Task 9: Labs subsystem (pipeline, LabViewer, demo lab)

**Files:**
- Create: `scripts/build-labs.mjs`
- Create: `labs/labs.json`, `labs/graph-coverage-paths/meta.json`, `labs/graph-coverage-paths/statement.md`, `labs/graph-coverage-paths/statement.en.md`, `labs/graph-coverage-paths/samples/1.in`, `labs/graph-coverage-paths/samples/1.out`, `labs/graph-coverage-paths/samples/2.in`, `labs/graph-coverage-paths/samples/2.out`
- Create: `src/data/labRendered.js` (generated), `src/components/LabViewer.js`, `src/components/LabViewer.css`
- Modify: `src/views/unitView.js`, `src/i18n/dict.js`, `src/styles.css` (one `@import`)
- Test: `src/tests/buildLabs.test.js`, `e2e/lab-viewer.spec.js`

**Interfaces:**
- Consumes: unit `id` (Task 1).
- Produces: `mdToHtml(md) → html` (exported for tests); generated `export const LAB_RENDERED = { [unitId]: [{ slug, titleZh, titleEn, topic, week, difficulty, tags, repoUrl, judgeUrl, statementHtml: { zh, en }, samples: [{ in, out }] }] }`; `LabViewer = { open(unitId), close(), has(unitId) }`.

- [ ] **Step 1: Write the failing mdToHtml test**

```js
// src/tests/buildLabs.test.js
import { describe, it, expect } from 'vitest';
import { mdToHtml } from '../../scripts/build-labs.mjs';

describe('mdToHtml', () => {
  it('renders headings, lists, inline code, fences, and escapes HTML', () => {
    const html = mdToHtml('# Title\n\n- item `x<y`\n\n```\na < b\n```\n\npara **bold**');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<li>item <code>x&lt;y</code></li>');
    expect(html).toContain('<pre><code>a &lt; b\n</code></pre>');
    expect(html).toContain('<p>para <strong>bold</strong></p>');
    expect(html).not.toContain('x<y');
  });
});
```

Run: `npx vitest run src/tests/buildLabs.test.js` — Expected: FAIL (missing script).

- [ ] **Step 2: Create `scripts/build-labs.mjs`** (ESM port of dsvisual `build_labs.js` — same `mdToHtml`, `readSamples`, `h1Of`, `buildLabs` logic verbatim, with these deltas):

```js
// Builds src/data/labRendered.js from labs/labs.json + labs/<slug>/.
// Usage: node scripts/build-labs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LABS = path.join(ROOT, 'labs');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Minimal, dependency-free markdown: fenced code, #/##/### headings,
// "- " lists, inline `code` / **bold** / *em*, paragraphs.
export function mdToHtml(md) {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0, para = [], list = null;
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const flushPara = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const flushList = () => { if (list) { out.push('<ul>' + list.map((li) => '<li>' + inline(li) + '</li>').join('') + '</ul>'); list = null; } };
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      flushPara(); flushList();
      const buf = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++; }
      i++;
      out.push('<pre><code>' + esc(buf.join('\n')) + '\n</code></pre>');
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { flushPara(); flushList(); out.push(`<h${h[1].length}>` + inline(h[2]) + `</h${h[1].length}>`); i++; continue; }
    const li = line.match(/^\s*-\s+(.*)$/);
    if (li) { flushPara(); (list = list || []).push(li[1]); i++; continue; }
    if (line.trim() === '') { flushPara(); flushList(); i++; continue; }
    flushList(); para.push(line); i++;
  }
  flushPara(); flushList();
  return out.join('\n');
}

function readSamples(slug) {
  const dir = path.join(LABS, slug, 'samples');
  const ins = fs.readdirSync(dir).filter((f) => f.endsWith('.in')).sort();
  return ins.map((f) => ({
    in: fs.readFileSync(path.join(dir, f), 'utf8'),
    out: fs.readFileSync(path.join(dir, f.replace(/\.in$/, '.out')), 'utf8'),
  }));
}

function h1Of(md) { const m = String(md).match(/^#\s+(.+)$/m); return m ? m[1].trim() : null; }

export function buildLabs() {
  const reg = JSON.parse(fs.readFileSync(path.join(LABS, 'labs.json'), 'utf8'));
  const R = {};
  for (const [unitId, entries] of Object.entries(reg)) {
    R[unitId] = entries.map((e) => {
      const dir = path.join(LABS, e.slug);
      const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
      const zhMd = fs.readFileSync(path.join(dir, 'statement.md'), 'utf8');
      const enPath = path.join(dir, 'statement.en.md');
      const enMd = fs.existsSync(enPath) ? fs.readFileSync(enPath, 'utf8') : zhMd;
      return {
        slug: e.slug,
        titleZh: h1Of(zhMd) || meta.title || e.slug,
        titleEn: h1Of(enMd) || meta.title || e.slug,
        topic: meta.topic, week: meta.week, difficulty: meta.difficulty, tags: meta.tags || [],
        repoUrl: e.repoUrl ?? null, judgeUrl: e.judgeUrl ?? null,
        statementHtml: { zh: mdToHtml(zhMd), en: mdToHtml(enMd) },
        samples: readSamples(e.slug),
      };
    });
  }
  return R;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const rendered = buildLabs();
  const file = path.join(ROOT, 'src', 'data', 'labRendered.js');
  fs.writeFileSync(file,
    '// AUTO-GENERATED by scripts/build-labs.mjs — do not edit by hand.\n'
    + '// Source of truth: labs/labs.json + labs/<slug>/\n'
    + 'export const LAB_RENDERED = ' + JSON.stringify(rendered, null, 2) + ';\n');
  console.log('Generated labs:', Object.keys(rendered).join(', ') || '(none)');
}
```

Run: `npx vitest run src/tests/buildLabs.test.js` — Expected: PASS.

- [ ] **Step 3: Author the demo lab content**

`labs/labs.json`:
```json
{
  "graph-coverage": [
    { "slug": "graph-coverage-paths" }
  ]
}
```

`labs/graph-coverage-paths/meta.json`:
```json
{
  "title": "Prime path enumeration",
  "topic": "graph-coverage",
  "week": 4,
  "difficulty": 2,
  "tags": ["graph", "coverage", "prime-path"]
}
```

`labs/graph-coverage-paths/statement.md` (zh, Traditional Chinese):
```markdown
# 質數路徑枚舉

給定一個控制流程圖（CFG），輸出其所有 **質數路徑**（prime paths）。

## 輸入格式

- 第一行兩個整數 `n m`：節點數與邊數（節點編號 0..n-1，0 為入口，n-1 為出口）
- 接下來 `m` 行，每行兩個整數 `u v` 表示邊 u→v

## 輸出格式

每行一條質數路徑，以空白分隔節點編號；路徑依「長度遞減、再字典序」排序。

## 提示

- 質數路徑是「極大簡單路徑」：本身是簡單路徑，且不是任何其他簡單路徑的真子路徑。
- 允許首尾為同一節點（迴圈邊界）。
```

`labs/graph-coverage-paths/statement.en.md`:
```markdown
# Prime path enumeration

Given a control-flow graph (CFG), output all of its **prime paths**.

## Input

- Line 1: two integers `n m` — node and edge counts (nodes 0..n-1; 0 is the entry, n-1 the exit)
- Next `m` lines: two integers `u v` for edge u→v

## Output

One prime path per line as space-separated node ids, sorted by decreasing length, then lexicographically.

## Hints

- A prime path is a *maximal simple path*: simple, and not a proper subpath of any other simple path.
- The first and last node may coincide (a loop boundary).
```

`labs/graph-coverage-paths/samples/1.in`:
```
4 4
0 1
0 2
1 3
2 3
```
`labs/graph-coverage-paths/samples/1.out`:
```
0 1 3
0 2 3
```
`labs/graph-coverage-paths/samples/2.in`:
```
3 3
0 1
1 1
1 2
```
`labs/graph-coverage-paths/samples/2.out`:
```
0 1 2
1 1
```

Generate: `npm run build:labs` — Expected: `Generated labs: graph-coverage`.

- [ ] **Step 4: Create `src/components/LabViewer.js`**

```js
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
```

- [ ] **Step 5: Create `src/components/LabViewer.css`** (reuses quiz overlay panel classes; adds lab bits) and add `@import url('./components/LabViewer.css');` next to the QuizViewer import in `src/styles.css`:

```css
.labviewer-panel { width: min(860px, 100%); }
.lab-head { margin-bottom: 0.75rem; }
.lab-meta { color: var(--app-text-subtle); font-size: 0.85rem; margin-top: 0.25rem; }
.lab-statement { margin-bottom: 1rem; }
.lab-statement pre { background: var(--app-surface-muted); border: 1px solid var(--app-border-muted);
  border-radius: var(--app-radius-md); padding: 0.6rem 0.75rem; overflow-x: auto; }
.lab-samples { display: flex; flex-direction: column; gap: 0.75rem; margin: 0.5rem 0 1rem; }
.lab-sample { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.lab-sample pre { background: var(--app-surface-muted); border: 1px solid var(--app-border-muted);
  border-radius: var(--app-radius-md); padding: 0.5rem 0.6rem; overflow-x: auto; }
.lab-actions { display: flex; gap: 0.6rem; justify-content: flex-end; }
```

- [ ] **Step 6: Wire the Lab button into the unit view**

In `src/views/unitView.js` add `import { LabViewer } from '../components/LabViewer.js';`
then inside `.unit-tools` (after the quiz button block):

```js
            ${LabViewer.has(unit.id) ? `
              <button type="button" class="btn secondary" data-testid="unit-lab-btn">
                ${t('btn.lab')}
              </button>` : ''}
```

and its handler next to the quiz one:

```js
    container.querySelector('[data-testid="unit-lab-btn"]')
      ?.addEventListener('click', () => LabViewer.open(unit.id));
```

- [ ] **Step 7: Dict keys**

`messages.en`:
```js
    'btn.lab': 'Lab',
    'lab.difficulty': 'Difficulty', 'lab.week': 'Week', 'lab.samples': 'Samples',
    'lab.openRepo': 'Open practice repo',
    'lab.judgeSoon': 'Practice on judge (coming soon)',
```
`messages.zh`:
```js
    'btn.lab': '實驗',
    'lab.difficulty': '難度', 'lab.week': '週次', 'lab.samples': '範例輸入輸出',
    'lab.openRepo': '開啟練習 repo',
    'lab.judgeSoon': '上機練習（即將開放）',
```

- [ ] **Step 8: Write the e2e spec**

```js
// e2e/lab-viewer.spec.js
import { test, expect } from '@playwright/test';

test('lab button opens statement, samples, and a disabled judge button', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage');
  await page.getByTestId('unit-lab-btn').click();
  await expect(page.getByTestId('lab-statement')).toBeVisible();
  await expect(page.getByTestId('lab-samples')).toBeVisible();
  const judge = page.getByTestId('lab-judge');
  await expect(judge).toBeDisabled();
  await expect(judge).toContainText(/coming soon|即將開放/);
});

test('lab language toggle swaps the statement', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage&lang=en');
  await page.getByTestId('unit-lab-btn').click();
  await expect(page.getByTestId('lab-statement')).toContainText('Prime path');
  await page.getByTestId('lab-lang-toggle').click();
  await expect(page.getByTestId('lab-statement')).toContainText('質數路徑');
});

test('units without labs show no lab button', async ({ page }) => {
  await page.goto('/?explorer=logic-coverage');
  await expect(page.getByTestId('unit-app')).toBeVisible();
  await expect(page.getByTestId('unit-lab-btn')).toHaveCount(0);
});
```

- [ ] **Step 9: Run everything, commit**

Run: `npm run build:labs && npx vitest run && npx playwright test`
Expected: PASS.

```bash
git add -A scripts/build-labs.mjs labs/ src/ e2e/lab-viewer.spec.js
git commit -m "feat(labs): build pipeline, LabViewer overlay, graph-coverage demo lab (judge coming soon)"
```

---

### Task 10: Standalone bundle, README, final verification

**Files:**
- Regenerate: `src/standalone.js` (committed esbuild bundle for `file:` usage)
- Modify: `README.md`

- [ ] **Step 1: Rebuild the standalone bundle**

```bash
npm run build:standalone
```
Expected: `Built standalone bundle at src/standalone.js` (the bundle enters
via `src/main.js`, so the new dispatcher/views/data ride along automatically).

- [ ] **Step 2: README section**

After the "Feature Highlights" heading in `README.md`, insert:

```markdown
### Unit View (classroom mode)

Every Explorer now has a single-window unit view for projection:
`?explorer=graph-coverage` (kebab id) or `?explorer=GraphCoverageExplorer`.
The ⛶ button enters a fullscreen focus mode (Esc or the floating ✕ exits).
The classic integrated page is still available via the Overview and
`?view=all&section=…` links; category-nav dropdowns list every unit.

### Quiz banks and labs

- `quizzes/{en,zh}/<id>.xml` are Moodle-XML question banks;
  `npm run build:quiz` regenerates `src/data/quizRendered.js` (committed).
  Units with a bank show a Quiz button (practice / test modes, recent
  attempts in localStorage).
- `labs/labs.json` + `labs/<slug>/` define practice labs;
  `npm run build:labs` regenerates `src/data/labRendered.js`. The judge
  button is a "coming soon" placeholder until a judge URL is wired up.
```

- [ ] **Step 3: Full verification**

```bash
npx vitest run
npx playwright test
npm run build
```
Expected: all green; Vite production build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/standalone.js README.md
git commit -m "chore: rebuild standalone bundle; document unit view, quiz banks, labs"
```

---

## Plan Self-Review Notes

- Spec coverage: registry (§1→Task 1), unit view + focus (§2→Task 4), nav +
  preserved integrated page (§3→Tasks 3/5), quiz subsystem + 5 seed banks +
  `quizId` sharing (§4→Tasks 6/7/8), labs + coming-soon judge (§5→Task 9),
  shell decomposition (§6→Task 3; `shell/nav.js` was folded into
  `integratedView.js`'s existing `renderNav` — extracting it would touch far
  more integrated-view internals than the feature needs), error handling
  (§7→Tasks 3/4/6), testing (§8→every task).
- The spec's "43 Explorers" undercounts: `EXPLORER_TO_LOCATION` has 69
  entries today. The registry/test cover ALL of them dynamically.
- `?explorer=` semantic change deliberately breaks old deep-link behavior
  (unit view instead of integrated scroll); Task 4 Step 10 updates affected
  legacy e2e assertions.
