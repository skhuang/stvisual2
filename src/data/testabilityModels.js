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
