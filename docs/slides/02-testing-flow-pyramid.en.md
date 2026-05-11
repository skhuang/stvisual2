---
marp: true
theme: default
paginate: true
size: 16:9
title: Software Testing Visualization #2 — Testing Flow & Testing Pyramid
description: Six-step testing flow, auto-play animation, the Unit/Integration/System/Acceptance pyramid
lang: en
---

# Testing Flow & Testing Pyramid
### Two classic high-level mental models

Software Testing Visualization, Lecture #2
Tool: `/section-flow` ([TestingFlow](../../src/components/TestingFlow.js)) + `/section-types` ([TestingTypesTable](../../src/components/TestingTypesTable.js))

---

## Two parallel threads

| Thread | Question | Tool |
| --- | --- | --- |
| **Testing flow** | From requirements to defect reports — **when** do I test? | TestingFlow |
| **Testing pyramid** | How many **unit / integration / system / acceptance** tests should I write? | TestingTypesTable |

> One is horizontal (timeline); the other vertical (layer distribution) — both visualised.

---

## Testing flow: six steps

```
Requirements ──► Test Plan ──► Test Design ──► Execution ──► Analysis ──► Defect Report
     📋             📝            ✏️              ▶️              🔍              📊
```

| # | Step | Primary output |
| --- | --- | --- |
| 1 | Requirements | Test goals and scope |
| 2 | Test Plan | Strategy, resources, schedule |
| 3 | Test Design | Test cases, scripts, data |
| 4 | Execution | Actual / expected results |
| 5 | Analysis | Defect list, coverage |
| 6 | Defect Report | Fix-tracking status |

---

## Tool: auto-play flow

![w:1000](../assets/slides/flow-overview.png)

- The six steps form a chain of icons (`flow-step-{id}` + `flow-arrow-{idx}`).
- Click `flow-play-btn` → the tool auto-advances every 1800 ms.
- The progress bar `flow-progress-fill` reflects the current step (0–100%).
- Hover any step → `flow-tooltip-{id}` shows the full description.

---

## Why this flow still matters

Even in the agile / CI era:
- **Requirements analysis** is still the root of coverage — you can’t test what you don’t understand.
- **Test design** ≠ **execution** — design is consistently under-estimated.
- **Analysis** is the feedback loop — without it, “tests ran” is meaningless.
- **Defect reporting** is where quality and engineering culture meet.

> Teaching tip: animating the flow is what makes students remember that “test design” is a separate stage.

---

## Another angle: the testing pyramid

```
              ┌────────────────────────────┐
              │      Acceptance (100%)     │  ◄── end-to-end, slow, expensive
              ├──────────────────────┐
              │   System (80%)       │
              ├────────────────┐
              │ Integration (55%) │
              ├──────────┐
              │ Unit (30%) │  ◄── fast, cheap, plentiful
              └──────────┘
```

> The tool draws an **inverted pyramid** (widening left → right) — the meaning is not “Unit is smallest” but “**scope** widens from narrow to broad”.

---

## Four testing layers

| Layer | Scope | When | Speed |
| --- | --- | --- | --- |
| **Unit** | A single function / class | Development | milliseconds |
| **Integration** | Module combinations | Late dev | seconds |
| **System** | Whole system | After integration | minutes |
| **Acceptance** | Verify requirements | Before release | hours |

> Moving up: **slower + more expensive**. Moving down: **narrower + less confidence**. Balance both ends.

---

## Tool: pyramid + cards

![w:1000](../assets/slides/pyramid-overview.png)

- The top `pyramid` visualises layer widths (30% / 55% / 80% / 100%).
- The bottom `types-grid` adds a card per layer (`type-card-{id}`): type + purpose + timing.
- The colour scale (blue → green → orange → red) maps to the “fast → slow” intuition.

---

## Classic guidance: Mike Cohn’s Test Pyramid

```
       △    Acceptance (few)
      △△    System
     △△△    Integration
    △△△△△   Unit (many)
```

“Many unit tests, few acceptance tests” is the classic recipe, but **modern CI has lowered the cost of higher layers**:
- Docker → integration tests are no longer expensive to set up.
- Playwright / Cypress → e2e can run reasonably fast.

> The pyramid still applies; **the exact ratio can adapt to tooling**.

---

## Two common anti-pyramids

```
  ▽▽▽▽▽   Acceptance   ◄── overly reliant on e2e
   ▽▽▽    System
    ▽▽    Integration
     ▽    Unit
```

or

```
     △    Acceptance
    △△    System       ◄── system-only, skipping integration + unit
   △△△    Integration
  △△△△△   Unit
```

> Both appear often. The first is the “ice-cream cone”; the second is “missing unit tests”. This tool won’t fix them — but it lets you **see the shape you actually have**.

---

## Combining the two views

| Flow step | Layers usually involved |
| --- | --- |
| Requirements → design | Planning across all layers |
| Execution (CI-triggered) | Unit every commit, integration every PR, system nightly, acceptance pre-release |
| Analysis | Unit gives fast feedback; acceptance gates releases |
| Defect report | Aggregated across layers |

> Both axes matter: **when to test** (flow) and **how much to test** (pyramid).

---

## Summary

- Two complementary high-level models:
  - **Flow**: 6 steps on a timeline, visualised via auto-play.
  - **Pyramid**: 4 layers vertically distributed, visualised with widths + colours.
- They are not “testing methods” themselves (that was Lecture #1) — they are the **engineering organisation** around testing.
- The next seven lectures dive into the criteria that live inside the “test design” step.

---

## Exercises

1. Open `/section-flow`, click `flow-play-btn`, and watch a full cycle. Try to describe each step in one sentence without using the tooltip.
2. Pick a test suite you currently use (any language). Estimate its pyramid ratio (unit:int:sys:acc). Does it lean toward an ice-cream cone?
3. What automation layers should run in your CI pipeline? When do you still need manual acceptance?
4. Read the colour intensity of `pyramid-row-{id}` in the tool — does darker mean **slower** or **broader scope**? Which interpretation does the designer intend?

---

## Further reading

- Mike Cohn, *Succeeding with Agile* — the classic Test Pyramid.
- Martin Fowler, “TestPyramid”: <https://martinfowler.com/bliki/TestPyramid.html>
- Google Testing Blog, “Just Say No to More End-to-End Tests”.
- Implementation:
  - [src/components/TestingFlow.js](../../src/components/TestingFlow.js) — auto-play + progress bar.
  - [src/components/TestingTypesTable.js](../../src/components/TestingTypesTable.js) — pyramid + cards.
  - [src/data/testingData.js](../../src/data/testingData.js) — `testingFlow` and `testingTypes`.
- Spec §2.B: [docs/Specification.zh-TW.md](../Specification.zh-TW.md).
- Next → **Lecture #3 — Graph Coverage (structural)**.
