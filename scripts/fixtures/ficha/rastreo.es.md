# Ficha Rosetta · Seguridad post-cuántica
**rastreo.example** · Fintech · país no determinado · medido 2026-11-16 18:55 UTC · desde afuera, sin instalar nada

## 01 Veredicto
| ID | Indicador | Valor |
|---|---|---|
| RQ.S.00 | Nota Q-Ready | **F** |
| RQ.S.01 | Índice QEX | 61/100 (tope externo 84) |

Lectura: Su sitio todavía no usa el candado post-cuántico y tiene un ambiente de pruebas expuesto a internet.
Referencia: el dominio .example no indica país; no se compara.
Publicación: privada. El dueño no ha activado su página pública.

## 02 Indicadores
| ID | Indicador | Valor | Tipo |
|---|---|---|---|
| RQ.S.02 | Certificados y PKI | 75/100 | medido |
| RQ.S.03 | Higiene de superficie | 60/100 | medido |
| RQ.S.04 | Postura HNDL | 65/100 | modelo |
| RQ.S.05 | PQC en el borde | 0/100 | medido |
| RQ.S.06 | Correo post-cuántico | sin dato | no medido |
| RQ.S.07 | Vigencia del certificado | 82 días · 2027-02-06 | medido |
| RQ.S.08 | security.txt | no publicado | medido |
| RQ.S.09 | Superficie expuesta | 4/4 sensibles responden | medido |

medido: observado hoy por la sonda · modelo: valor del sector, no medido en el dominio · no medido nunca significa no protegido

## 03 Alertas
| # | Nivel | Hallazgo | Dónde |
|---|---|---|---|
| A1 | GRAVE | Ambiente de pruebas expuesto | s•••.rastreo.example |
| A2 | ALTA | Infraestructura sensible que responde | c•••.rastreo.example |
| A3 | MEDIA | Ambiente de pruebas publicado con el acceso bloqueado | serverless-s•••.rastreo.example |
| A4 | MEDIA | Certificado clásico sin plan con fecha | www.rastreo.example |
| A5 | MEDIA | Servicio de correo que responde en el puerto 443 | w•••.rastreo.example |

## 04 Qué hacer
| # | Acción | Resuelve | Efecto en la nota |
|---|---|---|---|
| H1 | Sacar de internet s•••.rastreo.example | A1 | -> D |
| H2 | Activar X25519MLKEM768 en www.rastreo.example | RQ.S.05 | -> C |
| H3 | Cerrar o restringir por IP c•••.rastreo.example | A2 | -> B |
| H4 | Retirar de internet serverless-s•••.rastreo.example | A3 | no cambia |
| H5 | Cerrar el puerto 443 en w•••.rastreo.example | A5 | -> A |
| H6 | Plan con fecha para certificado post-cuántico | A4 | no cambia |
| H7 | Publicar security.txt | — | no cambia |

## 05 No medido
- El cifrado del correo no se midió en esta foto.
- La postura HNDL es el modelo del sector fintech, no una medición del dominio.
- Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- No medido nunca significa no protegido.

## 06 Evidencia
- Instrumento: rosetta-sondas-envivo/1
- Versiones: QEX-1.0 · QREADY-NOTA-2.1
- Medido: 2026-11-16T18:55:47Z
- Huella CT: e5b89749…3a86 · 1 cert.
- Huella de la foto: 6886b050…9447
- Método: CT · DNS · saludos TLS sin sesión

## 07 Límites y siguiente paso
- Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- Informe completo del dominio: https://rosettaquantum.com/es/q-ready/medicion/?dominio=rastreo.example&sector=fintech
- Con H1 a H5 hechos, la próxima medición debería dar A.

rosetta-ficha/1 · Rosetta Quantum · medición independiente
