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

<figure style="margin:1.5em 0;text-align:center">
<svg viewBox="0 0 360 532" role="img" aria-label="End-to-end pipeline: a seeded instance becomes a QUBO formulation that is sent to all three sides under the same budget. Classical bench: OR-Tools CP-SAT on the linearized QUBO, proves optimality. Quantum bench: the QUBO becomes an Ising Hamiltonian, then a QAOA circuit in PennyLane, parameters are optimized and the state is sampled. Referee for small n: brute force, exact optimum, ground truth. All three converge on a verdict sealed with sha256 and triple-archived to GitHub, Codeberg and D1." style="width:100%;max-width:430px;height:auto;background:#141210;border:1px solid #3D372F;border-radius:4px">
  <defs>
    <marker id="arrEn" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,0 L8,4 L0,8 z" fill="#6E675C"/>
    </marker>
  </defs>
  <g font-family="'IBM Plex Mono',monospace" fill="#B5AC99">
    <rect x="46" y="10" width="268" height="34" rx="3" fill="#1F1C18" stroke="#3D372F"/>
    <text x="180" y="31" font-size="12" fill="#F4EEDF" text-anchor="middle">instance (seeded)</text>
    <line x1="180" y1="44" x2="180" y2="64" stroke="#6E675C" marker-end="url(#arrEn)"/>
    <rect x="46" y="66" width="268" height="48" rx="3" fill="#1F1C18" stroke="#3D372F"/>
    <text x="180" y="87" font-size="12" fill="#F4EEDF" text-anchor="middle">QUBO formulation</text>
    <text x="180" y="104" font-size="10" text-anchor="middle">both sides, same budget</text>
    <path d="M180,114 V128 H24 V350" fill="none" stroke="#6E675C"/>
    <line x1="24" y1="178" x2="44" y2="178" stroke="#6E675C" marker-end="url(#arrEn)"/>
    <line x1="24" y1="264" x2="44" y2="264" stroke="#6E675C" marker-end="url(#arrEn)"/>
    <line x1="24" y1="350" x2="44" y2="350" stroke="#6E675C" marker-end="url(#arrEn)"/>
    <rect x="46" y="146" width="268" height="64" rx="3" fill="#1F1C18" stroke="#3D372F"/>
    <text x="60" y="167" font-size="11" fill="#F4EEDF" letter-spacing="1">CLASSICAL BENCH</text>
    <text x="60" y="184" font-size="10">OR-Tools CP-SAT (linearized QUBO)</text>
    <text x="60" y="199" font-size="10">proves optimality</text>
    <rect x="46" y="224" width="268" height="80" rx="3" fill="#1F1C18" stroke="#3D372F"/>
    <text x="60" y="245" font-size="11" fill="#4DC4B5" letter-spacing="1">QUANTUM BENCH</text>
    <text x="60" y="262" font-size="10">QUBO → Ising Hamiltonian</text>
    <text x="60" y="277" font-size="10">→ QAOA circuit (PennyLane)</text>
    <text x="60" y="292" font-size="10">→ optimize params → sample</text>
    <rect x="46" y="318" width="268" height="64" rx="3" fill="#1F1C18" stroke="#3D372F"/>
    <text x="60" y="339" font-size="11" fill="#F4EEDF" letter-spacing="1">REFEREE (small n)</text>
    <text x="60" y="356" font-size="10">brute force: exact optimum,</text>
    <text x="60" y="371" font-size="10">ground truth</text>
    <path d="M314,178 H336 V412 H180 V420" fill="none" stroke="#6E675C" marker-end="url(#arrEn)"/>
    <path d="M314,264 H336" fill="none" stroke="#6E675C"/>
    <path d="M314,350 H336" fill="none" stroke="#6E675C"/>
    <rect x="46" y="424" width="268" height="38" rx="3" fill="#1F1C18" stroke="#D9B87A"/>
    <text x="180" y="448" font-size="12" fill="#D9B87A" text-anchor="middle">verdict + seal (sha256)</text>
    <line x1="180" y1="462" x2="180" y2="480" stroke="#6E675C" marker-end="url(#arrEn)"/>
    <rect x="46" y="482" width="268" height="40" rx="3" fill="#1F1C18" stroke="#4DC4B5" stroke-dasharray="3 3"/>
    <text x="180" y="500" font-size="10" fill="#4DC4B5" text-anchor="middle">triple archive</text>
    <text x="180" y="514" font-size="10" text-anchor="middle">GitHub · Codeberg · D1</text>
  </g>
</svg>
</figure>

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
