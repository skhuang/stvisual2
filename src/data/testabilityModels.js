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
