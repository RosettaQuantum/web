# Las dos tipografias que se embeben en el Worker

Las usa `/og/<id>.png` (ver `lib/og.mjs`). **No las usa el sitio**: el sitio las pide a
Google Fonts por `<link>`; estas existen porque en un Worker no hay fuentes del sistema y
resvg necesita los bytes.

| archivo | familia | version | sha256 |
|---|---|---|---|
| `Newsreader-Regular.ttf` | Newsreader 400 | gstatic v26 | `b8f5e0a8…f2cd5a` |
| `Newsreader-SemiBold.ttf` | Newsreader 600 | gstatic v26 | `04188d52…804272` |
| `IBMPlexMono-Regular.ttf` | IBM Plex Mono 400 | gstatic v20 | `a7fdc993…f00c2` |

**La SemiBold no es un lujo.** El motor de contenido escribe `<b>…</b>` dentro de
`title_html` y `vlabel_html`, y sin esa cara cargada resvg lo pinta en regular **sin
avisar**: la tarjeta sale «bien», sólo que el énfasis que el autor puso no está. Medido:
la misma frase a 84 px mide 591 px en 400 y 631 px en 600, y el guardia compara justo eso.

Bajadas de `fonts.gstatic.com` el 26-oct-2026 (la API `css2` devuelve TTF cuando el
User-Agent es antiguo; en woff2 resvg no las lee). Las dos son **SIL Open Font License
1.1**, la misma licencia de Outfit en el kit de marca: se pueden redistribuir embebidas.

**Los sha256 estan sellados en `scripts/check-og-tarjeta.mjs`.** Cambiar una fuente sin
cambiar ese sello hace fallar el build — a proposito: una tarjeta social con otra
tipografia es otra marca, y es el defecto que nadie mira porque el PNG se genera igual.

Si alguna vez hay que actualizarlas, el orden es: bajar, medir con el guardia
(`npm run check:og`), mirar una tarjeta, y recien ahi sellar el sha nuevo.
