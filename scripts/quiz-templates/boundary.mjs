import { makeRng, randInt } from '../../src/utils/randomInput.js';
import { mcQuestion } from './index.mjs';

// Ask "which value is an ON point / OFF point / interior / exterior of the predicate".
export function generate(level, seed, count = 15) {
  const rng = makeRng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const n = randInt(rng, 5, 50);
    // easy: x <= n. medium: lo <= x <= hi. hard: lo < x <= hi.
    let pred, on, off, inside, outside;
    if (level === 'easy') {
      pred = `x ≤ ${n}`; on = n; off = n + 1; inside = n - 1; outside = n + 2;
    } else {
      const hi = n + randInt(rng, 3, 20);
      if (level === 'hard') { pred = `${n} &lt; x ≤ ${hi}`; on = n + 1; off = n; inside = n + 2; outside = hi + 1; }
      else { pred = `${n} ≤ x ≤ ${hi}`; on = n; off = n - 1; inside = n + 1; outside = hi + 1; }
    }
    const ask = ['ON point (boundary, satisfies)', 'OFF point (just outside)'][i % 2];
    const correct = ask.startsWith('ON') ? on : off;
    out.push(mcQuestion(rng, {
      name: `Boundary ${level} ${i + 1}`,
      prompt: `For the predicate <code>${pred}</code>, which value is an <strong>${ask}</strong>?`,
      correct: String(correct),
      distractors: [inside, outside, ask.startsWith('ON') ? off : on].map(String),
      general: `On/off points sit immediately either side of the boundary; interior/exterior points are further away.`,
    }));
  }
  return out;
}
