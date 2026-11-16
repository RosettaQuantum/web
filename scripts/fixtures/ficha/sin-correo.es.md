# Ficha Rosetta · Seguridad post-cuántica
**example.com** · retail · país no determinado · medido 2026-11-12 17:34 UTC

## 1. Veredicto
| ID | Indicador | Valor |
|---|---|---|
| RQ.S.00 | Nota Q-Ready | **B** |
| RQ.S.01 | Índice QEX | 69/100 (tope externo 84) |

Lectura: Candado nuevo en el sitio principal. Quedan nombres públicos sin evidencia del candado nuevo.
Referencia: el dominio .com no indica país; no se compara.
Publicación: privada. El dueño no ha activado su página pública.

## 2. Indicadores
| ID | Indicador | Valor | Tipo |
|---|---|---|---|
| RQ.S.02 | Certificados y PKI | 75/100 | medido |
| RQ.S.03 | Higiene de superficie | 50/100 | medido |
| RQ.S.04 | Postura HNDL | 65/100 | modelo |
| RQ.S.05 | PQC en el borde | 100/100 | medido |
| RQ.S.06 | Correo post-cuántico | sin MX publicado | medido |
| RQ.S.07 | Vigencia del certificado | 94 días (2027-02-14) | medido |
| RQ.S.08 | security.txt | no publicado | medido |
| RQ.S.09 | Superficie expuesta | 1/5 responden | medido |

## 3. Alertas
| # | Nivel | Hallazgo | Dónde |
|---|---|---|---|
| A1 | MEDIA | Certificado clásico sin plan con fecha | www |
| A2 | MEDIA | Nombre de legado que responde | l••• |

## 4. Qué hacer
| # | Acción | Resuelve | Efecto |
|---|---|---|---|
| H1 | Dar de baja o asignar dueño al nombre de legado | A2 | -> A |
| H2 | Plan con fecha para certificado post-cuántico | A1 | no cambia la nota |
| H3 | Publicar security.txt | RQ.S.08 | no cambia la nota |

## 5. No medido
- 1 nombres respondieron sin evidencia del candado nuevo.
- Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- "No medido" nunca significa "no protegido".

## 6. Evidencia
- Instrumento: rosetta-sondas-envivo/1 · QEX-1.0 · QREADY-NOTA-2
- Medido: 2026-11-12T17:34:15Z
- Huella CT: c1b1ac16…ce0e
- Huella de la foto: e6488add…c9f6
- Método: registros públicos de certificados, DNS y saludos TLS que no completan sesión.

## 7. Límites y siguiente paso
- Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- Informe completo del dominio: https://rosettaquantum.com/es/q-ready/medicion/?dominio=example.com&sector=retail

rosetta-ficha/1 · Rosetta Quantum · medición independiente · https://rosettaquantum.com/es/q-ready/medicion/?dominio=example.com&sector=retail
