---
title: "Run 001: cómo se ve un benchmark cuántico honesto (y por qué ganó el clásico)"
tldr: "Corrimos nuestra primera pelea real: QAOA (cuántico, simulado) vs OR-Tools CP-SAT (clásico) sobre la misma instancia de portafolio de 12 activos, mismo presupuesto de tiempo, semilla fija. CP-SAT llegó al óptimo exacto en 0.113 s; QAOA quedó a 42.8% en 45 s. Veredicto: todavía no — exactamente lo que la teoría predice a esta escala. El run quedó sellado con hash SHA-256 y archivado por triplicado. Esta es la entrada 001 del catálogo."
date: "2026-07-23"
pillar: D
lang: es
slugBase: run-001-qaoa-vs-cpsat
sources:
  - { label: "Archivo sellado EXP-0012-001 (sha256:d0a207d6…bce6c), RosettaQ evidence ledger" }
  - { label: "Google OR-Tools CP-SAT 9.15", url: "https://developers.google.com/optimization" }
  - { label: "PennyLane 0.45.1", url: "https://pennylane.ai" }
draft: false
---

## Qué corrimos

Una instancia de optimización de portafolio con restricciones — elegir 5 de 12 activos balanceando retorno esperado contra riesgo — codificada como QUBO y entregada a **ambos contendores a la vez**:

- **Lado clásico:** **CP-SAT** de Google OR-Tools, el tipo de solver industrial que un banco corre de verdad.
- **Lado cuántico:** **QAOA** (profundidad p=2), simulado en CPU con PennyLane — 12 activos = 12 qubits.
- **El árbitro:** el *óptimo exacto*, calculado por fuerza bruta (2¹² = 4.096 candidatos). A este tamaño podemos permitirnos la verdad perfecta: nadie corrige su propia prueba.

Misma instancia. Mismo presupuesto de 120 segundos. Semilla 42 en todo. Versiones de librerías congeladas y registradas.

## El resultado

<figure style="margin:1.5em 0">
<svg viewBox="0 0 640 250" role="img" aria-label="Distancia al óptimo exacto: CP-SAT 0 por ciento en 0.113 segundos; QAOA 42.8 por ciento en 45.1 segundos" style="width:100%;height:auto;background:#1F1C18;border-radius:4px">
  <text x="24" y="34" fill="#F4EEDF" font-size="15" font-weight="600" font-family="Instrument Sans, sans-serif">Distancia al óptimo exacto · menor es mejor</text>
  <text x="24" y="54" fill="#B5AC99" font-size="12" font-family="IBM Plex Mono, monospace">portafolio · 12 activos · seed 42 · presupuesto igual de 120 s</text>
  <line x1="170" y1="70" x2="170" y2="188" stroke="#3D372F" stroke-width="1"/>
  <text x="170" y="205" fill="#B5AC99" font-size="11" text-anchor="middle" font-family="IBM Plex Mono, monospace">0% = óptimo exacto (el árbitro)</text>
  <line x1="562" y1="70" x2="562" y2="188" stroke="#3D372F" stroke-width="1" stroke-dasharray="3 4"/>
  <text x="562" y="205" fill="#6E675C" font-size="11" text-anchor="middle" font-family="IBM Plex Mono, monospace">50%</text>
  <text x="24" y="95" fill="#F4EEDF" font-size="13" font-family="Instrument Sans, sans-serif">CP-SAT</text>
  <text x="24" y="111" fill="#B5AC99" font-size="11" font-family="Instrument Sans, sans-serif">clásico</text>
  <rect x="170" y="88" width="6" height="16" rx="2" fill="#D9B87A"/>
  <text x="186" y="101" fill="#F4EEDF" font-size="12" font-family="IBM Plex Mono, monospace">0% — óptimo · 0.113 s</text>
  <text x="24" y="155" fill="#F4EEDF" font-size="13" font-family="Instrument Sans, sans-serif">QAOA p=2</text>
  <text x="24" y="171" fill="#B5AC99" font-size="11" font-family="Instrument Sans, sans-serif">cuántico · sim CPU</text>
  <rect x="170" y="148" width="336" height="16" rx="2" fill="#4DC4B5"/>
  <text x="516" y="161" fill="#F4EEDF" font-size="12" font-family="IBM Plex Mono, monospace">42.8% · 45.1 s</text>
  <text x="24" y="236" fill="#6E675C" font-size="11" font-family="IBM Plex Mono, monospace">PennyLane 0.45.1 · OR-Tools 9.15 · veredicto: todavía no — gana el clásico</text>
</svg>
<figcaption style="color:#6E675C;font-size:0.85em">Resultado medido, archivo sellado EXP-0012-001. No es una ilustración.</figcaption>
</figure>

CP-SAT encontró el portafolio *probadamente óptimo* en una décima de segundo. QAOA, tras 120 pasos de optimización y 2.000 mediciones, entregó un portafolio 42.8% peor que el óptimo — y tardó 400× más en hacerlo.

## Por qué este era el resultado esperado

Nadie serio predice ventaja cuántica en un problema de 12 variables, y nosotros tampoco — el archivo registra nuestra hipótesis textual: *"a 12 activos NO se espera ventaja cuántica; este run fija la línea base del protocolo."* Tres razones por las que el lado clásico domina aquí:

1. **El problema es diminuto.** 4.096 portafolios candidatos no es nada; CP-SAT prueba optimalidad casi instantáneamente.
2. **QAOA a profundidad p=2 es una heurística superficial.** Su calidad de aproximación crece con la profundidad del circuito — y la profundidad es justo lo que escasea, en simuladores y en hardware real.
3. **El baseline es fuerte a propósito.** Ganarle a un solver clásico debilitado es el pecado más común del benchmarking cuántico. Una victoria contra un baseline débil no es una victoria.

## ¿Entonces para qué correrlo?

Porque un ledger de verificación se gana la confianza con sus **no** antes que con sus sí. Este run establece tres activos:

- **El protocolo, en vivo.** Misma instancia, mismo presupuesto, óptimo exacto como árbitro, semillas fijas, versiones congeladas — ahora demostrado de punta a punta, no descrito.
- **La línea base de la curva de cruce.** Cada run futuro — 16 activos, 20, circuitos más profundos, QPUs reales — se compara contra este punto. Dónde (y si) se cierra la brecha *es* el producto.
- **Reproducibilidad radical.** El archivo registra semilla, parámetros de la instancia y versiones. Corre el harness publicado con esos valores y deberías aterrizar en nuestros números. Si no puedes, dínoslo — en público.

## Integridad de esta entrada

El run completo vive en un archivo JSON sellado con `sha256:d0a207d6…bce6c`, guardado simultáneamente en tres lugares (GitHub, Codeberg y nuestra base de datos) que se referencian entre sí. Si el hash de cualquier copia difiere, esa copia no es válida. El archivo responde seis preguntas — qué, cómo, cuándo, dónde, por qué, quién — para que esta entrada pueda auditarse sin confiar en este post.

## Qué no sabemos

Si — y dónde — las recetas de la familia QAOA cruzan a CP-SAT en problemas de portafolio a medida que crecen las instancias: eso es exactamente lo que miden los próximos runs. Tampoco sabemos aún cómo estos resultados de simulador CPU se trasladan a hardware con ruido. Publicaremos ambas cosas, caigan donde caigan.

*Contenido medido del archivo sellado EXP-0012-001. Rosetta Quantum publica veredictos con datos crudos reproducibles — incluidos los que el cuántico pierde.*
