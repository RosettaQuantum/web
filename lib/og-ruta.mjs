/**
 * GET|HEAD /og/<id>.png — la tarjeta social de UNA nota, servida por el Worker.
 *
 * POR QUE EN EL WORKER Y NO EN EL BUILD
 * -------------------------------------
 * Las notas se publican con un INSERT en D1 sin rebuild. En el build no existen, asi que
 * build-og.mjs no puede hacerles tarjeta y todas acaban compartiendo /og/default.png.
 *
 * DE DONDE SALE LA TARJETA, Y EL ERROR QUE COSTO ESTA REESCRITURA
 * ---------------------------------------------------------------
 * `li_cards` manda; `posts` es el respaldo. El esquema real, leido de `sqlite_master` en
 * produccion el 26-oct-2026, tiene TRES columnas:
 *
 *     CREATE TABLE li_cards (slug_base TEXT PRIMARY KEY, spec_json TEXT NOT NULL, created_at TEXT NOT NULL)
 *
 * La primera version de este archivo no lo sabia —la lectura de produccion estaba fuera
 * de permiso— y "resolvio" el problema adivinando: hacia `SELECT *` y emparejaba nombres
 * de columna candidatos (`post_id`, `title`, `tldr`…) contra lo que encontrara. Como la
 * semilla local tenia justo esa forma inventada, **todo pasaba en verde y la cabecera
 * devolvia los nombres de mi propia fixture como si fueran un hallazgo**. Ninguna de esas
 * columnas existe: el contenido vive DENTRO de `spec_json`. Es el caso de manual de
 * probar contra una descripcion en vez de contra el objeto.
 *
 * De ahi las tres reglas que ahora sostiene el guardia T-og-tarjeta:
 *   1. Las columnas que se leen estan en `COLUMNAS_LI_CARDS` y el SELECT se construye de
 *      ahi. **Nunca `SELECT *`**: un wildcard es lo que dejo pasar el desajuste.
 *   2. Esos nombres tienen que existir en `db/li-cards.schema.sql`, que declara el
 *      esquema real. Si alguien vuelve a inventar una columna, el build se cae.
 *   3. El guardia parsea las CUATRO filas reales de `test/li_cards.real.seed.sql` con
 *      este mismo codigo. No hay forma de pasar contra una fixture imaginada.
 *
 * LA CLAVE ES slug_base, NO EL ID DE LA NOTA. `/og/advantaged-solve-en.png` busca
 * `advantaged-solve`, y el sufijo elige idioma en la forma B (bilingue).
 *
 * DOS FORMAS DE spec_json CONVIVEN y las dos se sirven (ver lib/og.mjs):
 *   A  kicker/date/title_html/bignum/vlabel_html/rtitle/panel[]/footnote
 *   B  pillar/format/headline_{en,es}/number/subhead_{en,es}/limit_{en,es}
 * Si el JSON no parsea o no es ninguna de las dos, se cae a `posts` y la cabecera lo
 * declara. Un spec desconocido no puede quedar en una tarjeta a medias.
 */
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import wasmModulo from "@resvg/resvg-wasm/index_bg.wasm";
import serifTtf from "../og/fonts/Newsreader-Regular.ttf";
import serifBoldTtf from "../og/fonts/Newsreader-SemiBold.ttf";
import monoTtf from "../og/fonts/IBMPlexMono-Regular.ttf";
import globalCss from "../src/styles/global.css";
import marcaFuente from "../public/rosetta-mark.svg";
import { construirTarjeta, tokensDeCss, marcaDeSvg, huella, LIENZO, COLUMNAS_LI_CARDS, clavesDe, formaDe } from "./og.mjs";

const SITIO = "https://rosettaquantum.com";

/**
 * Version del DIBUJO. Entra en la clave de cache y sube cuando cambia el ASPECTO, no
 * cuando cambia el contenido. Medido: sin esto, una correccion del render no invalidaba
 * nada y el edge seguia sirviendo la tarjeta vieja — con meses de cache en LinkedIn, un
 * arreglo del dibujo sin subir esto es un arreglo que no llega.
 */
const VERSION_DIBUJO = "og4";

/** Lee la fila de li_cards. Devuelve null si no hay tabla, ni fila, ni forma conocida. */
async function desdeLiCards(env, id) {
  const { lang, claves } = clavesDe(id);
  const sel = `SELECT ${COLUMNAS_LI_CARDS.map((c) => `"${c}"`).join(", ")} FROM li_cards WHERE "slug_base" = ? LIMIT 1`;
  for (const clave of claves) {
    const fila = await env.DB.prepare(sel).bind(clave).first().catch(() => null);
    if (!fila) continue;
    let spec = null;
    try { spec = JSON.parse(fila.spec_json); } catch { return { malFormado: true, clave }; }
    const forma = formaDe(spec);
    if (!forma) return { malFormado: true, clave };
    return { fuente: `li_cards:${forma}`, forma, spec, lang, clave, sello: fila.spec_json };
  }
  return null;
}

/** Respaldo: la propia nota. Esquema declarado en db/posts.schema.sql. */
async function desdePosts(env, id) {
  const fila = await env.DB.prepare(
    "SELECT id, title, tldr, date, pillar, lang FROM posts WHERE id=? AND published=1"
  ).bind(id).first().catch(() => null);
  if (!fila) return null;
  // El rotulo usa las MISMAS cadenas que el rotulo del articulo en worker.js.
  const s = fila.lang === "es" ? { pilar: "Pilar", estado: "Estado a" } : { pilar: "Pillar", estado: "State as of" };
  const partes = [];
  if (fila.pillar) partes.push(`${s.pilar} ${fila.pillar}`);
  if (fila.date) partes.push(`${s.estado} ${fila.date}`);
  return {
    fuente: "posts", forma: "NOTA", lang: fila.lang,
    nota: { titular: fila.title, tldr: fila.tldr, rotulo: partes.join(" · ").toUpperCase(), pie: `rosettaquantum.com/blog/${fila.id}` },
    sello: [fila.title, fila.tldr, fila.date, fila.pillar].join("|"),
  };
}

let listo = null;
async function arrancar() {
  if (!listo) listo = initWasm(wasmModulo);
  await listo;
}

/**
 * @returns {Promise<Response|null>} null si la ruta no es una tarjeta o no hay dato.
 */
export async function manejarOg(request, env, ctx) {
  const url = new URL(request.url);
  // La extension es OPCIONAL a proposito: el propio motor escribe en el spec
  // `"image": "/og/prospective-2026-w44"` SIN `.png`, asi que exigirla daria 404 en la
  // imagen que una publicacion ya viva estaria citando.
  const m = /^\/og\/([A-Za-z0-9][A-Za-z0-9._-]{0,120}?)(\.png)?$/.exec(url.pathname);
  // HEAD tambien: varios rastreadores sociales lo piden antes de bajar la imagen, y este
  // repo ya tiene el caso contrario documentado (una cabecera que solo salia en GET).
  if (!m || (request.method !== "GET" && request.method !== "HEAD")) return null;
  const id = m[1];

  const datos = (await desdeLiCards(env, id).catch(() => null)) || (await desdePosts(env, id));
  // Sin dato se devuelve null y la peticion sigue a ASSETS: asi las SEIS tarjetas fijas
  // de public/og/ ganan por existir —sin repetir aqui su lista— y un id inexistente da
  // el 404 del asset en vez de una imagen generica con el nombre de una nota concreta.
  if (!datos || datos.malFormado) return null;

  const sello = huella([id, datos.fuente, datos.sello]);
  const claveCache = new Request(`${SITIO}/og/${id}.png?v=${VERSION_DIBUJO}&h=${sello}`);
  const cache = (typeof caches !== "undefined" && caches.default) || null;
  const guardada = cache ? await cache.match(claveCache).catch(() => null) : null;
  if (guardada) {
    const r = new Response(request.method === "HEAD" ? null : guardada.body, guardada);
    r.headers.set("X-RQ-OG-Cache", "hit");
    return r;
  }

  await arrancar();
  const r = construirTarjeta({
    forma: datos.forma, spec: datos.spec, lang: datos.lang, nota: datos.nota,
    tokens: tokensDeCss(globalCss), ...marcaDeSvg(marcaFuente),
  }, {
    Resvg,
    fontBuffers: [new Uint8Array(serifTtf), new Uint8Array(serifBoldTtf), new Uint8Array(monoTtf)],
  });

  if (r.error) {
    // Falla cerrada y RUIDOSA. Los modos son distinguibles a proposito: sin-glifos = la
    // tipografia no cargo (tarjeta en blanco), no-entra = el titular no cabe ni en el
    // cuerpo mas chico, dimension = resvg no dio 1200x630.
    return new Response(`og render failed: ${r.error}\n`, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-RQ-OG": `FAILED:${r.error}` },
    });
  }

  const omitidos = r.meta.omitidos.length ? r.meta.omitidos.join("+") : "ninguno";
  const resp = new Response(r.png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(r.png.byteLength),
      "Cache-Control": "public, max-age=86400",
      "ETag": `"${sello}"`,
      // ASCII puro: workerd avisa de que un valor con bytes no-ASCII lanza TypeError en
      // la implementacion de Fetch de un navegador.
      "X-RQ-OG": `d1:${datos.fuente} | ${LIENZO.ancho}x${LIENZO.alto} | lang:${datos.lang} | px:${r.meta.px} | lineas:${r.meta.lineas} | omitidos:${omitidos}`,
      "X-RQ-OG-Cache": "miss",
    },
  });
  if (cache && ctx && ctx.waitUntil) ctx.waitUntil(cache.put(claveCache, resp.clone()));
  if (request.method === "HEAD") return new Response(null, { status: 200, headers: resp.headers });
  return resp;
}
