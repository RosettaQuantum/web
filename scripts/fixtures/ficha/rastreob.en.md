# Rosetta Fact Sheet · Post-quantum security
**rastreob.example** · Fintech · country not determined · measured 2026-11-16 18:56 UTC · from outside, nothing installed

## 01 Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **B** |
| RQ.S.01 | QEX index | 73/100 (external cap 84) |

Reading: Your site already uses the post-quantum lock, but its certificate could not be read.
How the grade is set: not from the QEX. The new lock, the alerts and whether everything sensitive was measured decide it (QREADY-NOTA-2.2); the QEX sums four weighted dimensions and does not set the grade. The “What to do” actions change the grade; the QEX only changes with what “Points per action” lists.
Reference: a .example domain does not indicate a country; no comparison.
Publication: private. The owner has not activated its public page.

## 02 Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | no data | not measured |
| RQ.S.03 | Surface hygiene | 70/70 | measured |
| RQ.S.04 | HNDL posture | 65/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | no MX published | measured |
| RQ.S.07 | Certificate validity | no data | not measured |
| RQ.S.08 | security.txt | not published | measured |
| RQ.S.09 | Exposed surface | no names probed | measured |

measured: observed today by the probe · model: sector value, not measured on the domain · not measured never means not protected

| ID | Rule | Dimension | QEX |
|---|---|---|---|
| RQ.S.02.1 | certificate not read | no data | — |
| RQ.S.02.2 | certificate not read (for information) | — | — |
| = RQ.S.02 | weight 0.40 | no data | — |
| RQ.S.03 | hygiene base (maximum 70) | 70 | 17.50 |
| RQ.S.03.1 | TLS 1.3 on the main site | passes · deduction 0 | 0.00 |
| RQ.S.03.2 | no non-production names in the log | passes · deduction 0 | 0.00 |
| RQ.S.03.3 | 0 infrastructure names in the log (deducts from 3) | passes · deduction 0 | 0.00 |
| RQ.S.03.4 | no legacy names in the log | passes · deduction 0 | 0.00 |
| RQ.S.03.5 | security.txt not published (for information) | — | — |
| = RQ.S.03 | weight 0.25 | 70/70 | 17.50 |
| RQ.S.04 | fintech sector model | 65 | 16.25 |
| RQ.S.04.1 | years the sector's data must stay secret | no data | — |
| RQ.S.04.2 | years the sector takes to migrate | no data | — |
| RQ.S.04.3 | Mosca margin | no data | — |
| = RQ.S.04 | weight 0.25 | 65/100 | 16.25 |
| RQ.S.05.1 | supports X25519MLKEM768 | 100 | 10.00 |
| RQ.S.05.2 | chooses it by default (for information) | yes | — |
| RQ.S.05.3 | has it on every name that answers (for information) | yes | — |
| = RQ.S.05 | weight 0.10 | 100/100 | 10.00 |
| = RQ.S.01 | sum of contributions over weight 0.60 |  | 43.75 / 0.60 → 73 |

Highest reachable from outside: 83.75 → 84.
QEX without the sector HNDL model (measured dimensions only): 79. The published index is still 73.

## 03 Alerts
No findings.

## 04 What to do
| # | Action | Resolves | Effect on the grade |
|---|---|---|---|
| H1 | Publish security.txt | — | no change |

## 05 Not measured
- Certificates and PKI could not be measured: without that dimension the grade cannot be A.
- HNDL posture is the fintech sector model, not a measurement of the domain: a per-sector table fixed in the 2026-08 edition; the derivation is not published.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- Not measured never means not protected.

## 06 Evidence
- Instrument: rosetta-sondas-envivo/1
- Versions: QEX-1.0 · QREADY-NOTA-2.2
- Measured: 2026-11-16T18:56:39Z
- CT fingerprint: a4f6c0d7…713e · 1 cert.
- Snapshot fingerprint: d716bd48…d06b
- Method: CT · DNS · TLS handshakes without a session
- Rubric: https://rosettaquantum.com/methodology/qex

## 07 Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Full report for the domain: https://rosettaquantum.com/q-ready/medicion/?dominio=rastreob.example&sector=fintech

rosetta-ficha/1 · Rosetta Quantum · independent measurement
