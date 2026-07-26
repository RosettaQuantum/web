---
title: "The wrong null is inflating this whole field: allosteric sites are contiguous pockets, not independent residues"
tldr: "Allosteric-site predictions are scored by asking whether the true residues rank better than chance — and 'chance' is almost always modelled as independent residues drawn at random. But a real allosteric site is ONE contiguous pocket: its residues are spatially correlated, so the effective sample size is far smaller than the residue count, and every test assuming independence inflates significance. We built the correct null — permute contiguous distal pockets of matched size, 2,000 permutations — and applied it to our own CTQW method first. Apparent z-scores of up to |4.64| collapse to |z| < 1.2. Under the honest null nothing is significant: not our quantum walk, not diffusion, not GNM, ANM, betweenness or closeness, on any of the three targets, with every p between 0.15 and 0.85. The paired test across the full 18-config grid gives zero cells at p < 0.05 on all three targets. Sealed as EXP-0007-017. We are publishing the instrument, not a score — and the instrument's first verdict goes against us."
date: "2026-07-26"
pillar: D
lang: en
slugBase: contiguous-pocket-null
sources:
  - { label: "Sealed archive EXP-0007-017 — contiguous spatial null", url: "https://github.com/RosettaQuantum/evidence/tree/main/runs/2026/07" }
  - { label: "Raw permutation output spatial_null.json (sha256:3914def6…c08f61)", url: "https://raw.githubusercontent.com/RosettaQuantum/evidence/main/data/2026/07/spatial_null.json" }
  - { label: "Raw paired-test output paired_null.json (sha256:43015a13…9664b3)", url: "https://raw.githubusercontent.com/RosettaQuantum/evidence/main/data/2026/07/paired_null.json" }
  - { label: "Rosetta evidence ledger — RQ-0007, 19 sealed runs", url: "https://rosettaquantum.com/ledger" }
  - { label: "ProDy (structure and network models)", url: "http://prody.csb.pitt.edu" }
draft: false
---

## The question

Someone claims their method finds allosteric sites. How do you know it beat chance?

The standard answer is a percentile rank: take the residues of the true allosteric site, look up where the method ranked them among all distal residues, average, and compare that mean percentile against 50. If the true site lands at percentile 70 and there are a hundred-odd candidate residues, the number looks impressive and the paper writes itself.

That comparison is wrong, and it is wrong in a way that makes almost every method in this field look better than it is.

## Why the usual null is broken

```
what the usual test assumes    each residue is an independent draw
                               → n_effective ≈ n_distal  (100s)
                               → the standard error is tiny
                               → a 10-point shift off 50 becomes "significant"

what an allosteric site is     ONE contiguous pocket in 3-D space
                               → its residues touch each other
                               → they share the same local network
                                 environment, the same burial, the same
                                 degree, the same everything
                               → n_effective ≈ 1 pocket, not k residues
```

An allosteric site is not a random sample of residues. It is a single spatially connected object, and the score of one of its residues is highly predictive of the score of its neighbours. Averaging k correlated numbers does not give you the precision of k independent ones. Assume independence and the standard error you divide by is too small — by a factor that grows with how correlated the pocket is.

The consequence is not subtle. It manufactures discoveries. And, symmetrically, it manufactures condemnations: a method that lands below 50 gets flagged as significantly *anti*-predictive when it is simply noise.

## The instrument

```
null hypothesis   the true pocket is no better placed, under this method's
                  ranking, than any other contiguous distal pocket of the
                  same size

permutation       draw a random distal residue as seed
                  take its k-1 nearest distal neighbours   (k = true site size)
                  → a random pocket with matched size, matched contiguity,
                    matched distal constraint
                  2,000 permutations, seed 20260717

paired variant    score the DIFFERENCE quantum-minus-classical against the
                  same null. Much lower variance: both propagators share the
                  graph, the source residue and the time window, so
                  everything except the propagator itself cancels.
                  5,000 permutations × 18 frozen grid configs per target

applied to        CTQW · diffusion · GNM · ANM · betweenness · closeness
                  on KRAS G12C, BCR-ABL1 and cardiac myosin
                  ground truth: the same geometric sites as EXP-0007-013/014/015
```

Everything here is fixed before the data is looked at: the cutoff (8.5 Å), the window (0.5–8.0), the distal threshold, the site definition, the permutation count and the seed. The grid is the same frozen 18 configurations we have used since the first molecular run.

## What happens to the numbers

<figure style="margin:1.5em 0">
<svg viewBox="0 0 640 300" role="img" aria-label="Apparent z-scores under an i.i.d. null collapse under the contiguous-pocket null: ANM on BCR-ABL1 from 4.64 to 1.18, GNM on cardiac myosin from 2.95 to 0.87, our own CTQW on KRAS from 2.60 to 1.02, GNM on BCR-ABL1 from 2.14 to 0.49, CTQW on BCR-ABL1 from 1.65 to 0.37, closeness on KRAS from 1.62 to 0.75. None reaches the 1.96 significance line under the correct null." style="width:100%;height:auto;background:#1F1C18;border-radius:4px">
  <text x="24" y="30" fill="#F4EEDF" font-size="15" font-weight="600" font-family="Instrument Sans, sans-serif">|z| under the i.i.d. null → |z| under the contiguous-pocket null</text>
  <text x="24" y="49" fill="#B5AC99" font-size="11" font-family="IBM Plex Mono, monospace">2,000 permutations · matched size, contiguity and distal constraint · seed 20260717</text>
  <line x1="190" y1="62" x2="190" y2="248" stroke="#3D372F" stroke-width="1"/>
  <line x1="350.7" y1="62" x2="350.7" y2="248" stroke="#D9B87A" stroke-width="1" stroke-dasharray="3 3"/>
  <text x="356" y="72" fill="#D9B87A" font-size="10" font-family="IBM Plex Mono, monospace">|z| = 1.96</text>
  <text x="190" y="264" fill="#6E675C" font-size="10" text-anchor="middle" font-family="IBM Plex Mono, monospace">0</text>
  <text x="272" y="264" fill="#6E675C" font-size="10" text-anchor="middle" font-family="IBM Plex Mono, monospace">1</text>
  <text x="354" y="264" fill="#6E675C" font-size="10" text-anchor="middle" font-family="IBM Plex Mono, monospace">2</text>
  <text x="436" y="264" fill="#6E675C" font-size="10" text-anchor="middle" font-family="IBM Plex Mono, monospace">3</text>
  <text x="518" y="264" fill="#6E675C" font-size="10" text-anchor="middle" font-family="IBM Plex Mono, monospace">4</text>
  <text x="600" y="264" fill="#6E675C" font-size="10" text-anchor="middle" font-family="IBM Plex Mono, monospace">5</text>

  <text x="24" y="99" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">ANM · BCR-ABL1</text>
  <line x1="286.8" y1="95" x2="570.5" y2="95" stroke="#3D372F" stroke-width="2"/>
  <circle cx="570.5" cy="95" r="5" fill="#8C4A3F"/><circle cx="286.8" cy="95" r="5" fill="#4DC4B5"/>
  <text x="24" y="125" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">GNM · myosin</text>
  <line x1="261.3" y1="121" x2="431.9" y2="121" stroke="#3D372F" stroke-width="2"/>
  <circle cx="431.9" cy="121" r="5" fill="#8C4A3F"/><circle cx="261.3" cy="121" r="5" fill="#4DC4B5"/>
  <text x="24" y="151" fill="#D9B87A" font-size="11" font-family="IBM Plex Mono, monospace">CTQW · KRAS (ours)</text>
  <line x1="273.6" y1="147" x2="403.2" y2="147" stroke="#3D372F" stroke-width="2"/>
  <circle cx="403.2" cy="147" r="5" fill="#8C4A3F"/><circle cx="273.6" cy="147" r="5" fill="#4DC4B5"/>
  <text x="24" y="177" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">GNM · BCR-ABL1</text>
  <line x1="230.2" y1="173" x2="365.5" y2="173" stroke="#3D372F" stroke-width="2"/>
  <circle cx="365.5" cy="173" r="5" fill="#8C4A3F"/><circle cx="230.2" cy="173" r="5" fill="#4DC4B5"/>
  <text x="24" y="203" fill="#D9B87A" font-size="11" font-family="IBM Plex Mono, monospace">CTQW · BCR-ABL1 (ours)</text>
  <line x1="220.3" y1="199" x2="325.3" y2="199" stroke="#3D372F" stroke-width="2"/>
  <circle cx="325.3" cy="199" r="5" fill="#8C4A3F"/><circle cx="220.3" cy="199" r="5" fill="#4DC4B5"/>
  <text x="24" y="229" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">closeness · KRAS</text>
  <line x1="251.5" y1="225" x2="322.8" y2="225" stroke="#3D372F" stroke-width="2"/>
  <circle cx="322.8" cy="225" r="5" fill="#8C4A3F"/><circle cx="251.5" cy="225" r="5" fill="#4DC4B5"/>

  <circle cx="200" cy="285" r="5" fill="#8C4A3F"/>
  <text x="212" y="289" fill="#B5AC99" font-size="10" font-family="IBM Plex Mono, monospace">apparent, i.i.d. residues</text>
  <circle cx="386" cy="285" r="5" fill="#4DC4B5"/>
  <text x="398" y="289" fill="#B5AC99" font-size="10" font-family="IBM Plex Mono, monospace">real, contiguous pockets</text>
</svg>
<figcaption style="color:#6E675C;font-size:0.85em">Measured, sealed archive EXP-0007-017. Every apparent score shrinks by a factor of roughly 2 to 4. Not one survives the significance line.</figcaption>
</figure>

The largest apparent effect in the whole matrix is ANM on BCR-ABL1, |z| = 4.64. Read through the independence assumption that is a p-value of a few parts in a million — a result, publishable, the kind of number that gets a method adopted. Under the correct null the same measurement gives p = 0.85: the true pocket sits well inside the distribution of random contiguous pockets. Nothing happened.

The same collapse hits us. Our own quantum walk on KRAS G12C looks like z = −2.60, which under the naive test would read as *significantly worse than chance*. Under the contiguous null it is −1.02 — unremarkable noise, in a matrix full of unremarkable noise.

## The honest result: nothing is significant, for anyone

Six methods × three targets, and the verdict is uniform.

Every p-value in the eighteen cells lies between 0.15 and 0.85. No method separates the true allosteric pocket from a random contiguous pocket of the same size on any of the three targets. That includes both classical structure-based baselines that this field trusts (GNM, ANM, betweenness, closeness), the classical diffusion propagator, and our continuous-time quantum walk.

The paired test is stricter still, because it removes the shared structure and asks only whether the quantum propagator ranks the true pocket better than the classical one on the *same* graph, source and window. Across the full frozen grid — 18 configurations per target, 5,000 permutations each, 54 cells in total — the number of cells reaching p < 0.05 is **zero**:

```
KRAS G12C       mean Δ  −18.01 pts   z̄ −1.19   0/18 configs favour quantum   p̃ 0.85
BCR-ABL1        mean Δ   −1.10 pts   z̄ −0.17  10/18 configs favour quantum   p̃ 0.49
cardiac myosin  mean Δ   +5.84 pts   z̄ +0.58  18/18 configs favour quantum   p̃ 0.26
                                              ────────────────────────────────────
                                              0/54 cells at p < 0.05
```

Cardiac myosin is the one place where the quantum side is ahead in every single configuration of the grid. It is also not significant. That is the honest reading, and we are not going to dress it up: a consistent sign across 18 correlated configurations of the same target is one observation, not eighteen.

## How many targets would actually settle it

The myosin effect size is d = +0.589. If that effect is real, the number of independent targets needed to detect it is a straightforward calculation:

```
targets for p < 0.05     8
targets for p < 0.01    16
we have                  3

combined across the three targets:  d = −0.196,  Stouffer z = −0.34
```

So the validation set of the challenge itself — three targets with a co-crystallised effector and a defensible ground truth — is too small to resolve the only signal that looks like it might be there. That is not a complaint about the challenge. It is the measurement, and it belongs in the record as much as any result would.

## Why we are publishing the instrument instead of a score

Every competitor in this track will report a number. Most of those numbers will be computed against a null that assumes independent residues, because that is the convention, and the convention inflates. Our contribution is not another number in that pile — it is the instrument that tells you which numbers in the pile are real.

We ran it on ourselves first, and it took our result away. That is the point. A measuring device you only point at other people is not a measuring device; it is a rhetorical instrument. The value of this null is precisely that it is indifferent to who built it.

There is a second, quieter reason. If we had run the naive test, our KRAS number would have come out as z = −2.60 and we would have had to publish "our quantum method is significantly worse than chance". The correct null protects us from that false condemnation too — and we still find nothing. Both of those facts are in the archive.

## Verify it yourself

The permutation outputs are published raw, not summarised: `spatial_null.json` (sha256:3914def6…c08f61) and `paired_null.json` (sha256:43015a13…9664b3), together with the harness `paired_null.py` (sha256:6f53f3a6…fdc88f) and `spatial_null.py` (sha256:61194e2e…d173c5) that produced them. The run archive EXP-0007-017 carries content hash sha256:ff29769b…7a43df, is stored in triple copy, and is anchored to Bitcoin through OpenTimestamps.

Re-run it with the same seed and you will get the same 2,000 permutations. Change the seed and the p-values will move in the third decimal and nowhere else. Point the instrument at your own method and it will treat you exactly as it treated us.
