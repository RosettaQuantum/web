# Ficha Rosetta · Seguridad post-cuántica
**example.com** · Retail · país no determinado · medido 2026-11-12 17:34 UTC · desde afuera, sin instalar nada

## 01 Veredicto
| ID | Indicador | Valor |
|---|---|---|
| RQ.S.00 | Nota Q-Ready | **B** |
| RQ.S.01 | Índice QEX | 69/100 (tope externo 84) |

Lectura: Su sitio ya usa el candado post-cuántico, pero un nombre que responde no muestra el candado nuevo.
Referencia: el dominio .com no indica país; no se compara.
Publicación: privada. El dueño no ha activado su página pública.

## 02 Indicadores
| ID | Indicador | Valor | Tipo |
|---|---|---|---|
| RQ.S.02 | Certificados y PKI | 75/100 | medido |
| RQ.S.03 | Higiene de superficie | 50/70 | medido |
| RQ.S.04 | Postura HNDL | 65/100 | modelo |
| RQ.S.05 | PQC en el borde | 100/100 | medido |
| RQ.S.06 | Correo post-cuántico | sin MX publicado | medido |
| RQ.S.07 | Vigencia del certificado | 94 días · 2027-02-14 | medido |
| RQ.S.08 | security.txt | no publicado | medido |
| RQ.S.09 | Superficie expuesta | 1/5 sensibles responden | medido |

medido: observado hoy por la sonda · modelo: valor del sector, no medido en el dominio · no medido nunca significa no protegido

| ID | Regla | Dimensión | QEX |
|---|---|---|---|
| RQ.S.02.1 | RSA-2048 = mínimo vigente | 75 | 30,00 |
| RQ.S.02.2 | vigencia: 94 días, hasta 2027-02-14 (informativo) | — | — |
| RQ.S.02.3 | sin plan con fecha para certificado post-cuántico (informativo) | — | — |
| = RQ.S.02 | peso 0,40 | 75/100 | 30,00 |
| RQ.S.03 | base de la higiene (máximo 70) | 70 | 17,50 |
| RQ.S.03.1 | TLS 1.3 en el sitio principal | 0 | 0,00 |
| RQ.S.03.2 | 3 nombres no productivos en el registro | −10 | −2,50 |
| RQ.S.03.3 | 1 nombre de infraestructura en el registro (resta desde 3) | 0 | 0,00 |
| RQ.S.03.4 | 1 nombre de legado en el registro | −10 | −2,50 |
| RQ.S.03.5 | security.txt no publicado (informativo) | — | — |
| = RQ.S.03 | peso 0,25 | 50/70 | 12,50 |
| RQ.S.04 | modelo del sector retail | 65 | 16,25 |
| RQ.S.04.1 | años que el dato del sector debe seguir secreto | sin dato | — |
| RQ.S.04.2 | años que toma migrar en el sector | sin dato | — |
| RQ.S.04.3 | margen de Mosca | sin dato | — |
| = RQ.S.04 | peso 0,25 | 65/100 | 16,25 |
| RQ.S.05.1 | soporta X25519MLKEM768 | 100 | 10,00 |
| RQ.S.05.2 | lo elige por defecto (informativo) | — | — |
| RQ.S.05.3 | no lo tiene en todos los nombres que responden (informativo) | — | — |
| = RQ.S.05 | peso 0,10 | 100/100 | 10,00 |
| = RQ.S.01 | suma de los aportes |  | 68,75 → 69 |

Máximo alcanzable desde afuera: 83,75 → 84.

## 03 Alertas
| # | Nivel | Hallazgo | Dónde |
|---|---|---|---|
| A1 | MEDIA | Certificado clásico sin plan con fecha | www.example.com |
| A2 | MEDIA | Nombre de legado que responde | l•••.example.com |

## 04 Qué hacer
| # | Acción | Resuelve | Efecto en la nota |
|---|---|---|---|
| H1 | Dar de baja o asignar dueño a l•••.example.com | A2 | -> A |
| H2 | Plan con fecha para certificado post-cuántico | A1 | no cambia |
| H3 | Publicar security.txt | — | no cambia |

## 05 No medido
- 1 nombres respondieron sin evidencia del candado nuevo.
- La postura HNDL es el modelo del sector retail, no una medición del dominio: tabla por sector fijada en la edición 2026-08; la derivación no está publicada.
- Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- No medido nunca significa no protegido.

## 06 Evidencia
- Instrumento: rosetta-sondas-envivo/1
- Versiones: QEX-1.0 · QREADY-NOTA-2.1
- Medido: 2026-11-12T17:34:15Z
- Huella CT: c1b1ac16…ce0e · 4022 cert.
- Huella de la foto: e6488add…c9f6
- Método: CT · DNS · saludos TLS sin sesión
- Rúbrica: https://rosettaquantum.com/es/metodologia/qex

## 07 Límites y siguiente paso
- Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- Informe completo del dominio: https://rosettaquantum.com/es/q-ready/medicion/?dominio=example.com&sector=retail
- Con H1 hecho, la próxima medición debería dar A.

rosetta-ficha/1 · Rosetta Quantum · medición independiente
