# Rosetta Fact Sheet · Post-quantum security
**example.com** · Retail · country not determined · measured 2026-11-12 17:34 UTC · from outside, nothing installed

## 01 Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **B** |
| RQ.S.01 | QEX index | 69/100 (external cap 84) |

Reading: Your site already uses the post-quantum lock, but one name that answers does not show the new lock.
How the grade is set: not from the QEX. The new lock, the alerts and whether everything sensitive was measured decide it (QREADY-NOTA-2.1); the QEX sums four weighted dimensions and does not set the grade. A1-A2 do not, by themselves, prevent an A. The “What to do” actions change the grade; the QEX only changes with what “Points per action” lists.
Reference: a .com domain does not indicate a country; no comparison.
Publication: private. The owner has not activated its public page.

## 02 Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | 75/100 | measured |
| RQ.S.03 | Surface hygiene | 50/70 | measured |
| RQ.S.04 | HNDL posture | 65/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | no MX published | measured |
| RQ.S.07 | Certificate validity | 94 days · 2027-02-14 | measured |
| RQ.S.08 | security.txt | not published | measured |
| RQ.S.09 | Exposed surface | 1/5 sensitive respond today (no QEX deduction; see alerts) | measured |

measured: observed today by the probe · model: sector value, not measured on the domain · not measured never means not protected

| ID | Rule | Dimension | QEX |
|---|---|---|---|
| RQ.S.02.1 | RSA-2048 = current minimum | 75 | 30.00 |
| RQ.S.02.2 | validity: 94 days, until 2027-02-14 (for information) | — | — |
| RQ.S.02.3 | no dated plan for a post-quantum certificate (for information) | — | — |
| = RQ.S.02 | weight 0.40 | 75/100 | 30.00 |
| RQ.S.03 | hygiene base (maximum 70) | 70 | 17.50 |
| RQ.S.03.1 | TLS 1.3 on the main site | passes · deduction 0 | 0.00 |
| RQ.S.03.2 | 3 non-production names in the CT log history (deducts from 1, even if they no longer answer) | −10 | −2.50 |
| RQ.S.03.3 | 1 infrastructure name in the log (deducts from 3) | passes · deduction 0 | 0.00 |
| RQ.S.03.4 | 1 legacy name in the log | −10 | −2.50 |
| RQ.S.03.5 | security.txt not published (for information) | — | — |
| = RQ.S.03 | weight 0.25 | 50/70 | 12.50 |
| RQ.S.04 | retail sector model | 65 | 16.25 |
| RQ.S.04.1 | years the sector's data must stay secret | no data | — |
| RQ.S.04.2 | years the sector takes to migrate | no data | — |
| RQ.S.04.3 | Mosca margin | no data | — |
| = RQ.S.04 | weight 0.25 | 65/100 | 16.25 |
| RQ.S.05.1 | supports X25519MLKEM768 | 100 | 10.00 |
| RQ.S.05.2 | chooses it by default (for information) | yes | — |
| RQ.S.05.3 | does not have it on every name that answers (for information) | no | — |
| = RQ.S.05 | weight 0.10 | 100/100 | 10.00 |
| = RQ.S.01 | sum of contributions |  | 68.75 → 69 |

Highest reachable from outside: 83.75 → 84.
QEX without the sector HNDL model (measured dimensions only): 70. The published index is still 69.

## 03 Alerts
| # | Level | Finding | Where |
|---|---|---|---|
| A1 | MEDIUM | Classical certificate without a dated plan | www.example.com |
| A2 | MEDIUM | Legacy name answering | legacy.example.com |

## 04 What to do
| # | Action | Resolves | Effect on the grade |
|---|---|---|---|
| H1 | Retire legacy.example.com or assign it an owner | A2 | -> A |
| H2 | Dated plan for a post-quantum certificate | A1 | no change |
| H3 | Publish security.txt | — | no change |

## 05 Not measured
- 1 names answered without evidence of the new lock.
- HNDL posture is the retail sector model, not a measurement of the domain: a per-sector table fixed in the 2026-08 edition; the derivation is not published.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- Not measured never means not protected.

## 06 Evidence
- Instrument: rosetta-sondas-envivo/1
- Versions: QEX-1.0 · QREADY-NOTA-2.2
- Measured: 2026-11-12T17:34:15Z
- CT fingerprint: c1b1ac16…ce0e · 4022 cert.
- Snapshot fingerprint: e6488add…c9f6
- Method: CT · DNS · TLS handshakes without a session
- Rubric: https://rosettaquantum.com/methodology/qex

## 07 Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Full report for the domain: https://rosettaquantum.com/q-ready/medicion/?dominio=example.com&sector=retail
- With H1 done, the next measurement should give A.

rosetta-ficha/1 · Rosetta Quantum · independent measurement
