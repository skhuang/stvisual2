---
marp: true
theme: default
paginate: true
size: 16:9
title: Software Testing Visualization #68 — Testability Metrics
description: Structural metrics that predict test difficulty — cyclomatic complexity, coupling (fan-in / fan-out), and cohesion — combined into one hardness score, and how splitting a unit or cutting coupling makes code easier to test.
lang: en
---

# Testability Metrics

### *Structure predicts how hard a unit is to test*

Software Testing Visualization series #68 · Testability
Companion tool: `?explorer=testability-metrics` → Testability Metrics Heatmap ([TestabilityMetricsExplorer](../../src/components/TestabilityMetricsExplorer.js))

<!-- Deck in the Testability section. Before this deck, testability was argued qualitatively — controllability, observability, seams. This one makes it *measurable*: three structural signals (cyclomatic complexity, coupling, cohesion) are combined into a single hardness score that ranks the units of a small checkout module by how hard each is to test in isolation. The companion tool is a heatmap + call graph the class can perturb (add a dependency, split the hardest unit) and watch the ranking move. -->

---

## Structure predicts test difficulty

Some units are simply harder to test than others, and you can often tell **before writing a single test** just by looking at their shape. Testability metrics turn that intuition into numbers.

Three **structural signals** each capture a different reason a unit resists testing:

- **cyclomatic complexity** — how many independent paths a test must cover,
- **coupling** — how many other units it depends on or is depended on by, and
- **cohesion** — how many unrelated responsibilities it carries at once.

None of these run the code or need a single test case; they are read straight off the **structure** — the control flow, the call graph, and the responsibility set. That is what makes them cheap enough to compute for every unit and use as a map for where testing pain will concentrate.

<!-- The framing move for the whole deck: testability is not only a qualitative property (seams, controllability) but a *structural* one you can measure statically. Stress that all three signals are read from structure, not from execution — no tests need exist yet. That is the point: the metrics tell you where the hard tests will be, so you can act before the pain arrives. The next three slides take each signal in turn. -->

---

## Cyclomatic complexity

**Cyclomatic complexity** counts the number of **linearly independent paths** through a unit — a lower bound on the test cases you need to exercise every branch.

The explorer computes it from an explicit decision count:

**M = decisions + 1**

Every `if`, `while`, `for`, `case`, or short-circuit `&&`/`||` is a decision that forks the control flow and doubles down on the paths a thorough test suite must cover. A unit with 6 decisions has cyclomatic complexity **7**; a straight-line unit with no decisions has complexity **1**.

More decisions means more paths, and more paths means more test cases just to reach every branch. Complexity is the part of test difficulty that comes from a unit's **internal logic**.

<!-- M = decisions + 1 is the engine's exact rule (cyclomatic(unit) in the component). Tie it to the practical meaning: complexity is a *lower bound* on branch-covering tests, so it reads directly as "how many tests, minimum." Contrast the two extremes that appear later — checkout at 7 vs formatMoney at 1 — so the number feels concrete. This is the internal-logic axis of difficulty; the next two slides are the external, relational axes. -->

---

## Coupling — fan-in and fan-out

**Coupling** measures a unit's entanglement with the rest of the module, read straight off the **call graph**:

- **fan-in** = how many units *call* this one (its callers), and
- **fan-out** = how many units this one *calls* (its collaborators).

For testing in isolation, **fan-out is the expensive direction**. Each collaborator a unit calls is a dependency a test must **stub, mock, or fake** to isolate the unit under test. A unit that calls four collaborators needs four doubles in place before a single assertion can run — so the hardness model weights fan-out **×2**.

High fan-in is a different signal: a heavily-called unit is a shared, reused helper, so its own tests pay dividends across every caller. The checkout module's `formatMoney` has fan-in 3 and fan-out 0 — called everywhere, depends on nothing.

<!-- coupling(module) returns {fanIn, fanOut} per unit from the call edges. The load-bearing asymmetry: fan-out is what makes isolation expensive (every callee is a test double you must build), which is exactly why the score weights fanOut ×2 while cohesion and complexity carry weight 1. Fan-in is not a testability penalty — it is a reuse signal. formatMoney is the poster child: fan-in 3, fan-out 0, so its own unit tests protect three callers at once. -->

---

## Cohesion

**Cohesion** asks whether a unit does *one* thing or *many*. A cohesive unit has a single, focused responsibility; a low-cohesion unit bundles several unrelated jobs into one place.

The explorer models this with a simple, explicit proxy: each unit declares a **responsibility set**, and the **cohesion penalty equals the number of responsibilities** (an LCOM-style measure, simplified).

Low cohesion hurts testability because unrelated responsibilities cannot be set up or asserted independently — one test has to arrange the state for *all* of them at once, and a change to any one responsibility can break tests aimed at the others. `checkout` declares four responsibilities (orchestrate-flow, coordinate-steps, handle-errors, audit-log); `formatMoney` declares just one (format).

<!-- cohesionPenalty(unit) = unit.responsibilities.length — the third weighted contribution (weight 1). Frame low cohesion as the "can't set up in isolation" tax: many responsibilities means one test has to arrange all of them, and they interfere. Keep the two anchors visible — checkout's four responsibilities vs formatMoney's one — so the contrast carries into the ranking table. -->

---

## The hardness model

The three signals combine into one **hardness score** per unit:

**score = cyclomatic + 2·fanOut + cohesionPenalty**

The weighting encodes the lesson: **fan-out is the costliest** for isolation (weight 2 — every collaborator is a test double you must build), while complexity and cohesion each contribute at weight 1.

| Signal | Contribution | Why it makes testing harder |
|---|---|---|
| Cyclomatic | `cyclomatic` | more independent paths to cover |
| Fan-out | `2·fanOut` | more collaborators to stub / fake |
| Cohesion | `cohesionPenalty` | more unrelated responsibilities to arrange |

The score is a **single number to rank by**: sort the units descending and the top of the list is where testing effort — and refactoring leverage — should go first.

<!-- The exact formula from testabilityHardness(): score = cyclomatic + 2*fanOut + cohesionPenalty. Do not skip the weighting rationale — it is the one design choice in the model, and it says isolation cost (fan-out) dominates. The score is deliberately a single scalar so units can be totally ordered; that ordering is what the heatmap colours and what the "hardest unit" readout reads off. Next slide instantiates it on the checkout module. -->

---

## The checkout module — a worked ranking

Six units of a small e-commerce checkout, scored and ranked (score DESC, ties broken by id):

| Unit | Cyclomatic | Fan-in | Fan-out | Cohesion | **Score** |
|---|---|---|---|---|---|
| `checkout` | 7 | 0 | 4 | 4 | **19** |
| `chargePayment` | 5 | 1 | 1 | 2 | **9** |
| `sendReceipt` | 4 | 1 | 1 | 1 | **7** |
| `applyDiscount` | 3 | 1 | 1 | 1 | **6** |
| `validateCart` | 4 | 1 | 0 | 2 | **6** |
| `formatMoney` | 1 | 3 | 0 | 1 | **2** |

`applyDiscount` and `validateCart` tie at 6; the ranking breaks the tie by **id ascending**, so `applyDiscount` sorts first. Each number is re-derivable from the module's decisions, call edges, and responsibility sets.

<!-- These are the exact fixture numbers (METRICS_MODULE + testabilityHardness). Walk one row live to prove the formula: checkout = 7 + 2·4 + 4 = 19; formatMoney = 1 + 2·0 + 1 = 2. Point out the deliberate 6-6 tie between applyDiscount and validateCart and that the ranking resolves it by id ascending — a detail the tool's ordering depends on. The spread from 19 down to 2 is the whole story: one orchestrator dominates. -->

---

## Hardest vs. easiest

The ranking separates the module into a clear top and bottom.

**`checkout` is the hardest — score 19.** It is a classic **orchestrator**: 6 decisions (cyclomatic 7), it calls **four** collaborators (fan-out 4, contributing 8 — the largest single term), and it carries four responsibilities. To test it in isolation you must stand up four test doubles *and* cover many paths *and* arrange four responsibilities at once. Its dominant contributor is **fan-out** — the coupling term.

**`formatMoney` is the easiest — score 2.** A pure helper: no decisions (cyclomatic 1), calls nothing (fan-out 0), one responsibility. It needs a couple of example inputs and nothing else — no doubles, no setup.

The gap between 19 and 2 is exactly the gap between an orchestrator and a leaf helper.

<!-- checkout's dominant term is 2·fanOut = 8, which is why the tool reports its highest-leverage fix as "split it — extract a collaborator." formatMoney is the deliberate opposite: everything that makes checkout hard is absent. The teaching point is that the score names *which* structural property dominates each unit, so the fix is targeted, not generic. This sets up the split demo. -->

---

## Splitting lowers hardness

The hardest unit is fixed by **splitting** it — extracting a collaborator so no single unit orchestrates everything. The explorer's `splitUnit(checkout)` does this deterministically: it halves the decisions, partitions the responsibilities, and distributes the outgoing calls across the two halves.

| After split | Cyclomatic | Fan-out | Cohesion | **Score** |
|---|---|---|---|---|
| `checkout-a` | 4 | 3 | 2 | **12** |
| `checkout-b` | 4 | 2 | 2 | **10** |

The module's worst score drops from **19 → 12**. Where one unit demanded four doubles and many paths, two smaller units each demand fewer of both. Neither half is as hard to test as the original whole.

<!-- These come straight from splitUnit: decisions 6 → ceil/floor = 3 & 3 (cyclomatic 4 each), responsibilities partitioned even/odd (2 & 2), the four outgoing edges dealt even→a / odd→b, plus one internal a→b edge (so checkout-a fan-out = 3, checkout-b = 2). Max hardness 19 → 12 is the headline. The lesson: complexity, coupling, and cohesion all drop per-unit when responsibilities are separated — splitting attacks all three axes at once. -->

---

## The coupling–complexity trade-off

Splitting is not free, and the metrics make the cost visible.

- **Within each unit**, everything improves: `checkout-a` and `checkout-b` each have lower complexity, lower fan-out, and fewer responsibilities than the original `checkout`.
- **Across the module**, coupling *rises*: there is now an extra unit and an extra call edge (`checkout-a → checkout-b`). You have traded one hard unit for two easier units **plus a new dependency**.

Adding a dependency shows the same trade-off from the other side. In the tool, **add a dependency** raises the caller's fan-out, which raises its score — a live reminder that every new collaborator is another test double someone will have to build.

The metrics do not say "never couple"; they say **know what each dependency costs** and spend coupling where it buys real structure.

<!-- addDependency(module, from, to) adds one call edge, raising the source's fanOut and therefore its score — the tool lets the class feel that a new dependency is a new testability tax. Pair it with the split result: splitting lowers per-unit hardness but adds a unit and an edge, so total module coupling goes up. That is the genuine trade-off — you cannot minimise complexity and coupling simultaneously, so the metrics are for making the trade *deliberately*, not for driving either signal to zero. -->

---

## Targeting refactoring with metrics

The point of a single hardness score is **prioritisation**. The tool reads off the top of the ranking and names one action:

> **Hardest unit: `checkout` (score 19).** Highest-leverage fix: *split it — extract a collaborator so no one unit orchestrates everything.*

The fix is chosen from the unit's **dominant contributor** — the largest of the three weighted terms. Fan-out dominates `checkout`, so the advice is to split; a complexity-dominated unit would be told to reduce branching, and a cohesion-dominated one to separate responsibilities.

Used this way, the metrics turn "this code feels untestable" into a ranked worklist: fix the top unit, re-score, and let the ranking point at the next one. Refactoring effort flows to where it most lowers the cost of testing.

<!-- highestLeverageFix(module) picks the hardest unit and maps its dominant contributor to a fix key: fanout → split, complexity → reduce branching, cohesion → separate responsibilities. Stress the loop: score → fix the top → re-score → next. This is the payoff of making testability numeric — it becomes an ordered backlog instead of a vibe. The single highest-leverage fix framing keeps the class from gold-plating every unit at once. -->

---

## Companion tool

Open `?explorer=testability-metrics` — the **Testability Metrics Heatmap**.

- **Heatmap** — the six units coloured by hardness (darker = harder). Click a unit for its metric breakdown and the reason its score is what it is.
- **Call graph** — the same module as an SVG dependency graph; an arrow from A to B means A calls B. Click a node to select it too.
- **Add a dependency** — pick a caller and a callee, add the edge, and watch the caller's fan-out and score rise.
- **Split the hardest unit** — one click applies `splitUnit` to the current hardest unit; the ranking and heatmap update live (`checkout`'s 19 becomes a 12 and a 10).
- **Reset** returns the module to the original six-unit checkout.

Everything on screen is derived from one source of truth — the same pure engine (`cyclomatic`, `coupling`, `cohesionPenalty`, `testabilityHardness`) covered in this deck.

<!-- Live-demo script. Start on the heatmap, click checkout to show the breakdown and the fan-out-dominated reason. Switch attention to the call graph so the fan-out of checkout is visible as four outgoing arrows. Then add a dependency (e.g. validateCart → formatMoney) and note validateCart's score climb. Finally hit "split the hardest unit" and read the new ranking — checkout gone, replaced by checkout-a (12) and checkout-b (10). Reset to restore. Emphasise that the numbers on screen match the tables in this deck because both come from the same engine. -->

---

## Summary

- **Testability is measurable from structure.** Three signals — cyclomatic complexity, coupling, and cohesion — predict how hard a unit is to test *before any test is written*.
- **Cyclomatic complexity = decisions + 1**: more independent paths to cover. **Fan-out** = collaborators to stub/fake (the expensive direction); **fan-in** = a reuse signal, not a penalty. **Cohesion penalty** = number of responsibilities to arrange at once.
- **Hardness score = cyclomatic + 2·fanOut + cohesionPenalty** — one number to rank by, weighting fan-out ×2 because isolation cost dominates.
- On the checkout module, **`checkout` is hardest (7, fanOut 4, cohesion 4 → 19)** as an orchestrator, and **`formatMoney` is easiest (→ 2)** as a pure leaf helper.
- **Splitting the orchestrator** (`splitUnit(checkout)`) drops the worst score **19 → 12** by lowering complexity, fan-out, and cohesion per unit — at the cost of one more unit and one more edge: the **coupling–complexity trade-off**.
- Use the **dominant contributor** to pick the **single highest-leverage fix**, then re-score — refactoring flows to where it most lowers the cost of testing.

**In-class exercise:** by hand, re-derive `chargePayment`'s score (cyclomatic 5, fan-out 1, cohesion 2), confirm it is 9, name its dominant contributor, and state the fix the model would recommend.

---

## Further reading

- Course specification — Testability visualization design ([2026-09-28-testability-visualization-design.md](../superpowers/specs/2026-09-28-testability-visualization-design.md))
- McCabe, T. (1976) *A Complexity Measure* — the original cyclomatic complexity metric.
- Chidamber, S. & Kemerer, C. (1994) *A Metrics Suite for Object-Oriented Design* — coupling and cohesion (including LCOM) as measurable design properties.
- Feathers, M. (2004) *Working Effectively with Legacy Code* — seams and why structure governs testability.
- Tool source: [TestabilityMetricsExplorer.js](../../src/components/TestabilityMetricsExplorer.js), [testabilityModels.js](../../src/data/testabilityModels.js)
- Neighbours in series: #67 Design for Testability, and the Testability scorecard capstone.
