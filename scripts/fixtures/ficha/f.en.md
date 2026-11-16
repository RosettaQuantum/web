# Rosetta Fact Sheet · Post-quantum security
**ejemplo.com.py** · Banking · Paraguay · measured 2026-11-12 17:34 UTC · from outside, nothing installed

## 01 Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **F** |
| RQ.S.01 | QEX index | 56/100 (external cap 84) |

Reading: Your site already uses the post-quantum lock, but it has a test environment exposed to the internet.
Reference: no index for Paraguay; no comparison.
Publication: private. The owner has not activated its public page.

## 02 Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | 75/100 | measured |
| RQ.S.03 | Surface hygiene | 50/100 | measured |
| RQ.S.04 | HNDL posture | 12/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | 0/4 MX | measured |
| RQ.S.07 | Certificate validity | 94 days · 2027-02-14 | measured |
| RQ.S.08 | security.txt | not published | measured |
| RQ.S.09 | Exposed surface | 3/5 sensitive respond | measured |

measured: observed today by the probe · model: sector value, not measured on the domain · not measured never means not protected

## 03 Alerts
| # | Level | Finding | Where |
|---|---|---|---|
| A1 | SERIOUS | Exposed test environment | s•••#a2.ejemplo.com.py |
| A2 | MEDIUM | Classical certificate without a dated plan | www.ejemplo.com.py |
| A3 | MEDIUM | Legacy name answering | l•••.ejemplo.com.py |
| A4 | MEDIUM | Mail service answering on port 443 | m•••.ejemplo.com.py |

## 04 What to do
| # | Action | Resolves | Effect on the grade |
|---|---|---|---|
| H1 | Take s•••#a2.ejemplo.com.py off the internet | A1 | -> B |
| H2 | Retire l•••.ejemplo.com.py or assign it an owner | A3 | no change |
| H3 | Close port 443 on m•••.ejemplo.com.py | A4 | -> A |
| H4 | Dated plan for a post-quantum certificate | A2 | no change |
| H5 | Publish security.txt | — | no change |
| H6 | Ask the email provider for a date for the hybrid key exchange | RQ.S.06 | no change |

## 05 Not measured
- crt.sh did not respond; Cert Spotter was used (4022 certificates, 77 names).
- 2 names answered without evidence of the new lock.
- HNDL posture is the banking sector model, not a measurement of the domain.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- Not measured never means not protected.

## 06 Evidence
- Instrument: rosetta-sondas-envivo/1
- Versions: QEX-1.0 · QREADY-NOTA-2.1
- Measured: 2026-11-12T17:34:15Z
- CT fingerprint: f00b5266…7d86 · 4022 cert.
- Snapshot fingerprint: 5c1eaafd…e046
- Method: CT · DNS · TLS handshakes without a session

## 07 Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Full report for the domain: https://rosettaquantum.com/q-ready/medicion/?dominio=ejemplo.com.py&sector=banca
- With H1 to H3 done, the next measurement should give A.

rosetta-ficha/1 · Rosetta Quantum · independent measurement
