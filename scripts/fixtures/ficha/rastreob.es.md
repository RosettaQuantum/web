# Ficha Rosetta · Seguridad post-cuántica
**rastreob.example** · Fintech · país no determinado · medido 2026-11-16 18:56 UTC · desde afuera, sin instalar nada

## 01 Veredicto
| ID | Indicador | Valor |
|---|---|---|
| RQ.S.00 | Nota Q-Ready | **B** |
| RQ.S.01 | Índice QEX | 73/100 (tope externo 84) |

Lectura: Su sitio ya usa el candado post-cuántico, pero no se pudo leer su certificado.
Referencia: el dominio .example no indica país; no se compara.
Publicación: privada. El dueño no ha activado su página pública.

## 02 Indicadores
| ID | Indicador | Valor | Tipo |
|---|---|---|---|
| RQ.S.02 | Certificados y PKI | sin dato | no medido |
| RQ.S.03 | Higiene de superficie | 70/100 | medido |
| RQ.S.04 | Postura HNDL | 65/100 | modelo |
| RQ.S.05 | PQC en el borde | 100/100 | medido |
| RQ.S.06 | Correo post-cuántico | sin MX publicado | medido |
| RQ.S.07 | Vigencia del certificado | sin dato | no medido |
| RQ.S.08 | security.txt | no publicado | medido |
| RQ.S.09 | Superficie expuesta | sin nombres sondeados | medido |

medido: observado hoy por la sonda · modelo: valor del sector, no medido en el dominio · no medido nunca significa no protegido

## 03 Alertas
Sin hallazgos.

## 04 Qué hacer
| # | Acción | Resuelve | Efecto en la nota |
|---|---|---|---|
| H1 | Publicar security.txt | — | no cambia |

## 05 No medido
- Certificados y PKI no se pudo medir: sin esa dimensión la nota no puede ser A.
- La postura HNDL es el modelo del sector fintech, no una medición del dominio.
- Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- No medido nunca significa no protegido.

## 06 Evidencia
- Instrumento: rosetta-sondas-envivo/1
- Versiones: QEX-1.0 · QREADY-NOTA-2.1
- Medido: 2026-11-16T18:56:39Z
- Huella CT: a4f6c0d7…713e · 1 cert.
- Huella de la foto: d716bd48…d06b
- Método: CT · DNS · saludos TLS sin sesión

## 07 Límites y siguiente paso
- Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- Informe completo del dominio: https://rosettaquantum.com/es/q-ready/medicion/?dominio=rastreob.example&sector=fintech

rosetta-ficha/1 · Rosetta Quantum · medición independiente
