# Prime path enumeration

Given a control-flow graph (CFG), output all of its **prime paths**.

## Input

- Line 1: two integers `n m` — node and edge counts (nodes 0..n-1; 0 is the entry, n-1 the exit)
- Next `m` lines: two integers `u v` for edge u→v

## Output

One prime path per line as space-separated node ids, sorted by decreasing length, then lexicographically.

## Hints

- A prime path is a *maximal simple path*: simple, and not a proper subpath of any other simple path.
- The first and last node may coincide (a loop boundary).
