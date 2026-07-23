---
title: "Cómo corremos el mismo problema en ambos tipos de computador"
tldr: "Cada run de Rosetta ejecuta una instancia dos veces: una en un algoritmo cuántico, otra en un solver clásico industrial, bajo presupuestos idénticos. Hoy el lado cuántico corre en simuladores de vector de estado (CPU, Linux en la nube); el clásico corre OR-Tools CP-SAT en la misma máquina. Las QPUs reales vía proveedores cloud entran a la escalera después — simular primero es una decisión metodológica deliberada, no una limitación que escondamos."
date: "2026-07-23"
pillar: D
lang: es
slugBase: how-we-run-both-sides
sources:
  - { label: "RosettaQuantum/evidence — harness + runs sellados", url: "https://github.com/RosettaQuantum/evidence" }
  - { label: "Documentación PennyLane", url: "https://pennylane.ai" }
  - { label: "Google OR-Tools", url: "https://developers.google.com/optimization" }
draft: false
---

## El pipeline, de punta a punta

```
instancia (con semilla) ──► formulación QUBO ──► ambos lados, mismo presupuesto
                                                  │
              ┌───────────────────────────────────┼──────────────────────────┐
              ▼                                   ▼                          ▼
     BANCO CLÁSICO                      BANCO CUÁNTICO               ÁRBITRO (n chico)
     OR-Tools CP-SAT               QUBO → Hamiltoniano Ising         fuerza bruta:
     (QUBO linealizado,            → circuito QAOA (PennyLane)       óptimo exacto,
     prueba optimalidad)           → optimizar params → muestrear    verdad de referencia
              │                                   │                          │
              └────────────► veredicto + sello (sha256) ◄────────────────────┘
                             triple archivo: GitHub · Codeberg · D1
```

Ningún paso es exótico. La disciplina es el producto: misma instancia, mismo presupuesto de tiempo, semillas fijas, versiones congeladas, todo registrado.

## En qué hardware, concretamente

**El lado clásico** corre donde viven los solvers clásicos en el mundo real: una CPU común. Usamos CP-SAT de Google OR-Tools — un solver de restricciones industrial que un banco o una minera despliega de verdad — con los términos cuadráticos del QUBO linealizados en productos booleanos. A los tamaños actuales no solo encuentra buenas respuestas: *prueba* optimalidad.

**El lado cuántico** corre, hoy, en simulación de vector de estado: el backend `default.qubit` de PennyLane sobre CPU, en un contenedor Linux en la nube. Un simulador sigue exactamente las 2ⁿ amplitudes del estado cuántico — 12 qubits son 4.096 números complejos, 16 qubits son 65.536, y el costo se duplica con cada qubit. Ese muro exponencial es la razón por la que la simulación se agota alrededor de los treinta y tantos qubits en hardware común — y también, irónicamente, el argumento más limpio de por qué el hardware cuántico podría importar algún día.

**El árbitro**, a tamaños chicos, es fuerza bruta: enumerar cada candidato y tomar el óptimo verdadero. Ninguno de los dos lados corrige su propia prueba.

## Por qué simular primero en vez de arrendar una QPU real

No es costo — existen niveles gratuitos. Es método. Un simulador es *sin ruido y determinista dada una semilla*, lo que significa que cada brecha que medimos hoy es atribuible al **algoritmo** (la calidad de aproximación de QAOA a poca profundidad), no al ruido del hardware. Eso separa dos preguntas que la gente confunde constantemente: "¿el algoritmo es bueno?" y "¿el hardware es suficientemente bueno para correrlo?". Respondemos la primera antes de tocar la segunda.

Las QPUs reales — máquinas superconductoras y de iones atrapados accesibles vía proveedores cloud como Amazon Braket e IBM Quantum — entran a la escalera *después* de que exista la línea base del simulador, en tiempo futuro hasta que ocurra. Cuando ocurra, la brecha con hardware ruidoso se medirá contra la brecha del simulador sin ruido, y ambas van al ledger.

## Qué no publicamos, deliberadamente

Las recetas exactas de generación de instancias más allá de sus semillas y parámetros (quien controla las instancias controla la honestidad del benchmark — publicamos lo suficiente para reproducir, y rotamos generadores a medida que crece la serie), y tooling interno que no afecta la reproducibilidad. Todo lo necesario para re-correr un archivo sellado — semilla, parámetros, versiones, código del harness — es público.

## Qué no sabemos

Cómo se trasladan nuestras brechas medidas en simulador al hardware con ruido — eso es una medición, no un supuesto, y está en la escalera. Y si CP-SAT sigue probando optimalidad rápido en los tamaños donde el arbitraje por fuerza bruta se vuelve intratable; cuando el árbitro se retire, el scoring del protocolo cambia explícitamente, y documentaremos el cambio.

*Contenido educativo que describe nuestra metodología publicada. Archivos sellados: EXP-0012-001 y -002.*
