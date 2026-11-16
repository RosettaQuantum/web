# Ficha Rosetta · Seguridad post-cuántica
**ejemplo.cl** · banca · CL · medido 2026-11-12 17:34 UTC

## 1. Veredicto
| ID | Indicador | Valor |
|---|---|---|
| RQ.S.00 | Nota Q-Ready | **A** |
| RQ.S.01 | Índice QEX | 56/100 (tope externo 84) |

Lectura: Candado nuevo en el sitio y en todos los nombres públicos que respondieron. Es la nota máxima que se puede dar desde afuera.
Referencia: mediana de banca en Chile 57/100 (12 organizaciones, edición 2026-08); diferencia -1.
Publicación: pública en https://rosettaquantum.com/es/verificado/ejemplo.cl

## 2. Indicadores
| ID | Indicador | Valor | Tipo |
|---|---|---|---|
| RQ.S.02 | Certificados y PKI | 75/100 | medido |
| RQ.S.03 | Higiene de superficie | 50/100 | medido |
| RQ.S.04 | Postura HNDL | 12/100 | modelo |
| RQ.S.05 | PQC en el borde | 100/100 | medido |
| RQ.S.06 | Correo post-cuántico | 1/1 MX | medido |
| RQ.S.07 | Vigencia del certificado | 94 días (2027-02-14) | medido |
| RQ.S.08 | security.txt | publicado | medido |
| RQ.S.09 | Superficie expuesta | 2/5 responden | medido |

## 3. Alertas
| # | Nivel | Hallazgo | Dónde |
|---|---|---|---|
| A1 | MEDIA | Certificado clásico sin plan con fecha | www |
| A2 | MEDIA | Nombre de legado que responde | legacy |
| A3 | MEDIA | Servicio de correo que responde en el puerto 443 | mail |

## 4. Qué hacer
| # | Acción | Resuelve | Efecto |
|---|---|---|---|
| H1 | Dar de baja o asignar dueño al nombre de legado | A2 | no cambia la nota |
| H2 | Cerrar el puerto 443 en el servicio de correo | A3 | no cambia la nota |
| H3 | Plan con fecha para certificado post-cuántico | A1 | no cambia la nota |

## 5. No medido
- Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- "No medido" nunca significa "no protegido".

## 6. Evidencia
- Instrumento: rosetta-sondas-envivo/1 · QEX-1.0 · QREADY-NOTA-2
- Medido: 2026-11-12T17:34:15Z
- Huella CT: 9d938f1f…d28f
- Huella de la foto: f0c71112…acdd
- Método: registros públicos de certificados, DNS y saludos TLS que no completan sesión.

## 7. Límites y siguiente paso
- Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- Página pública del dominio: https://rosettaquantum.com/es/verificado/ejemplo.cl

rosetta-ficha/1 · Rosetta Quantum · medición independiente · https://rosettaquantum.com/es/verificado/ejemplo.cl
