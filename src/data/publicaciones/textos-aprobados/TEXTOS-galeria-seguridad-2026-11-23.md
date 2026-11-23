# Galería «Publicaciones de Rosetta» y botón «Seguridad» · textos PROVISORIOS para aprobar

23-nov-2026. Pedido de Nicholas: un botón «Seguridad» / «Security» en el menú de arriba, y en la
portada de seguridad (/es/q-ready, /q-ready) una galería de publicaciones propias con el informe
PQC mensual y la guía PQC. **Nada de esto va a producción sin su aprobación.**

Fuente única de los textos de la galería: `src/data/publicaciones.json` (lo que se apruebe aquí es
literalmente lo que se sirve). Los textos en inglés de la tarjeta del informe están en
`src/components/publicaciones/TarjetaInformePqc.astro`.

Las cifras «14 capítulos» y «60 fuentes» se comprobaron el 23-nov contra la guía publicada: 14
capítulos numerados en la página (es y en), y 60 entradas en la sección Fuentes / Sources, cada una
con su enlace (60 enlaces distintos). La guía misma dice «14 capítulos, 60 fuentes primarias».

## Menú de arriba

- **PROVISORIO** es: `Seguridad` → /es/q-ready
- **PROVISORIO** en: `Security` → /q-ready

## Galería · encabezado

- **PROVISORIO** es · título: Publicaciones de Rosetta
- **PROVISORIO** es · bajada: Lo que medimos, publicado con fecha y fuente.
- **PROVISORIO** en · título: Rosetta publications
- **PROVISORIO** en · bajada: What we measure, published with a date and a source.

## Tarjeta · Guía de criptografía post-cuántica

Título: es el de la guía, sin cambio («Criptografía post-cuántica: la guía medida» /
«Post-quantum cryptography: the measured guide»).

- **PROVISORIO** es · etiqueta: Guía de referencia · PQC Watch
- **PROVISORIO** es · bajada: Qué rompe un computador cuántico, qué aprobó el NIST, quién puso fecha y cómo se migra. Cada número lleva fecha y fuente.
- **PROVISORIO** es · datos: 14 capítulos · 60 fuentes · PDF gratis
- **PROVISORIO** es · enlaces: Leer la guía → · Descargar el PDF
- **PROVISORIO** es · texto alternativo de la portada: Portada de la guía «Criptografía post-cuántica: la guía medida»
- **PROVISORIO** en · etiqueta: Reference guide · PQC Watch
- **PROVISORIO** en · bajada: What a quantum computer breaks, what NIST approved, who has set deadlines and how to migrate. Every number carries a date and a source.
- **PROVISORIO** en · datos: 14 chapters · 60 sources · free PDF
- **PROVISORIO** en · enlaces: Read the guide → · Download the PDF
- **PROVISORIO** en · texto alternativo de la portada: Cover of the guide “Post-quantum cryptography: the measured guide”

## Tarjeta · Informe PQC mensual

En español **no cambia ni una palabra** (comprobado comparando el texto y el gráfico construidos
antes y después: idénticos). En inglés la tarjeta no existía: /q-ready no la tenía. El informe
existe sólo en español, así que en inglés no hay formulario y el enlace lo dice.

- **PROVISORIO** en · etiqueta: Monthly PQC report · edition ‹n› · ‹Month Year›
- **PROVISORIO** en · título: Large Chilean companies, measured.
- **PROVISORIO** en · cifra: ‹mediana› QEX · median — n = ‹n› organizations, from ‹min› to ‹max›
- **PROVISORIO** en · gráfico: QEX distribution · ‹Month Year› — rótulo «ceiling ‹techo›»
- **PROVISORIO** en · pie del gráfico: Index distribution across ‹n› organizations. None scores above ‹max›; above ‹techo› nothing can be claimed when measuring from outside.
- **PROVISORIO** en · enlace: Read the report (in Spanish) →
- **PROVISORIO** en · archivo: Editions — no. ‹n› · median ‹m› · n = ‹n›
