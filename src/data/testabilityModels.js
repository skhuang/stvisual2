// Shared fixtures for the Testability section explorers.
//
// A tiny, explicit System-Under-Test: a coin turnstile modelled as a
// deterministic finite state machine. Its numbers are deliberately hand-picked
// so the controllability/observability lessons are exact and unit-testable:
//
//   • JAMMED is reachable only by a fault (no input edge leads into it) and
//     MAINT only by a maintenance key (not one of the test's inputs) — together
//     these are the CONTROLLABILITY gap: a test cannot drive the SUT there.
//   • JAMMED shares its observable output ('green') with UNLOCKED — the
//     OBSERVABILITY gap: from the outside a jam looks identical to unlocked.
//
// Kept as plain data with no dependencies so tests import one source of truth.
export const TURNSTILE_SUT = {
  inputs: ['coin', 'push', 'reset'],
  states: ['LOCKED', 'UNLOCKED', 'PASSED', 'JAMMED', 'MAINT'],
  start: 'LOCKED',
  // deterministic transition relation; only these input-driven edges exist
  trans: [
    { from: 'LOCKED',   on: 'coin',  to: 'UNLOCKED' },
    { from: 'LOCKED',   on: 'push',  to: 'LOCKED'   },
    { from: 'UNLOCKED', on: 'coin',  to: 'UNLOCKED' },
    { from: 'UNLOCKED', on: 'push',  to: 'PASSED'   },
    { from: 'PASSED',   on: 'reset', to: 'LOCKED'   },
    { from: 'JAMMED',   on: 'reset', to: 'LOCKED'   },
  ],
  // observable output per state (what a test can see from outside)
  outputs: { LOCKED: 'red', UNLOCKED: 'green', PASSED: 'beep', JAMMED: 'green', MAINT: 'red' },
};

// Design-for-testability seams (Feathers). One worked snippet — a `charge()`
// function — with four named anti-patterns, each of which pins a real
// dependency into the code so a test cannot substitute it. Each carries the
// Feathers seam type that removes it and the test double the seam then enables.
//
// The before/after code fragments are kept as short literals in the component's
// CODE_FRAGMENTS map (keyed by these ids); the human-readable names, fixes and
// unlocked capabilities live in i18n under `tsm.*`. This object stays pure data
// with no dependencies so both the explorer and its tests import one source of
// truth.
export const SEAM_SNIPPET = {
  antipatterns: [
    // global/singleton Config read — a hidden global input a test cannot set.
    { id: 'global', seam: 'object', double: 'stub' },
    // hard-coded new PaymentGateway() — a dependency the test cannot swap.
    { id: 'newdep', seam: 'object', double: 'mock' },
    // real Date.now() — the wall clock, which a test cannot pin.
    { id: 'clock', seam: 'object', double: 'fake' },
    // real Math.random() — the RNG, which a test cannot make deterministic.
    { id: 'random', seam: 'object', double: 'stub' },
  ],
};

// Testability-metrics module — a small e-commerce checkout, modelled as data so
// the structural-metric lessons (cyclomatic complexity, coupling fan-in/out,
// cohesion) are exact and unit-testable.
//
// The numbers are hand-picked so the ranking teaches one clear point: `checkout`
// is a hard-to-test ORCHESTRATOR — high complexity (6 decisions → cyclomatic 7),
// high fan-out (calls 4 collaborators), and many responsibilities (4) — while
// `formatMoney` is a trivially testable pure helper (no decisions, no fan-out,
// one responsibility). The middle units sit in between and include a deliberate
// score tie (applyDiscount vs validateCart, both 6) so the id-ascending
// tie-break in the ranking is exercised.
//
// score = cyclomatic + 2*fanOut + cohesionPenalty
//   checkout       cyclo 7, fanOut 4, coh 4 → 7 + 8 + 4 = 19  (hardest)
//   chargePayment  cyclo 5, fanOut 1, coh 2 → 5 + 2 + 2 =  9
//   sendReceipt    cyclo 4, fanOut 1, coh 1 → 4 + 2 + 1 =  7
//   applyDiscount  cyclo 3, fanOut 1, coh 1 → 3 + 2 + 1 =  6  (tie, id first)
//   validateCart   cyclo 4, fanOut 0, coh 2 → 4 + 0 + 2 =  6  (tie)
//   formatMoney    cyclo 1, fanOut 0, coh 1 → 1 + 0 + 1 =  2  (easiest)
//
// Kept as plain data with no dependencies so the explorer and its tests import
// one source of truth.
export const METRICS_MODULE = {
  units: [
    { id: 'checkout',      decisions: 6, responsibilities: ['orchestrate-flow', 'coordinate-steps', 'handle-errors', 'audit-log'] },
    { id: 'validateCart',  decisions: 3, responsibilities: ['check-stock', 'check-address'] },
    { id: 'applyDiscount', decisions: 2, responsibilities: ['coupon-rules'] },
    { id: 'chargePayment', decisions: 4, responsibilities: ['call-gateway', 'retry-logic'] },
    { id: 'sendReceipt',   decisions: 3, responsibilities: ['render-email'] },
    { id: 'formatMoney',   decisions: 0, responsibilities: ['format'] },
  ],
  // directed call edges (from calls to)
  calls: [
    { from: 'checkout',      to: 'validateCart' },
    { from: 'checkout',      to: 'applyDiscount' },
    { from: 'checkout',      to: 'chargePayment' },
    { from: 'checkout',      to: 'sendReceipt' },
    { from: 'applyDiscount', to: 'formatMoney' },
    { from: 'chargePayment', to: 'formatMoney' },
    { from: 'sendReceipt',   to: 'formatMoney' },
  ],
};

// Composite fixture for the capstone Scorecard explorer. It bundles the three
// sibling explorers' example models so the scorecard can aggregate all five
// testability signals from ONE source of truth, without re-deriving anything.
//
//   • sut            — explorer 1's turnstile (controllability & observability)
//   • module         — explorer 3's checkout module (structural hardness)
//   • appliedSeams   — explorer 2 seam ids injected so far (none initially)
//   • probes         — observability probe target states added so far (none)
//   • nondeterminism — nondeterminism sources present in the code; each one a
//                      testability tax that an inject-clock / inject-rng fix
//                      removes. DET_TOTAL (4) is the full catalogue the scorecard
//                      normalizes against.
export const SCORECARD_FIXTURE = {
  sut: TURNSTILE_SUT,
  module: METRICS_MODULE,
  appliedSeams: [],
  probes: [],
  nondeterminism: ['clock', 'random'],
};
