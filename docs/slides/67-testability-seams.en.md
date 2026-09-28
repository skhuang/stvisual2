---
marp: true
theme: default
paginate: true
size: 16:9
title: Software Testing Visualization #67 — Design-for-Testability Seams
description: Testability is a design choice — the four hard-coded dependencies that make charge() untestable, the Feathers object seams that make each one substitutable, and the test double each seam unlocks.
lang: en
---

# Design-for-Testability Seams

### *Make every dependency substitutable*

Software Testing Visualization series #67 · Design-for-Testability Seams
Companion tool: `?explorer=testability-seams` → Seams Explorer ([TestabilitySeamsExplorer](../../src/components/TestabilitySeamsExplorer.js))

<!-- Opening deck for the design-for-testability seams unit. The claim is that testability is not luck, it is a design property you can add on purpose. We take one small untestable charge() function, find the four dependencies it pins straight into its body, and remove each one with a Feathers seam. Every fix names the seam type and the test double it unlocks, cross-linking the test-doubles unit rather than re-teaching it. The companion Seams Explorer lets the learner apply each fix and watch the testability meter climb. -->

---

## What makes code untestable

A unit is untestable when a test cannot **control its inputs** or **observe its outputs**. The most common cause is a **hard-coded dependency**: the code reaches out and grabs a collaborator itself, so no test can put a different one in its place.

Look for the tell-tale shapes:

- a **global or singleton** read — a hidden input the test cannot set,
- a **`new`** of a concrete collaborator — a dependency the test cannot swap,
- a call to the **real clock** — a value the test cannot pin,
- a call to the **real RNG** — a value the test cannot make deterministic.

Each of these **pins** a real dependency into the function body. The behaviour under test is now entangled with the real world, and a unit test has no seam to reach in through.

<!-- Ground the whole deck in the controllability/observability framing from earlier in the section: a hard-coded dependency is a controllability failure — you cannot feed the unit the input you want. Stress that none of these four are bugs; the code runs correctly. They are *design* choices that happen to make the code hostile to testing. The four shapes here map one-to-one onto the four anti-patterns in the worked snippet on the next slides, so name them precisely. -->

---

## Feathers' notion of a seam

Michael Feathers (*Working Effectively with Legacy Code*) gives the key vocabulary: a **seam** is a place where you can **change the behaviour of your program without editing in that place** — you alter it from outside, through the seam.

Every seam has an **enabling point**: the spot where you choose which behaviour runs. For an **object seam**, the enabling point is a parameter or field — the caller decides which object to pass in, and the code under test uses whatever it is handed.

That is the whole design move of this deck: turn each hard-coded dependency into an **object seam**, so a test can hand in a substitute at the enabling point instead of the real thing.

<!-- Define seam carefully — students conflate it with "refactoring" or "interface". A seam is specifically a point of behavioural substitution *plus* an enabling point that selects the behaviour. Feathers catalogues several kinds (preprocessing seams, link seams, object seams); this deck uses only the object seam, because in a language with parameters and fields it is the cleanest and needs no build-system trickery. The enabling point for an object seam is just "the argument you pass" — keep it that concrete. -->

---

## The untestable `charge()`

```js
function charge(amount) {
  const cfg = Config.instance();          // global singleton read
  const gw  = new PaymentGateway();        // hard-coded new
  const at  = Date.now();                  // real clock
  const id  = Math.random().toString(36);  // real RNG
  return gw.charge(cfg.merchant, amount, at, id);
}
```

Four dependencies, four anti-patterns, all pinned into the body. A test that calls `charge(100)` gets the **real** config, the **real** gateway, the **wall-clock** time, and a **random** id — none of which it chose, and none of which it can check against.

The testability meter reads **0/4**: nothing here is substitutable yet.

<!-- This is the specimen the rest of the deck operates on — it is exactly the snippet the Seams Explorer renders (CODE_FRAGMENTS in the component). Walk the four lines and connect each to the anti-pattern shapes from the previous slide. Point out that the function *works* — it charges the card — which is why the untestability is easy to miss in review. The 0/4 meter is the explorer's testability score = fixes applied / 4; every following slide moves it up by one. -->

---

## Fix 1 — global singleton Config → inject config

```js
// before                              // after
const cfg = Config.instance();         function charge(deps, amount) {
                                       const cfg = deps.config;
```

The global read is a **hidden input**: `Config.instance()` reaches into shared state the test never chose. Passing `config` as part of `deps` turns it into an **object seam** — the test supplies its own config at the enabling point.

- **Seam type:** object seam
- **Enables (double):** **stub** — a canned config with the exact values the test wants
- **Capability unlocked:** *supply a test config without touching globals*

Meter → **1/4**.

<!-- The stub here is a test double that just returns fixed data — a config object with a known merchant id. The point is that the test no longer has to mutate global state (which leaks between tests and forces ordering) to set up its scenario. This is the object seam in its simplest form: replace a global lookup with a parameter. Keep the anti-pattern → seam → double mapping exact: global read → object seam → stub. -->

---

## Fix 2 — hard-coded `new PaymentGateway()` → inject collaborator

```js
// before                              // after
const gw = new PaymentGateway();       const gw = deps.gateway;
```

The `new` **welds a concrete collaborator** into `charge()`: every test hits the real payment gateway. Injecting the gateway as a collaborator (behind an interface) makes it an **object seam** — the test hands in whichever gateway it needs.

- **Seam type:** object seam
- **Enables (double):** **mock** — a gateway that records the call and can be told to fail
- **Capability unlocked:** *force the gateway to fail*

Meter → **2/4**.

<!-- This is the classic "new is glue" problem — a direct constructor call is the hardest dependency to break because it names a concrete type. Injecting behind an interface is the fix. The double is a *mock* because the interesting tests here are about the *interaction*: was charge() called with the right arguments, and does it handle a gateway failure? A mock verifies the call and can be programmed to throw — you cannot make the real gateway fail on demand. Mapping: hard-coded new → object seam → mock. -->

---

## Fix 3 — real `Date.now()` → inject a clock

```js
// before                    // after
const at = Date.now();       const at = deps.clock.now();
```

`Date.now()` is the **wall clock** — a fresh value every run, which the test can neither predict nor pin. Injecting a `clock` object makes it an **object seam**: the test passes a clock frozen at a known instant.

- **Seam type:** object seam
- **Enables (double):** **fake** — a working clock whose `now()` returns a fixed time
- **Capability unlocked:** *assert on a fixed timestamp*

Meter → **3/4**.

<!-- Non-determinism source #1: the clock. A test that reads the real time can never assert an exact timestamp, so it either skips the check or does something fragile like a range assertion. A *fake* clock is a real, working object (not just canned returns) whose behaviour is controllable — Date pinned to, say, 2026-01-01. Fake is the right double name here because it is a lightweight working implementation, not a recorder. Mapping: real clock → object seam → fake. -->

---

## Fix 4 — real `Math.random()` → inject a seeded rng

```js
// before                                  // after
const id = Math.random().toString(36);     const id = deps.rng.id();
```

`Math.random()` is the second **non-determinism source** — a different id every run, so the test cannot know what `charge()` produced. Injecting a seeded `rng` makes it an **object seam**: the test supplies an rng that yields a known sequence.

- **Seam type:** object seam
- **Enables (double):** **stub** — an rng returning a fixed, known id
- **Capability unlocked:** *make the generated id deterministic*

Meter → **4/4**.

<!-- Non-determinism source #2: the RNG. Same story as the clock — randomness in the unit means the test cannot predict the output. A seeded/stubbed rng returns a fixed id, so the generated transaction id is now assertable. Double is a *stub* (canned return value) rather than a mock, because the test only needs the value, not to verify the call. That the clock is a fake and the rng a stub, though both remove non-determinism, is a nice illustration that the double you reach for depends on what the test needs to do. Mapping: real RNG → object seam → stub. -->

---

## Seam → double crosswalk

| Anti-pattern | Seam type | Enables (double) | Capability unlocked |
| --- | --- | --- | --- |
| Global singleton `Config` | object seam | **stub** | supply a test config without touching globals |
| Hard-coded `new PaymentGateway()` | object seam | **mock** | force the gateway to fail |
| Real clock `Date.now()` | object seam | **fake** | assert on a fixed timestamp |
| Real `Math.random()` | object seam | **stub** | make the generated id deterministic |

Every seam is the same *kind* — an object seam — but each unlocks a **different test double**, chosen by what that test needs to do. → *See the matching test double* in the **Test Doubles** unit (deck #27).

<!-- This is the crosswalk table the explorer renders on the right, and the conceptual core of the deck: one seam type, four different doubles. Resist the urge to re-teach stubs/mocks/fakes here — that is deck #27's job, and the explorer deliberately links out rather than re-explaining. The teaching point is the *selection*: a seam gives you the ability to substitute; which double you drop in is a separate decision driven by the assertion you want to make (value → stub, interaction/failure → mock, working-but-controlled → fake). -->

---

## Design-for-testability = substitutable dependencies

The four fixes are one idea applied four times: **make each dependency substitutable**. That is what design-for-testability *is* — not writing more tests, but shaping the code so a test can control every input and observe every output.

The **testability meter** measures exactly this: `score = fixes applied / 4`. It is not a code-quality opinion; it is the fraction of the unit's real-world dependencies a test can now replace.

At **4/4**, `charge()` is a **pure-ish unit**: its config, gateway, clock, and RNG all arrive through `deps`, so a test drives all of them and checks the one line of real logic that remains.

<!-- Land the thesis: testability is a design property, added deliberately, and it is measurable. The meter (testabilityOf → applied.length / antipatterns.length) is deterministic and unit-tested precisely so the lesson is exact, not a matter of taste. "Pure-ish" is the honest word — charge() still has one side effect (the gateway call), but every input is now injected, so it behaves like a pure function of deps + amount for the purposes of a test. This is the same move as dependency injection frameworks make, just done by hand and named. -->

---

## Tool demonstration — the Seams Explorer

Open the companion tool at `?explorer=testability-seams`.

- The **left column** shows `charge()` as read-only annotated code, one *Apply seam* toggle per pinned dependency, each tagged with its anti-pattern chip.
- **Apply a seam** and that line rewrites to its injected `deps.…` form, the **Testability** meter climbs, and the unlocked capability appears under *What a test can now do*.
- The **right column** carries the seam / double crosswalk and a link out to the matching test double.
- Apply all four and the **capstone** fires: every dependency is now substitutable.

Try reverting one fix and watch the meter and its capability disappear — testability is reversible, and so is the damage of pinning a dependency back in.

<!-- Drive the explorer live if you can. The narrative arc is 0/4 → 4/4: start with the fully pinned function, apply the fixes one at a time, and read the capability list growing on the right. The revert action is worth demonstrating because it makes the meter's meaning concrete — each toggle is worth exactly one quarter, and un-fixing re-pins the dependency. End on the capstone message so the class sees the "pure-ish unit" payoff stated by the tool itself. -->

---

## Summary

- **Untestable code = hard-coded dependencies.** A global read, a `new`, the real clock, and the real RNG each pin a real-world dependency into the unit, so a test can neither control the input nor observe the output.
- A **seam** (Feathers) is a place to change behaviour without editing there; an **object seam** does it through a parameter or field — the enabling point where a test hands in a substitute.
- The four fixes are all the *same* seam — an **object seam** — but each unlocks a *different* **test double**: config → **stub**, gateway → **mock**, clock → **fake**, rng → **stub**.
- Each fix unlocks a concrete **capability**: supply a test config without globals, force the gateway to fail, assert a fixed timestamp, make the id deterministic.
- **Design-for-testability = making dependencies substitutable**; the **testability meter** measures it as *fixes applied / 4*, and 4/4 leaves a pure-ish unit fully under test control.

**In-class exercise:** take a function of your own that calls the clock, a global, or `new`. For each dependency name the seam that would remove it and the test double it would enable, then write the one assertion that becomes possible once you do.

---

## Further reading

- Course specification — Testability visualization design ([2026-09-28-testability-visualization-design.md](../superpowers/specs/2026-09-28-testability-visualization-design.md))
- Feathers, M. (2004) *Working Effectively with Legacy Code* — the source of the seam / enabling-point vocabulary and the object seam used throughout this deck.
- Companion unit — **Test Doubles** (deck #27): stubs, mocks, fakes, and when to reach for each — the doubles this deck's seams unlock.
- Tool source: [TestabilitySeamsExplorer.js](../../src/components/TestabilitySeamsExplorer.js), fixtures in [testabilityModels.js](../../src/data/testabilityModels.js) (`SEAM_SNIPPET`).
- Next in series: **Testability Metrics** and the **Testability Scorecard** — measuring structural hardness and aggregating the testability signals.
