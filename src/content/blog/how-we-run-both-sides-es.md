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

<figure style="margin:1.5em 0;text-align:center">
<svg viewBox="0 0 360 532" role="img" aria-label="Pipeline de punta a punta: una instancia con semilla se convierte en una formulación QUBO que se manda a los tres lados con el mismo presupuesto. Banco clásico: OR-Tools CP-SAT sobre el QUBO linealizado, prueba optimalidad. Banco cuántico: el QUBO pasa a Hamiltoniano de Ising, luego a circuito QAOA en PennyLane, se optimizan los parámetros y se muestrea. Árbitro para n chico: fuerza bruta, óptimo exacto, verdad de referencia. Los tres convergen en un veredicto sellado con sha256 y archivado por triplicado en GitHub, Codeberg y D1." style="width:100%;max-width:430px;height:auto;background:#141210;border:1px solid #3D372F;border-radius:4px">
  <defs>
    <marker id="arrEs" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,0 L8,4 L0,8 z" fill="#6E675C"/>
    </marker>
  </defs>
  <g font-family="'IBM Plex Mono',monospace" fill="#B5AC99">
    <rect x="46" y="10" width="268" height="34" rx="3" fill="#1F1C18" stroke="#3D372F"/>
    <text x="180" y="31" font-size="12" fill="#F4EEDF" text-anchor="middle">instancia (con semilla)</text>
    <line x1="180" y1="44" x2="180" y2="64" stroke="#6E675C" marker-end="url(#arrEs)"/>
    <rect x="46" y="66" width="268" height="48" rx="3" fill="#1F1C18" stroke="#3D372F"/>
    <text x="180" y="87" font-size="12" fill="#F4EEDF" text-anchor="middle">formulación QUBO</text>
    <text x="180" y="104" font-size="10" text-anchor="middle">ambos lados, mismo presupuesto</text>
    <path d="M180,114 V128 H24 V350" fill="none" stroke="#6E675C"/>
    <line x1="24" y1="178" x2="44" y2="178" stroke="#6E675C" marker-end="url(#arrEs)"/>
    <line x1="24" y1="264" x2="44" y2="264" stroke="#6E675C" marker-end="url(#arrEs)"/>
    <line x1="24" y1="350" x2="44" y2="350" stroke="#6E675C" marker-end="url(#arrEs)"/>
    <rect x="46" y="146" width="268" height="64" rx="3" fill="#1F1C18" stroke="#3D372F"/>
    <text x="60" y="167" font-size="11" fill="#F4EEDF" letter-spacing="1">BANCO CLÁSICO</text>
    <text x="60" y="184" font-size="10">OR-Tools CP-SAT (QUBO linealizado)</text>
    <text x="60" y="199" font-size="10">prueba optimalidad</text>
    <rect x="46" y="224" width="268" height="80" rx="3" fill="#1F1C18" stroke="#3D372F"/>
    <text x="60" y="245" font-size="11" fill="#4DC4B5" letter-spacing="1">BANCO CUÁNTICO</text>
    <text x="60" y="262" font-size="10">QUBO → Hamiltoniano Ising</text>
    <text x="60" y="277" font-size="10">→ circuito QAOA (PennyLane)</text>
    <text x="60" y="292" font-size="10">→ optimizar params → muestrear</text>
    <rect x="46" y="318" width="268" height="64" rx="3" fill="#1F1C18" stroke="#3D372F"/>
    <text x="60" y="339" font-size="11" fill="#F4EEDF" letter-spacing="1">ÁRBITRO (n chico)</text>
    <text x="60" y="356" font-size="10">fuerza bruta: óptimo exacto,</text>
    <text x="60" y="371" font-size="10">verdad de referencia</text>
    <path d="M314,178 H336 V412 H180 V420" fill="none" stroke="#6E675C" marker-end="url(#arrEs)"/>
    <path d="M314,264 H336" fill="none" stroke="#6E675C"/>
    <path d="M314,350 H336" fill="none" stroke="#6E675C"/>
    <rect x="46" y="424" width="268" height="38" rx="3" fill="#1F1C18" stroke="#D9B87A"/>
    <text x="180" y="448" font-size="12" fill="#D9B87A" text-anchor="middle">veredicto + sello (sha256)</text>
    <line x1="180" y1="462" x2="180" y2="480" stroke="#6E675C" marker-end="url(#arrEs)"/>
    <rect x="46" y="482" width="268" height="40" rx="3" fill="#1F1C18" stroke="#4DC4B5" stroke-dasharray="3 3"/>
    <text x="180" y="500" font-size="10" fill="#4DC4B5" text-anchor="middle">triple archivo</text>
    <text x="180" y="514" font-size="10" text-anchor="middle">GitHub · Codeberg · D1</text>
  </g>
</svg>
</figure>

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
