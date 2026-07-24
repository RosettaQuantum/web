---
title: "Runs 009–020: n=20 entra a la escalera, y la curva se niega a ser una línea"
tldr: "Doce runs sellados nuevos: 8 semillas ya en n=12 y n=16, y las primeras cuatro en n=20 (donde la optimización por gradientes chocó con un muro de memoria y el protocolo cambió a COBYLA sin gradientes — registrado en cada archivo). Brechas medias de QAOA: 48.2%±22.5 a n=12, 25.1%±11.1 a n=16, 41.1%±14.1 a n=20 — no monótono, sin tendencia limpia de tamaño. CP-SAT: óptimo probado en los 20 runs acumulados, pero su tiempo de prueba creció de 0.05 s (n=12) a ~29 s (n=20). Veredicto, en todos los tamaños: todavía no."
date: "2026-07-24"
pillar: D
lang: es
slugBase: run-scale-batch
sources:
  - { label: "Archivos sellados EXP-0012-009 … -020, RosettaQuantum/evidence", url: "https://github.com/RosettaQuantum/evidence/tree/main/runs/2026/07" }
  - { label: "Runs 001–008 (línea base y tanda de varianza previas)" }
draft: false
---

## El estado de la serie, con 20 runs

```
tamaño  seeds  brecha QAOA al óptimo        CP-SAT
n=12      8    22.0 ─────────── 86.5   media 48.2  σ 22.5    óptimo, ~0.05–0.26 s
n=16      8     9.6 ─────── 42.3       media 25.1  σ 11.1    óptimo, ~1.0–1.4 s
n=20      4    24.3 ──────── 58.5      media 41.1  σ 14.1    óptimo, ~28–30 s
```

Tres tamaños, veinte runs sellados, una constante: **CP-SAT encontró el óptimo exacto probado todas y cada una de las veces.** Veredicto en todos los tamaños: todavía no.

## Los dos hallazgos honestos

**1. La curva brecha-vs-tamaño no es una línea.** La brecha media bajó de n=12 a n=16 y volvió a subir en n=20. Con dispersiones de 10–23 puntos por tamaño, no vemos todavía ninguna tendencia de tamaño defendible en ninguna dirección. Quien hubiera ajustado una historia con los dos primeros tamaños — como el run 002 nos tentó — estaría equivocado al run 020. La densidad le gana a la narrativa; la serie continúa.

**2. El costo de prueba del lado clásico sube rápido.** El tiempo de CP-SAT para *probar* optimalidad creció ~25× por cada +4 activos (0.05 s → 1.3 s → 29 s). Sigue trivialmente dentro del presupuesto — pero este es el número que eventualmente decidirá dónde el arbitraje exacto se vuelve difícil, y ya está en el registro para cada tamaño.

## Un cambio de protocolo, declarado

A n=20, retropropagar gradientes a través de un vector de estado de 2²⁰ amplitudes excedió la memoria de nuestro contenedor y mató el proceso en silencio. El arreglo: a n≥20 el optimizador cambia a **COBYLA (sin gradientes, solo evaluaciones forward)** bajo el mismo presupuesto de tiempo. Cada archivo de n=20 lo registra en su `scope_note` y en el campo del optimizador. Cambiar una perilla sin declararla es como se pudren los benchmarks; declarada, es solo ingeniería.

## Qué no sabemos

Si la no-monotonicidad es estructura real o todavía ruido de muestra chica (más semillas y n=24 lo dirán). Cómo afecta COBYLA-vs-Adam la comparabilidad entre tamaños — el optimizador ahora es parte de lo que se mide, y por eso queda registrado por run. Y dónde la curva de tiempo de prueba de CP-SAT cruza a "impracticable" para el arbitraje exacto — cuando ocurra, el scoring del protocolo cambia explícitamente y documentaremos el cambio.

*Contenido medido de los archivos sellados EXP-0012-001 … -020. Rosetta Quantum publica veredictos con datos crudos reproducibles — incluidos los que se niegan a hacer un gráfico ordenado.*
