---
title: "How we run the same problem on both kinds of computer"
tldr: "Every Rosetta run executes one instance twice: once on a quantum algorithm, once on an industrial classical solver, under identical budgets. Today the quantum side runs on statevector simulators (CPU, cloud Linux); the classical side runs OR-Tools CP-SAT on the same machine. Real QPUs via cloud providers enter the ladder later — simulation first is a deliberate methodological choice, not a limitation we hide."
date: "2026-07-23"
pillar: D
lang: en
slugBase: how-we-run-both-sides
sources:
  - { label: "RosettaQuantum/evidence — harness + sealed runs", url: "https://github.com/RosettaQuantum/evidence" }
  - { label: "PennyLane documentation", url: "https://pennylane.ai" }
  - { label: "Google OR-Tools", url: "https://developers.google.com/optimization" }
draft: false
---

## The pipeline, end to end

```
instance (seeded) ──► QUBO formulation ──► both sides, same budget
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              ▼                             ▼                             ▼
     CLASSICAL BENCH                QUANTUM BENCH                 REFEREE (small n)
     OR-Tools CP-SAT           QUBO → Ising Hamiltonian           brute force:
     (linearized QUBO,         → QAOA circuit (PennyLane)         exact optimum,
     proves optimality)        → optimize params → sample         ground truth
              │                             │                             │
              └─────────────► verdict + seal (sha256) ◄───────────────────┘
                              triple archive: GitHub · Codeberg · D1
```

No step is exotic. The discipline is the product: same instance, same time budget, seeds fixed, versions frozen, everything recorded.

## What hardware, concretely

**The classical side** runs where classical solvers live in the real world: an ordinary CPU. We use Google's OR-Tools CP-SAT — an industrial constraint solver a bank or a mining company actually deploys — with the QUBO's quadratic terms linearized into boolean products. On our current instance sizes it doesn't just find good answers; it *proves* optimality.

**The quantum side** runs, today, on statevector simulation: PennyLane's `default.qubit` backend on CPU, in a cloud Linux container. A simulator tracks all 2ⁿ amplitudes of the quantum state exactly — 12 qubits is 4,096 complex numbers, 16 qubits is 65,536, and the cost doubles with every qubit. That exponential wall is why simulation tops out around 30-something qubits on ordinary hardware, and it is also, ironically, the cleanest argument for why quantum hardware could matter someday.

**The referee**, at small sizes, is brute force: enumerate every candidate, take the true optimum. Neither side grades its own homework.

## Why simulate first instead of renting a real QPU

Not cost — free tiers exist. Method. A simulator is *noiseless and deterministic given a seed*, which means every gap we measure today is attributable to the **algorithm** (QAOA's shallow-depth approximation quality), not to hardware noise. That separates two questions people constantly conflate: "is the algorithm good?" and "is the hardware good enough to run it?" We answer the first before touching the second.

Real QPUs — superconducting and trapped-ion machines reachable through cloud providers like Amazon Braket and IBM Quantum — enter the ladder *after* the simulator baseline exists, in future tense until it happens. When they do, the noisy-hardware gap gets measured against the noiseless-simulator gap, and both go in the ledger.

## What we deliberately don't publish

The exact instance-generation recipes beyond their seeds and parameters (whoever controls the instances controls the honesty of the benchmark — we publish enough to reproduce, and rotate generators as the series grows), and internal tooling that doesn't affect reproducibility. Everything needed to re-run a sealed archive — seed, parameters, library versions, harness code — is public.

## What we don't know

How our simulator-measured gaps transfer to noisy hardware — that's a measurement, not an assumption, and it's on the ladder. And whether CP-SAT remains provably optimal fast at the sizes where brute-force refereeing becomes intractable; when the referee retires, the protocol's scoring changes explicitly, and we'll document the switch.

*Educational content describing our published methodology. Sealed run archives: EXP-0012-001 and -002.*
