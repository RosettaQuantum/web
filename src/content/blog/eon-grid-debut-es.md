---
title: "El harness gira a la red: primeros runs reales de expansión de red (clase E.ON)"
tldr: "Apuntamos el mismo protocolo Juez v1 a una nueva clase de problema — expansión de red de distribución, el track de E.ON. Sobre un feeder IEEE case14 estresado con congestión real, un QUBO build/no-build (alivio de congestión medido con flujo de potencia DC real) peleó QAOA p=2 vs OR-Tools CP-SAT. CP-SAT llegó al óptimo probado en ~0.3 s; QAOA quedó a 0.005–3.2% en 3 semillas. Veredicto: todavía no. El plan ganador, validado en flujo AC completo, redujo la sobrecarga real de líneas en 43.5%. Sellado como RQ-0033 / EXP-0033-001…003. Nada del protocolo cambió — solo el problema."
date: "2026-07-24"
pillar: A
lang: es
slugBase: eon-grid-debut
sources:
  - { label: "Archivos sellados EXP-0033-001…003, RosettaQuantum/evidence", url: "https://github.com/RosettaQuantum/evidence/tree/main/runs/2026/07" }
  - { label: "pandapower (motor de red)", url: "https://pandapower.readthedocs.io" }
  - { label: "QOBLIB — Quantum Optimization Benchmark Library (metodología)", url: "https://arxiv.org/abs/2504" }
draft: false
---

## Mismo árbitro, nueva arena

Hasta ahora el ledger medía optimización de portafolios. Esta entrada se mueve a **expansión de red de distribución** — decidir qué líneas nuevas construir para que una red sobrecargada baje su congestión al menor costo. Es un problema combinatorio build/no-build, y es el problem statement de E.ON en el Global Quantum + AI Challenge 2026. El protocolo no cambió: misma instancia, mismo presupuesto de tiempo ambos lados, óptimo exacto de árbitro, semillas fijas, versiones congeladas, sellado en triple copia. Solo el problema es nuevo — que es el punto de un protocolo general.

## Cómo la instancia se funda en física de red real

```
red         IEEE case14, cargas ×3.0, ratings térmicos apretados
            → un feeder sub-dimensionado con congestión genuina
candidatos  14 opciones de build (refuerzos paralelos + líneas nuevas)
modelo      alivio de congestión medido con flujo DC REAL:
            r_i  = alivio de construir la línea i sola     (medido)
            q_ij = alivio(i,j) − r_i − r_j  interacción     (medido)
            → un QUBO cuyos coeficientes vienen de física, no de suposición
árbitro     óptimo exacto sobre 2^14 sets de build (fuerza bruta)
validación  plan ganador re-chequeado en flujo AC completo
```

Ningún coeficiente fue inventado: cada uno se midió corriendo el solver de red. Los términos cuadráticos capturan que dos refuerzos juntos alivian más (o menos) que la suma de sus partes — acoplamiento real de la red.

## El resultado

<figure style="margin:1.5em 0">
<svg viewBox="0 0 640 250" role="img" aria-label="Expansión de red E.ON: CP-SAT en óptimo probado en 0.3s; brechas QAOA 3.2, 0.005, 1.0 por ciento en 3 semillas; reducción de congestión validada en AC 43.5 por ciento" style="width:100%;height:auto;background:#1F1C18;border-radius:4px">
  <text x="24" y="34" fill="#F4EEDF" font-size="15" font-weight="600" font-family="Instrument Sans, sans-serif">Expansión de red E.ON · brecha al óptimo + alivio de congestión real</text>
  <text x="24" y="54" fill="#B5AC99" font-size="12" font-family="IBM Plex Mono, monospace">IEEE case14 estresado · 14 candidatos · presupuesto igual 120 s · 3 semillas</text>
  <line x1="150" y1="72" x2="150" y2="150" stroke="#3D372F" stroke-width="1"/>
  <text x="150" y="167" fill="#B5AC99" font-size="11" text-anchor="middle" font-family="IBM Plex Mono, monospace">0% = óptimo exacto</text>
  <text x="24" y="92" fill="#F4EEDF" font-size="12" font-family="Instrument Sans, sans-serif">CP-SAT</text>
  <rect x="150" y="84" width="6" height="14" rx="2" fill="#D9B87A"/>
  <text x="164" y="95" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">0% — óptimo probado · ~0.3 s (3/3)</text>
  <text x="24" y="120" fill="#F4EEDF" font-size="12" font-family="Instrument Sans, sans-serif">QAOA p=2</text>
  <rect x="150" y="112" width="118" height="14" rx="2" fill="#4DC4B5"/>
  <text x="276" y="123" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">brechas 0.005% · 1.0% · 3.2% · ~95 s</text>
  <rect x="24" y="188" width="592" height="44" rx="3" fill="#100E0B" stroke="#3D372F"/>
  <text x="38" y="206" fill="#B5AC99" font-size="11" font-family="IBM Plex Mono, monospace">Plan validado en AC (5 líneas construidas):</text>
  <text x="38" y="223" fill="#4DC4B5" font-size="12" font-family="IBM Plex Mono, monospace">sobrecarga de líneas 2672.7 → 1509.3  ·  congestión real −43.5%</text>
</svg>
<figcaption style="color:#6E675C;font-size:0.85em">Medido, archivos sellados EXP-0033-001…003. El −43.5% se chequea en flujo AC completo, no en el modelo QUBO.</figcaption>
</figure>

CP-SAT alcanzó el plan de build probadamente óptimo en cerca de un tercio de segundo, en las tres semillas. QAOA se acercó — 0.005% en su mejor caso — pero no ganó a presupuesto igual. **Veredicto: todavía no.** El planificador clásico es fuerte aquí, exactamente como debe ser en un benchmark honesto.

## Por qué el −43.5% importa más que el veredicto

La optimización se decide en un QUBO, pero el *valor* se decide en física. Reconstruimos el plan ganador de 5 líneas en flujo AC completo: la sobrecarga total de líneas cayó de 2672.7 a 1509.3 — una **reducción de congestión del 43.5%** en un feeder genuinamente sobrecargado. Ese es el número que le importa a un planificador de DSO, y está validado fuera del modelo que lo eligió. Venga el plan de lo cuántico o de lo clásico, el ledger reporta lo que de verdad le hace a la red.

## Qué no sabemos

Si el casi-empate de QAOA (0.005% en seed 43) sobrevive en instancias más duras y grandes o es suerte de instancia — los próximos runs escalan la red (case30, case118) y el número de candidatos hacia la escala utility de >100 qubits que apunta el challenge. Cómo diverge el modelo de congestión DC de 2do orden respecto al AC en redes más grandes (publicaremos la brecha). Y si el hardware NISQ, con ruido, sostiene la calidad de QAOA medida en simulador. Cada una es una medición en la escalera.

*Contenido medido de los archivos sellados EXP-0033-001…003. La metodología sigue el enfoque del benchmark QOBLIB citado en el problem statement de E.ON: identificar instancias duras, y luego benchmarkear con honestidad. Rosetta Quantum publica veredictos con datos crudos reproducibles — incluidos los que lo cuántico pierde.*
