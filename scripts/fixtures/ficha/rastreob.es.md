# Ficha Rosetta · Seguridad post-cuántica
**rastreob.example** · Fintech · país no determinado · medido 2026-11-16 18:56 UTC · desde afuera, sin instalar nada

## 01 Veredicto
| ID | Indicador | Valor |
|---|---|---|
| RQ.S.00 | Nota Q-Ready | **B** |
| RQ.S.01 | Índice QEX | 73/100 (tope externo 84) |

Lectura: Su sitio ya usa el candado post-cuántico, pero no se pudo leer su certificado.
Cómo sale la letra: no del QEX. La deciden el candado nuevo, las alertas y que lo sensible esté medido (QREADY-NOTA-2.2); el QEX resume cuatro dimensiones con peso y no fija la letra. Las acciones de «Qué hacer» cambian la letra; el QEX sólo cambia con lo que lista «Puntos por acción».
Referencia: el dominio .example no indica país; no se compara.
Publicación: privada. El dueño no ha activado su página pública.

## 02 Indicadores
| ID | Indicador | Valor | Tipo |
|---|---|---|---|
| RQ.S.02 | Certificados y PKI | sin dato | no medido |
| RQ.S.03 | Higiene de superficie | 70/70 | medido |
| RQ.S.04 | Postura HNDL | 65/100 | modelo |
| RQ.S.05 | PQC en el borde | 100/100 | medido |
| RQ.S.06 | Correo post-cuántico | sin MX publicado | medido |
| RQ.S.07 | Vigencia del certificado | sin dato | no medido |
| RQ.S.08 | security.txt | no publicado | medido |
| RQ.S.09 | Superficie expuesta | sin nombres sondeados | medido |

medido: observado hoy por la sonda · modelo: valor del sector, no medido en el dominio · no medido nunca significa no protegido

| ID | Regla | Dimensión | QEX |
|---|---|---|---|
| RQ.S.02.1 | certificado no leído | sin dato | — |
| RQ.S.02.2 | certificado no leído (informativo) | — | — |
| = RQ.S.02 | peso 0,40 | sin dato | — |
| RQ.S.03 | base de la higiene (máximo 70) | 70 | 17,50 |
| RQ.S.03.1 | TLS 1.3 en el sitio principal | cumple · descuento 0 | 0,00 |
| RQ.S.03.2 | sin nombres no productivos en el registro | cumple · descuento 0 | 0,00 |
| RQ.S.03.3 | 0 nombres de infraestructura en el registro (resta desde 3) | cumple · descuento 0 | 0,00 |
| RQ.S.03.4 | sin nombres de legado en el registro | cumple · descuento 0 | 0,00 |
| RQ.S.03.5 | security.txt no publicado (informativo) | — | — |
| = RQ.S.03 | peso 0,25 | 70/70 | 17,50 |
| RQ.S.04 | modelo del sector fintech | 65 | 16,25 |
| RQ.S.04.1 | años que el dato del sector debe seguir secreto | sin dato | — |
| RQ.S.04.2 | años que toma migrar en el sector | sin dato | — |
| RQ.S.04.3 | margen de Mosca | sin dato | — |
| = RQ.S.04 | peso 0,25 | 65/100 | 16,25 |
| RQ.S.05.1 | soporta X25519MLKEM768 | 100 | 10,00 |
| RQ.S.05.2 | lo elige por defecto (informativo) | sí | — |
| RQ.S.05.3 | lo tiene en todos los nombres que responden (informativo) | sí | — |
| = RQ.S.05 | peso 0,10 | 100/100 | 10,00 |
| = RQ.S.01 | suma de los aportes sobre peso 0,60 |  | 43,75 / 0,60 → 73 |

Máximo alcanzable desde afuera: 83,75 → 84.
QEX sin el modelo HNDL del sector (sólo lo medido): 79. El índice publicado sigue siendo 73.

## 03 Alertas
Sin hallazgos.

## 04 Qué hacer
| # | Acción | Resuelve | Efecto en la nota |
|---|---|---|---|
| H1 | Publicar security.txt | — | no cambia |

## 05 No medido
- Certificados y PKI no se pudo medir: sin esa dimensión la nota no puede ser A.
- La postura HNDL es el modelo del sector fintech, no una medición del dominio: tabla por sector fijada en la edición 2026-08; la derivación no está publicada.
- Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- No medido nunca significa no protegido.

## 06 Evidencia
- Instrumento: rosetta-sondas-envivo/1
- Versiones: QEX-1.0 · QREADY-NOTA-2.2
- Medido: 2026-11-16T18:56:39Z
- Huella CT: a4f6c0d7…713e · 1 cert.
- Huella de la foto: d716bd48…d06b
- Método: CT · DNS · saludos TLS sin sesión
- Rúbrica: https://rosettaquantum.com/es/metodologia/qex

## 07 Límites y siguiente paso
- Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- Informe completo del dominio: https://rosettaquantum.com/es/q-ready/medicion/?dominio=rastreob.example&sector=fintech

rosetta-ficha/1 · Rosetta Quantum · medición independiente
