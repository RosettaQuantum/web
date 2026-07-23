---
title: "El reloj criptográfico: qué cambia si las máquinas cuánticas mantienen su ritmo"
tldr: "La migración de seguridad no es hipotética: NIST finalizó los estándares post-cuánticos (FIPS 203/204/205) en agosto 2024, CNSA 2.0 de la NSA exige PQC en nuevos sistemas de seguridad nacional desde 2027, y NIST IR 8547 depreca RSA-2048/ECC en 2030 y los elimina en 2035. Las encuestas de expertos ubican un computador cuántico criptográficamente relevante en una ventana central 2033–2037. La exposición 'harvest now, decrypt later' aplica a datos cifrados hoy. La ventaja en optimización — lo que nosotros medimos — es una pregunta separada y más difícil."
date: "2026-07-23"
pillar: F
lang: es
slugBase: pqc-standards-clock
sources:
  - { label: "NIST FIPS 203/204/205 (13 ago 2024)", url: "https://csrc.nist.gov/pubs/fips/203/final" }
  - { label: "NIST IR 8547 — transición a PQC (hitos 2030/2035)", url: "https://csrc.nist.gov/pubs/ir/8547/ipd" }
  - { label: "ITECS — guía PQC 2026", url: "https://itecsonline.com/post/post-quantum-cryptography-complete-guide-2026" }
  - { label: "Global Risk Institute — encuestas de timeline de amenaza cuántica", url: "https://globalriskinstitute.org" }
draft: false
---

## Las fechas que ya son casi ley

```
2024-08-13   FIPS 203 (ML-KEM) · 204 (ML-DSA) · 205 (SLH-DSA) finalizados
2026         FIPS 206 (FN-DSA / FALCON) esperado
2027         CNSA 2.0: PQC obligatorio en nuevos sistemas de seguridad nacional de EE.UU.
2030         NIST IR 8547: RSA-2048 y ECC P-256 deprecados
2033–2037    ventana central de expertos para un QC criptográficamente relevante (CRQC)
2035         algoritmos vulnerables a quantum eliminados de los estándares NIST
```

Ninguna de estas fechas depende del marketing. Son estándares y directivas publicados, y fuerzan la migración *independientemente* de cuándo — o si — llega la máquina amenazante. Esa asimetría es toda la historia de la seguridad cuántica: el timeline de defensa está fijado por política; el de ataque es una distribución de probabilidad.

## Por qué la migración no puede esperar a la máquina

**Harvest now, decrypt later.** El texto cifrado capturado hoy puede almacenarse y descifrarse retroactivamente cuando exista un CRQC. Cualquier dato cuya confidencialidad deba sobrevivir a la ventana de amenaza — historias clínicas, secretos de estado, datos financieros y genómicos de largo plazo — está efectivamente ya expuesto si cruza una red bajo RSA/ECC hoy. Las estimaciones sectoriales ponen a la inmensa mayoría de los datos cifrados de salud y clasificados dentro de esa ventana de exposición.

**Las migraciones toman una década.** La propia guía de NIST enmarca la migración criptográfica empresarial en 5–15 años. Los hitos 2030/2035 existen precisamente porque empezar en CRQC-menos-dos-años es empezar tarde.

**El despliegue es medible, y ya empezó.** El intercambio de llaves híbrido post-cuántico ya corre en producción: el rollout híbrido X25519+Kyber de Chrome, PQ3 de Apple en iMessage, y Cloudflare reportando una fracción creciente de conexiones TLS 1.3 en PQC híbrido con expectativa de cobertura mayoritaria a fines de 2026. La dirección está fijada; la cola de rezagados es la superficie de riesgo.

## La matemática de recursos, dicha con honestidad

Un CRQC necesita correr el algoritmo de Shor contra RSA-2048 — un algoritmo *exacto* con ventaja exponencial probada, y por eso la criptografía es el único dominio donde la amenaza cuántica es matemáticamente inambigua. Las estimaciones de recursos vienen cayendo: de ~20 millones de qubits físicos en los análisis influyentes de la era 2019 a menos de 1 millón en papers recientes, por mejor corrección de errores y refinamientos algorítmicos. Las máquinas más grandes de hoy están en los cientos-a-pocos-miles de qubits físicos. La brecha sigue siendo de órdenes de magnitud; el *ritmo* al que caen las estimaciones es el número a vigilar, más que los conteos de qubits.

## La distinción que nuestro ledger existe para imponer

Shor-sobre-RSA es una separación exponencial probada. La optimización — portafolios, ruteo, scheduling, los problemas que nuestros runs miden — no lo es: ahí los candidatos cuánticos pelean contra solvers clásicos fuertes instancia por instancia, y como muestran nuestros propios runs sellados, el lado clásico hoy gana los tamaños que podemos arbitrar exactamente. Tratar "quantum romperá RSA eventualmente" y "quantum acelerará mi portafolio" como el mismo claim es el error de categoría más común de esta industria. Uno tiene un teorema. El otro necesita un ledger.

## Qué no sabemos

Cuándo (o con qué curva de probabilidad) llega realmente un CRQC — citamos encuestas de expertos, no un pronóstico propio. Si los estándares PQC actuales sobreviven al criptoanálisis futuro (FIPS 205 existe precisamente como cobertura). Y qué tan rápido migra la cola de rezagados — la historia con SHA-1 y TLS sugiere: más lento de lo que los estándares asumen.

*Contenido educativo, fechado 2026-07-23. No es asesoría de seguridad; consulta los estándares primarios.*
