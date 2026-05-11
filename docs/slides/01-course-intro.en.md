---
marp: true
theme: default
paginate: true
size: 16:9
title: Software Testing Visualization #1 — Course Intro & Testing Method Classification
description: Course map, black/white/gray box, code-visibility bar, common techniques per category
lang: en
---

# Software Testing Visualization
### Lecture #1 — Course Intro & Testing Method Classification

Software Testing Visualization, Lecture #1
Tool: `/section-methods` ([TestingMethodTree](../../src/components/TestingMethodTree.js))

---

## Course goal

Turn abstract test-criteria definitions into **operable, verifiable** visual teaching:

- Beyond definitions — click around the tool and watch requirements / metrics update live.
- One CFG / predicate / program threads through several criteria for side-by-side comparison.
- Every lecture comes with a **worked example**, a **tool demo**, and **exercises**.

> Main thread: **from theory to quantifiable engineering practice**.

---

## Course map (8 lectures)

| # | Topic | Spec section |
| --- | --- | --- |
| **1** | **Course intro & method classification** | §1, §2 |
| 2 | Testing flow & testing pyramid | §2.B |
| 3 | Graph Coverage (structural) | §3 |
| 4 | Data Flow Coverage | §15 |
| 5 | Logic Coverage (14 criteria) | §4–5 |
| 6 | Program Mutation (15 operators) | §11.2, §17.3 |
| 7 | Grammar + String Mutation | §12, §13 |
| 8 | Specification Mutation + SMV + FSM | §14, §16 |

---

## Learning dependencies

```
   #1 Intro
       │
       ▼
   #2 Testing flow
       │
       ├──► #3 Graph Coverage ──► #4 Data Flow Coverage
       │
       ├──► #5 Logic Coverage  ◄── shares parsePredicate ──► #8 Spec Mutation
       │
       └──► #6 Program Mutation ──► #7 Grammar Mutation ──► #8 Spec Mutation
```

> Three sub-threads (graph, logic, mutation) converge at #8.

---

## Three categories, organised by code visibility

| Category | Visibility | Perspective |
| --- | --- | --- |
| **Black box** | 0% | Only input / output behaviour |
| **Gray box** | ~50% | Some internal information assists test design |
| **White box** | 100% | Full source code + control flow / data flow |

> The tool’s `visibility-fill` is a progress bar that visualises this 0–100% spectrum.

---

## Black-box techniques (4)

| Technique | Use |
| --- | --- |
| **BVA** Boundary Value Analysis | Test boundary values (incl. boundary ±1) |
| **EP** Equivalence Partitioning | Split inputs into equivalence classes, one sample each |
| **CEG** Cause-Effect Graph | Reason about input → output causes |
| **STT** State Transition Testing | Validate state-machine transitions |

> Common trait: no source code required; can start during the requirements phase.

---

## White-box techniques (10, the core of this series)

| Technique | Lecture |
| --- | --- |
| Statement / Branch Coverage | #3 |
| Graph Coverage / Prime Path | #3 |
| Path Coverage | #3 |
| Condition / Multiple Conditions | #5 |
| **Logic Coverage** (PC/CC/ACC/IC…) | #5 |
| **Symbolic Execution** | Future #9 |
| **Concolic Execution** | Future #9 |

> Slogan: **any structure → a coverage criterion**.

---

## Gray-box techniques (2)

| Pattern | Example |
| --- | --- |
| **Combined Approach** | Design with white-box, verify with black-box |
| **Partial Code Visibility** | Only API / spec visible → use it to inform tests |

> In practice nearly every project is gray box (no one can read 100% of their dependencies’ source).

---

## Tool: testing method tree

![w:1000](../assets/slides/methods-overview.png)

- Three cards (`method-card-{blackbox, whitebox, graybox}`), each with a `visibility-fill` bar at 0% / 50% / 100%.
- Click `method-card-btn-{id}` to expand a category, or hit `toggle-all-btn` to expand / collapse everything.
- Every technique (`technique-{id}`) carries a bilingual name + description.

---

## Tool: white-box card expanded

![w:1000](../assets/slides/methods-whitebox.png)

- All 10 white-box techniques are listed, highlighting which ones this series covers in depth.
- The latest additions `symbex` / `concolic` are present — they correspond to textbook **symbolic execution** and DART/CUTE-style **concolic execution**.
- After this lecture students can answer: “Which category does my current test belong to? Which criterion measures its coverage?”

---

## Three core mental models

Used throughout the course:

1. **Abstraction** — turn the program into a graph, predicate, grammar, or spec.
2. **Coverage** — define an “at-least-once” criterion on that abstraction.
3. **Mutation** — inject faults into the subject and watch whether the test set catches them.

> Lectures #3–#5 develop (1) + (2); #6–#8 apply (3) to program / grammar / spec subjects.

---

## Summary

- Three categories by visibility: **black (0%) → gray (50%) → white (100%)**.
- 4 black-box, 10 white-box, 2 gray-box techniques — all surfaced in the tool.
- The next seven lectures take every criterion from definition to a visual demo.
- Tool design principle: **change one input → every metric re-computes instantly**.

---

## Exercises

1. Open `/section-methods` and hit `toggle-all-btn` to expand all 16 techniques. Pick 3 you have **never used** and read their descriptions.
2. Within the white-box list, which two techniques belong to the “symbolic execution family”? What is the difference?
3. Imagine you’re testing a third-party API (OpenAPI doc only, no source). Which category? Which techniques?
4. Compare EP with Combinatorial Coverage (#5) on “number of test rows”. Why is the black-box approach so much cheaper?

---

## Further reading

- Ammann & Offutt, *Introduction to Software Testing* — Ch. 1–2 (overall framework).
- Implementation:
  - [src/components/TestingMethodTree.js](../../src/components/TestingMethodTree.js) — tree expansion + visibility bar.
  - [src/data/testingData.js](../../src/data/testingData.js) — bilingual data for 16 techniques.
- Spec §1–§2: [docs/Specification.zh-TW.md](../Specification.zh-TW.md).
- Next → **Lecture #2 — Testing flow & testing pyramid**.
