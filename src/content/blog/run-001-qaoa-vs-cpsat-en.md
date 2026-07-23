---
title: "Run 001: what an honest quantum benchmark looks like (and why classical won)"
tldr: "We ran our first real fight: QAOA (quantum, simulated) vs OR-Tools CP-SAT (classical) on the same 12-asset portfolio instance, same time budget, fixed seed. CP-SAT reached the exact optimum in 0.113 s; QAOA landed 42.8% away in 45 s. Verdict: not yet — exactly as theory predicts at this scale. The run is sealed with a SHA-256 hash and archived in triplicate. This is entry 001 of the catalog."
date: "2026-07-23"
pillar: D
lang: en
slugBase: run-001-qaoa-vs-cpsat
sources:
  - { label: "Sealed archive EXP-0012-001 (sha256:d0a207d6…bce6c), RosettaQ evidence ledger" }
  - { label: "Google OR-Tools CP-SAT 9.15", url: "https://developers.google.com/optimization" }
  - { label: "PennyLane 0.45.1", url: "https://pennylane.ai" }
draft: false
---

## What we ran

One instance of constrained portfolio optimization — pick 5 of 12 assets, balancing expected return against risk — encoded as a QUBO and handed to **both contenders at once**:

- **Classical side:** Google's OR-Tools **CP-SAT**, the kind of industrial solver a bank actually runs.
- **Quantum side:** **QAOA** (depth p=2), simulated on CPU with PennyLane — 12 assets = 12 qubits.
- **The referee:** the *exact optimum*, computed by brute force (2¹² = 4,096 candidates). At this size we can afford perfect truth, so nobody grades their own homework.

Same instance. Same 120-second budget. Seed 42 on everything. Library versions frozen and recorded.

## The result

<figure style="margin:1.5em 0">
<svg viewBox="0 0 640 250" role="img" aria-label="Distance from the exact optimum: CP-SAT 0 percent in 0.113 seconds; QAOA 42.8 percent in 45.1 seconds" style="width:100%;height:auto;background:#1F1C18;border-radius:4px">
  <text x="24" y="34" fill="#F4EEDF" font-size="15" font-weight="600" font-family="Instrument Sans, sans-serif">Distance from the exact optimum · lower is better</text>
  <text x="24" y="54" fill="#B5AC99" font-size="12" font-family="IBM Plex Mono, monospace">portfolio · 12 assets · seed 42 · equal 120 s budget</text>
  <line x1="170" y1="70" x2="170" y2="188" stroke="#3D372F" stroke-width="1"/>
  <text x="170" y="205" fill="#B5AC99" font-size="11" text-anchor="middle" font-family="IBM Plex Mono, monospace">0% = exact optimum (the referee)</text>
  <line x1="562" y1="70" x2="562" y2="188" stroke="#3D372F" stroke-width="1" stroke-dasharray="3 4"/>
  <text x="562" y="205" fill="#6E675C" font-size="11" text-anchor="middle" font-family="IBM Plex Mono, monospace">50%</text>
  <text x="24" y="95" fill="#F4EEDF" font-size="13" font-family="Instrument Sans, sans-serif">CP-SAT</text>
  <text x="24" y="111" fill="#B5AC99" font-size="11" font-family="Instrument Sans, sans-serif">classical</text>
  <rect x="170" y="88" width="6" height="16" rx="2" fill="#D9B87A"/>
  <text x="186" y="101" fill="#F4EEDF" font-size="12" font-family="IBM Plex Mono, monospace">0% — optimal · 0.113 s</text>
  <text x="24" y="155" fill="#F4EEDF" font-size="13" font-family="Instrument Sans, sans-serif">QAOA p=2</text>
  <text x="24" y="171" fill="#B5AC99" font-size="11" font-family="Instrument Sans, sans-serif">quantum · CPU sim</text>
  <rect x="170" y="148" width="336" height="16" rx="2" fill="#4DC4B5"/>
  <text x="516" y="161" fill="#F4EEDF" font-size="12" font-family="IBM Plex Mono, monospace">42.8% · 45.1 s</text>
  <text x="24" y="236" fill="#6E675C" font-size="11" font-family="IBM Plex Mono, monospace">PennyLane 0.45.1 · OR-Tools 9.15 · verdict: not yet — classical wins</text>
</svg>
<figcaption style="color:#6E675C;font-size:0.85em">Measured result, sealed archive EXP-0012-001. Not an illustration.</figcaption>
</figure>

CP-SAT found the *provably optimal* portfolio in a tenth of a second. QAOA, after 120 optimization steps and 2,000 measurement shots, delivered a portfolio 42.8% worse than the optimum — and took 400× longer doing it.

## Why this was the expected result

Nobody serious predicts quantum advantage on a 12-variable problem, and we didn't either — the archive records our hypothesis verbatim: *"at 12 assets NO quantum advantage is expected; this run fixes the protocol's baseline."* Three reasons the classical side dominates here:

1. **The problem is tiny.** 4,096 candidate portfolios is nothing; CP-SAT proves optimality almost instantly.
2. **QAOA at depth p=2 is a shallow heuristic.** Its approximation quality grows with circuit depth — and depth is exactly what's scarce on both simulators and real hardware.
3. **The baseline is strong on purpose.** Beating a weakened classical solver is the most common sin in quantum benchmarking. A win against a weak baseline is not a win.

## Then why run it at all?

Because a verification ledger earns trust with its **no's** before its yes's. This run establishes three assets:

- **The protocol, live.** Same instance, same budget, exact-optimum referee, fixed seeds, frozen versions — now demonstrated end to end, not described.
- **The baseline of the crossover curve.** Every future run — 16 assets, 20, deeper circuits, real QPUs — gets compared against this point. Where (and whether) the gap closes *is* the product.
- **Radical reproducibility.** The archive records seed, instance parameters and library versions. Run the published harness with those values and you should land on our numbers. If you can't, tell us — publicly.

## Integrity of this entry

The full run lives in a JSON archive sealed with `sha256:d0a207d6…bce6c`, stored simultaneously in three places (GitHub, Codeberg, and our database) that reference each other. If any copy's hash differs, that copy is invalid. The archive answers six questions — what, how, when, where, why, who — so this entry can be audited without trusting this post.

## What we don't know

Whether, and where, QAOA-family recipes cross over CP-SAT on portfolio problems as instances grow — that is precisely what the coming runs measure. We also don't yet know how these CPU-simulator results transfer to noisy hardware. We will publish both, whichever way they land.

*Measured content from sealed archive EXP-0012-001. Rosetta Quantum publishes verdicts with reproducible raw data — including the ones quantum loses.*
