// Per-difficulty predicate preset/random generator for the Logic explorer.
import { makeRng, randInt, pick } from '../utils/randomInput.js';

const CLAUSES = 'abcdef'.split('');
const PARAMS = { a: 'x > 0', b: 'y > 0', c: 'z === 0', d: 'w < 10', e: 'p !== q', f: 'r >= 0' };

function bindingsFor(letters) {
  const out = {};
  letters.forEach((c) => { out[c] = PARAMS[c]; });
  return out;
}

// Join clause letters with a mix of && / || and one grouping.
function buildExpr(letters, ops) {
  if (letters.length === 1) return letters[0];
  // group the first two under parentheses when >2 clauses for readable nesting
  let expr = letters[0];
  for (let i = 1; i < letters.length; i++) expr += ` ${ops[(i - 1) % ops.length]} ${letters[i]}`;
  if (letters.length >= 3) expr = `(${letters[0]} ${ops[0]} ${letters[1]})` + expr.slice((letters[0] + ` ${ops[0]} ` + letters[1]).length);
  return expr;
}

export function presetForDifficulty(tier) {
  switch (tier) {
    case 'edge':    return { expression: 'a', bindings: bindingsFor(['a']) };
    case 'large':   return { expression: '((a && b) || (c && d)) || (e && f)', bindings: bindingsFor(['a','b','c','d','e','f']) };
    case 'special': return { expression: 'a && b && a', bindings: bindingsFor(['a','b']) };
    case 'normal':
    default:        return { expression: '(a && b) || c', bindings: bindingsFor(['a','b','c']) };
  }
}

export function randomPredicate(tier, rng = makeRng()) {
  let n;
  switch (tier) {
    case 'edge': return { expression: 'a', bindings: bindingsFor(['a']) };
    case 'large': n = randInt(rng, 4, 6); break;
    case 'special': {
      const op = pick(rng, ['&&', '||']);
      const letters = CLAUSES.slice(0, randInt(rng, 2, 3));
      return { expression: letters.join(` ${op} `), bindings: bindingsFor(letters) };
    }
    case 'normal':
    default: n = randInt(rng, 2, 3);
  }
  const letters = CLAUSES.slice(0, n);
  const ops = [pick(rng, ['&&', '||']), pick(rng, ['&&', '||'])];
  return { expression: buildExpr(letters, ops), bindings: bindingsFor(letters) };
}
