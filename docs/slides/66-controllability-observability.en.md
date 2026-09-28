---
marp: true
theme: default
paginate: true
size: 16:9
title: Software Testing Visualization #66 — Controllability & Observability
description: Testability as controllability + observability — driving the SUT into the state a test needs, seeing the effect it must check, and why observability is a design choice, worked on a turnstile finite-state model.
lang: en
---

# Controllability & Observability
### *Testability = can you drive it, and can you see it?*

Software Testing Visualization series #66 · Testability
Companion tool: `?explorer=controllability-observability` → Controllability & Observability Explorer ([ControllabilityObservabilityExplorer](../../src/components/ControllabilityObservabilityExplorer.js))

<!-- Opening deck for the Testability section. Testability is classically defined (Freedman; Binder; control-theory roots) as controllability + observability. This deck grounds both halves in one explicit finite-state model — a coin turnstile — so every number on screen is reproducible: controllability 3/5, observability 1/5, and a single probe lifting observability to 3/5. The companion explorer is Explorer 1 of the four-part testability family. -->

---

## What makes code testable?

Before we can generate a test, run it, and trust its verdict, the code has to *let* us. **Testability** is the property that measures how easily it does.

The classical definition — from Freedman, from Binder, with roots in control theory — splits testability into two independent halves:

- **Controllability** — can a test **drive** the software into the state or input it needs to exercise?
- **Observability** — can a test **see** the effect it needs to check?

A test needs *both*. If you cannot steer the code into the situation you want to test, you never reach the behaviour. If you can reach it but cannot observe the result, you cannot tell pass from fail. This deck makes each half concrete on one small model.

<!-- Establish the frame first: testability is not vague "clean code" virtue — it is two measurable, separable capabilities. Controllability is about the *input* side (getting in), observability about the *output* side (reading back out). The whole deck is a two-column argument: one column per half, each grounded in the same turnstile so students see they are orthogonal. Name the lineage — Freedman, Binder, control theory — so students know this is a definition, not our invention. -->

---

## The turnstile — one model, both lessons

We use a single, deliberately tiny System-Under-Test: a **coin turnstile**, modelled as a deterministic finite-state machine.

| Part | Value |
| --- | --- |
| Inputs (the test's levers) | `coin`, `push`, `reset` |
| States | `LOCKED`, `UNLOCKED`, `PASSED`, `JAMMED`, `MAINT` |
| Start state | `LOCKED` |
| Observable output per state | `LOCKED→red`, `UNLOCKED→green`, `PASSED→beep`, `JAMMED→green`, `MAINT→red` |

The transitions are exactly: `coin` unlocks, `push` when unlocked passes you through, `reset` relocks — plus a couple of self-loops. Crucially, **no input edge leads into `JAMMED` or `MAINT`**: a jam is a fault, and maintenance needs a physical key the test does not hold.

<!-- Introduce the fixture that every later slide reads from — it is TURNSTILE_SUT in src/data/testabilityModels.js, one source of truth shared by the explorer and its unit tests. Stress the two deliberately hand-picked gaps: JAMMED and MAINT have no incoming input-driven edge (a controllability trap), and JAMMED shares output 'green' with UNLOCKED (an observability trap). Everything downstream is a consequence of these two design choices in the model. -->

---

## Controllability — the definition

**Controllability** asks: starting from the initial state, using only the inputs a test can supply, which states can the test **actually reach**?

Compute it by breadth-first search over the transition relation from the start state, following only input-driven edges:

```
reachable(SUT) = BFS from start over trans      # inputs only
controllability = |reachable| / |states|
```

Any state the search never reaches is a **controllability gap**: no sequence of test inputs can put the SUT there, so no test can exercise the behaviour that lives in that state. A gap is not a missing test — it is a state the tests are *structurally unable* to visit.

<!-- This is the exported reachableStates(sut) / controllability(sut) engine. Keep the message crisp: controllability is a reachability question answered by BFS, and its value is a ratio. The teaching payload is the notion of a gap — an unreachable state is worse than an untested one, because no amount of test-writing effort can cover it until the design changes. Set up the number the next slide reveals. -->

---

## Controllability on the turnstile — 3/5

Run the reachability search from `LOCKED`:

- `LOCKED` — start
- `LOCKED --coin--> UNLOCKED`
- `UNLOCKED --push--> PASSED`

Reachable set = **{ LOCKED, UNLOCKED, PASSED }** → **controllability 3/5 = 60%**.

`JAMMED` and `MAINT` are the **gap**. No input (`coin`/`push`/`reset`) drives the SUT into either: `JAMMED` is entered only by a fault, `MAINT` only by a maintenance key that is not one of the test's inputs. A test suite simply *cannot* place the turnstile in those states — the "jam handling" and "maintenance" behaviours are unreachable from the outside.

<!-- Walk the BFS out loud so the 3/5 is earned, not asserted. The two unreachable states are the entire point of the model. Ask the room: how would you make JAMMED controllable? (Add a test-only input edge — a fault-injection hook — which is exactly a design-for-testability seam, previewing Explorer 2.) The ratio 3/5 = 60% must match the explorer's readout exactly. -->

---

## Observability — the definition

**Observability** asks the mirror question: if a fault lands in a given state, can a test **tell** — does that state produce a distinguishable output?

A state is observable when its output value is **unique** across all states. If two states share an output, an observer looking only at the output cannot tell them apart, so a fault that swaps one for the other is invisible.

```
observable(SUT) = states whose output is UNIQUE among all states
observability = |observable| / |states|
```

Shared outputs, swallowed errors, and missing return values all collapse distinct internal situations into one external signal — and every collapse hides a potential fault.

<!-- This is observableStates(sut) / observability(sut). The definition used here is deliberately simple and exact: an output shared by two states makes both unobservable, because the outside world cannot distinguish them. Connect to real code: two error paths that both return null, or both log the same message, are the same failure mode as two states sharing 'green'. Observability is the output side of the coin, orthogonal to controllability. -->

---

## Observability on the turnstile — 1/5

Tally the outputs:

| Output | States with it | Unique? |
| --- | --- | --- |
| `red` | LOCKED, MAINT | shared |
| `green` | UNLOCKED, JAMMED | shared |
| `beep` | PASSED | unique |

Only **PASSED → `beep`** is unique → **observability 1/5 = 20%**.

The damning case is `green`: **`JAMMED` looks identical to `UNLOCKED`**. From the outside a jammed turnstile and a working, unlocked one emit the same signal — so a test can never catch a jam by watching the output. The fault is real, but it is invisible.

<!-- The base observability is deliberately dismal (1/5) to make the design-choice slide land hard. The JAMMED/UNLOCKED collision is the concrete lesson: this is the classic "two failure modes, one output" bug that survives every test because no assertion can separate them. 1/5 = 20% must match the explorer. Note the asymmetry with controllability: JAMMED is both uncontrollable AND unobservable, which is why real jams slip through. -->

---

## Observability is a design choice

Observability is not fixed by the problem — it is something the **developer designs in**. Add a distinguishing output and previously-hidden states become visible.

In the explorer, toggle **"add a probe"**: it gives `JAMMED` its own distinct output, `grind`, instead of reusing `green`. Recount:

| Output | States | Unique? |
| --- | --- | --- |
| `red` | LOCKED, MAINT | shared |
| `green` | UNLOCKED | **now unique** |
| `beep` | PASSED | unique |
| `grind` | JAMMED | **now unique** |

Observability jumps from **1/5 to 3/5 = 60%** — one probe fixed *two* states, because separating `JAMMED` also un-shared `UNLOCKED`'s `green`.

<!-- The pivotal slide: observability is a lever, not a fate. A probe is any added return value, log line, status field, or test-only accessor that makes an internal state distinguishable. The double win is worth pausing on: adding one distinct output for JAMMED also rescues UNLOCKED, because green was only ambiguous due to the collision — so the count goes 1/5 → 3/5, not 1/5 → 2/5. This is exactly the withProbe(sut, 'JAMMED', 'grind') path in the engine; the numbers must match. -->

---

## Worked example — driving to PASSED

Put both halves together for one concrete test goal: **verify the pass-through behaviour** (state `PASSED`, output `beep`).

- **Controllability**: is `PASSED` reachable? Yes. Shortest drive from `LOCKED`:

  ```
  coin   →  UNLOCKED
  push   →  PASSED
  ```

  Two inputs — the test's setup sequence writes itself.

- **Observability**: once there, can the test check it? Yes — `PASSED` emits `beep`, the one unique output, so the assertion `expect(output).toBe('beep')` distinguishes it from every other state.

`PASSED` is fully testable because it is both reachable *and* distinguishable. Contrast `JAMMED`: unreachable by input **and** (before the probe) indistinguishable from `UNLOCKED` — untestable on both axes.

<!-- Tie the deck together with one end-to-end test-design story. driveTo(sut,'PASSED') = [coin, push] is the exported BFS; that sequence is literally the arrange step of a real test. beep being unique is what makes the assert step possible. The contrast with JAMMED shows the two axes are independent but both required: a state needs controllability to arrange and observability to assert. This is the mental model students should carry into writing real tests. -->

---

## Why both matter for test design

Every test has an **arrange** step and an **assert** step, and they map exactly onto the two halves:

- **Arrange needs controllability.** The setup drives the SUT into the state under test. An uncontrollable state has no arrange step that reaches it — the test cannot even begin.
- **Assert needs observability.** The check reads an output and compares it. An unobservable state has no output that distinguishes pass from fail — the assertion is meaningless.

So when a unit is "hard to test", ask *which half* is failing. Can't set up the scenario? Controllability — add a seam or a test-only input. Can't verify the result? Observability — add a return value, a probe, a status field. Naming the half turns a vague complaint into a concrete design fix.

<!-- The actionable takeaway: the arrange/assert structure of every test is the controllability/observability split in disguise. This gives students a diagnostic: when they hit an untestable unit, decompose the difficulty into the two axes and each axis points at a specific remedy. Preview the rest of the section — Explorer 2 (seams) is the controllability remedy toolkit, and probes/return values are the observability remedy. -->

---

## Tool demonstration — controllability mode

Open the companion explorer at `?explorer=controllability-observability` and stay on the **Controllability** tab.

- Pick a **target state** from the buttons. Choose `PASSED`: the graph highlights the drive path and the readout shows `reached PASSED in 2 steps` with the sequence `coin · push`.
- The readout reports **controllability 3/5** and names the gap: `JAMMED, MAINT unreachable`.
- Now pick `JAMMED`: the readout flips to **unreachable** — no input sequence drives the SUT there. Reachable nodes are drawn solid; the two gap states are dashed.

<!-- First demo slide. Have the class drive to PASSED and read the coin·push sequence off the screen, then try JAMMED to see the unreachable verdict. The solid-vs-dashed rendering makes the gap visible at a glance. Keep the numbers anchored: 3/5, and the exact drive sequence coin·push. No image asset is bundled for this deck, so this slide narrates the live tool instead. -->

---

## Tool demonstration — observability mode

Switch to the **Observability** tab in the same explorer.

- The output list shows each state → its output, tagged **unique** or **shared**. Only `PASSED → beep` is unique; the readout reads **observability 1/5**, gap `LOCKED, UNLOCKED, JAMMED, MAINT`.
- Tick **"add a probe"**. `JAMMED` gets its own output `grind`; `UNLOCKED`'s `green` is no longer shared. The readout climbs to **observability 3/5** live.
- Untick it to watch observability fall back to 1/5 — the design choice, made and unmade in one click.

<!-- Second demo slide. The probe toggle is the money interaction of the whole deck: students see 1/5 → 3/5 happen in real time and, if watching closely, notice one probe fixed two states. Point out the tag column (unique/shared) so they connect the ratio to the shared-output collisions. Again narrated rather than screenshotted, since this deck ships without image assets. -->

---

## Summary

- **Testability = controllability + observability** — the classical two-part definition. A test needs both: one to reach the behaviour, one to check it.
- **Controllability** = can a test drive the SUT into a needed state? Measured by reachability (BFS) from the start over input-driven edges. On the turnstile: reachable **{ LOCKED, UNLOCKED, PASSED } = 3/5**; `JAMMED` and `MAINT` are the gap — no input reaches them.
- **Observability** = can a test see the effect? Measured by how many states have a **unique** output. On the turnstile only `PASSED → beep` is unique, so base observability is **1/5**; `JAMMED` shares `green` with `UNLOCKED`, so a jam is invisible.
- **Observability is a design choice.** Adding one probe (`JAMMED → grind`) lifts observability to **3/5**, because distinguishing `JAMMED` also un-shares `UNLOCKED`'s output.
- **Both map onto every test**: arrange needs controllability, assert needs observability. When a unit is hard to test, name the failing half — and the remedy follows.

**In-class exercise:** for the turnstile, give the shortest input sequence that drives it to `PASSED` (answer: `coin · push`), then explain why a fault that lands in `JAMMED` escapes every test before a probe is added, and exactly which two states one `grind` probe makes observable.

---

## Further reading

- Course specification — Testability visualization design, Explorer 1 ([2026-09-28-testability-visualization-design.md](../superpowers/specs/2026-09-28-testability-visualization-design.md))
- Freedman, R. S. (1991) *Testability of Software Components* — the controllability + observability definition of testability.
- Binder, R. V. (1994) *Design for Testability in Object-Oriented Systems* — testability as a design property, with controllability and observability as its axes.
- Feathers, M. (2004) *Working Effectively with Legacy Code* — seams: the practical controllability levers (previewed by the next deck).
- Tool source: [ControllabilityObservabilityExplorer.js](../../src/components/ControllabilityObservabilityExplorer.js), [testabilityModels.js](../../src/data/testabilityModels.js)
- Next in series: Design-for-Testability Seams (deck #67) — turning uncontrollable dependencies into substitutable ones.
