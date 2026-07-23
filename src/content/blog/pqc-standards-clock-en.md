---
title: "The cryptographic clock: what changes if quantum machines keep their growth rate"
tldr: "The security migration is not hypothetical: NIST finalized the post-quantum standards (FIPS 203/204/205) in August 2024, NSA's CNSA 2.0 mandates PQC for new national security systems from 2027, and NIST IR 8547 deprecates RSA-2048/ECC by 2030 and removes them by 2035. Expert surveys put a cryptographically relevant quantum computer in a 2033–2037 central window. The 'harvest now, decrypt later' exposure applies to data encrypted today. Optimization advantage — what we benchmark — is a separate, harder question."
date: "2026-07-23"
pillar: F
lang: en
slugBase: pqc-standards-clock
sources:
  - { label: "NIST FIPS 203/204/205 (Aug 13, 2024)", url: "https://csrc.nist.gov/pubs/fips/203/final" }
  - { label: "NIST IR 8547 — transition to PQC (2030/2035 milestones)", url: "https://csrc.nist.gov/pubs/ir/8547/ipd" }
  - { label: "ITECS — Post-Quantum Cryptography 2026 guide", url: "https://itecsonline.com/post/post-quantum-cryptography-complete-guide-2026" }
  - { label: "Global Risk Institute — quantum threat timeline surveys", url: "https://globalriskinstitute.org" }
draft: false
---

## The dates that are already law-adjacent

```
2024-08-13   FIPS 203 (ML-KEM) · 204 (ML-DSA) · 205 (SLH-DSA) finalized
2026         FIPS 206 (FN-DSA / FALCON) expected
2027         CNSA 2.0: PQC mandated for new US national security systems
2030         NIST IR 8547: RSA-2048 and ECC P-256 deprecated
2033–2037    central expert window for a cryptographically relevant QC (CRQC)
2035         quantum-vulnerable algorithms removed from NIST standards
```

None of these dates depends on marketing. They are published standards and directives, and they force migration *regardless* of when — or whether — the threatening machine arrives. That asymmetry is the whole story of quantum security: the defense timeline is fixed by policy; the attack timeline is a probability distribution.

## Why the migration can't wait for the machine

**Harvest now, decrypt later.** Ciphertext captured today can be stored and decrypted retroactively once a CRQC exists. Any data whose confidentiality must outlive the threat window — health records, state secrets, long-term financial and genomic data — is effectively already exposed if it crosses a network under RSA/ECC today. Sector estimates put the overwhelming majority of today's encrypted healthcare and classified data inside that exposure window.

**Migrations are decade-scale.** NIST's own guidance frames enterprise cryptographic migration at 5–15 years. The 2030/2035 milestones exist precisely because starting at CRQC-minus-two-years is starting too late.

**Deployment is measurable, and it started.** Hybrid post-quantum key exchange already runs in production: Chrome's hybrid X25519+Kyber rollout, Apple's PQ3 in iMessage, and Cloudflare reporting a growing share of TLS 1.3 connections on hybrid PQC with an expectation of majority coverage by end of 2026. The direction is set; the tail of laggards is the risk surface.

## The resource math, honestly stated

A CRQC needs to run Shor's algorithm against RSA-2048 — an *exact* algorithm with proven exponential advantage, which is why cryptography is the one domain where the quantum threat is mathematically unambiguous. Resource estimates have been falling: from ~20 million physical qubits in influential 2019-era analyses to under 1 million in recent papers, driven by better error correction and algorithmic refinements. Today's largest machines are in the hundreds-to-low-thousands of physical qubits. The gap is still orders of magnitude; the *rate* at which the estimates fall is the number to watch, more than the qubit counts themselves.

## The distinction our ledger exists to enforce

Shor-on-RSA is a proven exponential separation. Optimization — portfolios, routing, scheduling, the problems our runs measure — is not: there, quantum candidates fight strong classical solvers instance by instance, and as our own sealed runs show, the classical side currently wins the sizes we can referee exactly. Treating "quantum will break RSA eventually" and "quantum will speed up my portfolio" as the same claim is the single most common category error in this industry. One has a theorem. The other needs a ledger.

## What we don't know

When (or with what probability curve) a CRQC actually arrives — we cite expert surveys, not our own forecast. Whether current PQC standards survive future cryptanalysis (FIPS 205 exists precisely as a hedge). And how fast the laggard tail of enterprises migrates — history with SHA-1 and TLS suggests: slower than the standards assume.

*Educational content, dated 2026-07-23. Not security advice; consult the primary standards.*
