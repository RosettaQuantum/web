---
title: "Run 002: la curva de cruce gana su segundo punto (que todavía no es tendencia)"
tldr: "La misma pelea, instancia más grande: QAOA p=2 vs OR-Tools CP-SAT en un portafolio de 16 activos, mismo protocolo Juez v1, semilla 42. CP-SAT volvió a llegar al óptimo exacto (1.0 s); QAOA quedó a 20.7% en 97.5 s. Veredicto: todavía no. La brecha es menor que a 12 activos (42.8%) — y explícitamente NO llamamos a eso una tendencia: una semilla por tamaño no prueba nada. Sellado como EXP-0012-002."
date: "2026-07-23"
pillar: D
lang: es
slugBase: run-002-crossover-curve
sources:
  - { label: "Archivo sellado EXP-0012-002 (sha256:b9f9ab48…47fe4), RosettaQuantum/evidence", url: "https://github.com/RosettaQuantum/evidence" }
  - { label: "Archivo sellado EXP-0012-001 (run 001, la línea base)" }
draft: false
---

## Qué cambió desde el run 001

Una sola variable: el tamaño de la instancia. 16 activos en vez de 12 (elegir 7, misma aversión al riesgo y estructura de penalidad, semilla 42). Todo lo demás está congelado por protocolo — mismo presupuesto de 120 s por lado, misma profundidad QAOA (p=2), mismo solver en el banco clásico, mismo árbitro de óptimo exacto (2¹⁶ = 65.536 candidatos, aún abordable por fuerza bruta). Si cambias una sola cosa, aprendes una sola cosa.

## El resultado

<figure style="margin:1.5em 0">
<svg viewBox="0 0 640 270" role="img" aria-label="Brecha de calidad al óptimo exacto por tamaño de instancia: a 12 activos QAOA 42.8 por ciento, a 16 activos 20.7 por ciento; CP-SAT en 0 por ciento en ambos tamaños" style="width:100%;height:auto;background:#1F1C18;border-radius:4px">
  <text x="24" y="34" fill="#F4EEDF" font-size="15" font-weight="600" font-family="Instrument Sans, sans-serif">Brecha de calidad al óptimo exacto · por tamaño de instancia</text>
  <text x="24" y="54" fill="#B5AC99" font-size="12" font-family="IBM Plex Mono, monospace">seed 42 · presupuesto igual de 120 s · una semilla por tamaño — aún no es tendencia</text>
  <line x1="80" y1="200" x2="600" y2="200" stroke="#3D372F" stroke-width="1"/>
  <text x="76" y="204" fill="#B5AC99" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">0%</text>
  <line x1="80" y1="96" x2="600" y2="96" stroke="#3D372F" stroke-width="1" stroke-dasharray="3 4"/>
  <text x="76" y="100" fill="#6E675C" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">50%</text>
  <text x="230" y="222" fill="#B5AC99" font-size="12" text-anchor="middle" font-family="IBM Plex Mono, monospace">12 activos</text>
  <text x="470" y="222" fill="#B5AC99" font-size="12" text-anchor="middle" font-family="IBM Plex Mono, monospace">16 activos</text>
  <line x1="230" y1="111" x2="470" y2="157" stroke="#4DC4B5" stroke-width="2" stroke-dasharray="5 5" opacity="0.5"/>
  <circle cx="230" cy="111" r="6" fill="#4DC4B5"/>
  <circle cx="470" cy="157" r="6" fill="#4DC4B5"/>
  <text x="230" y="95" fill="#F4EEDF" font-size="12" text-anchor="middle" font-family="IBM Plex Mono, monospace">42.8%</text>
  <text x="470" y="141" fill="#F4EEDF" font-size="12" text-anchor="middle" font-family="IBM Plex Mono, monospace">20.7%</text>
  <text x="510" y="161" fill="#B5AC99" font-size="11" font-family="Instrument Sans, sans-serif">QAOA p=2</text>
  <circle cx="230" cy="200" r="6" fill="#D9B87A"/>
  <circle cx="470" cy="200" r="6" fill="#D9B87A"/>
  <text x="510" y="193" fill="#B5AC99" font-size="11" font-family="Instrument Sans, sans-serif">CP-SAT (óptimo)</text>
  <text x="24" y="252" fill="#6E675C" font-size="11" font-family="IBM Plex Mono, monospace">línea punteada = guía visual, NO una tendencia ajustada · tiempos: CP-SAT 1.0 s · QAOA 97.5 s</text>
</svg>
<figcaption style="color:#6E675C;font-size:0.85em">Resultados medidos, archivos sellados EXP-0012-001 y -002. El conector punteado es una ayuda de lectura, no una extrapolación.</figcaption>
</figure>

CP-SAT: probadamente óptimo otra vez, en 1.0 segundo. QAOA: a 20.7% del óptimo tras 70 pasos del optimizador — esta vez la restricción activa fue el presupuesto de tiempo, no el número de pasos (97.5 s de los 120 s; el costo de simulación por paso crece con los qubits). **Veredicto: todavía no — gana el clásico.**

## La lectura honesta de "la brecha se achicó"

A 12 activos la brecha fue 42.8%; a 16, 20.7%. Es tentador trazar una línea entre dos puntos y anunciar que QAOA se acerca a medida que crecen las instancias. Nos negamos, por tres razones:

1. **Una semilla por tamaño.** El paisaje de optimización de QAOA es ruidoso; otra semilla puede mover la brecha considerablemente. La varianza está sin medir hasta que corramos múltiples semillas por tamaño.
2. **Dos puntos definen cualquier historia que quieras.** Una curva se gana el nombre con densidad: más tamaños, más semillas, barras de error.
3. **La restricción activa cambió.** A 16 qubits el optimizador completó 70 de 120 pasos antes del corte de presupuesto — los dos puntos no se produjeron bajo condiciones efectivas idénticas, y el protocolo registra exactamente eso.

Lo que los dos puntos *sí* establecen: el pipeline mide lo que dice medir, a escala creciente, con cada parámetro en el registro.

## Lo que sigue en la escalera

Múltiples semillas a 12 y 16 para medir varianza, y luego 20 activos — donde la fuerza bruta (2²⁰ ≈ 1M) todavía arbitra pero CP-SAT empieza a sentir el tamaño. Cada run sale sellado, en triple copia, con su entrada de biblioteca. Vaya donde vaya la curva, va al registro.

## Qué no sabemos

Si el movimiento de la brecha es señal o suerte de semilla — eso es exactamente lo que responderán los runs multi-semilla. Tampoco sabemos dónde (ni si) las recetas de la familia QAOA cruzan a CP-SAT en esta clase de problema, y nada de lo medido hasta ahora sugiere que esté cerca. Cuando lo sepamos, lo leerás aquí primero — con los datos crudos adjuntos.

*Contenido medido de los archivos sellados EXP-0012-001/-002. Rosetta Quantum publica veredictos con datos crudos reproducibles — incluidos los que el cuántico pierde.*
