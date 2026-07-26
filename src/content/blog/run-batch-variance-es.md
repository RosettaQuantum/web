---
title: "Runs 003–008: la varianza disuelve la tendencia (y eso es el sistema funcionando)"
tldr: "Corrimos 3 semillas nuevas por tamaño. A n=12 la brecha de QAOA va de 23.4% a 53.7% (media ≈40.9%); a n=16, de 20.7% a 42.3% (media ≈28.8%). Los rangos se solapan: el aparente 'la brecha se achica con el tamaño' del run 002 no sobrevive la medición. CP-SAT llegó al óptimo probado en los 8 runs acumulados. Veredicto, todos: todavía no. Seis archivos sellados, EXP-0012-003 a -008."
date: "2026-07-23"
pillar: D
lang: es
slugBase: run-batch-variance
sources:
  - { label: "Archivos sellados EXP-0012-003 … -008, RosettaQuantum/evidence", url: "https://github.com/RosettaQuantum/evidence" }
  - { label: "Runs 001–002 (los dos puntos previos)" }
draft: false
---

## Por qué existió esta tanda

El run 002 mostró una brecha menor a n=16 que a n=12 (20.7% vs 42.8%) y nos negamos explícitamente a llamarlo tendencia: una semilla por tamaño, varianza sin medir. Esta tanda mide esa varianza — tres semillas frescas (43, 44, 45) por tamaño, protocolo congelado byte a byte: mismos presupuestos, misma profundidad, mismo solver, óptimo exacto como árbitro.

## El resultado

<figure style="margin:1.5em 0">
<svg viewBox="0 0 640 300" role="img" aria-label="Brecha de QAOA al óptimo exacto en cuatro semillas por tamaño. n=12: 23.4 a 53.7 por ciento, media 40.9. n=16: 20.7 a 42.3 por ciento, media 28.8. Los rangos se solapan." style="width:100%;height:auto;background:#1F1C18;border-radius:4px">
  <text x="24" y="34" fill="#F4EEDF" font-size="15" font-weight="600" font-family="Instrument Sans, sans-serif">QAOA p=2 · brecha al óptimo exacto · 4 semillas por tamaño</text>
  <text x="24" y="54" fill="#B5AC99" font-size="12" font-family="IBM Plex Mono, monospace">seeds 42–45 · presupuestos iguales de 120 s · CP-SAT: óptimo probado en los 8 runs</text>
  <line x1="80" y1="210" x2="600" y2="210" stroke="#3D372F" stroke-width="1"/>
  <text x="76" y="214" fill="#B5AC99" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">0%</text>
  <line x1="80" y1="70" x2="600" y2="70" stroke="#3D372F" stroke-width="1" stroke-dasharray="3 4"/>
  <text x="76" y="74" fill="#6E675C" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">60%</text>
  <text x="230" y="242" fill="#B5AC99" font-size="12" text-anchor="middle" font-family="IBM Plex Mono, monospace">n=12</text>
  <text x="470" y="242" fill="#B5AC99" font-size="12" text-anchor="middle" font-family="IBM Plex Mono, monospace">n=16</text>
  <circle cx="222" cy="110.1" r="5" fill="#4DC4B5"/><circle cx="238" cy="84.7" r="5" fill="#4DC4B5"/>
  <circle cx="222" cy="108.0" r="5" fill="#4DC4B5"/><circle cx="238" cy="155.4" r="5" fill="#4DC4B5"/>
  <line x1="205" y1="114.6" x2="255" y2="114.6" stroke="#D9B87A" stroke-width="2.5"/>
  <text x="262" y="88" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">máx 53.7%</text>
  <text x="262" y="159" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">mín 23.4%</text>
  <text x="150" y="119" fill="#D9B87A" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">media 40.9%</text>
  <circle cx="462" cy="161.7" r="5" fill="#4DC4B5"/><circle cx="478" cy="111.3" r="5" fill="#4DC4B5"/>
  <circle cx="462" cy="160.3" r="5" fill="#4DC4B5"/><circle cx="478" cy="137.7" r="5" fill="#4DC4B5"/>
  <line x1="445" y1="142.8" x2="495" y2="142.8" stroke="#D9B87A" stroke-width="2.5"/>
  <text x="502" y="115" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">máx 42.3%</text>
  <text x="502" y="165" fill="#F4EEDF" font-size="11" font-family="IBM Plex Mono, monospace">mín 20.7%</text>
  <text x="440" y="132" fill="#D9B87A" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">media 28.8%</text>
  <text x="24" y="268" fill="#6E675C" font-size="11" font-family="IBM Plex Mono, monospace">puntos teal = semillas individuales · marca dorada = media</text>
  <text x="24" y="284" fill="#6E675C" font-size="11" font-family="IBM Plex Mono, monospace">rangos solapados → efecto tamaño sin resolver con n=4 semillas</text>
</svg>
<figcaption style="color:#6E675C;font-size:0.85em">Resultados medidos, archivos sellados EXP-0012-001 … -008.</figcaption>
</figure>

```
n=12  brechas: 42.8 · 53.7 · 43.7 · 23.4   media 40.9   rango 30.3
n=16  brechas: 20.7 · 42.3 · 21.3 · 31.0   media 28.8   rango 21.6
```

## Qué resuelve la tanda — y qué mata

**Mata la historia del run 002.** "La brecha se achica al crecer la instancia" parecía plausible con una semilla por tamaño. Con cuatro, los rangos se solapan por 19 puntos: la semilla 45 a n=12 (23.4%) le gana a la semilla 43 a n=16 (42.3%). Las medias siguen difiriendo (40.9 vs 28.8), pero con n=4 semillas y esta dispersión, esa diferencia aún no se distingue del ruido. Dijimos que dos puntos definen cualquier historia; aquí está la prueba, a costa nuestra.

**Resuelve que la varianza es de primer orden.** La dispersión semilla-a-semilla de QAOA (~20–30 puntos de brecha) es de la misma magnitud que cualquier efecto de tamaño que podamos aspirar a medir. Todo claim futuro sobre esta curva debe llevar barras de error o es decoración.

**Y una cosa se mantuvo constante en los 8 runs:** CP-SAT encontró el óptimo exacto probado todas y cada una de las veces, en ≈0.1–1.1 s. La vara clásica no se mueve. Así se ve un baseline fuerte.

## Qué no sabemos

Si la brecha media realmente decrece con el tamaño — responderlo necesita más semillas por tamaño (próxima tanda: 10+) y n más grandes. Si circuitos más profundos (p=4) aprietan la dispersión o solo la desplazan. Y cómo se comporta todo esto bajo ruido de hardware. Todo medible; todo en la escalera.

*Contenido medido de los archivos sellados EXP-0012-001 … -008. Rosetta Quantum publica veredictos con datos crudos reproducibles — incluidos los que disuelven nuestras propias observaciones previas.*
