---
title: "Runs 009–020: n=20 joins the ladder, and the curve refuses to be a line"
tldr: "Twelve new sealed runs: 8 seeds now at n=12 and n=16, and the first four at n=20 (where gradient-based optimization hit a memory wall and the protocol switched to gradient-free COBYLA — recorded in each archive). Mean QAOA gaps: 48.2%±22.5 at n=12, 25.1%±11.1 at n=16, 41.1%±14.1 at n=20 — non-monotonic, no clean size trend. CP-SAT: proven optimum in all 20 runs to date, but its proof time grew from 0.05 s (n=12) to ~29 s (n=20). Verdict, all sizes: not yet."
date: "2026-07-24"
pillar: D
lang: en
slugBase: run-scale-batch
sources:
  - { label: "Sealed archives EXP-0012-009 … -020, RosettaQuantum/evidence", url: "https://github.com/RosettaQuantum/evidence/tree/main/runs/2026/07" }
  - { label: "Runs 001–008 (prior baseline and variance batch)" }
draft: false
---

## The state of the series, 20 runs in

```
size   seeds   QAOA gap to optimum          CP-SAT
n=12     8     22.0 ─────────── 86.5   mean 48.2  σ 22.5    optimal, ~0.05–0.26 s
n=16     8      9.6 ─────── 42.3       mean 25.1  σ 11.1    optimal, ~1.0–1.4 s
n=20     4     24.3 ──────── 58.5      mean 41.1  σ 14.1    optimal, ~28–30 s
```

Three sizes, twenty sealed runs, one constant: **CP-SAT found the provably exact optimum every single time.** Verdict at every size: not yet.

## The two honest findings

**1. The gap-vs-size curve is not a line.** The mean gap went down from n=12 to n=16 and back up at n=20. With per-size spreads of 10–23 points, we see no defensible size trend in either direction yet. Anyone who fit a story through the first two sizes — as run 002 tempted us to — would have been wrong by run 020. Density beats narrative; the series continues.

**2. The classical side's proof cost is climbing fast.** CP-SAT's time to *prove* optimality grew ~25× per +4 assets (0.05 s → 1.3 s → 29 s). Still trivially inside budget — but this is the number that will eventually decide where honest refereeing gets hard, and it's now on the record at every size.

## A protocol change, disclosed

At n=20, backpropagating gradients through a 2²⁰-amplitude statevector exceeded our container's memory and killed the run silently. The fix: at n≥20 the optimizer switches to **COBYLA (gradient-free, forward evaluations only)** under the same time budget. Every n=20 archive records this in `scope_note` and in the optimizer field. Changing a knob without disclosing it is how benchmarks rot; disclosed, it's just engineering.

## What we don't know

Whether the non-monotonicity is real structure or still small-sample noise (more seeds and n=24 will tell). How COBYLA-vs-Adam affects comparability across sizes — the optimizer is now part of what's being measured, which is why it's recorded per-run. And where CP-SAT's proof-time curve crosses "impractical" for exact refereeing — when it does, the protocol's scoring changes explicitly and we'll document the switch.

*Measured content from sealed archives EXP-0012-001 … -020. Rosetta Quantum publishes verdicts with reproducible raw data — including the ones that refuse to make a tidy chart.*
