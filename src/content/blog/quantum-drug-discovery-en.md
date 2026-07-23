---
title: "Can quantum computing discover new drugs today?"
tldr: "Not in the way headlines imply. Quantum's credible contribution to medicine is narrow and real — simulating the electronic structure of strongly-correlated molecules that classical methods approximate poorly. Drug discovery itself is currently led by classical AI (AlphaFold). As of July 2026, no quantum advantage in drug discovery has been demonstrated at useful scale — but molecular simulation is the frontier where it is most plausible."
date: "2026-07-21"
pillar: A
lang: en
slugBase: quantum-drug-discovery
sources:
  - { label: "AlphaFold — protein structure prediction (DeepMind)" }
  - { label: "Quantum Algorithm Zoo — simulation algorithms (VQE, QPE)" }
draft: false
---

## The honest promise

The reason quantum computing is tied to medicine is real, and it is specific: molecules *are* quantum systems, so a quantum computer can, in principle, simulate their electronic structure directly — where classical methods must approximate. That matters most for **strongly-correlated systems** (transition-metal catalysts, certain excited states, reaction intermediates) that today's classical approximations like DFT model poorly.

## What classical already does — very well

Most of what people picture as "AI for drug discovery" is **classical**, not quantum. AlphaFold reshaped the field by predicting protein structure from sequence — a 50-year problem — using deep learning, no qubits involved. Docking, virtual screening, and generative molecule design are also classical and already in production. If someone claims quantum is needed to "do drug discovery," the honest question is: what does it add over AlphaFold plus classical simulation?

## Where quantum's real edge would be

Narrow and deep, not broad: the electronic-structure cases where classical accuracy breaks down. That is the defensible claim — and the only one Rosetta will make. Not "quantum will design your drug," but "for this specific class of molecule, a quantum method computes an energy classical methods get wrong."

## Why it isn't here yet

Near-term quantum hardware is noisy and small. The strong algorithms (quantum phase estimation) need error correction that doesn't exist at scale; the near-term ones (VQE) are limited by noise. So the advantage is **plausible and unproven** — exactly the kind of claim that needs measuring, not believing.

## What to watch

Not press releases — reproducible benchmarks on specific molecules, against the strongest classical method, with the crossover size stated. When one exists, it will be on the ledger, with the raw data. Until then, the honest answer is: the frontier is real, the arrival is not yet.

*Educational content, not a product claim. Rosetta Quantum publishes verdicts with reproducible raw data — including the negatives.*
