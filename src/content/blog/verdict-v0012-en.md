---
title: "V-0012: the ledger's first real verdict is a 'not yet' — on purpose"
tldr: "The Evidence Ledger now holds its first real, measured verdict. Recipe RQ-0012 (portfolio optimization, QAOA p=2 vs CP-SAT): NOT YET — classical reached the proven exact optimum in all 20 sealed runs at n=12/16/20; no crossover observed, no defensible size trend. Sealed as V-0012 (sha256:f510eff6…6636), backed by 20 run archives in verified triple copy. The demo entry it replaces is gone; the counter reads 1 verdict published, honestly."
date: "2026-07-24"
pillar: A
lang: en
slugBase: verdict-v0012
sources:
  - { label: "Sealed verdict V-0012 + 20 supporting run archives, RosettaQuantum/evidence", url: "https://github.com/RosettaQuantum/evidence" }
  - { label: "The Evidence Ledger (live)", url: "https://rosettaquantum.com/ledger" }
draft: false
---

## What changed today

Since day one, our public ledger carried illustrative entries clearly watermarked as demos — structure previews of what a verdict would look like. Today the first watermark comes off. **RQ-0012 · Constrained portfolio compression** now shows a real verdict, backed by 20 sealed, reproducible, triple-archived runs:

```
verdict   NOT YET — classical wins at every measured size
scope     QAOA p=2 (noiseless CPU sim) vs OR-Tools CP-SAT
          equal 120 s budgets · exact optimum as referee
evidence  n=12: 8 seeds · gap 48.2% ± 22.5
          n=16: 8 seeds · gap 25.1% ± 11.1
          n=20: 4 seeds · gap 41.1% ± 14.1
          CP-SAT: proven optimum, 20/20
crossover not observed — no defensible size trend at n≤20
seal      V-0012 · sha256:f510eff6…6636 · triple copy + OTS
```

## Why publishing a loss first is the whole point

A verification authority that debuts with a win invites one question: convenient, isn't it? Debuting with a rigorously measured *loss* — published, sealed, reproducible — establishes the only thing that matters at this stage: **that the referee calls it as measured.** When a "win" eventually appears in this ledger, it will be credible precisely because this "not yet" came first.

## What a verdict is, and isn't

A verdict is a dated photograph of the measured state, not a final sentence. V-0012 says: at these sizes, with this recipe depth, under these budgets, on a noiseless simulator — quantum does not beat a strong classical baseline, and nothing measured suggests it's near. The series continues (more seeds, larger n, deeper circuits, then noisy hardware), and any future revision ships as a new sealed verdict referencing this one. Nothing gets edited.

## What we don't know

Where — or whether — this recipe family crosses over at sizes beyond our exact-refereeing range; how noise shifts these gaps on real QPUs; and whether deeper circuits change the picture within honest budgets. Each is a measurement on the ladder, and each lands here when it's sealed.

*Measured content from sealed archives V-0012 and EXP-0012-001…020. Rosetta Quantum publishes verdicts with reproducible raw data — starting with the one where quantum loses.*
