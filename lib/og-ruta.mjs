/**
 * GET /og/<id>.png — la tarjeta social de UNA nota, servida por el Worker.
 *
 * POR QUE EN EL WORKER Y NO EN EL BUILD
 * -------------------------------------
 * Las notas se publican con un INSERT en D1 sin rebuild. En el build no existen, asi que
 * build-og.mjs no puede hacerles tarjeta y todas acaban compartiendo /og/default.png.
 *
 * POR QUE NO HACE FALTA TOCAR run_worker_first
 * --------------------------------------------
 * Es la mina numero uno de este repo (dos deploys perdidos): una ruta que lee D1 y no
 * esta en esa lista sirve el archivo estatico en silencio. Aqui el comportamiento por
 * defecto es el que queremos y hay que entenderlo antes de "arreglarlo": las SEIS
 * tarjetas fijas (default, library, ledger, services, cases, decision) SI existen como
 * archivo en public/og/ y deben seguir ganando; para un id de nota no existe archivo, el
 * asset da 404 y la peticion cae al Worker. Meter /og/* en run_worker_first invertiria
 * eso y pondria las seis fijas a depender de D1 sin necesidad.
 *
 * LA LECTURA: li_cards PRIMERO, posts DE RESPALDO, Y EL DENOMINADOR DECLARADO
 * --------------------------------------------------------------------------
 * El encargo dice que el spec de cada tarjeta vive en la tabla D1 `li_cards`. **Esa tabla
 * no esta declarada en ningun archivo de db/ y su forma real no se pudo leer** (la lectura
 * de la D1 de produccion quedo fuera de permiso en esta sesion), asi que aqui NO se
 * inventa un esquema: se DESCUBRE el de la tabla viva desde sqlite_master y se emparejan
 * sus columnas contra una lista de nombres candidatos. Si la tabla no existe, si no tiene
 * las columnas minimas o si no hay fila para ese id, se cae a `posts`, cuyo esquema SI
 * esta en el repositorio (db/posts.schema.sql). La cabecera `X-RQ-OG` declara siempre de
 * donde salio la tarjeta y con que columnas, para que se pueda comprobar contra el
 * terreno sin adivinar.
 */
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import wasmModulo from "@resvg/resvg-wasm/index_bg.wasm";
import serifTtf from "../og/fonts/Newsreader-Regular.ttf";
import monoTtf from "../og/fonts/IBMPlexMono-Regular.ttf";
import globalCss from "../src/styles/global.css";
import marcaFuente from "../public/rosetta-mark.svg";
import { construirTarjeta, tokensDeCss, marcaDeSvg, huella, LIENZO } from "./og.mjs";

const SITIO = "https://rosettaquantum.com";

/**
 * Version del DIBUJO. Entra en la clave de cache y hay que subirla cuando cambia el
 * aspecto de la tarjeta, no cuando cambia su contenido.
 *
 * Nace de un defecto medido en local el 26-oct: la clave llevaba id + fecha + huella del
 * texto, asi que una correccion en el codigo del render NO invalidaba nada y el edge
 * seguia sirviendo la tarjeta vieja. Lo vi porque una cabecera que acababa de arreglar
 * seguia saliendo con el valor anterior. Con max-age de un dia aqui y meses de cache en
 * LinkedIn, un arreglo del dibujo sin subir esto es un arreglo que no llega.
 */
const VERSION_DIBUJO = "og3";

/** Nombres de columna candidatos, en orden de preferencia. Un solo lugar. */
export const CANDIDATAS = {
  id: ["post_id", "id", "slug", "slug_base", "card_id"],
  titulo: ["title", "titular", "headline", "hook", "h1"],
  sub: ["tldr", "subtitle", "dek", "summary", "lede"],
  pilar: ["pillar", "pilar"],
  fecha: ["date", "fecha", "published_at", "created_at"],
  lang: ["lang", "idioma", "locale"],
};

/** Columnas de un CREATE TABLE. No usa PRAGMA: D1 no garantiza table_info. */
export function columnasDe(sqlCreate) {
  const m = /\(([\s\S]*)\)\s*;?\s*$/.exec(String(sqlCreate ?? ""));
  if (!m) return [];
  const cols = [];
  let nivel = 0, pieza = "";
  for (const ch of m[1]) {
    if (ch === "(") nivel++;
    if (ch === ")") nivel--;
    if (ch === "," && nivel === 0) { cols.push(pieza); pieza = ""; continue; }
    pieza += ch;
  }
  cols.push(pieza);
  return cols
    .map((c) => (/^\s*[`"'\[]?([A-Za-z_][\w]*)/.exec(c) || [])[1])
    .filter(Boolean)
    .filter((n) => !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)$/i.test(n));
}

/** Empareja las columnas vivas con los papeles de la tarjeta. */
export function emparejar(columnas) {
  const bajas = new Map(columnas.map((c) => [c.toLowerCase(), c]));
  const out = {};
  for (const [papel, nombres] of Object.entries(CANDIDATAS)) {
    for (const n of nombres) if (bajas.has(n)) { out[papel] = bajas.get(n); break; }
  }
  return out;
}

/** Lee la fila de li_cards si se puede; devuelve null (no lanza) si no. */
async function desdeLiCards(env, id) {
  const esq = await env.DB.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='li_cards'"
  ).first().catch(() => null);
  if (!esq || !esq.sql) return null;
  const mapa = emparejar(columnasDe(esq.sql));
  if (!mapa.id || !mapa.titulo) return { faltan: true, mapa };
  const fila = await env.DB.prepare(
    `SELECT * FROM li_cards WHERE "${mapa.id}" = ? LIMIT 1`
  ).bind(id).first().catch(() => null);
  if (!fila) return null;
  return {
    fuente: "li_cards",
    columnas: mapa,
    id,
    titulo: fila[mapa.titulo],
    sub: mapa.sub ? fila[mapa.sub] : null,
    pilar: mapa.pilar ? fila[mapa.pilar] : null,
    fecha: mapa.fecha ? fila[mapa.fecha] : null,
    lang: (mapa.lang ? fila[mapa.lang] : null) || (/-es$/.test(id) ? "es" : "en"),
  };
}

/** Respaldo: la propia nota. Esquema declarado en db/posts.schema.sql. */
async function desdePosts(env, id) {
  const fila = await env.DB.prepare(
    "SELECT id, title, tldr, date, pillar, lang FROM posts WHERE id=? AND published=1"
  ).bind(id).first().catch(() => null);
  if (!fila) return null;
  return {
    fuente: "posts", columnas: null, id: fila.id, titulo: fila.title,
    sub: fila.tldr, pilar: fila.pillar, fecha: fila.date, lang: fila.lang,
  };
}

/** El rotulo con las MISMAS cadenas que el rotulo del articulo en worker.js. */
export function rotuloDe({ lang, pilar, fecha }) {
  const s = lang === "es" ? { pilar: "Pilar", estado: "Estado a" } : { pilar: "Pillar", estado: "State as of" };
  const partes = [];
  if (pilar) partes.push(`${s.pilar} ${pilar}`);
  if (fecha) partes.push(`${s.estado} ${fecha}`);
  return partes.join(" · ");
}

let listo = null;
async function arrancar() {
  if (!listo) listo = initWasm(wasmModulo);
  await listo;
}

/**
 * @returns {Promise<Response|null>} null si la ruta no es una tarjeta.
 */
export async function manejarOg(request, env, ctx) {
  const url = new URL(request.url);
  const m = /^\/og\/([A-Za-z0-9][A-Za-z0-9._-]{0,120})\.png$/.exec(url.pathname);
  // HEAD tambien, y no es un detalle: varios rastreadores sociales piden HEAD antes de
  // bajar la imagen, y este repo ya tiene el caso contrario documentado —la cabecera
  // X-RQ-Splice que solo aparece en GET— que hizo que un `curl -sI` diera por ausente
  // algo que estaba. Con solo GET, un HEAD caia a ASSETS y devolvia 404 para una
  // tarjeta que existe.
  if (!m || (request.method !== "GET" && request.method !== "HEAD")) return null;
  const id = m[1];

  const datos = (await desdeLiCards(env, id).catch(() => null)) || (await desdePosts(env, id));
  // Sin fila en D1 se devuelve null y la peticion sigue a ASSETS. Asi las SEIS tarjetas
  // fijas de public/og/ ganan por existir, sin que esta ruta repita su lista —una lista
  // que vive en dos lugares ya divergio— y un id inexistente da el 404 del asset en vez
  // de una imagen generica con el nombre de una nota concreta.
  if (!datos || datos.faltan || !datos.titulo) return null;

  const sello = huella([datos.id, datos.fecha, datos.titulo, datos.sub, datos.pilar]);
  const claveCache = new Request(`${SITIO}/og/${id}.png?v=${VERSION_DIBUJO}&f=${encodeURIComponent(String(datos.fecha || ""))}&h=${sello}`);
  const cache = (typeof caches !== "undefined" && caches.default) || null;
  const guardada = cache ? await cache.match(claveCache).catch(() => null) : null;
  if (guardada) {
    const r = new Response(request.method === "HEAD" ? null : guardada.body, guardada);
    r.headers.set("X-RQ-OG-Cache", "hit");
    return r;
  }

  await arrancar();
  const tokens = tokensDeCss(globalCss);
  const marca = marcaDeSvg(marcaFuente);
  const r = construirTarjeta({
    titular: datos.titulo,
    tldr: datos.sub,
    rotulo: rotuloDe(datos),
    pie: `rosettaquantum.com/blog/${datos.id}`,
    tokens, ...marca,
  }, {
    Resvg,
    fontBuffers: [new Uint8Array(serifTtf), new Uint8Array(monoTtf)],
  });

  if (r.error) {
    // Falla cerrada y RUIDOSA. Los tres modos posibles son distinguibles a proposito:
    // sin-glifos = la tipografia no cargo (tarjeta en blanco), no-entra = el titular no
    // cabe ni en el cuerpo mas chico, dimension = resvg no dio 1200x630.
    return new Response(`og render failed: ${r.error}\n`, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-RQ-OG": `FAILED:${r.error}` },
    });
  }

  const cols = datos.columnas ? Object.entries(datos.columnas).map(([k, v]) => `${k}=${v}`).join(",") : "esquema-declarado";
  const resp = new Response(r.png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(r.png.byteLength),
      "Cache-Control": "public, max-age=86400",
      "ETag": `"${sello}"`,
      // La cabecera va en ASCII PURO a proposito: workerd avisa de que un valor con bytes
      // no-ASCII lanza TypeError en la implementacion de Fetch de un navegador. El punto
      // medio se veia bien en curl y habria roto a quien la lea desde el navegador.
      "X-RQ-OG": `d1:${datos.fuente} | ${LIENZO.ancho}x${LIENZO.alto} | px:${r.meta.px} | lineas:${r.meta.lineas} | tldr:${r.meta.tldr ? r.meta.tldr : "omitida"} | ${cols}`,
      "X-RQ-OG-Cache": "miss",
    },
  });
  if (cache && ctx && ctx.waitUntil) ctx.waitUntil(cache.put(claveCache, resp.clone()));
  if (request.method === "HEAD") return new Response(null, { status: 200, headers: resp.headers });
  return resp;
}
