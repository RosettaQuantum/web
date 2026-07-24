---
title: "The harness turns to the grid: first real network-expansion runs (E.ON class)"
tldr: "We pointed the same Judge v1 protocol at a new problem class — distribution grid expansion, the E.ON challenge track. On a stressed IEEE case14 feeder with real congestion, a build/no-build QUBO (congestion relief measured by actual DC power flow) was fought QAOA p=2 vs OR-Tools CP-SAT. CP-SAT hit the proven optimum in ~0.3 s; QAOA landed 0.005–3.2% away across 3 seeds. Verdict: not yet. The winning plan, validated in full AC power flow, cut real line overload by 43.5%. Sealed as RQ-0033 / EXP-0033-001…003. Nothing about the protocol changed — only the problem."
date: "2026-07-24"
pillar: A
lang: en
slugBase: eon-grid-debut
sources:
  - { label: "Sealed archives EXP-0033-001…003, RosettaQuantum/evidence", url: "https://github.com/RosettaQuantum/evidence/tree/main/runs/2026/07" }
  - { label: "pandapower (grid engine)", url: "https://pandapower.readthedocs.io" }
  - { label: "QOBLIB — Quantum Optimization Benchmark Library (methodology)", url: "https://arxiv.org/abs/2504" }
draft: false
---

## Same referee, new arena

Until now the ledger measured portfolio optimization. This entry moves to **distribution grid expansion** — deciding which new power lines to build so an overloaded network sheds congestion at least cost. It is a combinatorial build/no-build problem, and it is the E.ON problem statement in the 2026 Global Quantum + AI Challenge. The protocol did not change: same instance, same time budget both sides, exact optimum as referee, fixed seeds, frozen versions, sealed in triple copy. Only the problem is new — which is the point of a general protocol.

## How the instance is grounded in real grid physics

```
grid        IEEE case14, loads ×3.0, thermal ratings tightened
            → an under-provisioned feeder with genuine congestion
candidates  14 build options (parallel reinforcements + new lines)
model       congestion relief measured by REAL DC power flow:
            r_i  = relief of building line i alone      (measured)
            q_ij = relief(i,j) − r_i − r_j  interaction (measured)
            → a QUBO whose coefficients come from physics, not guesswork
referee     exact optimum over 2^14 build sets (brute force)
validation  winning plan re-checked in full AC power flow
```

No coefficient was invented: each was measured by running the grid solver. The quadratic terms capture that two reinforcements together relieve more (or less) than the sum of their parts — real network coupling.

## The result

<figure style="margin:1.5em 0">
<svg viewBox="0 0 640 250" role="img" aria-label="E.ON grid expansion: CP-SAT at proven optimum in 0.3s; QAOA gaps 3.2, 0.005, 1.0 percent across 3 seeds; AC-validated congestion reduction 43.5 percent" style="width:100%;height:auto;background:#1F1C18;border-radius:4px">
  <text x="24" y="34" fill="#F4EEDF" font-size="15" font-weight="600" font-family="Instrument Sans, sans-serif">E.ON grid-expansion · gap to exact optimum + real congestion relief</text>
  <text x="24" y="54" fill="#B5AC99" font-size="12" font-family="IBM Plex Mono, monospace">IEEE case14 stressed · 14 candidates · equal 120 s budget · 3 seeds</text>
  <line x1="150" y1="72" x2="150" y2="150" stroke="#3D372F" stroke-width="1"/>
  <text x="150" y="167" fill="#B5AC99" font-size="11" text-anchor="middle" font-family="IBM Plex Mono, monospace">0% = exact optimum</text>
  <text x="24" y="92" fill="#F4EEDF" font-size="12" font-family="Instrument Sans, sans-serif">CP-SAT</text>
  <rect x="150" y="84" width="6" height="14" rx="2" fill="#D9B87A"/>
  <text x="164" y="95" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">0% — proven optimal · ~0.3 s (3/3)</text>
  <text x="24" y="120" fill="#F4EEDF" font-size="12" font-family="Instrument Sans, sans-serif">QAOA p=2</text>
  <rect x="150" y="112" width="118" height="14" rx="2" fill="#4DC4B5"/>
  <text x="276" y="123" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">gaps 0.005% · 1.0% · 3.2% · ~95 s</text>
  <rect x="24" y="188" width="592" height="44" rx="3" fill="#100E0B" stroke="#3D372F"/>
  <text x="38" y="206" fill="#B5AC99" font-size="11" font-family="IBM Plex Mono, monospace">AC-validated plan (5 lines built):</text>
  <text x="38" y="223" fill="#4DC4B5" font-size="12" font-family="IBM Plex Mono, monospace">line overload 2672.7 → 1509.3  ·  real congestion −43.5%</text>
</svg>
<figcaption style="color:#6E675C;font-size:0.85em">Measured, sealed archives EXP-0033-001…003. The −43.5% is checked in full AC power flow, not the QUBO model.</figcaption>
</figure>

CP-SAT reached the provably optimal build plan in about a third of a second, all three seeds. QAOA came close — 0.005% at its best — but did not win under equal budget. **Verdict: not yet.** The classical planner is strong here, exactly as it should be for an honest benchmark.

## Why the −43.5% matters more than the verdict

The optimization is decided in a QUBO, but the *value* is decided in physics. We rebuilt the winning 5-line plan in full AC power flow: total line overload dropped from 2672.7 to 1509.3 — a **43.5% congestion reduction** on a genuinely overloaded feeder. That is the number a DSO planner cares about, and it is validated outside the model that chose it. Whether the plan came from quantum or classical, the ledger reports what it actually does to the grid.

## What we don't know

Whether QAOA's near-miss (0.005% on seed 43) survives on harder, larger instances or is instance-luck — the next runs scale the grid (case30, case118) and the candidate count toward the >100-qubit utility scale the challenge targets. How the second-order DC congestion model diverges from AC on bigger grids (we'll publish the gap). And whether NISQ hardware, with noise, holds QAOA's simulator-measured quality. Each is a measurement on the ladder.

*Measured content from sealed archives EXP-0033-001…003. Methodology follows the QOBLIB benchmark approach cited in the E.ON problem statement: identify hard instances, then benchmark honestly. Rosetta Quantum publishes verdicts with reproducible raw data — including the ones quantum loses.*
