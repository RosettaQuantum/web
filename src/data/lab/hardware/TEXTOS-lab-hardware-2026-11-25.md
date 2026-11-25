# Textos de /lab/hardware · aprobados el 25-nov-2026

Los doce textos de la página «El mismo circuito, dos máquinas», aprobados por Nicholas el
25-nov-2026 («Sí, apruebo los 12»), en los dos idiomas y tal cual. El orden es el aprobado:
«lo que esto no es» va arriba, justo después de la bajada, y no al pie.

Las cifras entre llaves NO están aquí: las pone el generador leyendo los archivos sellados de la
medición. Un texto con una cifra escrita a mano no sería un texto aprobado, sería una cifra sin
procedencia.

## es

- **titulo:** El mismo circuito, dos máquinas
- **bajada:** Un circuito cuántico de 4 qubits, ejecutado en un simulador exacto y en un computador cuántico real. El mismo archivo, con la misma huella, en las dos máquinas.
- **no_es:** Esto no es el algoritmo de Shor completo, y no rompe ninguna llave. Es el paso que extrae el período, que es su corazón. No hay módulo, no hay mensaje y no hay secreto.
- **que_se_mide:** De los 16 resultados posibles, sólo cuatro son correctos — y cuáles son se sabe por matemática, antes de encender nada. Lo que se mide es cuántos de los 1.000 disparos cayeron en esos cuatro.
- **columna_a:** Simulador exacto
- **columna_b:** Computador cuántico real · {maquina}
- **rotulo_cifra:** aciertos de 1.000
- **azar:** Una máquina respondiendo al azar acertaría 250. Por eso este número va siempre acompañado: sin él, un valor bajo se lee como «casi funcionó» cuando no aportó nada.
- **profundidad:** El circuito entra con profundidad {prof_original} y la máquina lo ejecuta con {prof_transpilada}: tiene que traducirlo a sus compuertas nativas y rutearlo entre qubits que no están todos conectados. Esa diferencia es la que se come la fidelidad.
- **rsa:** Para una llave RSA de 2.048 bits, el circuito de Shor pide 4.096 multiplicaciones modulares controladas y 4.096 qubits de conteo, contra los {qubits_maquina} que tiene esta máquina. Eso es aritmética —2 × 2.048—, no una extrapolación desde esta medición.
- **procedencia:** Trabajo {job_id} en {maquina} · {hora_utc} UTC · circuito sha256 {sha_circuito} · preregistro {prereg_id}, congelado el {hora_sello} UTC, antes de medir.
- **no_es_de_ahora:** Este resultado se midió el {fecha}. No es de este momento.

## en

- **titulo:** The same circuit, two machines
- **bajada:** A 4-qubit quantum circuit, run on an exact simulator and on a real quantum computer. The same file, with the same fingerprint, on both machines.
- **no_es:** This is not the complete Shor algorithm, and it breaks no key. It is the step that extracts the period, which is its core. There is no modulus, no message and no secret.
- **que_se_mide:** Of the 16 possible outcomes, only four are correct — and which ones is known by mathematics, before anything is switched on. What is measured is how many of the 1,000 shots landed on those four.
- **columna_a:** Exact simulator
- **columna_b:** Real quantum computer · {maquina}
- **rotulo_cifra:** correct out of 1,000
- **azar:** A machine answering at random would get 250. That is why this number never travels alone: without it, a low value reads as "it almost worked" when it contributed nothing.
- **profundidad:** The circuit goes in at depth {prof_original} and the machine runs it at {prof_transpilada}: it has to translate it into its native gates and route it across qubits that are not all connected. That difference is what eats the fidelity.
- **rsa:** For a 2,048-bit RSA key, Shor's circuit calls for 4,096 controlled modular multiplications and 4,096 counting qubits, against the {qubits_maquina} this machine has. That is arithmetic — 2 x 2,048 — not an extrapolation from this measurement.
- **procedencia:** Job {job_id} on {maquina} · {hora_utc} UTC · circuit sha256 {sha_circuito} · pre-registration {prereg_id}, frozen {hora_sello} UTC, before measuring.
- **no_es_de_ahora:** This result was measured on {fecha}. It is not live.
