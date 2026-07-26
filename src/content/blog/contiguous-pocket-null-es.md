---
title: "El nulo equivocado está inflando todo el campo: los sitios alostéricos son bolsillos contiguos, no residuos independientes"
tldr: "Las predicciones de sitios alostéricos se puntúan preguntando si los residuos verdaderos rankean mejor que el azar — y ese 'azar' casi siempre se modela como residuos independientes sorteados al voleo. Pero un sitio alostérico real es UN bolsillo contiguo: sus residuos están correlacionados espacialmente, el n efectivo es mucho menor que el número de residuos, y toda prueba que suponga independencia infla la significancia. Construimos el nulo correcto — permutar bolsillos distales contiguos del mismo tamaño, 2.000 permutaciones — y lo aplicamos primero a nuestro propio método CTQW. Los z aparentes de hasta |4,64| colapsan a |z| < 1,2. Bajo el nulo honesto nada es significativo: ni nuestra caminata cuántica, ni difusión, ni GNM, ANM, betweenness o closeness, en ninguna de las tres dianas, con todos los p entre 0,15 y 0,85. La prueba pareada sobre la rejilla congelada de 18 configuraciones da cero celdas con p < 0,05 en las tres dianas. Sellado como EXP-0007-017. Publicamos el instrumento, no un puntaje — y el primer veredicto del instrumento va en contra nuestra."
date: "2026-07-26"
pillar: D
lang: es
slugBase: contiguous-pocket-null
sources:
  - { label: "Archivo sellado EXP-0007-017 — nulo espacial contiguo", url: "https://github.com/RosettaQuantum/evidence/tree/main/runs/2026/07" }
  - { label: "Salida cruda de permutaciones spatial_null.json (sha256:3914def6…c08f61)", url: "https://raw.githubusercontent.com/RosettaQuantum/evidence/main/data/2026/07/spatial_null.json" }
  - { label: "Salida cruda de la prueba pareada paired_null.json (sha256:43015a13…9664b3)", url: "https://raw.githubusercontent.com/RosettaQuantum/evidence/main/data/2026/07/paired_null.json" }
  - { label: "Evidence ledger de Rosetta — RQ-0007, 19 runs sellados", url: "https://rosettaquantum.com/es/ledger" }
  - { label: "ProDy (estructura y modelos de red)", url: "http://prody.csb.pitt.edu" }
draft: false
---

## La pregunta

Alguien afirma que su método encuentra sitios alostéricos. ¿Cómo sabes que le ganó al azar?

La respuesta estándar es un percentil: tomas los residuos del sitio alostérico verdadero, miras en qué posición los rankeó el método entre todos los residuos distales, promedias, y comparas ese percentil medio contra 50. Si el sitio verdadero cae en percentil 70 y hay un centenar de residuos candidatos, el número se ve impresionante y el paper se escribe solo.

Esa comparación está mal, y está mal de una forma que hace que casi todos los métodos de este campo se vean mejores de lo que son.

## Por qué el nulo habitual está roto

```
lo que la prueba habitual   cada residuo es un sorteo independiente
supone                      → n_efectivo ≈ n_distal  (cientos)
                            → el error estándar queda diminuto
                            → un corrimiento de 10 puntos sobre 50
                              se vuelve "significativo"

lo que un sitio             UN bolsillo contiguo en el espacio 3-D
alostérico es               → sus residuos se tocan entre sí
                            → comparten el mismo entorno local de red,
                              el mismo enterramiento, el mismo grado,
                              lo mismo en todo
                            → n_efectivo ≈ 1 bolsillo, no k residuos
```

Un sitio alostérico no es una muestra aleatoria de residuos. Es un único objeto espacialmente conectado, y el puntaje de uno de sus residuos predice muy bien el puntaje de sus vecinos. Promediar k números correlacionados no te da la precisión de k independientes. Si supones independencia, el error estándar por el que divides es demasiado chico — por un factor que crece con lo correlacionado que esté el bolsillo.

La consecuencia no es sutil. Fabrica descubrimientos. Y, simétricamente, fabrica condenas: un método que cae bajo 50 queda marcado como significativamente *anti*-predictivo cuando en realidad es ruido.

## El instrumento

```
hipótesis nula      el bolsillo verdadero no está mejor ubicado, según el
                    ranking de este método, que cualquier otro bolsillo
                    distal contiguo del mismo tamaño

permutación         se sortea un residuo distal como semilla
                    se toman sus k-1 vecinos distales más cercanos
                    (k = tamaño del sitio verdadero)
                    → un bolsillo aleatorio con tamaño, contigüidad y
                      restricción distal apareados
                    2.000 permutaciones, semilla 20260717

variante pareada    se puntúa la DIFERENCIA cuántico-menos-clásico contra
                    el mismo nulo. Mucha menos varianza: ambos propagadores
                    comparten grafo, residuo fuente y ventana temporal, así
                    que todo salvo el propagador mismo se cancela.
                    5.000 permutaciones × 18 configs de la rejilla congelada

aplicado a          CTQW · difusión · GNM · ANM · betweenness · closeness
                    sobre KRAS G12C, BCR-ABL1 y miosina cardíaca
                    ground truth: los mismos sitios geométricos de
                    EXP-0007-013/014/015
```

Todo acá queda fijo antes de mirar los datos: el cutoff (8,5 Å), la ventana (0,5–8,0), el umbral distal, la definición del sitio, el número de permutaciones y la semilla. La rejilla es la misma de 18 configuraciones congeladas que usamos desde el primer run molecular.

## Qué le pasa a los números

<figure style="margin:1.5em 0">
<svg viewBox="0 0 640 300" role="img" aria-label="Los z aparentes bajo un nulo i.i.d. colapsan bajo el nulo de bolsillo contiguo: ANM en BCR-ABL1 de 4,64 a 1,18; GNM en miosina cardíaca de 2,95 a 0,87; nuestro propio CTQW en KRAS de 2,60 a 1,02; GNM en BCR-ABL1 de 2,14 a 0,49; CTQW en BCR-ABL1 de 1,65 a 0,37; closeness en KRAS de 1,62 a 0,75. Ninguno alcanza la línea de significancia 1,96 bajo el nulo correcto." style="width:100%;height:auto;background:#1F1C18;border-radius:4px">
  <text x="24" y="30" fill="#F4EEDF" font-size="15" font-weight="600" font-family="Instrument Sans, sans-serif">|z| bajo el nulo i.i.d. → |z| bajo el nulo de bolsillo contiguo</text>
  <text x="24" y="49" fill="#B5AC99" font-size="11" font-family="IBM Plex Mono, monospace">2.000 permutaciones · tamaño, contigüidad y restricción distal apareados · semilla 20260717</text>
  <line x1="190" y1="62" x2="190" y2="248" stroke="#3D372F" stroke-width="1"/>
  <line x1="350.7" y1="62" x2="350.7" y2="248" stroke="#D9B87A" stroke-width="1" stroke-dasharray="3 3"/>
  <text x="356" y="72" fill="#D9B87A" font-size="10" font-family="IBM Plex Mono, monospace">|z| = 1,96</text>
  <text x="190" y="264" fill="#6E675C" font-size="10" text-anchor="middle" font-family="IBM Plex Mono, monospace">0</text>
  <text x="272" y="264" fill="#6E675C" font-size="10" text-anchor="middle" font-family="IBM Plex Mono, monospace">1</text>
  <text x="354" y="264" fill="#6E675C" font-size="10" text-anchor="middle" font-family="IBM Plex Mono, monospace">2</text>
  <text x="436" y="264" fill="#6E675C" font-size="10" text-anchor="middle" font-family="IBM Plex Mono, monospace">3</text>
  <text x="518" y="264" fill="#6E675C" font-size="10" text-anchor="middle" font-family="IBM Plex Mono, monospace">4</text>
  <text x="600" y="264" fill="#6E675C" font-size="10" text-anchor="middle" font-family="IBM Plex Mono, monospace">5</text>

  <text x="24" y="99" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">ANM · BCR-ABL1</text>
  <line x1="286.8" y1="95" x2="570.5" y2="95" stroke="#3D372F" stroke-width="2"/>
  <circle cx="570.5" cy="95" r="5" fill="#8C4A3F"/><circle cx="286.8" cy="95" r="5" fill="#4DC4B5"/>
  <text x="24" y="125" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">GNM · miosina</text>
  <line x1="261.3" y1="121" x2="431.9" y2="121" stroke="#3D372F" stroke-width="2"/>
  <circle cx="431.9" cy="121" r="5" fill="#8C4A3F"/><circle cx="261.3" cy="121" r="5" fill="#4DC4B5"/>
  <text x="24" y="151" fill="#D9B87A" font-size="11" font-family="IBM Plex Mono, monospace">CTQW · KRAS (nuestro)</text>
  <line x1="273.6" y1="147" x2="403.2" y2="147" stroke="#3D372F" stroke-width="2"/>
  <circle cx="403.2" cy="147" r="5" fill="#8C4A3F"/><circle cx="273.6" cy="147" r="5" fill="#4DC4B5"/>
  <text x="24" y="177" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">GNM · BCR-ABL1</text>
  <line x1="230.2" y1="173" x2="365.5" y2="173" stroke="#3D372F" stroke-width="2"/>
  <circle cx="365.5" cy="173" r="5" fill="#8C4A3F"/><circle cx="230.2" cy="173" r="5" fill="#4DC4B5"/>
  <text x="24" y="203" fill="#D9B87A" font-size="11" font-family="IBM Plex Mono, monospace">CTQW · BCR-ABL1 (nuestro)</text>
  <line x1="220.3" y1="199" x2="325.3" y2="199" stroke="#3D372F" stroke-width="2"/>
  <circle cx="325.3" cy="199" r="5" fill="#8C4A3F"/><circle cx="220.3" cy="199" r="5" fill="#4DC4B5"/>
  <text x="24" y="229" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">closeness · KRAS</text>
  <line x1="251.5" y1="225" x2="322.8" y2="225" stroke="#3D372F" stroke-width="2"/>
  <circle cx="322.8" cy="225" r="5" fill="#8C4A3F"/><circle cx="251.5" cy="225" r="5" fill="#4DC4B5"/>

  <circle cx="200" cy="285" r="5" fill="#8C4A3F"/>
  <text x="212" y="289" fill="#B5AC99" font-size="10" font-family="IBM Plex Mono, monospace">aparente, residuos i.i.d.</text>
  <circle cx="386" cy="285" r="5" fill="#4DC4B5"/>
  <text x="398" y="289" fill="#B5AC99" font-size="10" font-family="IBM Plex Mono, monospace">real, bolsillos contiguos</text>
</svg>
<figcaption style="color:#6E675C;font-size:0.85em">Medido, archivo sellado EXP-0007-017. Cada puntaje aparente se encoge por un factor de entre 2 y 4. Ninguno sobrevive la línea de significancia.</figcaption>
</figure>

El efecto aparente más grande de toda la matriz es ANM sobre BCR-ABL1, |z| = 4,64. Leído a través del supuesto de independencia eso es un p-valor de unas pocas partes por millón — un resultado, publicable, del tipo de número que hace que un método se adopte. Bajo el nulo correcto la misma medición da p = 0,85: el bolsillo verdadero queda cómodamente dentro de la distribución de bolsillos contiguos aleatorios. No pasó nada.

El mismo colapso nos pega a nosotros. Nuestra propia caminata cuántica sobre KRAS G12C se ve como z = −2,60, que bajo la prueba ingenua se leería como *significativamente peor que el azar*. Bajo el nulo contiguo es −1,02 — ruido sin gracia, en una matriz llena de ruido sin gracia.

## El resultado honesto: nada es significativo, para nadie

Seis métodos × tres dianas, y el veredicto es uniforme.

Todos los p-valores de las dieciocho celdas caen entre 0,15 y 0,85. Ningún método separa el bolsillo alostérico verdadero de un bolsillo contiguo aleatorio del mismo tamaño en ninguna de las tres dianas. Eso incluye los baselines clásicos basados en estructura en los que este campo confía (GNM, ANM, betweenness, closeness), el propagador clásico de difusión, y nuestra caminata cuántica de tiempo continuo.

La prueba pareada es todavía más estricta, porque elimina la estructura compartida y pregunta solo si el propagador cuántico rankea mejor el bolsillo verdadero que el clásico sobre el *mismo* grafo, fuente y ventana. Sobre la rejilla congelada completa — 18 configuraciones por diana, 5.000 permutaciones cada una, 54 celdas en total — el número de celdas que alcanza p < 0,05 es **cero**:

```
KRAS G12C          Δ medio  −18,01 pts   z̄ −1,19    0/18 configs a favor    p̃ 0,85
BCR-ABL1           Δ medio   −1,10 pts   z̄ −0,17   10/18 configs a favor    p̃ 0,49
miosina cardíaca   Δ medio   +5,84 pts   z̄ +0,58   18/18 configs a favor    p̃ 0,26
                                                   ─────────────────────────────────
                                                   0/54 celdas con p < 0,05
```

La miosina cardíaca es el único lugar donde el lado cuántico va adelante en cada una de las configuraciones de la rejilla. Tampoco es significativo. Esa es la lectura honesta, y no la vamos a maquillar: un signo consistente a lo largo de 18 configuraciones correlacionadas de la misma diana es una observación, no dieciocho.

## Cuántas dianas harían falta para zanjarlo

El tamaño de efecto de la miosina es d = +0,589. Si ese efecto es real, el número de dianas independientes necesarias para detectarlo es un cálculo directo:

```
dianas para p < 0,05     8
dianas para p < 0,01    16
tenemos                  3

combinado sobre las tres dianas:  d = −0,196,  z de Stouffer = −0,34
```

Es decir: el conjunto de validación del propio reto — tres dianas con efector co-cristalizado y un ground truth defendible — es demasiado chico para resolver la única señal que parece estar ahí. Eso no es un reclamo contra el reto. Es la medición, y va en el registro igual que iría cualquier resultado.

## Por qué publicamos el instrumento en vez de un puntaje

Todos los competidores de este track van a reportar un número. La mayoría de esos números va a estar calculada contra un nulo que supone residuos independientes, porque esa es la convención, y la convención infla. Nuestra contribución no es otro número en esa pila — es el instrumento que te dice cuáles de los números de la pila son reales.

Lo corrimos primero sobre nosotros mismos, y nos quitó el resultado. Ese es el punto. Un instrumento de medición que solo apuntas a los demás no es un instrumento de medición; es un instrumento retórico. El valor de este nulo es precisamente que es indiferente a quién lo construyó.

Hay una segunda razón, más callada. Si hubiéramos corrido la prueba ingenua, nuestro número de KRAS habría salido z = −2,60 y habríamos tenido que publicar "nuestro método cuántico es significativamente peor que el azar". El nulo correcto nos protege también de esa condena falsa — y aun así no encontramos nada. Ambos hechos están en el archivo.

## Verifícalo tú mismo

Las salidas de permutación se publican crudas, no resumidas: `spatial_null.json` (sha256:3914def6…c08f61) y `paired_null.json` (sha256:43015a13…9664b3), junto con el harness `paired_null.py` (sha256:6f53f3a6…fdc88f) y `spatial_null.py` (sha256:61194e2e…d173c5) que las produjeron. El archivo del run EXP-0007-017 lleva content hash sha256:ff29769b…7a43df, está almacenado en triple copia y anclado a Bitcoin vía OpenTimestamps.

Vuelve a correrlo con la misma semilla y obtendrás las mismas 2.000 permutaciones. Cambia la semilla y los p-valores se moverán en el tercer decimal y en ningún otro lado. Apunta el instrumento a tu propio método y te tratará exactamente como nos trató a nosotros.
