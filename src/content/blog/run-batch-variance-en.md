---
title: "Runs 003–008: variance dissolves the trend (and that's the system working)"
tldr: "We ran 3 new seeds per size. At n=12 the QAOA gap spans 23.4%–53.7% (mean ≈40.9%); at n=16 it spans 20.7%–42.3% (mean ≈28.8%). The ranges overlap: run 002's apparent 'gap shrinks with size' does not survive measurement. Classical CP-SAT hit the proven optimum in every one of the 8 runs to date. Verdict, all runs: not yet. Six sealed archives, EXP-0012-003 through -008."
date: "2026-07-23"
pillar: D
lang: en
slugBase: run-batch-variance
sources:
  - { label: "Sealed archives EXP-0012-003 … -008, RosettaQuantum/evidence", url: "https://github.com/RosettaQuantum/evidence/tree/main/runs/2026/07" }
  - { label: "Runs 001–002 (the two prior points)" }
draft: false
---

## Why this batch existed

Run 002 showed a smaller gap at n=16 than at n=12 (20.7% vs 42.8%) and we explicitly refused to call it a trend: one seed per size, unmeasured variance. This batch measures that variance — three fresh seeds (43, 44, 45) per size, protocol byte-for-byte frozen: same budgets, same depth, same solver, exact-optimum referee.

## The result

<figure style="margin:1.5em 0">
<svg viewBox="0 0 640 290" role="img" aria-label="QAOA gap to exact optimum across four seeds per size. n=12: 23.4 to 53.7 percent, mean 40.9. n=16: 20.7 to 42.3 percent, mean 28.8. Ranges overlap." style="width:100%;height:auto;background:#1F1C18;border-radius:4px">
  <text x="24" y="34" fill="#F4EEDF" font-size="15" font-weight="600" font-family="Instrument Sans, sans-serif">QAOA p=2 · gap to exact optimum · 4 seeds per size</text>
  <text x="24" y="54" fill="#B5AC99" font-size="12" font-family="IBM Plex Mono, monospace">seeds 42–45 · equal 120 s budgets · CP-SAT: proven optimum in all 8 runs</text>
  <line x1="80" y1="210" x2="600" y2="210" stroke="#3D372F" stroke-width="1"/>
  <text x="76" y="214" fill="#B5AC99" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">0%</text>
  <line x1="80" y1="70" x2="600" y2="70" stroke="#3D372F" stroke-width="1" stroke-dasharray="3 4"/>
  <text x="76" y="74" fill="#6E675C" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">60%</text>
  <text x="230" y="242" fill="#B5AC99" font-size="12" text-anchor="middle" font-family="IBM Plex Mono, monospace">n=12</text>
  <text x="470" y="242" fill="#B5AC99" font-size="12" text-anchor="middle" font-family="IBM Plex Mono, monospace">n=16</text>
  <circle cx="222" cy="110.1" r="5" fill="#4DC4B5"/><circle cx="238" cy="84.7" r="5" fill="#4DC4B5"/>
  <circle cx="222" cy="108.0" r="5" fill="#4DC4B5"/><circle cx="238" cy="155.4" r="5" fill="#4DC4B5"/>
  <line x1="205" y1="114.6" x2="255" y2="114.6" stroke="#D9B87A" stroke-width="2.5"/>
  <text x="262" y="88" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">max 53.7%</text>
  <text x="262" y="159" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">min 23.4%</text>
  <text x="150" y="119" fill="#D9B87A" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">mean 40.9%</text>
  <circle cx="462" cy="161.7" r="5" fill="#4DC4B5"/><circle cx="478" cy="111.3" r="5" fill="#4DC4B5"/>
  <circle cx="462" cy="160.3" r="5" fill="#4DC4B5"/><circle cx="478" cy="137.7" r="5" fill="#4DC4B5"/>
  <line x1="445" y1="142.8" x2="495" y2="142.8" stroke="#D9B87A" stroke-width="2.5"/>
  <text x="502" y="115" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">max 42.3%</text>
  <text x="502" y="165" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">min 20.7%</text>
  <text x="440" y="132" fill="#D9B87A" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">mean 28.8%</text>
  <text x="24" y="274" fill="#6E675C" font-size="11" font-family="IBM Plex Mono, monospace">teal dots = individual seeds · gold tick = mean · ranges overlap → size effect unresolved at n=4 seeds</text>
</svg>
<figcaption style="color:#6E675C;font-size:0.85em">Measured results, sealed archives EXP-0012-001 … -008.</figcaption>
</figure>

```
n=12  gaps: 42.8 · 53.7 · 43.7 · 23.4   mean 40.9   range 30.3
n=16  gaps: 20.7 · 42.3 · 21.3 · 31.0   mean 28.8   range 21.6
```

## What the batch settles — and what it kills

**It kills the run-002 story.** "The gap shrinks as instances grow" looked plausible with one seed per size. With four, the ranges overlap by 19 points: seed 45 at n=12 (23.4%) beats seed 43 at n=16 (42.3%). The means still differ (40.9 vs 28.8), but with n=4 seeds and this spread, that difference is not yet distinguishable from noise. We said two points define any story you want; here is the proof, at our own expense.

**It settles that variance is first-order.** QAOA's seed-to-seed spread (~20–30 points of gap) is the same magnitude as any size effect we could hope to measure. Every future claim on this curve must carry error bars or it is decoration.

**And one thing stayed constant across all 8 runs:** CP-SAT found the provably exact optimum every single time, in ≈0.1–1.1 s. The classical bar is not moving. That is what a strong baseline looks like.

## What we don't know

Whether the mean gap truly decreases with size — answering that needs more seeds per size (next tanda: 10+) and larger n. Whether deeper circuits (p=4) tighten the spread or just shift it. And how any of this behaves under hardware noise. All measurable; all on the ladder.

*Measured content from sealed archives EXP-0012-001 … -008. Rosetta Quantum publishes verdicts with reproducible raw data — including the ones that dissolve our own prior observations.*
