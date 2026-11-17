/**
 * La guía PQC v1.1 servida desde D1 (encargo del 17-nov-2026, pedido directo de Nicholas).
 *
 * QUÉ HACE ESTE ARCHIVO
 * ---------------------
 *  · GET|HEAD /guia/<slug> y /guide/<slug> → `pages.html` tal cual, SIN layout: el html de la
 *    fila es un documento completo. Sólo con `published=1`; sin fila publicada, 404.
 *  · El marcador `<!--RQ_INDICATORS-->` del <head> se cambia por los indicadores vivos de
 *    `pqc_indicators` (el último registro de cada uno). Si la consulta falla, el marcador
 *    QUEDA: la página trae sus cifras impresas y sigue siendo correcta, sólo que no viva.
 *  · GET|HEAD de cada `pdf_path` → el PDF desde los assets del build, como application/pdf,
 *    sólo si su página está publicada y el archivo existe y empieza por `%PDF-`. Nunca uno
 *    vacío ni uno inventado: sin archivo, 404.
 *  · /api/promo/guia y POST /_promo/guia/{view,click,close}: lo que necesita el pop-up.
 *  · Las dos funciones puras que usan /sitemap-0.xml y /llms.txt para declarar la guía SÓLO
 *    cuando está publicada.
 *
 * POR QUÉ VIVE EN lib/ Y NO EN worker.js
 * --------------------------------------
 * Por la misma razón que lib/sitemap.mjs: worker.js importa .ttf/.css/.wasm y Node no puede
 * cargarlo. Aquí `scripts/check-guia.mjs` lo ejerce contra una D1 en memoria con el esquema
 * REAL y lo muta.
 *
 * EL MODO DE PRUEBA (sólo preview)
 * --------------------------------
 * Para revisar el borrador sin tocar `published`. Mismo patrón que QREADY_PRUEBA_DNS: existe
 * SÓLO si la variable `GUIA_PRUEBA="1"` está (declarada únicamente en env.preview de
 * wrangler.jsonc) Y el host es *.workers.dev. Producción no tiene la variable, y aunque la
 * tuviera, rosettaquantum.com no es workers.dev: hacen falta las dos llaves. Con el modo
 * activo la página se sirve aunque `published=0`, con `no-store` y `noindex`, y el pop-up se
 * enciende aunque el flag de D1 esté apagado. check-guia grita si la variable aparece fuera
 * de env.preview.
 *
 * EL FLAG DEL POP-UP ES UNA FILA DE D1, NO UNA VARIABLE DEL WORKER
 * ----------------------------------------------------------------
 * `site_flags(k='promo_guia')`. Una variable del Worker sólo cambia con un deploy, y el único
 * escritor del Worker es el CI de main: apagarlo de urgencia costaría un push. La fila se
 * cambia con un UPDATE y vale en la siguiente petición. Falla CERRADO: sin tabla, sin fila,
 * o con cualquier valor distinto de '1', el pop-up no aparece. Y aunque esté en '1', no
 * aparece si la guía no está publicada.
 */
import { SQL_HIT, claseUA, hostReferrer } from "./hits.mjs";

const SITIO = "https://rosettaquantum.com";

export const SLUG_GUIA = "guia-criptografia-post-cuantica";
export const MARCADOR = "<!--RQ_INDICATORS-->";
/** Los cinco indicadores que la página lee por `data-ind`. Ni uno más: el resto no se pinta. */
export const INDICADORES = [
  "broken_keys_rsa2048_public",
  "quantum_attributed_breaches_public",
  "pqc_share_https_cloudflare",
  "nist_rsa_ecc_clock",
  "latam_fin_regulators_pqc_deadline",
];
export const CACHE_GUIA = "public, s-maxage=3600, stale-while-revalidate=86400";
export const FLAG_PROMO = "promo_guia";

/**
 * Los PDF que se esperan, con su sha256 (entregados por Nicholas; los archivos todavía no).
 * Van en public/ con el nombre de su `pdf_path`. scripts/check-guia.mjs no deja construir si
 * aparece uno con otro hash, vacío, o con un nombre que no está aquí.
 */
export const PDF_ESPERADOS = {
  "/guia/guia-criptografia-post-cuantica.pdf": "20db2442e129d1941b10b67dde9fce8c5bd7f5ff1c51696c4a2643fee44c0d85",
  "/guide/post-quantum-cryptography-guide.pdf": "eefb67c41b5c43c3656361a23512122f4eff133109263c7c098741f37d203c73",
};

// ── SQL. Constantes con nombre para que el guardia pueda mutarlas y ver que grita. ───────
export const SQL_PAGINA = "SELECT html, version, published FROM pages WHERE path = ? AND published = 1";
export const SQL_PAGINA_PRUEBA = "SELECT html, version, published FROM pages WHERE path = ?";
export const SQL_PDF = "SELECT path FROM pages WHERE pdf_path = ? AND published = 1 LIMIT 1";
export const SQL_PDF_PRUEBA = "SELECT path FROM pages WHERE pdf_path = ? LIMIT 1";
export const SQL_PUBLICADAS =
  "SELECT slug_base, lang, path, title, version, updated_at FROM pages WHERE published = 1 ORDER BY slug_base, lang";
export const SQL_DESTINO_PROMO =
  "SELECT path, lang FROM pages WHERE slug_base = ? AND published = 1 ORDER BY (lang = ?) DESC LIMIT 1";
export const SQL_DESTINO_PROMO_PRUEBA =
  "SELECT path, lang FROM pages WHERE slug_base = ? ORDER BY (lang = ?) DESC LIMIT 1";
export const SQL_FLAG = "SELECT v FROM site_flags WHERE k = ?";
// El último registro por indicador = la fecha más alta (la clave primaria es indicator_id+date).
export const SQL_INDICADORES =
  "SELECT p.indicator_id, p.value, p.date FROM pqc_indicators p JOIN (" +
  "SELECT indicator_id, MAX(date) AS d FROM pqc_indicators WHERE indicator_id IN (" +
  INDICADORES.map(() => "?").join(",") + ") GROUP BY indicator_id" +
  ") m ON m.indicator_id = p.indicator_id AND m.d = p.date";

/** Las dos llaves del modo de prueba: la variable del preview Y un host *.workers.dev. */
export function modoPruebaGuia(env, url) {
  return !!(env && env.GUIA_PRUEBA === "1" && url && /\.workers\.dev$/.test(url.hostname));
}

/** ¿Es una ruta de la guía? /guia/<algo> o /guide/<algo>. Lo usa también el pop-up (en JS de cliente). */
export const RUTA_GUIA = /^\/(?:guia|guide)\/./;

// ── Indicadores ──────────────────────────────────────────────────────────────────────

/**
 * JSON que no puede cerrar el <script> que lo contiene. `<` se escribe \u003c: eso cubre
 * `</script>` y `<!--` de una vez, y es JSON válido (sólo puede aparecer dentro de cadenas).
 * `>` y `&` por la misma regla, y U+2028/2029 porque rompen un literal de JS viejo.
 */
export function jsonParaScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** Filas de pqc_indicators → { id: {display, date} }. */
export function mapaIndicadores(filas) {
  const out = {};
  for (const f of filas || []) {
    if (!f || !INDICADORES.includes(f.indicator_id)) continue;
    out[f.indicator_id] = { display: String(f.value ?? ""), date: String(f.date ?? "").slice(0, 10) };
  }
  return out;
}

/**
 * Cambia el PRIMER marcador por el <script>. Devuelve el html y un estado para la cabecera.
 * Sin mapa (la consulta falló) o vacío, el html sale intacto y el marcador queda.
 * El reemplazo va por FUNCIÓN y no por cadena: con cadena, un `$&` en un valor de la base
 * se expande a «lo que calzó» y reescribe el texto en silencio.
 */
export function inyectarIndicadores(html, mapa) {
  if (!mapa) return { html, estado: "FAILED:consulta" };
  const n = Object.keys(mapa).length;
  if (!n) return { html, estado: "sin-filas" };
  if (!html.includes(MARCADOR)) return { html, estado: "sin-marcador" };
  const script = `<script>window.RQ_INDICATORS=${jsonParaScript(mapa)}</script>`;
  return { html: html.replace(MARCADOR, () => script), estado: `d1:${n}` };
}

export async function leerIndicadores(env) {
  const { results = [] } = await env.DB.prepare(SQL_INDICADORES).bind(...INDICADORES).all();
  return mapaIndicadores(results);
}

// ── Respuestas ───────────────────────────────────────────────────────────────────────

function noEncontrado(motivo) {
  // no-store: el día que Nicholas publique, la página tiene que aparecer en la siguiente
  // petición, no cuando caduque un 404 guardado en algún borde.
  return new Response("Not found\n", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-RQ-Guia": motivo },
  });
}

/** Los cinco primeros bytes de un PDF de verdad. Un archivo vacío o un HTML de error no pasa. */
export function esPdf(b) {
  return !!b && b.length > 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d;
}

async function servirPagina(request, env, url, prueba) {
  let fila = null;
  try {
    fila = await env.DB.prepare(prueba ? SQL_PAGINA_PRUEBA : SQL_PAGINA).bind(url.pathname).first();
  } catch (e) {
    return new Response("Service unavailable\n", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-RQ-Guia": "FAILED:d1" },
    });
  }
  if (!fila || typeof fila.html !== "string" || !fila.html) return noEncontrado("no-publicada");

  let r;
  try { r = inyectarIndicadores(fila.html, await leerIndicadores(env)); }
  catch (e) { r = { html: fila.html, estado: "FAILED:consulta" }; }

  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": prueba ? "no-store" : CACHE_GUIA,
    "X-RQ-Guia": `${prueba ? (Number(fila.published) === 1 ? "prueba:publicada" : "prueba:borrador") : "publicada"} v${fila.version} indicadores:${r.estado}`,
  };
  if (prueba) headers["X-Robots-Tag"] = "noindex, nofollow";
  return new Response(request.method === "HEAD" ? null : r.html, { status: 200, headers });
}

async function servirPdf(request, env, url, prueba) {
  const fila = await env.DB.prepare(prueba ? SQL_PDF_PRUEBA : SQL_PDF).bind(url.pathname).first().catch(() => null);
  if (!fila) return noEncontrado("pdf-sin-pagina-publicada");
  // Los PDF viven en los assets del build (public/guia/, public/guide/). Se piden por GET aunque
  // la petición sea HEAD: hay que leer los primeros bytes para no servir algo que no es un PDF.
  const asset = await env.ASSETS.fetch(new Request(new URL(url.pathname, url.origin).toString()));
  if (asset.status !== 200) return noEncontrado("pdf-ausente");
  const bytes = new Uint8Array(await asset.arrayBuffer());
  if (!esPdf(bytes)) return noEncontrado("pdf-invalido");
  const nombre = url.pathname.split("/").pop();
  return new Response(request.method === "HEAD" ? null : bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="${nombre}"`,
      "Cache-Control": prueba ? "no-store" : CACHE_GUIA,
      "X-RQ-Guia": prueba ? "pdf:prueba" : "pdf",
    },
  });
}

// ── Pop-up ───────────────────────────────────────────────────────────────────────────

/** ¿Está encendido el flag? Falla cerrado: cualquier cosa que no sea exactamente '1' es apagado. */
export async function flagPromo(env) {
  try {
    const f = await env.DB.prepare(SQL_FLAG).bind(FLAG_PROMO).first();
    return !!f && String(f.v).trim() === "1";
  } catch { return false; }
}

/**
 * Lo que el pop-up necesita saber: si se muestra y a dónde lleva. Prefiere la guía del idioma
 * de la página; si ésa no está publicada y la otra sí, lleva a la otra.
 */
export async function estadoPromo(env, url, lang) {
  const prueba = modoPruebaGuia(env, url);
  if (!prueba && !(await flagPromo(env))) return { mostrar: false, motivo: "flag-apagado" };
  const l = lang === "es" ? "es" : "en";
  const fila = await env.DB.prepare(prueba ? SQL_DESTINO_PROMO_PRUEBA : SQL_DESTINO_PROMO)
    .bind(SLUG_GUIA, l).first().catch(() => null);
  if (!fila || !RUTA_GUIA.test(String(fila.path))) return { mostrar: false, motivo: "guia-no-publicada" };
  return { mostrar: true, href: fila.path, lang: fila.lang };
}

export const RUTA_EVENTO = /^\/_promo\/guia\/(view|click|close)$/;

/**
 * Cuenta un evento del pop-up en `hits`, con la misma fila que lib/hits.mjs: ruta sintética
 * /_promo/guia/<evento>, clase del agente y host del referrer (la página donde se mostró).
 * Sólo en rosettaquantum.com, igual que el contador: el preview escribe en la MISMA base.
 */
export async function registrarEventoPromo(request, env, url, ctx) {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const cuenta = url.hostname === "rosettaquantum.com";
  if (cuenta && env && env.DB) {
    const p = env.DB.prepare(SQL_HIT).bind(
      new Date().toISOString().slice(0, 10), url.pathname,
      claseUA(request.headers.get("user-agent")), hostReferrer(request.headers.get("referer")),
    ).run().catch(() => {});
    if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
  }
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store", "X-RQ-Promo": cuenta ? "registrado" : "no-registrado:fuera-de-produccion" },
  });
}

// ── Entrada única desde worker.js ──────────────────────────────────────────────────────

/** @returns {Promise<Response|null>} null si la ruta no es de la guía ni del pop-up. */
export async function manejarGuia(request, env, url, ctx) {
  const p = url.pathname;

  if (RUTA_EVENTO.test(p)) return registrarEventoPromo(request, env, url, ctx);

  if (p === "/api/promo/guia") {
    if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { Allow: "GET" } });
    const lang = url.searchParams.get("lang") === "es" ? "es" : "en";
    const e = await estadoPromo(env, url, lang);
    return new Response(JSON.stringify(e), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": modoPruebaGuia(env, url) ? "no-store" : "public, max-age=60",
      },
    });
  }

  if (!RUTA_GUIA.test(p)) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  // Con barra final, 301 a la ruta sin barra: el enlace al PDF dentro de la página es
  // RELATIVO («guia-criptografia-post-cuantica.pdf»), y con barra resolvería a otra carpeta.
  if (p.length > 1 && p.endsWith("/")) {
    const destino = new URL(url.toString());
    destino.pathname = p.replace(/\/+$/, "");
    return Response.redirect(destino.toString(), 301);
  }

  const prueba = modoPruebaGuia(env, url);
  if (p.endsWith(".pdf")) return servirPdf(request, env, url, prueba);
  return servirPagina(request, env, url, prueba);
}

// ── Sitemap y llms.txt: sólo lo publicado ──────────────────────────────────────────────

/** Las páginas publicadas. Una base que no responde no rompe el sitemap: devuelve []. */
export async function paginasPublicadas(env) {
  try {
    const { results = [] } = await env.DB.prepare(SQL_PUBLICADAS).all();
    // El filtro por forma es a propósito: un doble de D1 que devuelve las filas de `posts` a
    // cualquier consulta (el de check-sitemap-cuerpo) no puede colarse como guía.
    return (results || []).filter((r) => r && typeof r.path === "string" && RUTA_GUIA.test(r.path) && (r.lang === "es" || r.lang === "en"));
  } catch { return []; }
}

/**
 * Las <url> de la guía que faltan en `xml`. El par hreflang se declara sólo si las dos caras
 * están publicadas: un alternate que responde 404 es peor que ninguno. x-default = inglés,
 * igual que el <head> de la propia página.
 */
export function urlsSitemapGuia(filas, xml = "") {
  const por = new Map();
  for (const f of filas) por.set(`${f.slug_base}|${f.lang}`, f);
  const partes = [];
  for (const f of filas) {
    const loc = SITIO + f.path;
    if (xml.includes(`<loc>${loc}</loc>`)) continue;
    const otra = por.get(`${f.slug_base}|${f.lang === "es" ? "en" : "es"}`);
    let links = "";
    if (otra) {
      const es = f.lang === "es" ? f : otra, en = f.lang === "en" ? f : otra;
      links = `<xhtml:link rel="alternate" hreflang="es" href="${SITIO + es.path}"/>` +
              `<xhtml:link rel="alternate" hreflang="en" href="${SITIO + en.path}"/>` +
              `<xhtml:link rel="alternate" hreflang="x-default" href="${SITIO + en.path}"/>`;
    }
    const lastmod = String(f.updated_at || "").slice(0, 10);
    partes.push(`<url><loc>${loc}</loc>${/^\d{4}-\d{2}-\d{2}$/.test(lastmod) ? `<lastmod>${lastmod}</lastmod>` : ""}${links}</url>`);
  }
  return { xml: partes.join(""), n: partes.length };
}

/**
 * UNA línea por guía en /llms.txt, con la forma de las líneas de las notas
 * («- [título](url) — fecha (idioma)») y la otra cara a continuación. Inglés primero.
 * Nada de texto propio: título, ruta, versión y fecha salen de la fila.
 */
export function lineasLlmsGuia(filas, texto = "") {
  const grupos = new Map();
  for (const f of filas) {
    if (!grupos.has(f.slug_base)) grupos.set(f.slug_base, []);
    grupos.get(f.slug_base).push(f);
  }
  const lineas = [];
  for (const g of grupos.values()) {
    g.sort((a, b) => (a.lang === "en" ? -1 : 1) - (b.lang === "en" ? -1 : 1));
    if (g.some((f) => texto.includes(SITIO + f.path + ")"))) continue;
    const [p, ...resto] = g;
    const fecha = String(p.updated_at || "").slice(0, 10);
    lineas.push(`- [${p.title}](${SITIO}${p.path}) — v${p.version}, ${fecha} (${p.lang})` +
      resto.map((f) => ` · [${f.title}](${SITIO}${f.path}) (${f.lang})`).join(""));
  }
  return lineas;
}
