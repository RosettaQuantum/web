# Rosetta Fact Sheet · Post-quantum security
**ejemplo.cl** · Banking · Chile · measured 2026-11-12 17:34 UTC · from outside, nothing installed

## 01 Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **A** |
| RQ.S.01 | QEX index | 56/100 (external cap 84) |

Reading: New lock on the site and on every public name that responded, no serious or high alerts, no published test environments, and everything sensitive measured. The highest grade that can be given from outside.
Reference: banking median 57 (12 orgs, edition 2026-08). ejemplo.cl is 1 point below.
Publication: public at https://rosettaquantum.com/verificado/ejemplo.cl

## 02 Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | 75/100 | measured |
| RQ.S.03 | Surface hygiene | 50/70 | measured |
| RQ.S.04 | HNDL posture | 12/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | 1/1 MX | measured |
| RQ.S.07 | Certificate validity | 94 days · 2027-02-14 | measured |
| RQ.S.08 | security.txt | published | measured |
| RQ.S.09 | Exposed surface | 2/5 sensitive respond | measured |

measured: observed today by the probe · model: sector value, not measured on the domain · not measured never means not protected

| ID | Rule | Dimension | QEX |
|---|---|---|---|
| RQ.S.02.1 | RSA-2048 = current minimum | 75 | 30.00 |
| RQ.S.02.2 | validity: 94 days, until 2027-02-14 (for information) | — | — |
| RQ.S.02.3 | no dated plan for a post-quantum certificate (for information) | — | — |
| = RQ.S.02 | weight 0.40 | 75/100 | 30.00 |
| RQ.S.03 | hygiene base (maximum 70) | 70 | 17.50 |
| RQ.S.03.1 | TLS 1.3 on the main site | 0 | 0.00 |
| RQ.S.03.2 | 3 non-production names in the log | −10 | −2.50 |
| RQ.S.03.3 | 1 infrastructure name in the log (deducts from 3) | 0 | 0.00 |
| RQ.S.03.4 | 1 legacy name in the log | −10 | −2.50 |
| RQ.S.03.5 | security.txt published (for information) | — | — |
| = RQ.S.03 | weight 0.25 | 50/70 | 12.50 |
| RQ.S.04 | banking sector model | 12 | 3.00 |
| RQ.S.04.1 | years the sector's data must stay secret | no data | — |
| RQ.S.04.2 | years the sector takes to migrate | no data | — |
| RQ.S.04.3 | Mosca margin | no data | — |
| = RQ.S.04 | weight 0.25 | 12/100 | 3.00 |
| RQ.S.05.1 | supports X25519MLKEM768 | 100 | 10.00 |
| RQ.S.05.2 | chooses it by default (for information) | — | — |
| RQ.S.05.3 | has it on every name that answers (for information) | — | — |
| = RQ.S.05 | weight 0.10 | 100/100 | 10.00 |
| = RQ.S.01 | sum of contributions |  | 55.50 → 56 |

Highest reachable from outside: 70.50 → 70.

## 03 Alerts
| # | Level | Finding | Where |
|---|---|---|---|
| A1 | MEDIUM | Classical certificate without a dated plan | www.ejemplo.cl |
| A2 | MEDIUM | Legacy name answering | legacy.ejemplo.cl |
| A3 | MEDIUM | Mail service answering on port 443 | mail.ejemplo.cl |

## 04 What to do
| # | Action | Resolves | Effect on the grade |
|---|---|---|---|
| H1 | Retire legacy.ejemplo.cl or assign it an owner | A2 | no change |
| H2 | Close port 443 on mail.ejemplo.cl | A3 | no change |
| H3 | Dated plan for a post-quantum certificate | A1 | no change |

## 05 Not measured
- HNDL posture is the banking sector model, not a measurement of the domain: a per-sector table fixed in the 2026-08 edition; the derivation is not published.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- Not measured never means not protected.

## 06 Evidence
- Instrument: rosetta-sondas-envivo/1
- Versions: QEX-1.0 · QREADY-NOTA-2.1
- Measured: 2026-11-12T17:34:15Z
- CT fingerprint: 9d938f1f…d28f · 4022 cert.
- Snapshot fingerprint: f0c71112…acdd
- Method: CT · DNS · TLS handshakes without a session
- Rubric: https://rosettaquantum.com/methodology/qex

## 07 Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Public page for the domain: https://rosettaquantum.com/verificado/ejemplo.cl

rosetta-ficha/1 · Rosetta Quantum · independent measurement
