# Rosetta Fact Sheet · Post-quantum security
**rastreo.example** · Fintech · country not determined · measured 2026-11-16 18:55 UTC · from outside, nothing installed

## 01 Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **F** |
| RQ.S.01 | QEX index | 61/100 (external cap 84) |

Reading: Your site does not use the post-quantum lock yet, and it has a test environment exposed to the internet.
Reference: a .example domain does not indicate a country; no comparison.
Publication: private. The owner has not activated its public page.

## 02 Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | 75/100 | measured |
| RQ.S.03 | Surface hygiene | 60/70 | measured |
| RQ.S.04 | HNDL posture | 65/100 | model |
| RQ.S.05 | PQC at the edge | 0/100 | measured |
| RQ.S.06 | Post-quantum email | no data | not measured |
| RQ.S.07 | Certificate validity | 82 days · 2027-02-06 | measured |
| RQ.S.08 | security.txt | not published | measured |
| RQ.S.09 | Exposed surface | 4/4 sensitive respond | measured |

measured: observed today by the probe · model: sector value, not measured on the domain · not measured never means not protected

| ID | Rule | Dimension | QEX |
|---|---|---|---|
| RQ.S.02.1 | RSA-2048 = current minimum | 75 | 30.00 |
| RQ.S.02.2 | validity: 82 days, until 2027-02-06 (for information) | — | — |
| RQ.S.02.3 | no dated plan for a post-quantum certificate (for information) | — | — |
| = RQ.S.02 | weight 0.40 | 75/100 | 30.00 |
| RQ.S.03 | hygiene base (maximum 70) | 70 | 17.50 |
| RQ.S.03.1 | TLS 1.3 on the main site | 0 | 0.00 |
| RQ.S.03.2 | 2 non-production names in the log | −10 | −2.50 |
| RQ.S.03.3 | 2 infrastructure names in the log (deducts from 3) | 0 | 0.00 |
| RQ.S.03.4 | no legacy names in the log | 0 | 0.00 |
| RQ.S.03.5 | security.txt not published (for information) | — | — |
| = RQ.S.03 | weight 0.25 | 60/70 | 15.00 |
| RQ.S.04 | fintech sector model | 65 | 16.25 |
| RQ.S.04.1 | years the sector's data must stay secret | no data | — |
| RQ.S.04.2 | years the sector takes to migrate | no data | — |
| RQ.S.04.3 | Mosca margin | no data | — |
| = RQ.S.04 | weight 0.25 | 65/100 | 16.25 |
| RQ.S.05.1 | does not support X25519MLKEM768 | 0 | 0.00 |
| = RQ.S.05 | weight 0.10 | 0/100 | 0.00 |
| = RQ.S.01 | sum of contributions |  | 61.25 → 61 |

Highest reachable from outside: 83.75 → 84.
Points per action: RSA-4096 or P-384 key +10.00; enable the hybrid +10.00.

## 03 Alerts
| # | Level | Finding | Where |
|---|---|---|---|
| A1 | SERIOUS | Exposed test environment | s•••.rastreo.example |
| A2 | HIGH | Sensitive infrastructure answering | c•••.rastreo.example |
| A3 | MEDIUM | Test environment published with access blocked | serverless-s•••.rastreo.example |
| A4 | MEDIUM | Classical certificate without a dated plan | www.rastreo.example |
| A5 | MEDIUM | Mail service answering on port 443 | w•••.rastreo.example |

## 04 What to do
| # | Action | Resolves | Effect on the grade |
|---|---|---|---|
| H1 | Take s•••.rastreo.example off the internet | A1 | -> D |
| H2 | Enable X25519MLKEM768 on www.rastreo.example | RQ.S.05 | -> C |
| H3 | Close or IP-restrict c•••.rastreo.example | A2 | -> B |
| H4 | Take serverless-s•••.rastreo.example off the internet | A3 | no change |
| H5 | Close port 443 on w•••.rastreo.example | A5 | -> A |
| H6 | Dated plan for a post-quantum certificate | A4 | no change |
| H7 | Publish security.txt | — | no change |

## 05 Not measured
- Email encryption was not measured in this snapshot.
- HNDL posture is the fintech sector model, not a measurement of the domain: a per-sector table fixed in the 2026-08 edition; the derivation is not published.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- Not measured never means not protected.

## 06 Evidence
- Instrument: rosetta-sondas-envivo/1
- Versions: QEX-1.0 · QREADY-NOTA-2.1
- Measured: 2026-11-16T18:55:47Z
- CT fingerprint: e5b89749…3a86 · 1 cert.
- Snapshot fingerprint: 6886b050…9447
- Method: CT · DNS · TLS handshakes without a session
- Rubric: https://rosettaquantum.com/methodology/qex

## 07 Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Full report for the domain: https://rosettaquantum.com/q-ready/medicion/?dominio=rastreo.example&sector=fintech
- With H1 to H5 done, the next measurement should give A.

rosetta-ficha/1 · Rosetta Quantum · independent measurement
