# Sección 14 · el certificado que no se pudo leer

Aprobado por Nicholas el 18-nov-2026: «Sí, así queda».

Va junto al desglose de certificados. Ni una palabra distinta.

## La frase

219 de 220 organizaciones con certificado leído. De 1 no se pudo leer el certificado y queda fuera de este desglose.

## Las tres cifras, recomputadas contra la edición al sellar

| cifra | valor | de dónde sale |
|---|---|---|
| organizaciones medidas | 219 | `indice.certificados_detalle.total` |
| muestra | 220 | `muestra.organizaciones` |
| sin certificado leído | 1 | `indice.certificados_detalle.sin_medir` |

## Cómo NO se implementa

Las tres cifras **no se clavan en el texto**. Esta frase es la que corresponde a 2026-11;
el mes que cambie cualquiera de las tres, el literal queda mintiendo y nadie se entera.
Es el mismo defecto que en noviembre nos dejó «los cuatro puntos de la sección 11» y
«indice-agosto-2026.json» publicados.

La frase se arma con las tres cifras leídas de la edición, y el chequeo comprueba que lo
construido para 2026-11 sea **byte a byte** este archivo.
