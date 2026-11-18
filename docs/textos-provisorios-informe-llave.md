# Textos provisorios · informe nacional y la regla de la llave (18-nov-2026)

**PROVISORIO.** Nicholas aprobó la regla (QEX-1.2, NIST IR 8547), no la redacción. Nada de esto se publica
sin su aprobación. El párrafo actual del informe NO se cambia: este documento sólo propone la variante.

El párrafo de `src/pages/informe-pqc/index.astro` (aprobado) nombra dos valores de la dimensión certificados:

> La dimensión de mayor peso —certificados, {peso}%— resulta **prácticamente constante**: {distribucion[0].n}
> de {total} organizaciones obtienen el mismo valor, el {pct_valor_dominante}% de la muestra. Sólo
> {distribucion[1].n} se separan.

Con la regla de QEX-1.2 el estudio queda con UN solo valor (toda llave clásica aprobada vale 75), y
«Sólo {distribucion[1].n} se separan» no tiene de dónde salir. El build se niega con la causa
(`src/pages/informe-pqc/index.astro`, guardia de la distribución) hasta que haya frase aprobada.

## Propuesta para un solo valor

| | ES | EN |
|---|---|---|
| párrafo | La dimensión de mayor peso —certificados, {peso}%— resulta **constante**: las {total} organizaciones con certificado leído obtienen el mismo valor. Con la regla de NIST IR 8547, toda llave clásica de al menos 112 bits vale lo mismo, y se deprecan todas después de 2030: ninguna se separa hasta que aparezca un certificado post-cuántico. | The heaviest dimension —certificates, {peso}%— is **constant**: all {total} organizations with a readable certificate get the same value. Under NIST IR 8547, every classical key of at least 112 bits is worth the same, and all are deprecated after 2030: none stands apart until a post-quantum certificate appears. |
| cita destacada (hoy: «El {pct}% de las organizaciones medidas obtiene el mismo puntaje en la dimensión que más pesa. Nadie se diferencia porque nadie ha empezado.») | sin cambio: con un solo valor dice «El 100%…», que sigue siendo cierto | unchanged |
