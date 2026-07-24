---
title: "V-0012: el primer veredicto real del ledger es un 'todavía no' — a propósito"
tldr: "El Evidence Ledger ya tiene su primer veredicto real y medido. Receta RQ-0012 (optimización de portafolios, QAOA p=2 vs CP-SAT): TODAVÍA NO — el clásico alcanzó el óptimo exacto probado en los 20 runs sellados a n=12/16/20; sin punto de cruce observado, sin tendencia de tamaño defendible. Sellado como V-0012 (sha256:f510eff6…6636), respaldado por 20 archivos de runs en triple copia verificada. La entrada demo que reemplaza ya no está; el contador dice 1 veredicto publicado, con honestidad."
date: "2026-07-24"
pillar: A
lang: es
slugBase: verdict-v0012
sources:
  - { label: "Veredicto sellado V-0012 + 20 archivos de runs, RosettaQuantum/evidence", url: "https://github.com/RosettaQuantum/evidence" }
  - { label: "El Evidence Ledger (en vivo)", url: "https://rosettaquantum.com/es/ledger" }
draft: false
---

## Qué cambió hoy

Desde el día uno, nuestro ledger público llevó entradas ilustrativas claramente marcadas como demo — vistas previas de la estructura de un veredicto. Hoy se cae la primera marca de agua. **RQ-0012 · Constrained portfolio compression** muestra ahora un veredicto real, respaldado por 20 runs sellados, reproducibles y en triple archivo:

```
veredicto  TODAVÍA NO — gana el clásico en cada tamaño medido
alcance    QAOA p=2 (sim CPU sin ruido) vs OR-Tools CP-SAT
           presupuestos iguales de 120 s · óptimo exacto de árbitro
evidencia  n=12: 8 seeds · brecha 48.2% ± 22.5
           n=16: 8 seeds · brecha 25.1% ± 11.1
           n=20: 4 seeds · brecha 41.1% ± 14.1
           CP-SAT: óptimo probado, 20/20
cruce      no observado — sin tendencia defendible a n≤20
sello      V-0012 · sha256:f510eff6…6636 · triple copia + OTS
```

## Por qué publicar una derrota primero es todo el punto

Una autoridad de verificación que debuta con una victoria invita una sola pregunta: conveniente, ¿no? Debutar con una *derrota* rigurosamente medida — publicada, sellada, reproducible — establece lo único que importa en esta etapa: **que el árbitro canta lo que midió.** Cuando en este ledger aparezca eventualmente un "gana", será creíble precisamente porque este "todavía no" vino primero.

## Qué es un veredicto, y qué no es

Un veredicto es una fotografía fechada del estado medido, no una sentencia final. V-0012 dice: a estos tamaños, con esta profundidad de receta, bajo estos presupuestos, en un simulador sin ruido — lo cuántico no le gana a un baseline clásico fuerte, y nada de lo medido sugiere que esté cerca. La serie continúa (más semillas, n más grandes, circuitos más profundos, luego hardware con ruido), y cualquier revisión futura sale como un veredicto sellado nuevo que referencia a este. Nada se edita.

## Qué no sabemos

Dónde — o si — esta familia de recetas cruza a tamaños más allá de nuestro rango de arbitraje exacto; cómo el ruido mueve estas brechas en QPUs reales; y si circuitos más profundos cambian el cuadro dentro de presupuestos honestos. Cada una es una medición en la escalera, y cada una aterriza aquí cuando esté sellada.

*Contenido medido de los archivos sellados V-0012 y EXP-0012-001…020. Rosetta Quantum publica veredictos con datos crudos reproducibles — empezando por el que lo cuántico pierde.*
