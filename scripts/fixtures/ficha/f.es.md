# Ficha Rosetta · Seguridad post-cuántica
**ejemplo.com.py** · Banca · Paraguay · medido 2026-11-12 17:34 UTC · desde afuera, sin instalar nada

## 01 Veredicto
| ID | Indicador | Valor |
|---|---|---|
| RQ.S.00 | Nota Q-Ready | **F** |
| RQ.S.01 | Índice QEX | 56/100 (tope externo 84) |

Lectura: Su sitio ya usa el candado post-cuántico, pero tiene un ambiente de pruebas expuesto a internet.
Referencia: sin índice para Paraguay; no se compara.
Publicación: privada. El dueño no ha activado su página pública.

## 02 Indicadores
| ID | Indicador | Valor | Tipo |
|---|---|---|---|
| RQ.S.02 | Certificados y PKI | 75/100 | medido |
| RQ.S.03 | Higiene de superficie | 50/100 | medido |
| RQ.S.04 | Postura HNDL | 12/100 | modelo |
| RQ.S.05 | PQC en el borde | 100/100 | medido |
| RQ.S.06 | Correo post-cuántico | 0/4 MX | medido |
| RQ.S.07 | Vigencia del certificado | 94 días · 2027-02-14 | medido |
| RQ.S.08 | security.txt | no publicado | medido |
| RQ.S.09 | Superficie expuesta | 3/5 sensibles responden | medido |

medido: observado hoy por la sonda · modelo: valor del sector, no medido en el dominio · no medido nunca significa no protegido

## 03 Alertas
| # | Nivel | Hallazgo | Dónde |
|---|---|---|---|
| A1 | GRAVE | Ambiente de pruebas expuesto | s•••#a2.ejemplo.com.py |
| A2 | MEDIA | Certificado clásico sin plan con fecha | www.ejemplo.com.py |
| A3 | MEDIA | Nombre de legado que responde | l•••.ejemplo.com.py |
| A4 | MEDIA | Servicio de correo que responde en el puerto 443 | m•••.ejemplo.com.py |

## 04 Qué hacer
| # | Acción | Resuelve | Efecto en la nota |
|---|---|---|---|
| H1 | Sacar de internet s•••#a2.ejemplo.com.py | A1 | -> B |
| H2 | Dar de baja o asignar dueño a l•••.ejemplo.com.py | A3 | no cambia |
| H3 | Cerrar el puerto 443 en m•••.ejemplo.com.py | A4 | -> A |
| H4 | Plan con fecha para certificado post-cuántico | A2 | no cambia |
| H5 | Publicar security.txt | — | no cambia |
| H6 | Pedir al proveedor de correo fecha para el intercambio híbrido | RQ.S.06 | no cambia |

## 05 No medido
- crt.sh no respondió; se usó Cert Spotter (4022 certificados, 77 nombres).
- 2 nombres respondieron sin evidencia del candado nuevo.
- La postura HNDL es el modelo del sector banca, no una medición del dominio.
- Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- No medido nunca significa no protegido.

## 06 Evidencia
- Instrumento: rosetta-sondas-envivo/1
- Versiones: QEX-1.0 · QREADY-NOTA-2.1
- Medido: 2026-11-12T17:34:15Z
- Huella CT: f00b5266…7d86 · 4022 cert.
- Huella de la foto: 5c1eaafd…e046
- Método: CT · DNS · saludos TLS sin sesión

## 07 Límites y siguiente paso
- Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- Informe completo del dominio: https://rosettaquantum.com/es/q-ready/medicion/?dominio=ejemplo.com.py&sector=banca
- Con H1 a H3 hechos, la próxima medición debería dar A.

rosetta-ficha/1 · Rosetta Quantum · medición independiente
