# Lab 2 — Coverage Criteria (branch + prime paths)

**Chapter 2 (Graph Coverage) · release W4 · due W5 · difficulty ★★**

## Goal

Write a pytest suite for `target/triangle.py` that

1. reaches **branch coverage ≥ 90%** (measured with coverage.py `--branch`), and
2. exercises **every prime path** of the function's control-flow graph.

The judge measures (1) automatically. You argue (2) yourself in the reflection:
list the prime paths of the CFG and name the test that covers each. A suite can
hit 90% branch coverage while still missing a prime path — noticing that gap is
the point of this lab.

## The target

`classify(a, b, c)` returns one of `"invalid"`, `"not a triangle"`,
`"equilateral"`, `"isosceles"`, `"scalene"`. The source in `starter/target/` is
the same source the judge measures, so your local number is your grade's number.
Do not edit it.

## What to do

```bash
cd starter
make setup      # pytest + coverage.py, once
make grade      # your suite + branch coverage, with the missing lines named
```

`make grade` starts at 56% with a single example test. Keep adding cases to
`tests/test_triangle.py` until it reports ≥ 90%. The `Missing` column names the
lines whose branches you have not reached yet.

Write **real oracles**: assert the value you expect. A test that only calls the
function raises coverage without testing anything, and the reflection asks you
to defend your oracles.

## Submitting

Two routes, same grader and same score:

- **GitHub push** — push `tests/test_*.py` to your `st-lab02-…` repo on `main`.
  The judge grades the push and reports the verdict on the commit.
- **Web upload** — open the lab on the course site and use **Submit tests** to
  upload your `test_triangle.py`.

You get back a verdict, a score out of 100, and your measured coverage. Scoring
is `0` at 40% coverage rising to `100` at full coverage, and the verdict is
**AC** only at **≥ 90%** — below the bar you still earn partial credit, but the
lab is not passed.

You may submit repeatedly; the last on-time submission counts.

## Using AI

**AI is allowed** for this lab, including generating tests.

The reflection must compare the **AI-derived** path set with your
**hand-derived** one: what did each find that the other missed? An AI that
produces a 95%-coverage suite in one shot has still not done the lab — the
graded thinking is the comparison.

## Deliverables

1. `tests/test_triangle.py` (submitted to the judge).
2. `reflection.md` — see `rubric.md` for what it must contain.
