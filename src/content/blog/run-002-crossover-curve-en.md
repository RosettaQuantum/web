---
title: "Run 002: the crossover curve gets its second point (still not a trend)"
tldr: "Same fight, bigger instance: QAOA p=2 vs OR-Tools CP-SAT on a 16-asset portfolio, same Judge v1 protocol, seed 42. CP-SAT again reached the exact optimum (1.0 s); QAOA landed 20.7% away in 97.5 s. Verdict: not yet. The gap is smaller than at 12 assets (42.8%) — and we are explicitly NOT calling that a trend: one seed per size proves nothing. Sealed as EXP-0012-002."
date: "2026-07-23"
pillar: D
lang: en
slugBase: run-002-crossover-curve
sources:
  - { label: "Sealed archive EXP-0012-002 (sha256:b9f9ab48…47fe4), RosettaQuantum/evidence", url: "https://github.com/RosettaQuantum/evidence" }
  - { label: "Sealed archive EXP-0012-001 (run 001, the baseline)" }
draft: false
---

## What changed since run 001

One variable: instance size. 16 assets instead of 12 (choose 7, same risk-aversion and penalty structure, seed 42). Everything else is frozen by protocol — same 120 s budget per side, same QAOA depth (p=2), same solver on the classical bench, same exact-optimum referee (2¹⁶ = 65,536 candidates, still brute-forceable). If you change one thing, you learn one thing.

## The result

<figure style="margin:1.5em 0">
<svg viewBox="0 0 640 270" role="img" aria-label="Quality gap to the exact optimum by instance size: at 12 assets QAOA 42.8 percent, at 16 assets 20.7 percent; CP-SAT at 0 percent both sizes" style="width:100%;height:auto;background:#1F1C18;border-radius:4px">
  <text x="24" y="34" fill="#F4EEDF" font-size="15" font-weight="600" font-family="Instrument Sans, sans-serif">Quality gap to the exact optimum · by instance size</text>
  <text x="24" y="54" fill="#B5AC99" font-size="12" font-family="IBM Plex Mono, monospace">seed 42 · equal 120 s budget · one seed per size — not yet a trend</text>
  <line x1="80" y1="200" x2="600" y2="200" stroke="#3D372F" stroke-width="1"/>
  <text x="76" y="204" fill="#B5AC99" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">0%</text>
  <line x1="80" y1="96" x2="600" y2="96" stroke="#3D372F" stroke-width="1" stroke-dasharray="3 4"/>
  <text x="76" y="100" fill="#6E675C" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">50%</text>
  <text x="230" y="222" fill="#B5AC99" font-size="12" text-anchor="middle" font-family="IBM Plex Mono, monospace">12 assets</text>
  <text x="470" y="222" fill="#B5AC99" font-size="12" text-anchor="middle" font-family="IBM Plex Mono, monospace">16 assets</text>
  <line x1="230" y1="111" x2="470" y2="157" stroke="#4DC4B5" stroke-width="2" stroke-dasharray="5 5" opacity="0.5"/>
  <circle cx="230" cy="111" r="6" fill="#4DC4B5"/>
  <circle cx="470" cy="157" r="6" fill="#4DC4B5"/>
  <text x="230" y="95" fill="#F4EEDF" font-size="12" text-anchor="middle" font-family="IBM Plex Mono, monospace">42.8%</text>
  <text x="470" y="141" fill="#F4EEDF" font-size="12" text-anchor="middle" font-family="IBM Plex Mono, monospace">20.7%</text>
  <text x="510" y="161" fill="#B5AC99" font-size="11" font-family="Instrument Sans, sans-serif">QAOA p=2</text>
  <circle cx="230" cy="200" r="6" fill="#D9B87A"/>
  <circle cx="470" cy="200" r="6" fill="#D9B87A"/>
  <text x="510" y="193" fill="#B5AC99" font-size="11" font-family="Instrument Sans, sans-serif">CP-SAT (optimal)</text>
  <text x="24" y="252" fill="#6E675C" font-size="11" font-family="IBM Plex Mono, monospace">dashed line = visual guide only, NOT a fitted trend · runtimes: CP-SAT 1.0 s · QAOA 97.5 s</text>
</svg>
<figcaption style="color:#6E675C;font-size:0.85em">Measured results, sealed archives EXP-0012-001 and -002. The dashed connector is a reading aid, not an extrapolation.</figcaption>
</figure>

CP-SAT: provably optimal again, in 1.0 second. QAOA: 20.7% from the optimum after 70 optimizer steps — the time budget, not the step count, was the binding constraint this time (97.5 s of the 120 s budget; the simulation cost per step grows with qubit count). **Verdict: not yet — classical wins.**

## The honest reading of "the gap shrank"

At 12 assets the gap was 42.8%; at 16 it is 20.7%. It is tempting to draw a line through two points and announce that QAOA closes in as instances grow. We refuse, for three reasons:

1. **One seed per size.** QAOA's optimization landscape is noisy; a different seed can move the gap by a lot. Variance is unmeasured until we run multiple seeds per size.
2. **Two points define any story you want.** A curve earns the name with density: more sizes, more seeds, error bars.
3. **The budget bound changed.** At 16 qubits the optimizer completed 70 of 120 steps before the budget cutoff — the two points weren't produced under identical effective conditions, and the protocol records exactly that.

What the two points *do* establish: the pipeline measures what it claims to measure, at growing scale, with every parameter on the record.

## What's next on the ladder

Multiple seeds at 12 and 16 to measure variance, then 20 assets — where brute force (2²⁰ ≈ 1M) still referees but CP-SAT starts to feel the size. Each run ships sealed, in triple copy, with its library entry. Wherever the curve goes, it goes on the record.

## What we don't know

Whether the gap movement is signal or seed-luck — that is precisely what the multi-seed runs will answer. We also don't know where (or if) QAOA-family recipes cross CP-SAT on this problem class, and nothing measured so far suggests it is near. When we know, you'll read it here first — with the raw data attached.

*Measured content from sealed archives EXP-0012-001/-002. Rosetta Quantum publishes verdicts with reproducible raw data — including the ones quantum loses.*
