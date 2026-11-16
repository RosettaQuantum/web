# Rosetta Fact Sheet · Post-quantum security
**ejemplo.cl** · banking · CL · measured 2026-11-12 17:34 UTC

## 1. Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **A** |
| RQ.S.01 | QEX index | 56/100 (external cap 84) |

Reading: New lock on the site and on every public name that responded. The highest grade that can be given from outside.
Reference: banking median in Chile 57/100 (12 organizations, edition 2026-08); difference -1.
Publication: public at https://rosettaquantum.com/verificado/ejemplo.cl

## 2. Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | 75/100 | measured |
| RQ.S.03 | Surface hygiene | 50/100 | measured |
| RQ.S.04 | HNDL posture | 12/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | 1/1 MX | measured |
| RQ.S.07 | Certificate validity | 94 days (2027-02-14) | measured |
| RQ.S.08 | security.txt | published | measured |
| RQ.S.09 | Exposed surface | 2/5 respond | measured |

## 3. Alerts
| # | Level | Finding | Where |
|---|---|---|---|
| A1 | MEDIUM | Classical certificate without a dated plan | www |
| A2 | MEDIUM | Legacy name answering | legacy |
| A3 | MEDIUM | Mail service answering on port 443 | mail |

## 4. What to do
| # | Action | Resolves | Effect |
|---|---|---|---|
| H1 | Retire the legacy name or assign it an owner | A2 | grade does not change |
| H2 | Close port 443 on the mail service | A3 | grade does not change |
| H3 | Dated plan for a post-quantum certificate | A1 | grade does not change |

## 5. Not measured
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- "Not measured" never means "not protected".

## 6. Evidence
- Instrument: rosetta-sondas-envivo/1 · QEX-1.0 · QREADY-NOTA-2
- Measured: 2026-11-12T17:34:15Z
- CT fingerprint: 9d938f1f…d28f
- Snapshot fingerprint: f0c71112…acdd
- Method: public certificate logs, DNS and TLS handshakes that do not complete a session.

## 7. Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Public page for the domain: https://rosettaquantum.com/verificado/ejemplo.cl

rosetta-ficha/1 · Rosetta Quantum · independent measurement · https://rosettaquantum.com/verificado/ejemplo.cl
