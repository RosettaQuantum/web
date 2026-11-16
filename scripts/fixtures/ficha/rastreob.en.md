# Rosetta Fact Sheet · Post-quantum security
**rastreob.example** · Fintech · country not determined · measured 2026-11-16 18:56 UTC · from outside, nothing installed

## 01 Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **B** |
| RQ.S.01 | QEX index | 73/100 (external cap 84) |

Reading: Your site already uses the post-quantum lock, but its certificate could not be read.
Reference: a .example domain does not indicate a country; no comparison.
Publication: private. The owner has not activated its public page.

## 02 Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | no data | not measured |
| RQ.S.03 | Surface hygiene | 70/100 | measured |
| RQ.S.04 | HNDL posture | 65/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | no MX published | measured |
| RQ.S.07 | Certificate validity | no data | not measured |
| RQ.S.08 | security.txt | not published | measured |
| RQ.S.09 | Exposed surface | no names probed | measured |

measured: observed today by the probe · model: sector value, not measured on the domain · not measured never means not protected

## 03 Alerts
No findings.

## 04 What to do
| # | Action | Resolves | Effect on the grade |
|---|---|---|---|
| H1 | Publish security.txt | — | no change |

## 05 Not measured
- Certificates and PKI could not be measured: without that dimension the grade cannot be A.
- HNDL posture is the fintech sector model, not a measurement of the domain.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- Not measured never means not protected.

## 06 Evidence
- Instrument: rosetta-sondas-envivo/1
- Versions: QEX-1.0 · QREADY-NOTA-2.1
- Measured: 2026-11-16T18:56:39Z
- CT fingerprint: a4f6c0d7…713e · 1 cert.
- Snapshot fingerprint: d716bd48…d06b
- Method: CT · DNS · TLS handshakes without a session

## 07 Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Full report for the domain: https://rosettaquantum.com/q-ready/medicion/?dominio=rastreob.example&sector=fintech

rosetta-ficha/1 · Rosetta Quantum · independent measurement
