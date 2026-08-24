---
title: "Can quantum computing discover new drugs today?"
tldr: "Not the way headlines imply. As of July 2026 no quantum advantage in drug discovery has been demonstrated at useful scale. The credible near-term contribution is narrow — simulating the electronic structure of strongly-correlated molecules that classical methods approximate poorly — and even that runs inside a classical pipeline led by AlphaFold and industrial docking. Money is pouring in ($12.6B into quantum startups in 2025), demos are real (a virus genome encoded on IBM hardware; hybrid simulations of protein complexes over 12,000 atoms), but no standardized head-to-head benchmark against the strongest classical tools exists yet. We tested a nearby task ourselves — 19 sealed runs on allosteric-site ranking — and under an honest null, nothing was significant."
date: "2026-07-29"
pillar: A
lang: en
slugBase: quantum-drug-discovery
draft: false
sources:
  - { label: "McKinsey Quantum Technology Monitor 2026 — a commercial tipping point", url: "https://www.mckinsey.com/capabilities/mckinsey-technology/our-insights/mckinsey-quantum-technology-monitor-2026-a-commercial-tipping-point" }
  - { label: "Quantum-machine-assisted drug discovery — npj Drug Discovery (2025)", url: "https://www.nature.com/articles/s44386-025-00033-2" }
  - { label: "Quantum computing in transition — Nature Biotechnology editorial (6 Jul 2026)", url: "https://www.nature.com/articles/s41587-026-03233-x" }
  - { label: "AlphaFold — highly accurate protein structure prediction (Jumper et al., Nature 2021)", url: "https://www.nature.com/articles/s41586-021-03819-2" }
---

**Status as of: July 2026.** The verdict below is measured, not asserted: the external claims are sourced and dated, and the negative at the end rests on 19 sealed runs anyone can re-run.

Short answer: **not yet** — and the honest version of that answer is more useful than either the hype or the dismissal. Drug discovery is the application quantum computing is most often sold on, and it is also the one where the credible case is _narrowest_. Both things are true at once.

## What is actually being claimed?

The physical argument is real and specific: molecules **are** quantum systems, so a quantum computer can, in principle, compute their electronic structure directly, where classical methods must approximate. That matters most for **strongly-correlated systems** — transition-metal catalysts, certain excited states, reaction intermediates — that classical approximations like DFT model poorly. This is the strongest feasibility case in the whole field, because it is the one place where the problem is natively quantum. It is not the claim that "quantum will design your drug."

## What is proven today?

Not the advantage. The demonstrations that exist are real but sit below the bar of _beating the best classical tool on the same problem_. A 2026 Nature Biotechnology editorial catalogs the genuine progress: a hepatitis D virus genome encoded and analyzed on IBM quantum hardware, and hybrid quantum-classical simulations of protein complexes over 12,000 atoms — the largest reported. IBM calls 2026 the "inflection point" for hybrid advantage; that is a vendor prediction, dated and on the record, not an established result. The same editorial's reality check is blunt: today's devices are noisy (NISQ), not error-corrected, and hybrid methods "are not likely to scale well to the number of qubits required" for the molecular problems that would benefit most.

QUANTUM IN THE DRUG STACK · JUL 2026CLASSICAL AI — AlphaFold, docking, generativeIN PRODUCTIONHYBRID Q-CLASSICAL DEMOS — genome, 12k-atom simDEMONSTRATED · NO ADVANTAGEFAULT-TOLERANT ELECTRONIC-STRUCTURE EDGEPLAUSIBLE · UNPROVENbar width = maturity, not benchmark score

## What does classical already do — very well?

Most of what people picture as "AI for drug discovery" is **classical**, not quantum. AlphaFold predicted protein structure from sequence — a 50-year problem — with deep learning and no qubits. Docking, virtual screening, and generative molecule design are classical and already in production. The peer-reviewed picture agrees: the 2025 npj Drug Discovery review frames quantum methods as **complementary evaluators** of local electronic structure nested inside classical pipelines, not as replacements. Its most telling admission is about measurement — "standardized, hardware-run quantum benchmarks at CASF-2016, CrossDocked2020, or PoseBusters scale are not yet available," and it offers **no** head-to-head comparison beating classical workhorses like AutoDock Vina, DiffDock, or Gnina. No shared benchmark, no demonstrated advantage.

## Where would quantum's real edge be?

Narrow and deep, not broad: the electronic-structure cases where classical accuracy breaks down. That is the defensible claim, and the only one worth making — not "quantum does drug discovery," but "for this specific class of molecule, a quantum method computes an energy classical methods get wrong, verified on the same instance." The strong algorithms that would deliver it (quantum phase estimation) need fault-tolerant error correction that does not exist at scale; the near-term ones (VQE) are capped by noise. Plausible and unproven — exactly the kind of claim that needs measuring, not believing.

## What did we measure ourselves?

We ran the nearest thing we could seal end-to-end: **19 sealed runs** ranking allosteric sites on real proteins — hemoglobin, caspase-3, KRAS G12C, BCR-ABL1, cardiac myosin, and a blind prediction on c-Myc — pitting a continuous-time quantum walk against classical diffusion on the residue-contact graph. Two findings, both negative, both the point. First, on the early set the classical propagator led 8–4 and its wins were stable while the quantum walk's were not: perturb the contact cutoff and the "quantum victories" vanished. Second, and more important methodologically: the null hypothesis everyone uses — shuffling residues independently — **inflates the z-score roughly two-to-four fold**, because true allosteric residues sit in one contiguous pocket, not scattered at random. Swap in the correct spatial null (permute contiguous distal pockets of the same size) and the largest |z| across every target and method was **1.18**. Nothing reached significance; no target cleared even a lenient p < 0.15.

OUR OWN TEST · ALLOSTERIC RANKING · 19 RUNSp=0.05 ref · z≈1.64~2-4x inflatedi.i.d. nullmax |z| 1.18pocket nullruns simulated, noiseless — favors the quantum side; still no signal

The honesty tax on that chart: our runs are **simulated and noiseless**, which favors the quantum side, since real hardware only adds error. Even with that thumb on the scale, no signal. That is what "not yet" looks like when you actually instrument it.

## What we don't know

We do not know the crossover molecule size where a quantum electronic-structure method would first beat the best classical approximation on the same system — no one has published it with evidence. We do not know whether IBM's 2026 "inflection point" prediction will land; it is a claim, not a result. We did not benchmark quantum against classical _drug-discovery_ pipelines head-to-head — our 19 runs measure allosteric-site ranking, a related but narrower task, and a null result there is not proof of a null everywhere. And the peer-reviewed field itself concedes the decisive benchmark (hardware-run, at PoseBusters/CASF scale, against Vina/DiffDock) does not yet exist. When one does, it belongs on the ledger with raw data — including if it goes against us.

_Educational content, not a product claim. Rosetta Quantum publishes verdicts with reproducible raw data — including the negatives._
