import { makeRng, randInt, pick } from '../../src/utils/randomInput.js';
import { mcQuestion, esc } from './index.mjs';

const LETTERS = ['a', 'b', 'c', 'd'];

function clauseCountFor(level) {
  if (level === 'easy') return 2;
  if (level === 'medium') return 3;
  return 4; // hard (and any unrecognized level defaults to the largest allowed)
}

// Build a left-nested boolean expression string like "((a && b) || c)".
// Full parenthesization keeps evaluation order unambiguous.
function buildExpr(letters, ops) {
  let expr = letters[0];
  for (let i = 1; i < letters.length; i++) {
    expr = `(${expr} ${ops[i - 1]} ${letters[i]})`;
  }
  return expr;
}

function evalExpr(letters, expr, bits) {
  const fn = new Function(...letters, `return ${expr};`);
  return fn(...bits.map(Boolean));
}

function allAssignments(n) {
  const rows = [];
  for (let mask = 0; mask < (1 << n); mask++) {
    const bits = [];
    for (let i = 0; i < n; i++) bits.push((mask >> i) & 1);
    rows.push(bits);
  }
  return rows;
}

function countSatisfying(letters, expr) {
  let count = 0;
  for (const bits of allAssignments(letters.length)) {
    if (evalExpr(letters, expr, bits)) count++;
  }
  return count;
}

// A clause is "active" at a given row if flipping only that clause changes
// the overall predicate outcome (single-condition MC/DC sensitivity check).
function activeClauseCount(letters, expr, bits) {
  const base = evalExpr(letters, expr, bits);
  let active = 0;
  for (let i = 0; i < letters.length; i++) {
    const flipped = bits.slice();
    flipped[i] = flipped[i] ? 0 : 1;
    if (evalExpr(letters, expr, flipped) !== base) active++;
  }
  return active;
}

function formatRow(letters, bits) {
  return letters.map((l, i) => `${l.toUpperCase()}=${bits[i] ? 'T' : 'F'}`).join(', ');
}

// Pick 3 distinct integers in [0, poolMax] that are not equal to `correct`.
function distinctDistractors(rng, correct, poolMax) {
  const set = new Set();
  let guard = 0;
  while (set.size < 3 && guard < 100) {
    guard++;
    const v = randInt(rng, 0, poolMax);
    if (v !== correct) set.add(v);
  }
  let fallback = 0;
  while (set.size < 3) {
    if (fallback !== correct && !set.has(fallback)) set.add(fallback);
    fallback++;
  }
  return [...set];
}

export function generate(level, seed, count = 15) {
  const rng = makeRng(seed);
  const out = [];
  const n = Math.min(4, clauseCountFor(level));
  const letters = LETTERS.slice(0, n);

  for (let i = 0; i < count; i++) {
    const ops = [];
    for (let k = 0; k < n - 1; k++) ops.push(pick(rng, ['&&', '||']));
    const expr = buildExpr(letters, ops);

    const kind = i % 2;
    if (kind === 0) {
      const total = 1 << n;
      const correct = countSatisfying(letters, expr);
      const distractors = distinctDistractors(rng, correct, total);
      out.push(mcQuestion(rng, {
        name: `Logic truth-table ${level} ${i + 1}`,
        prompt: `For the predicate <code>${esc(expr)}</code> with ${n} boolean clauses (${letters.join(', ').toUpperCase()}), `
          + `how many of the ${total} possible assignments make it <strong>true</strong>?`,
        correct: String(correct),
        distractors: distractors.map(String),
        general: `Evaluate the predicate over all ${total} truth-table rows and count the true outcomes.`,
      }));
    } else {
      const bits = letters.map(() => randInt(rng, 0, 1));
      const correct = activeClauseCount(letters, expr, bits);
      const distractors = distinctDistractors(rng, correct, n + 2);
      out.push(mcQuestion(rng, {
        name: `Logic truth-table ${level} ${i + 1}`,
        prompt: `For the predicate <code>${esc(expr)}</code>, evaluated at ${formatRow(letters, bits)}, `
          + `how many of the ${n} clauses are <strong>active</strong> (flipping that clause alone would change the predicate's overall result)?`,
        correct: String(correct),
        distractors: distractors.map(String),
        general: `A clause is active at a row if toggling only that clause changes the predicate's truth value; check each clause independently.`,
      }));
    }
  }
  return out;
}
