---
title: "¿Puede la computación cuántica descubrir nuevas drogas hoy?"
tldr: "No como sugieren los titulares. A julio 2026 no se ha demostrado ventaja cuántica en drug discovery a escala útil. La contribución creíble de corto plazo es angosta — simular la estructura electrónica de moléculas fuertemente correlacionadas que los métodos clásicos aproximan mal — y aun eso corre dentro de un pipeline clásico liderado por AlphaFold y el docking industrial. Entra dinero ($12.6B a startups cuánticas en 2025), las demos son reales (un genoma viral codificado en hardware de IBM; simulaciones híbridas de complejos proteicos de más de 12,000 átomos), pero todavía no existe un benchmark head-to-head estandarizado contra las mejores herramientas clásicas. Probamos una tarea cercana nosotros mismos — 19 corridas selladas de ranking de sitios alostéricos — y bajo un nulo honesto, nada fue significativo."
date: "2026-07-29"
pillar: A
lang: es
slugBase: quantum-drug-discovery
draft: false
sources:
  - { label: "McKinsey Quantum Technology Monitor 2026 — a commercial tipping point", url: "https://www.mckinsey.com/capabilities/mckinsey-technology/our-insights/mckinsey-quantum-technology-monitor-2026-a-commercial-tipping-point" }
  - { label: "Quantum-machine-assisted drug discovery — npj Drug Discovery (2025)", url: "https://www.nature.com/articles/s44386-025-00033-2" }
  - { label: "Quantum computing in transition — editorial de Nature Biotechnology (6 jul 2026)", url: "https://www.nature.com/articles/s41587-026-03233-x" }
  - { label: "AlphaFold — predicción de estructura de proteínas de alta precisión (Jumper et al., Nature 2021)", url: "https://www.nature.com/articles/s41586-021-03819-2" }
---

**Estado a: julio 2026.** El veredicto de abajo es medido, no afirmado: los claims externos van con fuente y fecha, y el negativo del final se apoya en 19 corridas selladas que cualquiera puede re-correr.

Respuesta corta: **todavía no** — y la versión honesta de esa respuesta es más útil que el hype o que el desprecio. El descubrimiento de drogas es la aplicación con que más se vende la computación cuántica, y es también aquella donde el caso creíble es _más angosto_. Las dos cosas son verdad a la vez.

## ¿Qué se está afirmando en realidad?

El argumento físico es real y específico: las moléculas **son** sistemas cuánticos, así que un computador cuántico puede, en principio, computar su estructura electrónica directamente, donde los métodos clásicos deben aproximar. Eso importa sobre todo en **sistemas fuertemente correlacionados** — catalizadores de metales de transición, ciertos estados excitados, intermediarios de reacción — que las aproximaciones clásicas como DFT modelan mal. Es el caso de viabilidad más fuerte de todo el campo, porque es el único lugar donde el problema es nativamente cuántico. No es el claim de que "lo cuántico diseñará tu droga".

## ¿Qué está probado hoy?

La ventaja no. Las demostraciones que existen son reales pero quedan por debajo de la vara de _ganarle a la mejor herramienta clásica en el mismo problema_. Un editorial de Nature Biotechnology de 2026 cataloga el progreso genuino: un genoma del virus de la hepatitis D codificado y analizado en hardware cuántico de IBM, y simulaciones híbridas cuántico-clásicas de complejos proteicos de más de 12,000 átomos — las mayores reportadas. IBM llama a 2026 el "punto de inflexión" de la ventaja híbrida; eso es una predicción de vendor, fechada y en el registro, no un resultado establecido. El propio contrapeso del editorial es directo: los dispositivos de hoy son ruidosos (NISQ), sin corrección de errores, y los métodos híbridos "probablemente no escalen bien al número de qubits requerido" para los problemas moleculares que más se beneficiarían.

CUANTICO EN EL STACK DE DROGAS · JUL 2026IA CLASICA — AlphaFold, docking, generativoEN PRODUCCIONDEMOS HIBRIDAS — genoma, sim de 12k atomosDEMOSTRADO · SIN VENTAJAVENTAJA ELECTRONICA CON TOLERANCIA A FALLOSPLAUSIBLE · NO PROBADOancho de barra = madurez, no puntaje de benchmark

## ¿Qué hace ya el clásico — muy bien?

Casi todo lo que la gente imagina como "IA para descubrir drogas" es **clásico**, no cuántico. AlphaFold predijo la estructura de proteínas desde la secuencia — un problema de 50 años — con deep learning y sin un solo qubit. El docking, el virtual screening y el diseño generativo de moléculas son clásicos y ya están en producción. La foto revisada por pares coincide: la revisión de 2025 en npj Drug Discovery enmarca los métodos cuánticos como **evaluadores complementarios** de la estructura electrónica local, anidados dentro de pipelines clásicos, no como reemplazos. Su admisión más reveladora es sobre la medición — "benchmarks cuánticos estandarizados corridos en hardware a escala CASF-2016, CrossDocked2020 o PoseBusters todavía no están disponibles", y **no** ofrece ninguna comparación directa que le gane a caballos de batalla clásicos como AutoDock Vina, DiffDock o Gnina. Sin benchmark compartido, no hay ventaja demostrada.

## ¿Dónde estaría la ventaja real de lo cuántico?

Angosta y profunda, no ancha: los casos de estructura electrónica donde la precisión clásica se rompe. Ese es el claim defendible, y el único que vale la pena hacer — no "lo cuántico hace drug discovery", sino "para esta clase específica de molécula, un método cuántico computa una energía que los métodos clásicos calculan mal, verificado sobre la misma instancia". Los algoritmos fuertes que lo entregarían (quantum phase estimation) necesitan corrección de errores con tolerancia a fallos que no existe a escala; los de corto plazo (VQE) están topados por el ruido. Plausible y no probado — justo el tipo de afirmación que hay que medir, no creer.

## ¿Qué medimos nosotros mismos?

Corrimos lo más cercano que pudimos sellar de punta a punta: **19 corridas selladas** rankeando sitios alostéricos en proteínas reales — hemoglobina, caspasa-3, KRAS G12C, BCR-ABL1, miosina cardíaca y una predicción ciega sobre c-Myc — enfrentando una caminata cuántica de tiempo continuo contra difusión clásica sobre el grafo de contactos de residuos. Dos hallazgos, ambos negativos, ambos el punto. Primero, en el set temprano el propagador clásico lideró 8–4 y sus victorias eran estables mientras las de la caminata cuántica no: al perturbar el cutoff de contacto, las "victorias cuánticas" desaparecían. Segundo, y más importante en lo metodológico: el nulo que todos usan — barajar residuos de forma independiente — **infla el z-score entre dos y cuatro veces**, porque los residuos alostéricos verdaderos viven en un bolsillo contiguo, no dispersos al azar. Al cambiar por el nulo espacial correcto (permutar bolsillos distales contiguos del mismo tamaño), el mayor |z| sobre cada diana y cada método fue **1.18**. Nada alcanzó significancia; ninguna diana cruzó siquiera un p < 0.15 indulgente.

PRUEBA PROPIA · RANKING ALOSTERICO · 19 RUNSref p=0.05 · z≈1.64~2-4x infladonulo i.i.d.max |z| 1.18nulo bolsillocorridas simuladas, sin ruido — favorece al lado cuantico; aun sin senal

El impuesto de honestidad de ese gráfico: nuestras corridas son **simuladas y sin ruido**, lo que favorece al lado cuántico, ya que el hardware real solo agrega error. Aun con ese dedo en la balanza, no hay señal. Así se ve un "todavía no" cuando de verdad lo instrumentas.

## Qué no sabemos

No sabemos el tamaño de molécula de cruce donde un método cuántico de estructura electrónica le ganaría por primera vez a la mejor aproximación clásica sobre el mismo sistema — nadie lo ha publicado con evidencia. No sabemos si la predicción del "punto de inflexión" de IBM para 2026 se cumplirá; es un claim, no un resultado. No hicimos benchmark de lo cuántico contra pipelines clásicos de _drug discovery_ head-to-head — nuestras 19 corridas miden ranking de sitios alostéricos, una tarea relacionada pero más angosta, y un nulo ahí no es prueba de un nulo en todas partes. Y el propio campo revisado por pares concede que el benchmark decisivo (corrido en hardware, a escala PoseBusters/CASF, contra Vina/DiffDock) todavía no existe. Cuando exista, va al ledger con datos crudos — incluso si va en contra nuestra.

_Contenido educativo, no un claim de producto. Rosetta Quantum publica veredictos con datos crudos reproducibles — incluidos los negativos._
