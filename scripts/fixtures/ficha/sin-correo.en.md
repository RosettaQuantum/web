# Rosetta Fact Sheet · Post-quantum security
**example.com** · retail · country not determined · measured 2026-11-12 17:34 UTC

## 1. Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **B** |
| RQ.S.01 | QEX index | 69/100 (external cap 84) |

Reading: New lock on the main site. Some public names show no evidence of the new lock yet.
Reference: a .com domain does not indicate a country; no comparison.
Publication: private. The owner has not activated its public page.

## 2. Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | 75/100 | measured |
| RQ.S.03 | Surface hygiene | 50/100 | measured |
| RQ.S.04 | HNDL posture | 65/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | no MX published | measured |
| RQ.S.07 | Certificate validity | 94 days (2027-02-14) | measured |
| RQ.S.08 | security.txt | not published | measured |
| RQ.S.09 | Exposed surface | 1/5 respond | measured |

## 3. Alerts
| # | Level | Finding | Where |
|---|---|---|---|
| A1 | MEDIUM | Classical certificate without a dated plan | www |
| A2 | MEDIUM | Legacy name answering | l••• |

## 4. What to do
| # | Action | Resolves | Effect |
|---|---|---|---|
| H1 | Retire the legacy name or assign it an owner | A2 | -> A |
| H2 | Dated plan for a post-quantum certificate | A1 | grade does not change |
| H3 | Publish security.txt | RQ.S.08 | grade does not change |

## 5. Not measured
- 1 names answered without evidence of the new lock.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- "Not measured" never means "not protected".

## 6. Evidence
- Instrument: rosetta-sondas-envivo/1 · QEX-1.0 · QREADY-NOTA-2
- Measured: 2026-11-12T17:34:15Z
- CT fingerprint: c1b1ac16…ce0e
- Snapshot fingerprint: e6488add…c9f6
- Method: public certificate logs, DNS and TLS handshakes that do not complete a session.

## 7. Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Full report for the domain: https://rosettaquantum.com/q-ready/medicion/?dominio=example.com&sector=retail

rosetta-ficha/1 · Rosetta Quantum · independent measurement · https://rosettaquantum.com/q-ready/medicion/?dominio=example.com&sector=retail
