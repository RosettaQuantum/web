---
title: "¿Puede la computación cuántica descubrir nuevas drogas hoy?"
tldr: "No como sugieren los titulares. La contribución creíble de lo cuántico a la medicina es angosta y real — simular la estructura electrónica de moléculas fuertemente correlacionadas que los métodos clásicos aproximan mal. El descubrimiento de drogas hoy lo lidera la IA clásica (AlphaFold). A julio 2026 no se ha demostrado ventaja cuántica en drug discovery a escala útil — pero la simulación molecular es la frontera donde es más plausible."
date: "2026-07-21"
pillar: A
lang: es
slugBase: quantum-drug-discovery
sources:
  - { label: "AlphaFold — predicción de estructura de proteínas (DeepMind)" }
  - { label: "Quantum Algorithm Zoo — algoritmos de simulación (VQE, QPE)" }
draft: false
---

## La promesa honesta

La razón por la que la computación cuántica se liga a la medicina es real, y es específica: las moléculas *son* sistemas cuánticos, así que un computador cuántico puede, en principio, simular su estructura electrónica directamente — donde los métodos clásicos deben aproximar. Eso importa sobre todo en **sistemas fuertemente correlacionados** (catalizadores de metales de transición, ciertos estados excitados, intermediarios de reacción) que las aproximaciones clásicas como DFT modelan mal.

## Lo que el clásico ya hace — muy bien

Casi todo lo que la gente imagina como "IA para descubrir drogas" es **clásico**, no cuántico. AlphaFold reconfiguró el campo prediciendo la estructura de proteínas desde la secuencia — un problema de 50 años — con deep learning, sin un solo qubit. El docking, el virtual screening y el diseño generativo de moléculas también son clásicos y ya están en producción. Si alguien afirma que se necesita lo cuántico para "hacer drug discovery", la pregunta honesta es: ¿qué agrega sobre AlphaFold más simulación clásica?

## Dónde estaría la ventaja real de lo cuántico

Angosta y profunda, no ancha: los casos de estructura electrónica donde la precisión clásica se rompe. Ese es el claim defendible — y el único que Rosetta hará. No "lo cuántico diseñará tu droga", sino "para esta clase específica de molécula, un método cuántico computa una energía que los métodos clásicos calculan mal".

## Por qué todavía no llega

El hardware cuántico de corto plazo es ruidoso y pequeño. Los algoritmos fuertes (quantum phase estimation) necesitan corrección de errores que no existe a escala; los de corto plazo (VQE) están limitados por el ruido. Así que la ventaja es **plausible y no probada** — justo el tipo de afirmación que hay que medir, no creer.

## Qué mirar

No comunicados de prensa — benchmarks reproducibles sobre moléculas específicas, contra el mejor método clásico, con el tamaño de cruce declarado. Cuando exista uno, estará en el ledger, con los datos crudos. Hasta entonces, la respuesta honesta es: la frontera es real, la llegada todavía no.

*Contenido educativo, no un claim de producto. Rosetta Quantum publica veredictos con datos crudos reproducibles — incluidos los negativos.*
