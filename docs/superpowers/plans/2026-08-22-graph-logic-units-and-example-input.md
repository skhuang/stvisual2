# Graph/Logic Family Units + Example-Input System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Graph and Logic coverage explorers into per-family classroom units (reusing the explorers via an additive `preset` mode), and give both a dsvisual-style example/input surface (preset dropdown + recent-10 history + global difficulty + 🎲 random) built from shared, reusable modules.

**Architecture:** Six shared modules (examples store, global difficulty state, RNG helpers, two domain random-generators, a shared ExampleControls row) are built first. The two explorers gain an additive `opts.preset` focus mode and mount ExampleControls. The registry/router/nav gain 7 pseudo-component family units; `graph`/`logic` become tabbed sections in the integrated view; both view headers get the global difficulty selector.

**Tech Stack:** Vanilla ES modules (browser-native, relative imports only — the app runs unbundled via `python3 -m http.server`), Vitest (jsdom), Playwright, esbuild (committed `src/standalone.js` bundle).

**Specs:**
- `docs/superpowers/specs/2026-08-22-graph-logic-family-units-design.md`
- `docs/superpowers/specs/2026-08-22-example-input-system-design.md`

## Global Constraints

- Browser-native ESM, **relative import paths only**; no bare specifiers (unbundled runtime).
- Additive only in the two explorers: with `opts.preset` absent, existing behavior, tests, and every existing `data-testid` are unchanged.
- zh copy is Traditional Chinese (繁體中文).
- i18n: flat keys in `src/i18n/dict.js` under `messages.en` / `messages.zh`; `t(key, params)` interpolates `{name}` and returns the key string when missing (a second arg to a custom `t(key, fallback)` is only used by QuizViewer-style helpers — the app's shared `t` from `src/i18n/index.js` takes `(key, params)`).
- Explorer factories return a DOM element; mount via `appendChild`.
- localStorage keys: `stvisual:examples:<methodId>`, `stvisual:input-difficulty`. Difficulty vocab: `normal | special | edge | large` (default `normal`).
- Recent-input history cap: **10**.
- Every task: `npx vitest run` green before commit. Tasks that touch views/explorers also run the relevant Playwright spec.
- **E2E infra:** Playwright runs against `http://localhost:4174` served by an HTTP/1.1 keep-alive python server that must already be running (`cd <worktree> && python3 -m http.server 4174 --bind ::1 --protocol HTTP/1.1 &`). Run at most ONE playwright invocation at a time; never orphan servers. `navigation-state.spec.js:147` is a pre-existing self-skip; `accessibility-navigation.spec.js:28` is a known load-flake that passes in isolation — if only it fails, it is not a regression.
- Commit style: Conventional Commits with trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File structure

New shared modules:
- `src/utils/examplesStore.js` — recent-input history (localStorage).
- `src/utils/inputDifficulty.js` — global difficulty state + change events.
- `src/utils/randomInput.js` — seedable RNG helpers + difficulty vocab.
- `src/data/graphCoverageRandom.js` — CFG preset/random per difficulty.
- `src/data/logicCoverageRandom.js` — predicate preset/random per difficulty.
- `src/components/ExampleControls.js` (+ `.css`) — shared dropdown + 🎲 row.

Modified:
- `src/components/GraphCoverageExplorer.js`, `src/components/LogicCoverageExplorer.js` — preset mode + ExampleControls.
- `src/data/explorerUnits.js`, `src/data/explorerFactories.js`, `src/utils/urlRouter.js`, `src/utils/unitTitles.js`, `src/i18n/dict.js` — 7 family units + tab wiring.
- `src/views/integratedView.js` — graph/logic tabbed sections + header difficulty select.
- `src/views/unitView.js` — header difficulty select.
- `src/styles.css` — one `@import` for ExampleControls.css.
- `src/standalone.js` — regenerated.

---

### Task 1: examplesStore util

**Files:**
- Create: `src/utils/examplesStore.js`
- Test: `src/tests/examplesStore.test.js`

**Interfaces:**
- Produces: `key(methodId) -> string`, `load(storage, methodId) -> Array<{text}>`, `save(storage, methodId, text, defaultText, cap=10) -> void`.

- [ ] **Step 1: Write the failing test**
```js
// src/tests/examplesStore.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { key, load, save } from '../utils/examplesStore.js';

describe('examplesStore', () => {
  beforeEach(() => localStorage.clear());

  it('namespaces the key', () => {
    expect(key('graph')).toBe('stvisual:examples:graph');
  });

  it('saves newest-first, dedupes, and caps at 10', () => {
    for (let i = 0; i < 12; i++) save(localStorage, 'graph', `input-${i}`, 'DEFAULT');
    const r = load(localStorage, 'graph');
    expect(r).toHaveLength(10);
    expect(r[0].text).toBe('input-11');
    save(localStorage, 'graph', 'input-11', 'DEFAULT'); // dedupe -> back to front, still 10
    const r2 = load(localStorage, 'graph');
    expect(r2).toHaveLength(10);
    expect(r2[0].text).toBe('input-11');
  });

  it('skips empty and default text', () => {
    save(localStorage, 'g', '', 'DEFAULT');
    save(localStorage, 'g', 'DEFAULT', 'DEFAULT');
    expect(load(localStorage, 'g')).toEqual([]);
  });

  it('returns [] on corrupt storage', () => {
    localStorage.setItem('stvisual:examples:bad', '{not json');
    expect(load(localStorage, 'bad')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `npx vitest run src/tests/examplesStore.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/examplesStore.js`**
```js
// Recent-input history, localStorage-backed. Ported from dsvisual
// js/examples_store.js; cap default raised to 10.
export function key(methodId) { return 'stvisual:examples:' + methodId; }

export function load(storage, methodId) {
  try {
    const raw = storage.getItem(key(methodId));
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter((e) => e && typeof e.text === 'string');
  } catch { return []; }
}

export function save(storage, methodId, text, defaultText, cap = 10) {
  try {
    if (text == null) return;
    text = String(text);
    if (text === '' || text === defaultText) return;
    const arr = load(storage, methodId).filter((e) => e.text !== text);
    arr.unshift({ text });
    storage.setItem(key(methodId), JSON.stringify(arr.slice(0, cap)));
  } catch { /* storage unavailable */ }
}
```

- [ ] **Step 4: Run to verify it passes**
Run: `npx vitest run src/tests/examplesStore.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Full suite + commit**
Run: `npx vitest run`
```bash
git add src/utils/examplesStore.js src/tests/examplesStore.test.js
git commit -m "feat(input): examplesStore — localStorage recent-input history (cap 10)"
```

---

### Task 2: inputDifficulty global state

**Files:**
- Create: `src/utils/inputDifficulty.js`
- Test: `src/tests/inputDifficulty.test.js`

**Interfaces:**
- Produces: `INPUT_DIFFICULTIES: string[]`, `getInputDifficulty() -> string`, `setInputDifficulty(tier, {persist=true}) -> void`, `onInputDifficultyChange(cb) -> () => void`.

- [ ] **Step 1: Write the failing test**
```js
// src/tests/inputDifficulty.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { INPUT_DIFFICULTIES, getInputDifficulty, setInputDifficulty, onInputDifficultyChange } from '../utils/inputDifficulty.js';

describe('inputDifficulty', () => {
  beforeEach(() => { localStorage.clear(); setInputDifficulty('normal', { persist: false }); });
  afterEach(() => setInputDifficulty('normal', { persist: false }));

  it('exposes the four tiers and defaults to normal', () => {
    expect(INPUT_DIFFICULTIES).toEqual(['normal', 'special', 'edge', 'large']);
    expect(getInputDifficulty()).toBe('normal');
  });

  it('set persists and notifies; unknown tier is ignored', () => {
    let seen = null;
    const off = onInputDifficultyChange((t) => { seen = t; });
    setInputDifficulty('large');
    expect(getInputDifficulty()).toBe('large');
    expect(seen).toBe('large');
    expect(localStorage.getItem('stvisual:input-difficulty')).toBe('large');
    setInputDifficulty('nope');
    expect(getInputDifficulty()).toBe('large');
    off();
    setInputDifficulty('edge');
    expect(seen).toBe('large'); // unsubscribed
  });
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `npx vitest run src/tests/inputDifficulty.test.js` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/utils/inputDifficulty.js`**
```js
// Global "random-input difficulty" state, shape mirrors src/i18n/index.js.
const STORAGE_KEY = 'stvisual:input-difficulty';
export const INPUT_DIFFICULTIES = ['normal', 'special', 'edge', 'large'];
const DEFAULT = 'normal';

let current = (() => {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (saved && INPUT_DIFFICULTIES.includes(saved)) return saved;
  } catch {}
  return DEFAULT;
})();

const listeners = new Set();

export function getInputDifficulty() { return current; }

export function setInputDifficulty(tier, { persist = true } = {}) {
  if (!INPUT_DIFFICULTIES.includes(tier) || tier === current) return;
  current = tier;
  if (persist) { try { globalThis.localStorage?.setItem(STORAGE_KEY, tier); } catch {} }
  listeners.forEach((cb) => { try { cb(tier); } catch (err) { console.error(err); } });
}

export function onInputDifficultyChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
```

- [ ] **Step 4: Run to verify it passes**
Run: `npx vitest run src/tests/inputDifficulty.test.js` — Expected: PASS.

- [ ] **Step 5: Full suite + commit**
Run: `npx vitest run`
```bash
git add src/utils/inputDifficulty.js src/tests/inputDifficulty.test.js
git commit -m "feat(input): global inputDifficulty state (normal/special/edge/large)"
```

---

### Task 3: randomInput RNG helpers

**Files:**
- Create: `src/utils/randomInput.js`
- Test: `src/tests/randomInput.test.js`

**Interfaces:**
- Produces: `makeRng(seed?) -> () => number` (deterministic when seeded), `randInt(rng, lo, hi) -> int` (inclusive), `pick(rng, arr) -> item`, `shuffle(rng, arr) -> new array`, `uniqueInts(rng, n, lo, hi) -> int[]`, `DIFFICULTIES: string[]`.

- [ ] **Step 1: Write the failing test**
```js
// src/tests/randomInput.test.js
import { describe, it, expect } from 'vitest';
import { makeRng, randInt, pick, shuffle, uniqueInts, DIFFICULTIES } from '../utils/randomInput.js';

describe('randomInput helpers', () => {
  it('makeRng(seed) is deterministic and in [0,1)', () => {
    const a = makeRng(42), b = makeRng(42);
    const seqA = [a(), a(), a()], seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    seqA.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); });
  });
  it('randInt is inclusive within range', () => {
    const rng = makeRng(1);
    for (let i = 0; i < 200; i++) { const v = randInt(rng, 3, 7); expect(v).toBeGreaterThanOrEqual(3); expect(v).toBeLessThanOrEqual(7); }
  });
  it('uniqueInts returns n distinct values in range', () => {
    const r = uniqueInts(makeRng(2), 5, 0, 9);
    expect(new Set(r).size).toBe(5);
    r.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(9); });
  });
  it('shuffle preserves elements and does not mutate input', () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(makeRng(3), src);
    expect(out).not.toBe(src);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });
  it('pick returns a member', () => {
    expect(['a', 'b', 'c']).toContain(pick(makeRng(4), ['a', 'b', 'c']));
  });
  it('exposes the difficulty vocab', () => {
    expect(DIFFICULTIES).toEqual(['normal', 'special', 'edge', 'large']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `npx vitest run src/tests/randomInput.test.js` — Expected: FAIL.

- [ ] **Step 3: Implement `src/utils/randomInput.js`**
```js
// Seedable RNG + helpers for domain random-input generators.
export const DIFFICULTIES = ['normal', 'special', 'edge', 'large'];

// mulberry32 — deterministic when seeded; time-seeded otherwise.
export function makeRng(seed) {
  let a = (seed == null) ? ((Math.random() * 2 ** 32) >>> 0) : (seed >>> 0);
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function uniqueInts(rng, n, lo, hi) {
  const pool = [];
  for (let v = lo; v <= hi; v++) pool.push(v);
  return shuffle(rng, pool).slice(0, n);
}
```

- [ ] **Step 4: Run to verify it passes**
Run: `npx vitest run src/tests/randomInput.test.js` — Expected: PASS.

- [ ] **Step 5: Full suite + commit**
Run: `npx vitest run`
```bash
git add src/utils/randomInput.js src/tests/randomInput.test.js
git commit -m "feat(input): seedable RNG helpers + difficulty vocab (randomInput)"
```

---

### Task 4: graphCoverageRandom domain generator

**Files:**
- Create: `src/data/graphCoverageRandom.js`
- Test: `src/tests/coverageRandom.test.js` (graph portion; logic added in Task 5)

**Interfaces:**
- Consumes: `makeRng`, `randInt`, `pick` from `../utils/randomInput.js`.
- Produces (graph shape matches `graphCoverageGraph` in `src/data/testingData.js`: `{ id, title, titleEn, startNodeId, endNodeId, nodes:[{id,label,x,y,kind}], edges:[{id,from,to,control?}] }`):
  - `presetForDifficulty(tier) -> graph` (deterministic per tier),
  - `randomGraph(tier, rng = makeRng()) -> graph` (valid, connected S→T),
  - `graphToEdgesText(graph) -> string` (one `id,from,to` per line, matching the explorer's edges-text format),
  - `edgesTextLooksValid(text) -> boolean` (lightweight guard used in tests).

**Context on the edges-text format:** `GraphCoverageExplorer.js` serializes edges as lines `id,from,to` (or `from,to`, or `id,from,to,cx,cy`). Nodes are laid out on a grid. Keep node ids single uppercase letters starting `S` (start) … `T` (end). Produce coordinates on a simple left-to-right grid so the CFG renders (x increases with depth, y spreads siblings).

- [ ] **Step 1: Write the failing test (graph section)**
```js
// src/tests/coverageRandom.test.js
import { describe, it, expect } from 'vitest';
import { makeRng } from '../utils/randomInput.js';
import * as G from '../data/graphCoverageRandom.js';

const TIERS = ['normal', 'special', 'edge', 'large'];

function reachable(graph) {
  const adj = new Map(graph.nodes.map((n) => [n.id, []]));
  graph.edges.forEach((e) => adj.get(e.from)?.push(e.to));
  const seen = new Set([graph.startNodeId]);
  const stack = [graph.startNodeId];
  while (stack.length) { for (const nx of adj.get(stack.pop()) || []) if (!seen.has(nx)) { seen.add(nx); stack.push(nx); } }
  return seen;
}

describe('graphCoverageRandom', () => {
  it('presetForDifficulty returns a connected S→T CFG for every tier', () => {
    for (const tier of TIERS) {
      const g = G.presetForDifficulty(tier);
      expect(g.nodes.length).toBeGreaterThanOrEqual(2);
      expect(g.startNodeId).toBeTruthy();
      expect(g.endNodeId).toBeTruthy();
      expect(reachable(g).has(g.endNodeId)).toBe(true);
    }
  });
  it('randomGraph (seeded) is connected S→T and matches tier size bands', () => {
    for (const tier of TIERS) {
      const g = G.randomGraph(tier, makeRng(7));
      expect(reachable(g).has(g.endNodeId)).toBe(true);
      const n = g.nodes.length;
      if (tier === 'edge') expect(n).toBeLessThanOrEqual(4);
      if (tier === 'large') expect(n).toBeGreaterThanOrEqual(10);
    }
  });
  it('graphToEdgesText emits id,from,to lines the explorer format accepts', () => {
    const g = G.presetForDifficulty('normal');
    const text = G.graphToEdgesText(g);
    expect(text.split('\n').length).toBe(g.edges.length);
    text.split('\n').forEach((line) => expect(line.split(',').length).toBeGreaterThanOrEqual(3));
    expect(G.edgesTextLooksValid(text)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `npx vitest run src/tests/coverageRandom.test.js` — Expected: FAIL.

- [ ] **Step 3: Implement `src/data/graphCoverageRandom.js`**

Implement four exports. Node layout: assign nodes to columns (depth) left→right at `x = 80 + depth*140`, spread siblings vertically around `y = 170` by `±90`. Always include `S` (kind `start`) and `T` (kind `end`). Edge ids are `from-to`. Guarantee connectivity by building a spine `S → n1 → … → T` first, then adding tier-specific branches/loops.

```js
import { makeRng, randInt, pick } from '../utils/randomInput.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQR'.split('');

function node(id, depth, row, kind) {
  return { id, label: id === 'S' ? 'Start' : id === 'T' ? 'End' : id, x: 80 + depth * 140, y: 170 + row * 90, kind: kind || 'node' };
}
function graphFrom(nodes, edges) {
  return { id: 'random-cfg', title: '隨機控制流程圖', titleEn: 'Random CFG',
    startNodeId: 'S', endNodeId: 'T', nodes, edges: edges.map((e) => ({ id: `${e.from}-${e.to}`, from: e.from, to: e.to, ...(e.control ? { control: e.control } : {}) })) };
}

// Build a spine S -> mids... -> T with `branchCount` diamond branches and
// `loopCount` back-edges. midCount excludes S and T.
function build(midCount, branchCount, loopCount) {
  const mids = LETTERS.slice(0, midCount);
  const chain = ['S', ...mids, 'T'];
  const nodes = chain.map((id, i) => node(id, i, 0, id === 'S' ? 'start' : id === 'T' ? 'end' : 'node'));
  const edges = [];
  for (let i = 0; i < chain.length - 1; i++) edges.push({ from: chain[i], to: chain[i + 1] });
  // diamonds: pick a chain node, add a parallel sibling that rejoins the next node
  let sib = 0;
  for (let b = 0; b < branchCount && b + 1 < mids.length; b++) {
    const at = 1 + b; // index into chain, a mid node
    const from = chain[at - 1], rejoin = chain[at + 1];
    const sibId = `X${sib++}`;
    nodes.push(node(sibId, at, 1));
    // mark the fork node as a decision
    const forkNode = nodes.find((n) => n.id === from); if (forkNode && forkNode.kind === 'node') forkNode.kind = 'decision';
    edges.push({ from, to: sibId }, { from: sibId, to: rejoin });
  }
  // loops: add a back-edge from a later mid to an earlier mid
  for (let l = 0; l < loopCount && mids.length >= 2; l++) {
    const hi = 1 + Math.min(mids.length - 1, 2 + l), lo = 1 + Math.min(mids.length - 2, l);
    if (hi > lo) edges.push({ from: chain[hi], to: chain[lo], control: { x: 80 + lo * 140, y: 40 } });
  }
  return graphFrom(nodes, edges);
}

export function presetForDifficulty(tier) {
  switch (tier) {
    case 'edge':    return build(1, 0, 0);            // S -> A -> T
    case 'large':   return build(8, 3, 2);
    case 'special': return build(4, 2, 2);            // loops + branches
    case 'normal':
    default:        return build(3, 1, 1);
  }
}

export function randomGraph(tier, rng = makeRng()) {
  switch (tier) {
    case 'edge':    return build(randInt(rng, 1, 2), 0, 0);
    case 'large':   return build(randInt(rng, 8, 12), randInt(rng, 2, 3), randInt(rng, 1, 2));
    case 'special': return build(randInt(rng, 4, 6), randInt(rng, 1, 2), 2);
    case 'normal':
    default:        return build(randInt(rng, 3, 5), randInt(rng, 1, 2), pick(rng, [0, 1]));
  }
}

export function graphToEdgesText(graph) {
  return graph.edges.map((e) => `${e.id || `${e.from}-${e.to}`},${e.from},${e.to}`).join('\n');
}

export function edgesTextLooksValid(text) {
  return String(text).trim().split('\n').every((l) => l.split(',').length >= 3);
}
```

- [ ] **Step 4: Run to verify it passes**
Run: `npx vitest run src/tests/coverageRandom.test.js` — Expected: PASS (graph tests).

- [ ] **Step 5: Full suite + commit**
Run: `npx vitest run`
```bash
git add src/data/graphCoverageRandom.js src/tests/coverageRandom.test.js
git commit -m "feat(input): graphCoverageRandom — per-difficulty CFG preset/random"
```

---

### Task 5: logicCoverageRandom domain generator

**Files:**
- Create: `src/data/logicCoverageRandom.js`
- Test: extend `src/tests/coverageRandom.test.js` with a logic block.

**Interfaces:**
- Consumes: `makeRng`, `randInt`, `pick` from `../utils/randomInput.js`.
- Produces: `presetForDifficulty(tier) -> { expression, bindings }`, `randomPredicate(tier, rng = makeRng()) -> { expression, bindings }`. `expression` uses clause letters `a,b,c,…`, operators `&&`/`||`, and parentheses; `bindings` maps each clause letter to a JS boolean expression string (e.g. `{ a: 'x > 0' }`) mirroring `logicCoveragePredicates` in `testingData.js`.

- [ ] **Step 1: Add the failing logic test block**
```js
// append to src/tests/coverageRandom.test.js
import * as Lg from '../data/logicCoverageRandom.js';

function clauseSet(expr) { return new Set((expr.match(/[a-z]/g) || [])); }

describe('logicCoverageRandom', () => {
  const TIERS = ['normal', 'special', 'edge', 'large'];
  it('presetForDifficulty yields a parseable predicate per tier', () => {
    for (const tier of TIERS) {
      const { expression, bindings } = Lg.presetForDifficulty(tier);
      expect(typeof expression).toBe('string');
      expect(expression.length).toBeGreaterThan(0);
      clauseSet(expression).forEach((c) => expect(bindings[c]).toBeTruthy());
    }
  });
  it('randomPredicate (seeded) respects tier clause-count bands', () => {
    expect(clauseSet(Lg.randomPredicate('edge', makeRng(1)).expression).size).toBe(1);
    const normal = clauseSet(Lg.randomPredicate('normal', makeRng(1)).expression).size;
    expect(normal).toBeGreaterThanOrEqual(2); expect(normal).toBeLessThanOrEqual(3);
    expect(clauseSet(Lg.randomPredicate('large', makeRng(1)).expression).size).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `npx vitest run src/tests/coverageRandom.test.js` — Expected: FAIL (logic module missing).

- [ ] **Step 3: Implement `src/data/logicCoverageRandom.js`**
```js
import { makeRng, randInt, pick } from '../utils/randomInput.js';

const CLAUSES = 'abcdef'.split('');
const PARAMS = { a: 'x > 0', b: 'y > 0', c: 'z === 0', d: 'w < 10', e: 'p !== q', f: 'r >= 0' };

function bindingsFor(letters) {
  const out = {};
  letters.forEach((c) => { out[c] = PARAMS[c]; });
  return out;
}

// Join clause letters with a mix of && / || and one grouping.
function buildExpr(letters, ops) {
  if (letters.length === 1) return letters[0];
  // group the first two under parentheses when >2 clauses for readable nesting
  let expr = letters[0];
  for (let i = 1; i < letters.length; i++) expr += ` ${ops[(i - 1) % ops.length]} ${letters[i]}`;
  if (letters.length >= 3) expr = `(${letters[0]} ${ops[0]} ${letters[1]})` + expr.slice((letters[0] + ` ${ops[0]} ` + letters[1]).length);
  return expr;
}

export function presetForDifficulty(tier) {
  switch (tier) {
    case 'edge':    return { expression: 'a', bindings: bindingsFor(['a']) };
    case 'large':   return { expression: '((a && b) || (c && d)) || (e && f)', bindings: bindingsFor(['a','b','c','d','e','f']) };
    case 'special': return { expression: 'a && b && a', bindings: bindingsFor(['a','b']) };
    case 'normal':
    default:        return { expression: '(a && b) || c', bindings: bindingsFor(['a','b','c']) };
  }
}

export function randomPredicate(tier, rng = makeRng()) {
  let n;
  switch (tier) {
    case 'edge': return { expression: 'a', bindings: bindingsFor(['a']) };
    case 'large': n = randInt(rng, 4, 6); break;
    case 'special': {
      const op = pick(rng, ['&&', '||']);
      const letters = CLAUSES.slice(0, randInt(rng, 2, 3));
      return { expression: letters.join(` ${op} `), bindings: bindingsFor(letters) };
    }
    case 'normal':
    default: n = randInt(rng, 2, 3);
  }
  const letters = CLAUSES.slice(0, n);
  const ops = [pick(rng, ['&&', '||']), pick(rng, ['&&', '||'])];
  return { expression: buildExpr(letters, ops), bindings: bindingsFor(letters) };
}
```

- [ ] **Step 4: Run to verify it passes**
Run: `npx vitest run src/tests/coverageRandom.test.js` — Expected: PASS (graph + logic).
Note: if `buildExpr`'s grouping produces a malformed string for any tier, simplify to `letters.map(...).join` with a single leading parenthesized pair — the test only requires parseable clause letters + count; keep the expression well-formed (balanced parens).

- [ ] **Step 5: Full suite + commit**
Run: `npx vitest run`
```bash
git add src/data/logicCoverageRandom.js src/tests/coverageRandom.test.js
git commit -m "feat(input): logicCoverageRandom — per-difficulty predicate preset/random"
```

---

### Task 6: ExampleControls shared component

**Files:**
- Create: `src/components/ExampleControls.js`, `src/components/ExampleControls.css`
- Modify: `src/styles.css` (add `@import url('./components/ExampleControls.css');` next to the other component imports)
- Modify: `src/i18n/dict.js` (example.* + settings.difficulty + difficulty.* keys)
- Test: `src/tests/exampleControls.test.js`

**Interfaces:**
- Consumes: `load` from `../utils/examplesStore.js`; `getInputDifficulty` from `../utils/inputDifficulty.js`; `t` from `../i18n/index.js`.
- Produces: `createExampleControls({ methodId, getDefaultText, presets, onLoad, onRandom }) -> { element, refresh }` where `presets` is `Array<{ value, label }>` (value is the loadable text), `onLoad(text)` fires on dropdown pick, `onRandom()` fires on 🎲 click (the caller generates + loads), `getDefaultText()` returns the current-difficulty default text (excluded from the recent list), `refresh()` rebuilds the recent options.

- [ ] **Step 1: Add dict keys** (both locales) in `src/i18n/dict.js`:
`messages.en`:
```js
    'example.pick': 'Examples…',
    'example.currentDefault': 'Current-difficulty default',
    'example.random': 'Random input',
    'settings.difficulty': 'Random-input difficulty',
    'difficulty.normal': 'Normal', 'difficulty.special': 'Special',
    'difficulty.edge': 'Edge case', 'difficulty.large': 'Large',
```
`messages.zh`:
```js
    'example.pick': '範例…',
    'example.currentDefault': '目前難度預設',
    'example.random': '隨機輸入',
    'settings.difficulty': '隨機輸入難度',
    'difficulty.normal': '一般', 'difficulty.special': '特殊',
    'difficulty.edge': '邊界', 'difficulty.large': '大型',
```

- [ ] **Step 2: Write the failing test**
```js
// src/tests/exampleControls.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createExampleControls } from '../components/ExampleControls.js';
import { save } from '../utils/examplesStore.js';

describe('ExampleControls', () => {
  beforeEach(() => localStorage.clear());

  it('lists placeholder + current-default + presets + recent, and fires callbacks', () => {
    save(localStorage, 'graph', 'RECENT-1', 'DEFAULT');
    const onLoad = vi.fn(), onRandom = vi.fn();
    const { element, refresh } = createExampleControls({
      methodId: 'graph',
      getDefaultText: () => 'DEFAULT',
      presets: [{ value: 'PRESET-A', label: 'Preset A' }],
      onLoad, onRandom,
    });
    const select = element.querySelector('[data-testid="ex-select"]');
    const values = [...select.options].map((o) => o.value);
    expect(values).toContain('DEFAULT');     // current-default option
    expect(values).toContain('PRESET-A');    // preset
    expect(values).toContain('RECENT-1');    // recent
    // pick a preset -> onLoad
    select.value = 'PRESET-A';
    select.dispatchEvent(new Event('change'));
    expect(onLoad).toHaveBeenCalledWith('PRESET-A');
    // 🎲 -> onRandom
    element.querySelector('[data-testid="ex-random"]').click();
    expect(onRandom).toHaveBeenCalled();
    // refresh picks up a new saved entry
    save(localStorage, 'graph', 'RECENT-2', 'DEFAULT');
    refresh();
    expect([...element.querySelector('[data-testid="ex-select"]').options].map((o) => o.value)).toContain('RECENT-2');
  });
});
```

- [ ] **Step 3: Run to verify it fails**
Run: `npx vitest run src/tests/exampleControls.test.js` — Expected: FAIL.

- [ ] **Step 4: Implement `src/components/ExampleControls.js`**
```js
import { t } from '../i18n/index.js';
import { load } from '../utils/examplesStore.js';

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const truncate = (s) => String(s).length > 28 ? String(s).slice(0, 28) + '…' : String(s);

export function createExampleControls({ methodId, getDefaultText, presets = [], onLoad, onRandom }) {
  const element = document.createElement('div');
  element.className = 'example-controls';

  function optionsHtml() {
    const def = getDefaultText();
    let html = `<option value="">${esc(t('example.pick'))}</option>`;
    html += `<option value="${esc(def)}">${esc(t('example.currentDefault'))}</option>`;
    for (const p of presets) {
      if (p.value === def) continue;
      html += `<option value="${esc(p.value)}">${esc(p.label)}</option>`;
    }
    for (const entry of load(localStorage, methodId)) {
      if (entry.text === def) continue;
      html += `<option value="${esc(entry.text)}">${esc(truncate(entry.text))}</option>`;
    }
    return html;
  }

  function paint() {
    element.innerHTML = `
      <select class="ex-select" data-testid="ex-select" aria-label="${esc(t('example.pick'))}">${optionsHtml()}</select>
      <button type="button" class="ex-random" data-testid="ex-random" title="${esc(t('example.random'))}" aria-label="${esc(t('example.random'))}">🎲</button>`;
    element.querySelector('.ex-select').addEventListener('change', (e) => {
      const v = e.target.value;
      if (v) onLoad?.(v);
    });
    element.querySelector('.ex-random').addEventListener('click', () => onRandom?.());
  }

  paint();
  return { element, refresh: paint };
}
```

- [ ] **Step 5: Implement `src/components/ExampleControls.css`** and add the `@import` to `src/styles.css`.
```css
.example-controls { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.75rem; }
.example-controls .ex-select {
  padding: 0.4rem 0.6rem; border: 1px solid var(--app-border); border-radius: var(--app-radius-md);
  background: var(--app-surface); color: var(--app-text); max-width: 22rem;
}
.example-controls .ex-random {
  padding: 0.4rem 0.6rem; border: 1px solid var(--app-border); border-radius: var(--app-radius-md);
  background: var(--app-surface); cursor: pointer; font-size: 1rem; line-height: 1;
}
.example-controls .ex-random:hover { background: var(--app-surface-hover); }
```

- [ ] **Step 6: Run to verify it passes**
Run: `npx vitest run src/tests/exampleControls.test.js` — Expected: PASS.

- [ ] **Step 7: Full suite + commit**
Run: `npx vitest run`
```bash
git add src/components/ExampleControls.js src/components/ExampleControls.css src/styles.css src/i18n/dict.js src/tests/exampleControls.test.js
git commit -m "feat(input): shared ExampleControls row (presets + recent + 🎲) + i18n"
```

---

### Task 7: Graph explorer — preset focus mode + ExampleControls

**Files:**
- Modify: `src/components/GraphCoverageExplorer.js`
- Test: `src/tests/graphCoverageExplorer.preset.test.js`

**Interfaces:**
- Consumes: `createExampleControls`, `graphCoverageRandom` (presetForDifficulty/randomGraph/graphToEdgesText), `getInputDifficulty`/`onInputDifficultyChange`, `examplesStore.save`.
- Produces: `createGraphCoverageExplorer(opts = {})` now accepts `opts.preset ∈ {'structural','path','dataflow'}`. With no preset → unchanged full explorer. Exports (add) `GRAPH_PRESETS` for testing.

- [ ] **Step 1: Write the failing test**
```js
// src/tests/graphCoverageExplorer.preset.test.js
import { describe, it, expect } from 'vitest';
import { createGraphCoverageExplorer, GRAPH_PRESETS } from '../components/GraphCoverageExplorer.js';
import { graphCoverageCriteria } from '../data/testingData.js';

describe('GraphCoverageExplorer presets', () => {
  it('preset criteria ids all exist in graphCoverageCriteria', () => {
    const known = new Set(graphCoverageCriteria.map((c) => c.id));
    for (const cfg of Object.values(GRAPH_PRESETS)) {
      cfg.criteria.forEach((id) => expect(known.has(id)).toBe(true));
    }
  });
  it('structural preset shows only its chips and hides editor/upload', () => {
    const el = createGraphCoverageExplorer({ preset: 'structural' });
    const chips = el.querySelectorAll('[data-testid^="criterion-"]');
    expect([...chips].map((c) => c.dataset.criterion).sort()).toEqual(['edge', 'node']);
    expect(el.querySelector('[data-testid="graph-source-card"]')).toBeNull();
    expect(el.querySelector('[data-testid="graph-editor-card"]')).toBeNull();
    expect(el.querySelector('[data-testid="ex-select"]')).toBeTruthy(); // example controls present
  });
  it('dataflow preset keeps the DFG card; path preset hides it', () => {
    expect(createGraphCoverageExplorer({ preset: 'dataflow' }).querySelector('[data-testid="graph-dfg-card"]')).toBeTruthy();
    expect(createGraphCoverageExplorer({ preset: 'path' }).querySelector('[data-testid="graph-dfg-card"]')).toBeNull();
  });
  it('no preset renders the full 8-criterion switcher and editor', () => {
    const el = createGraphCoverageExplorer();
    expect(el.querySelectorAll('[data-testid^="criterion-"]').length).toBe(8);
    expect(el.querySelector('[data-testid="graph-editor-card"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `npx vitest run src/tests/graphCoverageExplorer.preset.test.js` — Expected: FAIL.

- [ ] **Step 3: Implement preset mode in `GraphCoverageExplorer.js`**
1. Add imports at top:
```js
import { createExampleControls } from './ExampleControls.js';
import * as graphRandom from '../data/graphCoverageRandom.js';
import { getInputDifficulty, onInputDifficultyChange } from '../utils/inputDifficulty.js';
import { save as saveExample } from '../utils/examplesStore.js';
```
2. Add the preset table above `createGraphCoverageExplorer`:
```js
export const GRAPH_PRESETS = {
  structural: { criteria: ['node', 'edge'], showDfg: false },
  path:       { criteria: ['prime-path', 'edge-pair', 'complete-path'], showDfg: false },
  dataflow:   { criteria: ['all-defs', 'all-uses', 'all-du-paths'], showDfg: true },
};
```
3. Change the signature to `export function createGraphCoverageExplorer(opts = {})` and near the top of the body resolve the preset:
```js
  const presetCfg = opts.preset && GRAPH_PRESETS[opts.preset] ? GRAPH_PRESETS[opts.preset] : null;
  if (opts.preset && !presetCfg) console.warn('GraphCoverageExplorer: unknown preset', opts.preset);
  const focus = Boolean(presetCfg);
  let userEdited = false;
```
   Initialize `criterionId` to `presetCfg ? presetCfg.criteria[0] : 'node'`. When `focus`, initialize `graph`/`baseGraph`/`draft` from `graphRandom.presetForDifficulty(getInputDifficulty())` (apply via the same path the uploaded-graph flow uses so the CFG renders); otherwise unchanged.
4. In `render()`'s template:
   - Wrap the `graph-source-card` and `graph-editor-card` blocks in `${focus ? '' : `…existing markup…`}` so they are omitted in focus mode.
   - The criterion switcher `.map(graphCoverageCriteria)` becomes `.map((presetCfg ? graphCoverageCriteria.filter((c) => presetCfg.criteria.includes(c.id)) : graphCoverageCriteria))`.
   - The DFG card renders when `!focus || presetCfg.showDfg` (full explorer keeps current behavior; focus shows it only for dataflow).
   - The lab/quiz start controls (`graph-quiz-start`, `graph-lab-reflect-start`, `graph-lab-metric`) and their panels render only when `!focus`.
   - The optimization *metrics* panel renders only when `!focus`; keep the requirements/paths list in both.
5. Add an ExampleControls mount for focus mode. Create it once (outside `render()`), insert its `element` at the top of the explorer's input area, and in focus mode use it as the input surface:
```js
  const exampleControls = focus ? createExampleControls({
    methodId: 'graph',
    getDefaultText: () => graphRandom.graphToEdgesText(graphRandom.presetForDifficulty(getInputDifficulty())),
    presets: graphCoverageProgramExamples.map((p) => ({ value: /* edges-text for p */ graphRandom.graphToEdgesText(baseGraph), label: p.name })),
    onLoad: (text) => { applyEdgesText(text); userEdited = true; saveExample(localStorage, 'graph', text, exampleDefault(), 10); },
    onRandom: () => { const g = graphRandom.randomGraph(getInputDifficulty()); applyGraphObject(g); userEdited = true; },
  }) : null;
```
   where `applyEdgesText`/`applyGraphObject` reuse the explorer's existing parse+apply logic (the same functions the editor/upload use) and `exampleDefault()` returns the current-difficulty default edges-text. After a successful load, call `exampleControls.refresh()`.
   NOTE: the presets' `value` must be the edges-text for that program's CFG — reuse the explorer's existing "program example → CFG" conversion to produce it; if that conversion is only available after selecting the example, fall back to listing just the current-difficulty default + generated CFGs (keep presets minimal rather than block the task).
6. Subscribe to difficulty changes (focus mode): `onInputDifficultyChange(() => { if (!userEdited) { applyGraphObject(graphRandom.presetForDifficulty(getInputDifficulty())); } })`. Store the unsubscribe on the element if the codebase cleans up (otherwise fine for this app's lifecycle).

- [ ] **Step 4: Run to verify it passes**
Run: `npx vitest run src/tests/graphCoverageExplorer.preset.test.js` — Expected: PASS. Also run existing graph tests: `npx vitest run src/tests/GraphCoverageExplorer.test.jsx` (if present) and `npx vitest run` — no regressions.

- [ ] **Step 5: e2e smoke (focus render)** — start the keep-alive server if not running, then:
Run: `npx playwright test e2e/graph-coverage.spec.js`
Expected: PASS (existing full-explorer e2e unaffected — the full explorer path is unchanged).

- [ ] **Step 6: Commit**
```bash
git add src/components/GraphCoverageExplorer.js src/tests/graphCoverageExplorer.preset.test.js
git commit -m "feat(graph): preset focus mode + ExampleControls input (additive)"
```

---

### Task 8: Logic explorer — preset focus mode + ExampleControls

**Files:**
- Modify: `src/components/LogicCoverageExplorer.js`
- Test: `src/tests/logicCoverageExplorer.preset.test.js`

**Interfaces:**
- Consumes: `createExampleControls`, `logicCoverageRandom`, `getInputDifficulty`/`onInputDifficultyChange`, `examplesStore.save`.
- Produces: `createLogicCoverageExplorer(opts = {})` accepts `opts.preset ∈ {'basic','active','inactive','dnf'}`; no preset → unchanged. Exports (add) `LOGIC_PRESETS`.

- [ ] **Step 1: Write the failing test**
```js
// src/tests/logicCoverageExplorer.preset.test.js
import { describe, it, expect } from 'vitest';
import { createLogicCoverageExplorer, LOGIC_PRESETS } from '../components/LogicCoverageExplorer.js';
import { logicCoverageCriteria } from '../data/testingData.js';

describe('LogicCoverageExplorer presets', () => {
  it('preset criteria ids all exist', () => {
    const known = new Set(logicCoverageCriteria.map((c) => c.id));
    for (const cfg of Object.values(LOGIC_PRESETS)) cfg.criteria.forEach((id) => expect(known.has(id)).toBe(true));
  });
  it('basic preset shows only pc/cc/coc chips and the truth table, hides K-maps', () => {
    const el = createLogicCoverageExplorer({ preset: 'basic' });
    const chips = [...el.querySelectorAll('[data-testid^="logic-criterion-"]')].map((c) => c.dataset.criterion);
    expect(chips.sort()).toEqual(['cc', 'coc', 'pc']);
    expect(el.querySelector('[data-testid="logic-truth-table"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="logic-kmap-f"]')).toBeNull();
    expect(el.querySelector('[data-testid="ex-select"]')).toBeTruthy();
  });
  it('dnf preset shows K-maps', () => {
    expect(createLogicCoverageExplorer({ preset: 'dnf' }).querySelector('[data-testid="logic-kmap-f"]')).toBeTruthy();
  });
  it('no preset shows the full 14-criterion switcher', () => {
    expect(createLogicCoverageExplorer().querySelectorAll('[data-testid^="logic-criterion-"]').length).toBe(14);
  });
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `npx vitest run src/tests/logicCoverageExplorer.preset.test.js` — Expected: FAIL.

- [ ] **Step 3: Implement preset mode in `LogicCoverageExplorer.js`**
Mirror Task 7 for logic:
1. Imports: `createExampleControls`, `import * as logicRandom from '../data/logicCoverageRandom.js'`, `getInputDifficulty`/`onInputDifficultyChange`, `save as saveExample`.
2. Preset table:
```js
export const LOGIC_PRESETS = {
  basic:    { criteria: ['pc', 'cc', 'coc'], view: 'truth' },
  active:   { criteria: ['gacc', 'cacc', 'racc'], view: 'truth' },
  inactive: { criteria: ['gicc', 'ricc'], view: 'truth' },
  dnf:      { criteria: ['ic', 'utpc', 'mutpc', 'nfpc', 'mnfpc', 'cutpnfp'], view: 'kmap' },
};
```
3. `createLogicCoverageExplorer(opts = {})`; resolve `presetCfg`/`focus`/`userEdited`; unknown preset → warn + full. Initialize `state.selectedCriterion` to `presetCfg ? presetCfg.criteria[0] : 'pc'`; in focus mode initialize `state.expression`/bindings from `logicRandom.presetForDifficulty(getInputDifficulty())`.
4. In `render()`:
   - The criterion buttons `.map(logicCoverageCriteria)` → filter to `presetCfg.criteria` when focus.
   - The K-map region renders when `!focus || presetCfg.view === 'kmap'`.
   - The free-text predicate input + lab/quiz controls render only when `!focus`; in focus mode the input surface is the ExampleControls row.
5. Mount `createExampleControls({ methodId: 'logic', getDefaultText: () => logicRandom.presetForDifficulty(getInputDifficulty()).expression, presets: logicCoveragePredicates.map((p) => ({ value: p.expression, label: p.name })), onLoad: (text) => { applyExpression(text); userEdited = true; saveExample(localStorage,'logic',text,logicRandom.presetForDifficulty(getInputDifficulty()).expression,10); refresh }, onRandom: () => { const { expression } = logicRandom.randomPredicate(getInputDifficulty()); applyExpression(expression); userEdited = true; } })` where `applyExpression` reuses the explorer's existing "set expression + reparse + re-render" path.
6. Subscribe: `onInputDifficultyChange(() => { if (!userEdited) applyExpression(logicRandom.presetForDifficulty(getInputDifficulty()).expression); })`.

- [ ] **Step 4: Run to verify it passes**
Run: `npx vitest run src/tests/logicCoverageExplorer.preset.test.js && npx vitest run` — Expected: PASS, no regressions.

- [ ] **Step 5: e2e smoke**
Run: `npx playwright test e2e/logic-coverage.spec.js` — Expected: PASS (full explorer unchanged).

- [ ] **Step 6: Commit**
```bash
git add src/components/LogicCoverageExplorer.js src/tests/logicCoverageExplorer.preset.test.js
git commit -m "feat(logic): preset focus mode + ExampleControls input (additive)"
```

---

### Task 9: Registry + router + unitTitles + i18n (family-unit wiring)

**Files:**
- Modify: `src/data/explorerUnits.js`, `src/data/explorerFactories.js`, `src/utils/urlRouter.js`, `src/utils/unitTitles.js`, `src/i18n/dict.js`
- Test: extend `src/tests/explorerUnits.test.js`, `src/tests/urlRouterUnit.test.js`, `src/tests/unitTitles.test.js`

**Interfaces:**
- Consumes: preset factories from Tasks 7-8.
- Produces: 7 new registry units + tab wiring so `unitsForSection('graph'|'logic')` returns them and `unitTitle` resolves their labels.

- [ ] **Step 1: Extend the registry** — `src/data/explorerUnits.js`, add after the existing `graph-coverage`/`logic-coverage` entries:
```js
  { id: 'graph-structural', componentName: 'GraphStructuralExplorer' },
  { id: 'graph-path',       componentName: 'GraphPathExplorer' },
  { id: 'graph-dataflow',   componentName: 'GraphDataflowExplorer' },
  { id: 'logic-basic',            componentName: 'LogicBasicExplorer' },
  { id: 'logic-active-clause',    componentName: 'LogicActiveClauseExplorer' },
  { id: 'logic-inactive-clause',  componentName: 'LogicInactiveClauseExplorer' },
  { id: 'logic-dnf',              componentName: 'LogicDnfExplorer' },
```

- [ ] **Step 2: Add the factory thunks** — `src/data/explorerFactories.js`:
```js
  GraphStructuralExplorer: () => createGraphCoverageExplorer({ preset: 'structural' }),
  GraphPathExplorer:       () => createGraphCoverageExplorer({ preset: 'path' }),
  GraphDataflowExplorer:   () => createGraphCoverageExplorer({ preset: 'dataflow' }),
  LogicBasicExplorer:          () => createLogicCoverageExplorer({ preset: 'basic' }),
  LogicActiveClauseExplorer:   () => createLogicCoverageExplorer({ preset: 'active' }),
  LogicInactiveClauseExplorer: () => createLogicCoverageExplorer({ preset: 'inactive' }),
  LogicDnfExplorer:            () => createLogicCoverageExplorer({ preset: 'dnf' }),
```
(These reuse the already-imported `createGraphCoverageExplorer`/`createLogicCoverageExplorer`.)

- [ ] **Step 3: Router** — `src/utils/urlRouter.js`:
  - In `EXPLORER_TO_LOCATION`: change `GraphCoverageExplorer: { section: 'graph' }` → `{ section: 'graph', tab: 'full' }`; `LogicCoverageExplorer: { section: 'logic' }` → `{ section: 'logic', tab: 'full' }`; add:
```js
  GraphStructuralExplorer: { section: 'graph', tab: 'structural' },
  GraphPathExplorer:       { section: 'graph', tab: 'path' },
  GraphDataflowExplorer:   { section: 'graph', tab: 'dataflow' },
  LogicBasicExplorer:          { section: 'logic', tab: 'basic' },
  LogicActiveClauseExplorer:   { section: 'logic', tab: 'active' },
  LogicInactiveClauseExplorer: { section: 'logic', tab: 'inactive' },
  LogicDnfExplorer:            { section: 'logic', tab: 'dnf' },
```
  - In `TAB_SECTIONS` add:
```js
  graph: { tabs: ['structural', 'path', 'dataflow', 'full'], default: 'full' },
  logic: { tabs: ['basic', 'active', 'inactive', 'dnf', 'full'], default: 'full' },
```

- [ ] **Step 4: unitTitles** — `src/utils/unitTitles.js`, add to `TAB_LABEL_PREFIX`:
```js
  graph: 'graph.tab',
  logic: 'logic.tab',
```

- [ ] **Step 5: i18n tab labels** — `src/i18n/dict.js` both locales:
`messages.en`:
```js
    'graph.tab.structural': 'Structural Coverage', 'graph.tab.path': 'Path Coverage',
    'graph.tab.dataflow': 'Data-Flow Coverage', 'graph.tab.full': 'Complete (all criteria)',
    'logic.tab.basic': 'Basic (PC / CC / CoC)', 'logic.tab.active': 'Active Clause (GACC / CACC / RACC)',
    'logic.tab.inactive': 'Inactive Clause (GICC / RICC)', 'logic.tab.dnf': 'DNF / K-map (IC … CUTPNFP)',
    'logic.tab.full': 'Complete (all criteria)',
```
`messages.zh`:
```js
    'graph.tab.structural': '結構覆蓋', 'graph.tab.path': '路徑覆蓋',
    'graph.tab.dataflow': '資料流覆蓋', 'graph.tab.full': '完整（所有準則）',
    'logic.tab.basic': '基本（PC / CC / CoC）', 'logic.tab.active': '主動子句（GACC / CACC / RACC）',
    'logic.tab.inactive': '非主動子句（GICC / RICC）', 'logic.tab.dnf': 'DNF / K-map（IC … CUTPNFP）',
    'logic.tab.full': '完整（所有準則）',
```

- [ ] **Step 6: Extend tests**
```js
// add to src/tests/urlRouterUnit.test.js
it('unitsForSection returns graph/logic family tabs in order', () => {
  expect(unitsForSection('graph').map((u) => u.id)).toEqual(['graph-structural','graph-path','graph-dataflow','graph-coverage']);
  expect(unitsForSection('logic').map((u) => u.id)).toEqual(['logic-basic','logic-active-clause','logic-inactive-clause','logic-dnf','logic-coverage']);
});
```
```js
// add to src/tests/unitTitles.test.js (inside an 'en' locale block)
expect(unitTitle(UNIT_BY_ID.get('graph-structural'))).toBe('Structural Coverage');
expect(unitTitle(UNIT_BY_ID.get('logic-dnf'))).toBe('DNF / K-map (IC … CUTPNFP)');
```
The existing `explorerUnits.test.js` 1:1 coverage assertion will now compare the enlarged `EXPLORER_TO_LOCATION` (76 entries) against the enlarged registry — it passes automatically once Steps 1-3 are consistent.

- [ ] **Step 7: Run + commit**
Run: `npx vitest run`
Expected: PASS (registry completeness, router order, titles).
```bash
git add src/data/explorerUnits.js src/data/explorerFactories.js src/utils/urlRouter.js src/utils/unitTitles.js src/i18n/dict.js src/tests/
git commit -m "feat(nav): register 7 graph/logic family units + tab sections + labels"
```

---

### Task 10: Integrated view — graph/logic tabbed sections

**Files:**
- Modify: `src/views/integratedView.js`
- Test: `e2e/graph-logic-family-units.spec.js`

**Interfaces:**
- Consumes: the preset factories + tab wiring from Tasks 7-9; `unitsForSection`, `resolveInitialTab`.

- [ ] **Step 1: Convert the graph and logic slots to tabbed rendering**, mirroring the existing `blackbox` block (see `blackboxTabs` … `renderBlackboxTabs`/`updateBlackboxPanels` around integratedView.js:1017). For each of `graph` and `logic`:
  - Build a tab array using the preset factories + the full factory:
```js
    const graphTabs = [
      { id: 'structural', key: 'graph.tab.structural', component: createGraphCoverageExplorer({ preset: 'structural' }) },
      { id: 'path',       key: 'graph.tab.path',       component: createGraphCoverageExplorer({ preset: 'path' }) },
      { id: 'dataflow',   key: 'graph.tab.dataflow',   component: createGraphCoverageExplorer({ preset: 'dataflow' }) },
      { id: 'full',       key: 'graph.tab.full',       component: components.graph }, // existing full instance
    ];
    const logicTabs = [
      { id: 'basic',    key: 'logic.tab.basic',    component: createLogicCoverageExplorer({ preset: 'basic' }) },
      { id: 'active',   key: 'logic.tab.active',    component: createLogicCoverageExplorer({ preset: 'active' }) },
      { id: 'inactive', key: 'logic.tab.inactive', component: createLogicCoverageExplorer({ preset: 'inactive' }) },
      { id: 'dnf',      key: 'logic.tab.dnf',      component: createLogicCoverageExplorer({ preset: 'dnf' }) },
      { id: 'full',     key: 'logic.tab.full',     component: components.logic },
    ];
```
  - Replace the current `container.querySelector('[data-slot="graph"]').appendChild(components.graph)` / logic lines (integratedView.js:361-362) with tab-bar + panels construction identical in shape to the blackbox block, using testids `graph-tab-row` / `logic-tab-row`, panel datasets `data-graph-panel` / `data-logic-panel`, localStorage keys `stvisual.graphActiveTab` / `stvisual.logicActiveTab`, and `resolveInitialTab({ sectionId: 'graph'|'logic', urlSection: urlState.section, urlTab: urlState.tab, saved })`. Wire tab clicks to re-render tabs, toggle panels, and `if (activeSection === 'graph') syncUrl();`.
  - Default tab resolves to `full` (from `TAB_SECTIONS`), so first paint shows the complete explorer.

- [ ] **Step 2: Write the e2e spec**
```js
// e2e/graph-logic-family-units.spec.js
import { test, expect } from '@playwright/test';

test('graph unit view: structural shows 2 criteria, no editor', async ({ page }) => {
  await page.goto('/?explorer=graph-structural');
  await expect(page.getByTestId('unit-app')).toBeVisible();
  await expect(page.locator('[data-testid^="criterion-"]')).toHaveCount(2);
  await expect(page.getByTestId('graph-editor-card')).toHaveCount(0);
  await expect(page.getByTestId('ex-select')).toBeVisible();
});

test('graph dataflow shows DFG, path does not', async ({ page }) => {
  await page.goto('/?explorer=graph-dataflow');
  await expect(page.getByTestId('graph-dfg-card')).toBeVisible();
  await page.goto('/?explorer=graph-path');
  await expect(page.getByTestId('graph-dfg-card')).toHaveCount(0);
});

test('logic dnf shows K-map, basic shows truth table only', async ({ page }) => {
  await page.goto('/?explorer=logic-dnf');
  await expect(page.getByTestId('logic-kmap-f')).toBeVisible();
  await page.goto('/?explorer=logic-basic');
  await expect(page.getByTestId('logic-truth-table')).toBeVisible();
  await expect(page.getByTestId('logic-kmap-f')).toHaveCount(0);
});

test('integrated graph section shows a tab bar defaulting to Complete', async ({ page }) => {
  await page.goto('/?view=all&section=graph');
  await expect(page.getByTestId('graph-tab-row')).toBeVisible();
  await expect(page.getByTestId('graph-editor-card')).toBeVisible(); // full tab default
});

test('regression: graph-coverage full deeplink still works with Quiz', async ({ page }) => {
  await page.goto('/?explorer=graph-coverage');
  await expect(page.getByTestId('unit-quiz-btn')).toBeVisible();
  await expect(page.getByTestId('graph-editor-card')).toBeVisible();
});
```

- [ ] **Step 3: Run tests** (ensure keep-alive server on 4174 is up; one run)
Run: `npx vitest run && npx playwright test e2e/graph-logic-family-units.spec.js`
Expected: PASS.

- [ ] **Step 4: Regression run**
Run: `npx playwright test e2e/graph-coverage.spec.js e2e/logic-coverage.spec.js e2e/nav-unit-links.spec.js`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/views/integratedView.js e2e/graph-logic-family-units.spec.js
git commit -m "feat(nav): graph/logic become tabbed sections (family tabs + Complete)"
```

---

### Task 11: Global difficulty selector in both view headers

**Files:**
- Modify: `src/views/unitView.js`, `src/views/integratedView.js`
- Test: extend `e2e/example-input.spec.js` (created in Task 12) OR add a focused case here; add a Vitest DOM test `src/tests/difficultySelector.test.js`.

**Interfaces:**
- Consumes: `INPUT_DIFFICULTIES`, `getInputDifficulty`, `setInputDifficulty` from `../utils/inputDifficulty.js`; `t`.

- [ ] **Step 1: unit-view header** — in `src/views/unitView.js`, inside `.unit-tools` (before the fullscreen toggle), render:
```js
            <label class="unit-difficulty">
              <span class="sr-only">${t('settings.difficulty')}</span>
              <select data-testid="input-difficulty" aria-label="${t('settings.difficulty')}">
                ${INPUT_DIFFICULTIES.map((d) => `<option value="${d}"${getInputDifficulty() === d ? ' selected' : ''}>${t('difficulty.' + d)}</option>`).join('')}
              </select>
            </label>
```
Wire it after mount: `container.querySelector('[data-testid="input-difficulty"]')?.addEventListener('change', (e) => setInputDifficulty(e.target.value));` Import `INPUT_DIFFICULTIES`, `getInputDifficulty`, `setInputDifficulty`.

- [ ] **Step 2: integrated-view header** — add the same `<select data-testid="input-difficulty">` to the integrated header tools row (near the language / cloud controls), wired identically. (Two selects with the same testid never coexist — unit view and integrated view are separate renders.)

- [ ] **Step 3: Vitest DOM test**
```js
// src/tests/difficultySelector.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { renderApp } from '../app.js';
import { getInputDifficulty, setInputDifficulty } from '../utils/inputDifficulty.js';

describe('difficulty selector (unit view header)', () => {
  beforeEach(() => { setInputDifficulty('normal', { persist: false }); window.history.replaceState(null, '', '/?explorer=graph-structural'); document.body.innerHTML = ''; });
  it('renders and updates global difficulty', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    renderApp(c);
    const sel = document.querySelector('[data-testid="input-difficulty"]');
    expect(sel).toBeTruthy();
    sel.value = 'large'; sel.dispatchEvent(new Event('change'));
    expect(getInputDifficulty()).toBe('large');
  });
});
```

- [ ] **Step 4: Run**
Run: `npx vitest run src/tests/difficultySelector.test.js && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/views/unitView.js src/views/integratedView.js src/tests/difficultySelector.test.js
git commit -m "feat(input): global difficulty selector in unit + integrated headers"
```

---

### Task 12: Example-input e2e + standalone rebuild + full verification

**Files:**
- Create: `e2e/example-input.spec.js`
- Regenerate: `src/standalone.js`
- Test: full vitest + playwright + vite build

- [ ] **Step 1: Write the e2e spec**
```js
// e2e/example-input.spec.js
import { test, expect } from '@playwright/test';

test('graph unit: example dropdown + 🎲 change the CFG; recent persists', async ({ page }) => {
  await page.goto('/?explorer=graph-structural');
  await expect(page.getByTestId('ex-select')).toBeVisible();
  await page.getByTestId('ex-random').click();
  await expect(page.getByTestId('graph-canvas')).toBeVisible(); // still renders a CFG
});

test('logic unit: example dropdown lists presets', async ({ page }) => {
  await page.goto('/?explorer=logic-basic');
  const select = page.getByTestId('ex-select');
  await expect(select).toBeVisible();
  await expect(select.locator('option')).not.toHaveCount(0);
});

test('difficulty selector persists across reload', async ({ page }) => {
  await page.goto('/?explorer=graph-structural');
  await page.getByTestId('input-difficulty').selectOption('large');
  await page.reload();
  await expect(page.getByTestId('input-difficulty')).toHaveValue('large');
});
```

- [ ] **Step 2: Run e2e** (single run, keep-alive server up)
Run: `npx playwright test e2e/example-input.spec.js`
Expected: PASS.

- [ ] **Step 3: Rebuild the standalone bundle**
Run: `npm run build:standalone`
Expected: "Built standalone bundle" with zero duplicate-key warnings.

- [ ] **Step 4: Full verification**
Run: `npx vitest run`
Run: `npx playwright test`
Run: `npm run build`
Expected: vitest all green; playwright green except the known `accessibility-navigation.spec.js:28` load-flake (confirm it passes in isolation) + the `navigation-state.spec.js:147` self-skip; vite build succeeds.

- [ ] **Step 5: Commit**
```bash
git add e2e/example-input.spec.js src/standalone.js
git commit -m "test(input): example-input e2e; rebuild standalone bundle"
```

---

## Plan Self-Review Notes

- **Spec coverage — example-input spec:** examplesStore (T1), inputDifficulty (T2), randomInput helpers (T3), graph/logic generators (T4/T5), ExampleControls + i18n (T6), explorer integration (T7/T8), global difficulty UI (T11), e2e (T12). ✓
- **Spec coverage — family-units spec:** preset mechanism (T7/T8), registry/router/unitTitles/i18n (T9), tabbed integrated sections (T10), testing (throughout), standalone rebuild (T12). ✓
- **Deferred (both specs):** family-unit quizzes/labs, bespoke hand-crafted visuals, other-explorer adoption — intentionally not tasked.
- **Known soft spots the implementer must resolve against real code (flagged, not placeholders):** T7's graph preset `presets` list depends on the explorer's existing "program-example → edges-text" conversion; the task says to reuse the existing apply/parse functions (`applyEdgesText`/`applyGraphObject` are the names for those existing internal paths — the implementer maps them to the actual function names in the file) and to fall back to a minimal preset list if that conversion isn't cleanly reachable. T7/T8 focus-mode gating must wrap existing markup blocks in `${focus ? '' : …}` without altering them when `!focus`.
- **Type consistency:** `opts.preset` string ids match between GRAPH_PRESETS/LOGIC_PRESETS (T7/T8), the factory thunks (T9 Step 2), and EXPLORER_TO_LOCATION tabs (T9 Step 3). Tab ids (`structural/path/dataflow/full`, `basic/active/inactive/dnf/full`) match across TAB_SECTIONS, integratedView tab arrays, and i18n keys. `methodId` strings `graph`/`logic` match between explorer save calls and ExampleControls.
