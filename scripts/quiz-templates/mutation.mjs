import { makeRng, randInt, pick, shuffle } from '../../src/utils/randomInput.js';
import { mcQuestion, esc } from './index.mjs';

// Ask: given a mutated snippet and a test input, is the mutant KILLED (this test
// detects it), LIVES (this test does not detect it, but the mutant is not
// equivalent — some other input would kill it), or EQUIVALENT (no input, ever,
// could detect it)? Every outcome below is a hand-verified fact about the fixed
// snippet/operator pair, not a dynamically-executed judgement — see the report
// for the full per-entry reasoning.
export const OUTCOMES = {
  KILLED: 'Killed — the mutant produces different output on this test input',
  EQUIVALENT: 'Equivalent — no test input could ever detect this mutant',
  LIVES: 'Lives — the mutant produces the same output on this test input, but it is not equivalent overall',
};

// --- fixed, hand-verified table of mutation cases -------------------------
// Each template's `build` picks a *category* (via the seeded rng, or forced by
// level for the "obvious" easy cases) whose outcome is fixed by construction;
// only literals that provably cannot change the outcome are varied.
const TEMPLATES = {
  // if (x > 0) ... vs if (x >= 0) ...
  // x=0: original takes the else-branch, mutant's >= flips it -> KILLED.
  // x>0: both branches agree ("positive") -> LIVES.
  // x<0: both branches agree ("non-positive") -> LIVES.
  signClassify: {
    title: 'relational boundary (sign classify)',
    build(rng, level) {
      const cat = level === 'easy' ? 'zero' : pick(rng, ['zero', 'positive', 'negative']);
      let x;
      let outcome;
      if (cat === 'zero') { x = 0; outcome = 'KILLED'; } else if (cat === 'positive') { x = randInt(rng, 1, 50); outcome = 'LIVES'; } else { x = randInt(rng, -50, -1); outcome = 'LIVES'; }
      return {
        original: 'if (x > 0) return "positive"; else return "non-positive";',
        operator: '> → >=',
        mutated: 'if (x >= 0) return "positive"; else return "non-positive";',
        testInput: `x = ${x}`,
        outcome,
        explanation: outcome === 'KILLED'
          ? 'At x=0 the original takes the else-branch ("non-positive"), but the mutant\'s x>=0 is true so it returns "positive" — the outputs differ, so this test kills the mutant.'
          : `At x=${x}, "x>0" and "x>=0" evaluate the same way here, so both versions return the same string; the mutant survives this test (only x=0 kills it).`,
      };
    },
  },

  // if (x < 0) { x = -x; } return x;  vs  if (x < 0) { } return x;  (statement deletion)
  // x<0: original negates -> |x|; mutant's empty body leaves x unchanged -> KILLED.
  // x>=0: the if-branch never runs in either version -> LIVES.
  absDeletion: {
    title: 'statement deletion (abs)',
    build(rng, level) {
      const cat = level === 'easy' ? 'negative' : pick(rng, ['negative', 'nonneg']);
      let x;
      let outcome;
      if (cat === 'negative') { x = randInt(rng, -50, -1); outcome = 'KILLED'; } else { x = randInt(rng, 0, 50); outcome = 'LIVES'; }
      return {
        original: 'if (x < 0) { x = -x; } return x;',
        operator: 'statement deletion (remove "x = -x;")',
        mutated: 'if (x < 0) { } return x;',
        testInput: `x = ${x}`,
        outcome,
        explanation: outcome === 'KILLED'
          ? `At x=${x} (negative), the original negates it and returns ${Math.abs(x)}, but the mutant's empty if-body leaves it as ${x} — different outputs, so this test kills the mutant.`
          : `At x=${x} (non-negative), "x<0" is false in both versions, so the deleted statement was never going to run anyway; both return ${x} unchanged — the mutant survives this test.`,
      };
    },
  },

  // return age >= 18;  vs  return age > 18;
  // age=18: original true, mutant false -> KILLED.
  // age>18 or age<18: both agree -> LIVES.
  ageBoundary: {
    title: 'relational boundary (voting age)',
    build(rng, level) {
      const cat = level === 'easy' ? 'boundary' : pick(rng, ['boundary', 'above', 'below']);
      let age;
      let outcome;
      if (cat === 'boundary') { age = 18; outcome = 'KILLED'; } else if (cat === 'above') { age = randInt(rng, 19, 80); outcome = 'LIVES'; } else { age = randInt(rng, 0, 17); outcome = 'LIVES'; }
      return {
        original: 'return age >= 18;',
        operator: '>= → >',
        mutated: 'return age > 18;',
        testInput: `age = ${age}`,
        outcome,
        explanation: outcome === 'KILLED'
          ? 'At age=18, the original\'s "age>=18" is true but the mutant\'s "age>18" is false — the outputs differ, so this test kills the mutant.'
          : `At age=${age}, "age>=18" and "age>18" evaluate the same way here, so this test does not kill the mutant (only age=18 does).`,
      };
    },
  },

  // return a + b;  vs  return a - b;
  // b=0: a+0 == a-0 always -> LIVES (not equivalent: any b!=0 would kill it).
  // b!=0: a+b and a-b differ by 2b != 0, for every a -> KILLED.
  addSubOperator: {
    title: 'arithmetic operator (add/sub)',
    build(rng, level) {
      const cat = level === 'hard' ? 'bZero' : 'bNonzero';
      let a;
      let b;
      let outcome;
      if (cat === 'bZero') {
        b = 0;
        a = randInt(rng, -50, 50);
        outcome = 'LIVES';
      } else {
        b = randInt(rng, 1, 50) * pick(rng, [1, -1]);
        a = randInt(rng, -50, 50);
        outcome = 'KILLED';
      }
      const orig = a + b;
      const mut = a - b;
      return {
        original: 'return a + b;',
        operator: '+ → -',
        mutated: 'return a - b;',
        testInput: `a = ${a}, b = ${b}`,
        outcome,
        explanation: outcome === 'LIVES'
          ? `With b=0, a+b=${orig} and a-b=${mut} are always equal (adding/subtracting zero is a no-op), so this test does not kill the mutant. It is not equivalent, though: any test with b≠0 would kill it (a+b and a-b differ by 2b whenever b≠0).`
          : `Here a+b=${orig} but a-b=${mut}; since b≠0 the two differ by 2b≠0 for any a, so this test kills the mutant.`,
      };
    },
  },

  // return (age>=18) && citizen;  vs  return (age>=18) || citizen;
  // A&&B vs A||B agree exactly when A==B, and disagree exactly when A!=B.
  logicAndOr: {
    title: 'logical operator (&&/||)',
    build(rng) {
      const cat = pick(rng, ['TT', 'FF', 'TF', 'FT']);
      let age;
      let citizen;
      let outcome;
      if (cat === 'TT') { age = randInt(rng, 18, 80); citizen = true; outcome = 'LIVES'; } else if (cat === 'FF') { age = randInt(rng, 0, 17); citizen = false; outcome = 'LIVES'; } else if (cat === 'TF') { age = randInt(rng, 18, 80); citizen = false; outcome = 'KILLED'; } else { age = randInt(rng, 0, 17); citizen = true; outcome = 'KILLED'; }
      return {
        original: 'return (age >= 18) && citizen;',
        operator: '&& → ||',
        mutated: 'return (age >= 18) || citizen;',
        testInput: `age = ${age}, citizen = ${citizen}`,
        outcome,
        explanation: outcome === 'KILLED'
          ? '"age>=18" and "citizen" have different truth values here, so AND yields false while OR yields true — the versions disagree, killing the mutant.'
          : '"age>=18" and "citizen" have the same truth value here (A&&A-style agreement), so AND and OR both yield that value — the outputs agree, and the mutant survives this test.',
      };
    },
  },

  // for (i=0; i<n; i++) sum+=arr[i];  vs  for (i=0; i<=n; i++) sum+=arr[i];
  // Fixed array of nonzero elements, n kept within bounds -> the extra
  // iteration always adds a nonzero arr[n], so this is always KILLED.
  loopOffByOne: {
    title: 'loop boundary (< / <=)',
    build(rng) {
      const arr = [2, 3, 5, 7, 11];
      const n = randInt(rng, 0, arr.length - 1);
      const originalSum = arr.slice(0, n).reduce((s, v) => s + v, 0);
      const mutantSum = arr.slice(0, n + 1).reduce((s, v) => s + v, 0);
      return {
        original: 'int sum = 0; for (int i = 0; i < n; i++) { sum += arr[i]; } return sum;',
        operator: '< → <=',
        mutated: 'int sum = 0; for (int i = 0; i <= n; i++) { sum += arr[i]; } return sum;',
        testInput: `arr = [${arr.join(', ')}], n = ${n}`,
        outcome: 'KILLED',
        explanation: `With n=${n}, the original sums the first ${n} elements (=${originalSum}); the mutant's extra iteration also adds arr[${n}]=${arr[n]}, giving ${mutantSum}. Since every element of this array is nonzero, the sums always differ for n in [0, ${arr.length - 1}], so this test kills the mutant.`,
      };
    },
  },

  // int unused = x * 2; return x * x;  vs  return x * x;  (statement deletion)
  // "unused" is a dead store (assigned, never read, no side effects), so
  // deleting it can never change the return value, for ANY x -> EQUIVALENT.
  deadStoreDeletion: {
    title: 'statement deletion (dead store)',
    build(rng) {
      const x = randInt(rng, -50, 50);
      return {
        original: 'int unused = x * 2; return x * x;',
        operator: 'statement deletion (remove "int unused = x * 2;")',
        mutated: 'return x * x;',
        testInput: `x = ${x}`,
        outcome: 'EQUIVALENT',
        explanation: `"unused" is assigned but never read, and "x * 2" has no side effects, so deleting that statement cannot change the value returned for ANY x. The mutant is equivalent regardless of which x is tested, including x=${x}.`,
      };
    },
  },

  // Given n = arr.length (so n>=0 always): if (n > -1) ... vs if (n >= -1) ...
  // Both conditions are true for every n a length can actually take (n>=0),
  // so the two versions can never disagree on a reachable input -> EQUIVALENT.
  domainInvariantEquivalent: {
    title: 'relational operator on a non-negative array length',
    build(rng) {
      const n = randInt(rng, 0, 50);
      return {
        original: '/* n = arr.length, so n >= 0 always */ if (n > -1) return true; else return false;',
        operator: '> → >=',
        mutated: '/* n = arr.length, so n >= 0 always */ if (n >= -1) return true; else return false;',
        testInput: `n = ${n} (a valid array length, n >= 0)`,
        outcome: 'EQUIVALENT',
        explanation: `Because n is always an array length (n>=0 by construction), both "n>-1" and "n>=-1" are true for every value n can actually take. The two versions can never disagree on a reachable input, so the mutant is equivalent no matter which valid length is tested, including n=${n}.`,
      };
    },
  },
};

function poolFor(level) {
  if (level === 'easy') return ['signClassify', 'absDeletion', 'ageBoundary', 'addSubOperator', 'loopOffByOne'];
  if (level === 'hard') return ['signClassify', 'absDeletion', 'ageBoundary', 'addSubOperator', 'logicAndOr', 'loopOffByOne', 'deadStoreDeletion', 'domainInvariantEquivalent'];
  return ['signClassify', 'absDeletion', 'ageBoundary', 'addSubOperator', 'logicAndOr', 'loopOffByOne']; // medium (and any unrecognized level)
}

export function generate(level, seed, count = 15) {
  const rng = makeRng(seed);
  const poolNames = shuffle(rng, poolFor(level));
  const out = [];
  for (let i = 0; i < count; i++) {
    const key = poolNames[i % poolNames.length];
    const kase = TEMPLATES[key].build(rng, level);
    const distractors = Object.keys(OUTCOMES).filter((k) => k !== kase.outcome).map((k) => OUTCOMES[k]);
    out.push(mcQuestion(rng, {
      name: `Mutation ${level} ${i + 1}: ${TEMPLATES[key].title}`,
      prompt: `Consider: <code>${esc(kase.original)}</code>. The mutation operator <strong>${esc(kase.operator)}</strong> is applied, producing: <code>${esc(kase.mutated)}</code>. `
        + `For the test input <code>${esc(kase.testInput)}</code>, what is the outcome?`,
      correct: OUTCOMES[kase.outcome],
      distractors,
      general: kase.explanation,
    }));
  }
  return out;
}
