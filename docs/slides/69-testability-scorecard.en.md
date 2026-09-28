---
marp: true
theme: default
paginate: true
size: 16:9
title: Software Testing Visualization #69 — Testability Scorecard
description: The capstone of the Testability section — aggregating five normalized testability signals (controllability, observability, seam coverage, structural, determinism) into one overall grade, prioritizing the weakest, and watching fixes cascade.
lang: en
---

# Testability Scorecard
### *Five signals, one diagnosis, one grade*

Software Testing Visualization series #69 · Testability Scorecard
Companion tool: `?explorer=testability-scorecard` → Testability Scorecard ([TestabilityScorecardExplorer](../../src/components/TestabilityScorecardExplorer.js))

<!-- Closing deck for the Testability section. The scorecard is the capstone: it does not derive anything new — it COMPOSES the three sibling explorers (controllability/observability, seams, structural metrics) plus the nondeterminism catalogue into five normalized signals, averages them into one A–F grade, and turns the lowest signals into a prioritized, deep-linked fix list. The deck walks the aggregation, the exact fixture readout, the grade thresholds, the fix cascade, and how the scorecard drives design-for-testability work. -->

---

## The capstone — one diagnosis from many signals

Each earlier deck in this section taught **one** testability property in isolation: whether a test can *drive* the code (controllability), whether it can *see* the result (observability), whether it can *substitute* dependencies (seams), how *tangled* the structure is (metrics), and whether runs *repeat* (nondeterminism).

The scorecard is the **capstone**. It answers the question those decks leave open: *given all of these at once, how testable is this unit — and what should I fix first?*

Crucially, it **re-derives nothing**. It composes the sibling explorers' pure engines over one shared fixture, normalizes each into a signal on the same scale, and averages them into a single overall grade. One source of truth, five readings, one number.

<!-- The framing to establish: the scorecard is an aggregator, not a new analysis. Stress "composes, does not re-derive" — controllability() and observability() come from the controllability-observability explorer, testabilityOf() from the seams explorer, testabilityHardness() from the metrics explorer, and the nondeterminism count from the fixture. The value it adds is a single comparable diagnosis plus a prioritized worklist. Contrast with the isolated decks: each was a microscope on one property; this is the dashboard over all five. -->

---

## The five signals

The scorecard reads exactly **five** signals, each normalized to `[0, 1]` where **higher = more testable**:

- **controllability** — the fraction of states a test can *drive* the SUT into.
- **observability** — the fraction of states a test can *distinguish* from the outside.
- **seam coverage** — the fraction of dependency anti-patterns broken by an injected seam.
- **structural** — how far the hardest unit sits below the worst-case hardness cap.
- **determinism** — the fraction of nondeterminism sources that have been removed.

Putting every property on the same `0..1, higher-is-better` axis is what makes them **comparable** — a controllability of 0.6 and a determinism of 0.5 can now sit in the same ranking, and the search for "the weakest link" becomes a plain sort.

<!-- Enumerate the five and, more importantly, the normalization convention. Some signals are naturally ratios (controllability, observability, seam coverage); the other two are turned into ratios: structural is 1 - hardest/CAP so a low-complexity module scores high, and determinism is 1 - present/TOTAL so removing a nondeterminism source raises it. The single shared scale is the whole trick — it is what lets an arithmetic mean and a "lowest signal" ranking mean anything across properties measured in different units. -->

---

## Normalization — higher = more testable

Two signals are not natural ratios, so the scorecard converts them:

- **structural** `= clamp(1 − hardest / 25, 0, 1)`. `testabilityHardness()` scores the hardest unit; `25` is the worst-case cap (`STRUCT_CAP`). A structurally simple module scores near 1; the fixture's hardest unit scores 19, giving **1 − 19/25 = 0.24**.
- **determinism** `= clamp(1 − present / 4, 0, 1)`. `4` is the full catalogue of nondeterminism sources (`DET_TOTAL`). Remove a source and the signal rises; with 2 of 4 present, **1 − 2/4 = 0.5**.

The sign convention is deliberate and uniform: **more testable is always a bigger number**. Complexity and nondeterminism are taxes, so they enter as `1 − tax`, keeping them on the same "up is good" axis as the ratios.

<!-- This is the slide that makes the numbers reproducible. Write both formulas on the board and plug the fixture in: hardest = 19, cap = 25 → 0.24; present = 2, total = 4 → 0.5. Stress the inversion — the raw structural and nondeterminism measures are "bad when high", so they are flipped to "good when high" before averaging. Without a uniform direction the mean would add apples to anti-apples. -->

---

## The fixture readout

The bundled fixture — a coin turnstile SUT, an e-commerce checkout module, no seams applied, no probes, two nondeterminism sources — grades out as:

| Signal | Score | Where it comes from |
|---|---|---|
| controllability | **0.6** | states a test can drive into |
| observability | **0.2** | states distinguishable from outside |
| seam coverage | **0** | no anti-pattern seams injected yet |
| structural | **0.24** | 1 − 19/25 |
| determinism | **0.5** | 1 − 2/4 |

Overall = mean = (0.6 + 0.2 + 0 + 0.24 + 0.5) / 5 = **0.308** → grade **F**.

<!-- Walk the table row by row and then the arithmetic mean. Every number is exact and comes straight from the fixture and the engines — controllability 0.6 and observability 0.2 from the turnstile's reachable/distinguishable states, seam 0 because appliedSeams starts empty, structural 0.24 and determinism 0.5 from the formulas on the previous slide. The mean 0.308 is the overall; the badge shows 31%. Emphasise that an F here is the *honest starting point* — the fixture is deliberately untestable so the fixes have somewhere to go. -->

---

## Grade thresholds

The overall (mean) score maps to a letter grade, checked **high → low**:

| Grade | Overall ≥ |
|---|---|
| A | 0.85 |
| B | 0.70 |
| C | 0.55 |
| D | 0.40 |
| F | otherwise |

At **0.308**, the fixture falls below the D cut of 0.40, so it lands at **F**. The grade is a blunt, at-a-glance summary; the per-signal bars underneath it are where the actual diagnosis lives.

<!-- The thresholds are the GRADE_THRESHOLDS table verbatim; checked top-down, the first min the overall clears wins. Point out that a single very weak signal can hold the whole grade down through the mean — here seam 0 and observability 0.2 are dragging 0.308 well under the 0.40 D line. The grade is a headline; the signal bars are the story. This sets up prioritization: to move the grade, move the lowest bars. -->

---

## Prioritizing the lowest signals

A single grade tells you *how bad*, not *what to do*. So the scorecard ranks the signals **ascending by score** (ties broken by a fixed signal order) and surfaces the **three lowest** as a prioritized fix list.

For the fixture, the bottom three are:

1. **seam coverage — 0** → inject a seam (Testability Seams explorer)
2. **observability — 0.2** → add an output probe (Controllability & Observability explorer)
3. **structural — 0.24** → decompose the orchestrator (Testability Metrics explorer)

Fix the worst link first: because the grade is a mean, lifting a `0` or a `0.2` moves the overall far more than polishing a signal that is already high.

<!-- The topFixes logic: sort perSignal by score ascending, tie-break by SIGNAL_ORDER, take three. For the fixture that is seam (0), observability (0.2), structural (0.24) — controllability 0.6 and determinism 0.5 are healthier and drop off the list. The pedagogy: the mean rewards raising the floor, not the ceiling, so the worklist is deliberately the weakest signals. Each item is actionable and deep-linked to the explorer that teaches the fix, which is the next slide. -->

---

## Fixes cascade

Some fixes move **more than one** signal at once — the scorecard makes that visible by re-grading live as you toggle fixes on.

- **Inject the clock seam and the RNG seam.** Each injects a seam (raising **seam coverage**) *and* removes a nondeterminism source (raising **determinism** toward 1). Two signals rise together, and the overall crosses 0.40: **F → D**.
- **Inject all four seams** (config, gateway, clock, RNG). Seam coverage reaches **1.0**, determinism is already **1.0**, and the overall clears 0.55: **F → C**.

This is the scorecard's core lesson: the highest-leverage fixes are the ones a *single* design change lets **multiple** signals share.

<!-- Demonstrate the cascade live in the tool. inject-clock and inject-rng each do double duty: the seam is added to appliedSeams (seam coverage 0 → 0.5 for two of four) and the matching source is filtered out of nondeterminism (determinism 0.5 → 1.0). Overall becomes (0.6+0.2+0.5+0.24+1.0)/5 = 0.508 → D. Turn on all four seams and seam coverage is 1.0: (0.6+0.2+1.0+0.24+1.0)/5 = 0.608 → C. The takeaway is leverage — one seam-injection habit pays off in two signals at once, which is exactly the kind of design change worth prioritizing. -->

---

## Every signal links back to its teacher

The scorecard is a **hub**, not a dead end. Each fix in the prioritized list carries a deep link to the explorer that teaches that signal — so a diagnosis becomes a guided path to the lesson that fixes it:

| Signal | Links to |
|---|---|
| controllability | Controllability & Observability |
| observability | Controllability & Observability |
| seam coverage | Testability Seams |
| structural | Testability Metrics |
| determinism | **Flaky Diagnosis** (nondeterminism → flaky testing) |

So a low determinism score does not just say "you have nondeterminism" — it hands you the flaky-testing explorer that shows *why* an unpinned clock or RNG makes a test flaky, and how a seam removes it.

<!-- These are the SIGNAL_META deep links. The one worth calling out is determinism → flaky-diagnosis: nondeterminism is the mechanism behind flaky tests, so the scorecard routes a weak determinism signal to the explorer that teaches flakiness directly. The design point: the capstone closes the loop — every weakness it reports is one click from the tool that taught the fix, turning the whole section into a navigable diagnostic system rather than five separate lessons. -->

---

## Driving design-for-testability work

Read end to end, the scorecard turns "make this more testable" from a vague aspiration into a **measurable loop**:

1. **Grade** the unit — get one honest number and five bars.
2. **Prioritize** — the three lowest signals are the worklist, worst first.
3. **Fix** — follow each deep link, apply the seam / probe / decomposition.
4. **Re-grade** — watch the cascade lift multiple signals and the grade climb.

The fixture's journey — **F (0.308)** → inject clock + RNG → **D** → all four seams → **C** — is exactly this loop in miniature. Design-for-testability stops being folklore and becomes a scoreboard you can move.

<!-- Land the section here. The scorecard's real product is not the grade but the loop: measure, prioritize, fix, re-measure. Trace the fixture's arc F → D → C as proof the loop moves the number. Connect to practice: on real code, wire these five signals into CI and the scorecard becomes a testability budget — a gate that fails when a change drops the grade, and a worklist that tells the team which single design change buys the most testability. -->

---

## Summary

- The **scorecard is the capstone** of the Testability section: it **composes** the three sibling explorers plus the nondeterminism catalogue into one diagnosis, and **re-derives nothing**.
- **Five signals**, each normalized to `[0, 1]` with **higher = more testable**: controllability, observability, seam coverage, structural, determinism.
- **structural = 1 − 19/25 = 0.24** and **determinism = 1 − 2/4 = 0.5** — complexity and nondeterminism enter as `1 − tax` so "up is good" holds uniformly.
- The **fixture reads** controllability 0.6, observability 0.2, seam 0, structural 0.24, determinism 0.5 → overall **0.308** → grade **F**.
- **Grades** map the mean high→low: A ≥ 0.85, B ≥ 0.70, C ≥ 0.55, D ≥ 0.40, else F.
- **Prioritize the lowest** three signals (seam 0, observability 0.2, structural 0.24); a mean rewards raising the floor.
- **Fixes cascade**: inject clock + RNG raises seam coverage *and* determinism → **F → D**; injecting all four seams → **C**. Each signal deep-links to its explorer, with determinism → flaky diagnosis.

**In-class exercise:** starting from the F fixture, list the toggle order that reaches grade C with the fewest fixes, and for each toggle name every signal it moves and by how much.

---

## Further reading

- Course specification — Testability visualization design (Explorer 4: Testability Scorecard).
- Feathers, M. (2004) *Working Effectively with Legacy Code* — seams and the dependency-breaking techniques behind the seam-coverage signal.
- Freeman & Pryce (2009) *Growing Object-Oriented Software, Guided by Tests* — design-for-testability as an ongoing discipline, not a one-off audit.
- Companion explorers: Controllability & Observability, Testability Seams, Testability Metrics, Flaky Diagnosis — the four lessons this scorecard aggregates.
- Tool source: [TestabilityScorecardExplorer.js](../../src/components/TestabilityScorecardExplorer.js), [testabilityModels.js](../../src/data/testabilityModels.js)
- Previous in series: the four Testability-section explorers this capstone composes.
