---
marp: true
theme: default
paginate: true
size: 16:9
title: Software Testing Visualization #11 — Concolic Execution
description: Concrete + symbolic (DART/CUTE-style): run concretely, flip the last branch, solve for the next input
lang: en
---

# Concolic Execution
### Concrete + symbolic — the DART/CUTE engineering balance

Software Testing Visualization, Lecture #11
Tool: `/section-concolic` ([ConcolicExecutionExplorer](../../src/components/ConcolicExecutionExplorer.js) + [concolicExecution.js](../../src/utils/concolicExecution.js))

---

## Three-way comparison: fuzz → symbex → concolic

| Dimension | #9 Fuzz | #10 Symbex | **#11 Concolic** |
| --- | --- | --- | --- |
| Input generation | Random | Solve path conditions | Concrete run + flip a branch for the next input |
| Program execution | Concrete | Fully symbolic (no real run) | **Concrete** (a real run) + symbolic trace alongside |
| Coverage direction | None | Yes (but path explosion) | Yes (following actual traces) |
| Production systems | AFL | KLEE | DART, CUTE, jCUTE |

> Concolic is the engineering compromise — symbex’s direction plus concrete execution’s reliability.

---

## The name

**Concolic = Concrete + Symbolic**

- Godefroid et al., *DART: Directed Automated Random Testing* (PLDI 2005).
- Sen et al., *CUTE: A Concolic Unit Testing Engine for C* (FSE 2005).

> Same year, same idea — “concolic” became the umbrella term for dynamic symbolic execution.

---

## Four core steps per iteration

```
   inputs  ── ① concrete run ──►  trace = [(cond, taken)*]
                                       │
                                       ▼ ② record symbolic conditions
                                  pc = [c₀, c₁, …, cₙ]
                                       │
                                       ▼ ③ scan from the end for an unexplored branch
                                  flip c_i:  prefix(c) ∧ ¬c_i
                                       │
                                       ▼ ④ findWitness for a new input
                                  nextInput → next iteration
```

Every iteration runs the program for real — the trace is always “actually walked”.

---

## “Flip the last unexplored branch”

```
trace:  c₀=T, c₁=F, c₂=T

  candidate path 1:  c₀ ∧ c₁ ∧ ¬c₂      ← try this
  candidate path 2:  c₀ ∧ ¬c₁           ← back up
  candidate path 3:  ¬c₀                ← back up again
```

Scan backwards: if `prefix + ¬c_i` corresponds to an unseen path key and `findWitness` succeeds → adopt it.

> Result: each iteration advances exactly one new path — a natural BFS-style exploration.

---

## Key differences vs symbex

| Dimension | symbex | concolic |
| --- | --- | --- |
| Fork trigger | Forks symbolically (both branches walked) | **No forking** — only walks the concrete side |
| Unknown behaviour | Stuck (can’t resolve symbolically) | Bypasses with the concrete value |
| `while` loops | `maxLoopUnroll` truncates | Naturally bounded by the concrete trace |
| Path count | Exponential | Linear (one path per iteration) |

> Concolic turns “exploration” into a controllable iteration loop — much closer to a unit-test workflow.

---

## Built-in 4 examples

| id | Seed | Teaching focus |
| --- | --- | --- |
| `triangle` | `a=1, b=1, c=1` | Start from equilateral, flip branches to reach other triangle types |
| `abs` | `x=0` | Smallest example: one flip reaches the `x<0` dual input |
| `max3` | `a=0, b=0, c=0` | Two-branch structure: four truth combinations |
| `middle` | `a=0, b=0, c=0` | Classic DART benchmark (median of three integers) |

> Each example ships with a `seed`; the UI renders it in `concolic-seed`.

---

## Tool: overview + settings

![w:1000](../assets/slides/concolic-overview.png)

- `concolic-example-{id}` example chips; `concolic-source` is the code editor.
- `concolic-seed` accepts the initial input (`a=1, b=2, ...`); `concolic-max-iter` caps iteration count (default 16).
- `concolic-summary` shows total iterations, unique paths, unique inputs.

---

## Tool: iteration list

![w:1000](../assets/slides/concolic-iters.png)

- `concolic-iters` is the ordered list. Each `concolic-{iter-id}` entry shows
  - The iteration number, its input, and the branches walked (line + symbolic condition).
  - `negatedAt` highlights which branch this iteration **flipped**.
  - `nextInput` is the derived input for the next iteration.
- Clicking an entry highlights that iteration’s path on the CFG.

---

## Tool: CFG sync highlight

![w:1000](../assets/slides/concolic-cfg.png)

- `concolic-cfg` shares the CFG engine with Lectures #3 / #9 / #10.
- Switch between iterations to feel the “one new path at a time” exploration in motion.
- `concolic-cfg-selected` displays the current iteration id.

---

## Algorithm peek

[`concolicExecute(sourceCode, options)`](../../src/utils/concolicExecution.js):

```js
worklist = [seed]
while (worklist.length && iterations < maxIterations) {
  inputs = worklist.shift();
  trace = runConcolicOnce(fn, inputs);  // concrete run + symbolic trace
  for (i = trace.branches.length - 1; i >= 0; i--) {
    constraint = prefix(i) ∧ ¬trace.branches[i].symbolic;
    if (already seen path key) continue;
    witness = findWitness(constraint, params, domain);
    if (witness) { worklist.push(witness); break; }
  }
}
```

> ~240 lines: the parser is reused from [symbolicExecution.js](../../src/utils/symbolicExecution.js); only the concrete runner + flip loop are new.

---

## Path convergence

For a fixed `maxIterations`, concolic:
1. Exhausts every path reachable within ±5–12 integer inputs → stops naturally.
2. If `searchDomain` is too small, some paths can’t be solved → `truncated: false` but path coverage incomplete.
3. `uniquePathCount` / `uniqueInputCount` give an overall progress indicator.

> Unlike symbex (Lecture #10): concolic never enumerates an infeasible path — every path was actually walked.

---

## Real-world systems vs this tool

| Tool | Subject | Solver |
| --- | --- | --- |
| **This tool** | A tiny JS subset | bounded brute-force |
| DART | C | Stanford SVC |
| CUTE | C | lp_solve |
| jCUTE | Java | Yices |
| KLEE-NUSE / SymJEx | LLVM IR / JS | Z3 |
| SAGE (Microsoft) | x86 binaries | Z3 |

> Microsoft SAGE has found around a third of Windows 7 parser bugs — concolic is mainstream in industry.

---

## Summary

- Concolic replaces symbex’s “fork everything symbolically” with “**run concretely, flip the last branch**”.
- Four steps per iteration: concrete run → record → flip → new input.
- Adds one new path per iteration, sidestepping path explosion while keeping concrete-execution reliability.
- Shares parser + solver with #10 symbex — direct comparison of two search strategies.

---

## Exercises

1. Open `triangle` and look at unique path count after 16 iterations. How does it compare to symbex’s feasible count in #10?
2. Set `concolic-max-iter` on `abs` to 1 — both paths still emerge; why?
3. The 8 truth combinations of `middle` — does concolic explore them in BFS or DFS order?
4. Change `seed` to invalid input (`a=-1, b=-1, c=-1`) on `triangle`. How does the exploration order change?

---

## Further reading

- Godefroid, Klarlund, Sen, *DART: Directed Automated Random Testing* (PLDI 2005).
- Sen, Marinov, Agha, *CUTE: A Concolic Unit Testing Engine for C* (FSE 2005).
- Cadar & Sen, *Symbolic Execution for Software Testing: Three Decades Later* (CACM 2013).
- Implementation:
  - [src/utils/concolicExecution.js](../../src/utils/concolicExecution.js) — 240 lines: concrete runner + flip loop.
  - Shares [src/utils/symbolicExecution.js](../../src/utils/symbolicExecution.js) — parser, substitute, negate, findWitness.
  - [src/components/ConcolicExecutionExplorer.js](../../src/components/ConcolicExecutionExplorer.js) — UI.
- End of the series — full course index in [docs/slides/index.en.md](index.en.md).
