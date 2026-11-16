# Rosetta Fact Sheet · Post-quantum security
**ejemplo.com.py** · banking · PY · measured 2026-11-12 17:34 UTC

## 1. Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **F** |
| RQ.S.01 | QEX index | 56/100 (external cap 84) |

Reading: A serious failure was measured: an expired certificate or an exposed test environment.
Reference: no index for Paraguay; no comparison.
Publication: private. The owner has not activated its public page.

## 2. Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | 75/100 | measured |
| RQ.S.03 | Surface hygiene | 50/100 | measured |
| RQ.S.04 | HNDL posture | 12/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | 0/4 MX | measured |
| RQ.S.07 | Certificate validity | 94 days (2027-02-14) | measured |
| RQ.S.08 | security.txt | not published | measured |
| RQ.S.09 | Exposed surface | 3/5 respond | measured |

## 3. Alerts
| # | Level | Finding | Where |
|---|---|---|---|
| A1 | SERIOUS | Exposed test environment | s••• |
| A2 | MEDIUM | Classical certificate without a dated plan | www |
| A3 | MEDIUM | Legacy name answering | l••• |
| A4 | MEDIUM | Mail service answering on port 443 | m••• |

## 4. What to do
| # | Action | Resolves | Effect |
|---|---|---|---|
| H1 | Take the test environment off the internet | A1 | -> B |
| H2 | Retire the legacy name or assign it an owner | A3 | grade does not change |
| H3 | Close port 443 on the mail service | A4 | -> A |
| H4 | Dated plan for a post-quantum certificate | A2 | grade does not change |
| H5 | Publish security.txt | RQ.S.08 | grade does not change |
| H6 | Ask the email provider for a date for the hybrid key exchange | RQ.S.06 | grade does not change |

## 5. Not measured
- crt.sh did not respond; Cert Spotter was used (4022 certificates, 77 names).
- 2 names answered without evidence of the new lock.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- "Not measured" never means "not protected".

## 6. Evidence
- Instrument: rosetta-sondas-envivo/1 · QEX-1.0 · QREADY-NOTA-2
- Measured: 2026-11-12T17:34:15Z
- CT fingerprint: f00b5266…7d86
- Snapshot fingerprint: 5c1eaafd…e046
- Method: public certificate logs, DNS and TLS handshakes that do not complete a session.

## 7. Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Full report for the domain: https://rosettaquantum.com/q-ready/medicion/?dominio=ejemplo.com.py&sector=banca

rosetta-ficha/1 · Rosetta Quantum · independent measurement · https://rosettaquantum.com/q-ready/medicion/?dominio=ejemplo.com.py&sector=banca
