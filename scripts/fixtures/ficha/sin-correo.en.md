# Rosetta Fact Sheet · Post-quantum security
**example.com** · Retail · country not determined · measured 2026-11-12 17:34 UTC · from outside, nothing installed

## 01 Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **B** |
| RQ.S.01 | QEX index | 69/100 (external cap 84) |

Reading: Your site already uses the post-quantum lock, but one name that answers does not show the new lock.
Reference: a .com domain does not indicate a country; no comparison.
Publication: private. The owner has not activated its public page.

## 02 Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | 75/100 | measured |
| RQ.S.03 | Surface hygiene | 50/100 | measured |
| RQ.S.04 | HNDL posture | 65/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | no MX published | measured |
| RQ.S.07 | Certificate validity | 94 days · 2027-02-14 | measured |
| RQ.S.08 | security.txt | not published | measured |
| RQ.S.09 | Exposed surface | 1/5 sensitive respond | measured |

measured: observed today by the probe · model: sector value, not measured on the domain · not measured never means not protected

## 03 Alerts
| # | Level | Finding | Where |
|---|---|---|---|
| A1 | MEDIUM | Classical certificate without a dated plan | www.example.com |
| A2 | MEDIUM | Legacy name answering | l•••.example.com |

## 04 What to do
| # | Action | Resolves | Effect on the grade |
|---|---|---|---|
| H1 | Retire l•••.example.com or assign it an owner | A2 | -> A |
| H2 | Dated plan for a post-quantum certificate | A1 | no change |
| H3 | Publish security.txt | — | no change |

## 05 Not measured
- 1 names answered without evidence of the new lock.
- HNDL posture is the retail sector model, not a measurement of the domain.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- Not measured never means not protected.

## 06 Evidence
- Instrument: rosetta-sondas-envivo/1
- Versions: QEX-1.0 · QREADY-NOTA-2.1
- Measured: 2026-11-12T17:34:15Z
- CT fingerprint: c1b1ac16…ce0e · 4022 cert.
- Snapshot fingerprint: e6488add…c9f6
- Method: CT · DNS · TLS handshakes without a session

## 07 Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Full report for the domain: https://rosettaquantum.com/q-ready/medicion/?dominio=example.com&sector=retail
- With H1 done, the next measurement should give A.

rosetta-ficha/1 · Rosetta Quantum · independent measurement
