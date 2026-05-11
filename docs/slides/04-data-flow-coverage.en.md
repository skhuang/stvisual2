---
marp: true
theme: default
paginate: true
size: 16:9
title: Software Testing Visualization #4 — Data Flow Coverage
description: Data-flow coverage criteria on the CFG — All-Defs / All-Uses / All-DU-Paths
lang: en
---

# Data Flow Coverage
### Tracking variable definitions and uses on the CFG

Software Testing Visualization, Lecture #4
Tool: `/section-graph` ([GraphCoverageExplorer](../../src/components/GraphCoverageExplorer.js) + [dataFlow.js](../../src/utils/dataFlow.js))

---

## From structure to data

| Last lecture (#3) | This lecture (#4) |
| --- | --- |
| Requirements defined by nodes / edges | Requirements defined by **(def, use, variable)** triples |
| Only “where did we go?” | Also “where does the data come from / go to?” |
| Bug shape: missed branch | Bug shape: uninitialised, wrong variable, stale value |

> Same CFG, one extra layer of semantics: **every node carries a set of defs / uses**.

---

## Three core concepts

| Concept | Definition |
| --- | --- |
| **def(n, v)** | Node `n` assigns to variable `v` |
| **use(n, v)** | Node `n` reads `v` (conditions, return, RHS, call arguments…) |
| **def-clear path** | A path from a def to a use with no re-def of that variable in between |

Joining these on the CFG yields the **Data-Flow Graph (DFG)**: each edge is `(defNode, useNode, variable)`.

---

## Three data-flow coverage criteria

| id | Name | Requirement shape |
| --- | --- | --- |
| `all-defs` | All-Defs Coverage | for each (defNode, variable): at least one def-clear path to **some** use |
| `all-uses` | All-Uses Coverage | for each (defNode, useNode, variable): at least one def-clear path |
| `all-du-paths` | All-DU-Paths Coverage | for each (defNode, useNode, variable): **every** def-clear simple path |

> In the tool, the buttons are `criterion-all-defs` / `criterion-all-uses` / `criterion-all-du-paths`.

---

## Subsumption (structural + data-flow)

```
All-DU-Paths ──►  All-Uses ──►  All-Defs
                       │
                       └─►  Edge Coverage  ──►  Node Coverage
```

- **All-Uses subsumes Edge Coverage** (assuming every edge has some def→use traversing it; usually true for programs with reasonable assignments).
- Classroom pairing: EC for structural skeleton, then All-Uses for variable correctness.

---

## Worked example: from Triangle Problem

```js
function classifyTriangle(a, b, c) {
  if (a <= 0 || b <= 0 || c <= 0) return 'invalid';
  if (a + b <= c || a + c <= b || b + c <= a) return 'invalid';
  if (a === b && b === c) return 'equilateral';
  if (a === b || b === c || a === c) return 'isosceles';
  return 'scalene';
}
```

- The start node keeps the function header → **a, b, c are simultaneously defined at start** (since commit `9e4c3fc`).
- No re-assignments → every use is “def-clear from start”.

---

## How def / use are extracted

[`dataFlow.js → extractDefUse(node)`](../../src/utils/dataFlow.js):

| Source line | def | use |
| --- | --- | --- |
| `function f(a, b)` / `(a, b) =>` | `{a, b}` | — |
| `let x = a + b` | `{x}` | `{a, b}` |
| `x += y` | `{x}` | `{x, y}` |
| `x++` / `y--` | `{x}` | `{x}` |
| `for (i = 0; i < n; i++)` | lvalue of init/update | every identifier in cond |
| Everything else (return / call / condition) | — | all non-keyword identifiers |

> A deliberately conservative heuristic: unrecognised lines fall back to “pure use”, so we err on the side of over-counting uses rather than missing them.

---

## Tool demo: the DFG view

![w:1000](../assets/slides/dfg-triangle.png)

- After picking `Triangle Problem`, a **Data Flow Graph** card (`graph-dfg-card`) appears beneath the CFG.
- Each edge is a def→use relation, **labelled with the variable carried**.
- The multiple edges leaving `Start` are the parameters a/b/c flowing out.

---

## Tool demo: All-Defs

![w:1000](../assets/slides/dfg-all-defs.png)

- Click `criterion-all-defs` → `requirement-list` shows one representative def-clear path per (defNode, variable), shortest first.
- On Triangle Problem: 3 parameters × 1 def site each = 3 requirements, each reaching the first decision that reads it.

---

## Tool demo: All-Uses

![w:1000](../assets/slides/dfg-all-uses.png)

- Click `criterion-all-uses` → one requirement per (def, use, var) triple.
- In Triangle Problem each of `a`, `b`, `c` is read at several decisions → the requirement list grows quickly.
- Clicking a requirement highlights the matching node in both CFG and DFG.

---

## Tool demo: All-DU-Paths

![w:1000](../assets/slides/dfg-all-du-paths.png)

- Click `criterion-all-du-paths` → **every** def-clear simple path for each (def, use, var) is a requirement.
- To keep enumeration bounded, [`enumerateDefClearPaths`](../../src/utils/graphCoverage.js) caps path length at `max(8, |V| × 2)`.
- On Triangle Problem (linear, no loops) the count is still tractable; introduce a loop and it explodes.

---

## Why the DFG can be empty

![w:780](../assets/slides/dfg-empty.png)

- The default sample CFG uses abstract labels (S/A/B/...) without `sourceText`.
- `extractDefUse` sees no variable names → 0 DFG edges.
- The tool renders the `graph-dfg-empty` hint: “No definition→use pair detected from the current source.”
- Fix: select any program example, or upload your own JS source.

---

## Algorithm recap

1. `extractDefUse(node)` extracts defs / uses for each node (see the demo).
2. `collectDefUsePairs(graph, defUseMap)` keeps triples that have at least one def-clear path (filtered via `shortestDefClearPath`).
3. The three `getAllX...Requirements()` functions produce requirement objects, each carrying `path: string[]`.
4. `requirementCoveredByRecord` switches to `containsNodePath(record.path, requirement.path)` for the data-flow criteria.
5. `buildTestPathSetForRequirements` reuses the same greedy set cover as the structural criteria → same baseline / optimised / saved metrics.

---

## Summary

- Three criteria, weakest to strongest: **All-Defs → All-Uses → All-DU-Paths**.
- Same CFG + same greedy set cover → end-to-end consistent with Lecture #3.
- The key teaching point is the **def-clear path**:
  - A re-def of the same variable “kills” the previous def for this use.
  - The tool’s predecessor BFS materialises that rule directly.

> Without source code → no defs/uses → the sample CFG alone **cannot** demonstrate this lecture (by design, not a bug).

---

## Exercises

1. Open `Triangle Problem` and record `optimized-path-count` for All-Defs / All-Uses / All-DU-Paths. Why is All-DU-Paths largest?
2. Upload a small program containing a loop (`while` / `for`). Compare `baseline-path-count` for All-DU-Paths with and without the loop.
3. Add a line like `x = x + 1` (re-def of the same variable) and watch the DFG: which edges get cut?
4. Replace one node label in the sample CFG with something like `x = 1` (even if not syntactically valid). Does the empty DFG suddenly grow edges? (Hint: `extractDefUse` only inspects text.)

---

## Further reading

- Ammann & Offutt, *Introduction to Software Testing*, Ch. 7.3 (Data Flow Coverage).
- Implementation:
  - [src/utils/dataFlow.js](../../src/utils/dataFlow.js) — def/use extraction, DFG construction.
  - [src/utils/graphCoverage.js](../../src/utils/graphCoverage.js) — `getAllDefs/All-Uses/All-DU-Paths` + def-clear path enumeration.
- Spec §15: [docs/Specification.zh-TW.md](../Specification.zh-TW.md).
- Next → **Lecture #5 — Logic Coverage** (truth tables, ACC/ICC, DNF, Karnaugh maps).
