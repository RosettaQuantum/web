/**
 * La guía PQC v1.1 servida desde D1 (encargo del 17-nov-2026, pedido directo de Nicholas).
 *
 * QUÉ HACE ESTE ARCHIVO
 * ---------------------
 *  · GET|HEAD /guia/<slug> y /guide/<slug> → `pages.html` tal cual, SIN layout: el html de la
 *    fila es un documento completo. Sólo con `published=1`; sin fila publicada, 404.
 *  · El marcador `<!--RQ_INDICATORS-->` del <head> se cambia por los indicadores vivos de
 *    `pqc_indicators` (el último registro de cada uno, escrito con FORMATOS). Si la consulta
 *    falla, el marcador QUEDA: la página trae sus cifras impresas y sigue siendo correcta, sólo que no viva.
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
 * activo la página se sirve aunque `published=0`, con `no-store` y `noindex`. El pop-up NO se
 * enciende por este modo: para verlo está `?promo=1` (ver promoForzado). check-guia grita si
 * cualquiera de las dos variables aparece fuera de env.preview.
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
/**
 * Los indicadores que se inyectan, y CÓMO se escribe cada uno (decisión de Cowork y Nicholas,
 * 17-nov-2026). El display NO sale de la columna `value` —es texto libre, en inglés, y cambiaba
 * lo que la página en español dice («2030·35» pasaba a «deprecate 2030 / disallow 2035 - FINAL»,
 * «≈70%» a «≈70»)—: se arma de `value_num` con un formato FIJO, igual en ES y EN, que reproduce
 * exactamente lo que la página ya trae impreso. Sin `value_num`, el indicador se salta y la
 * página conserva su cifra.
 *
 * `nist_rsa_ecc_clock` NO está, a propósito: la página deja «2030·35» fijo.
 */
export const FORMATOS = {
  broken_keys_rsa2048_public: (n) => String(n),
  quantum_attributed_breaches_public: (n) => String(n),
  pqc_share_https_cloudflare: (n) => `≈${n}%`,
  latam_fin_regulators_pqc_deadline: (n) => `${n}/5`,
};
export const INDICADORES = Object.keys(FORMATOS);
export const CACHE_GUIA = "public, s-maxage=3600, stale-while-revalidate=86400";
export const FLAG_PROMO = "promo_guia";

/**
 * Los PDF de la guía y las cotas que deben cumplir. Los imprime scripts/build-guia-pdf.mjs desde
 * la propia página (el conector de Cowork no adjunta archivos, así que no hay un hash entregado
 * contra el cual comparar). Van en public/ con el nombre de su `pdf_path`; scripts/check-guia.mjs
 * no deja construir si aparece uno con otro nombre o fuera de estas cotas. Las cotas encierran lo
 * que describió Cowork (≈39 páginas A4, ≈1,3 MB) con holgura para una edición nueva, y dejan
 * afuera los modos de fallo reales de una impresión: Carta en vez de A4, una página en blanco o
 * cortada, un PDF vacío.
 */
export const PDF_RUTAS = ["/guia/guia-criptografia-post-cuantica.pdf", "/guide/post-quantum-cryptography-guide.pdf"];
export const PDF_COTAS = { paginasMin: 30, paginasMax: 50, bytesMin: 0.5 * 1048576, bytesMax: 3 * 1048576, a4: [595.28, 841.89], tolPt: 3 };

// ── SQL. Constantes con nombre para que el guardia pueda mutarlas y ver que grita. ───────
export const SQL_PAGINA = "SELECT html, version, published, lang, alt_path FROM pages WHERE path = ? AND published = 1";
export const SQL_PAGINA_PRUEBA = "SELECT html, version, published, lang, alt_path FROM pages WHERE path = ?";
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
  "SELECT p.indicator_id, p.value_num, p.date FROM pqc_indicators p JOIN (" +
  "SELECT indicator_id, MAX(date) AS d FROM pqc_indicators WHERE indicator_id IN (" +
  INDICADORES.map(() => "?").join(",") + ") GROUP BY indicator_id" +
  ") m ON m.indicator_id = p.indicator_id AND m.d = p.date";

/**
 * `?promo=1` (sólo preview, pedido de Nicholas 17-nov): fuerza el pop-up aunque el flag esté
 * apagado y la guía sin publicar, para poder VERLO. Mismo patrón que GUIA_PRUEBA: hace falta la
 * variable `PROMO_PRUEBA="1"` (declarada sólo en env.preview) Y host *.workers.dev Y el parámetro.
 * En producción el parámetro llega igual —lo manda el script— y no hace nada.
 * Sin `?promo=1`, el preview se comporta como producción: flag Y published.
 */
export function promoForzado(env, url) {
  return !!(env && env.PROMO_PRUEBA === "1" && url && /\.workers\.dev$/.test(url.hostname)
    && url.searchParams.get("promo") === "1");
}

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

/** Filas de pqc_indicators → { id: {display, date} }. El display sale de `value_num` y FORMATOS. */
export function mapaIndicadores(filas) {
  const out = {};
  for (const f of filas || []) {
    if (!f || !Object.prototype.hasOwnProperty.call(FORMATOS, f.indicator_id)) continue;
    if (f.value_num === null || f.value_num === undefined || f.value_num === "") continue;
    const n = Number(f.value_num);
    if (!Number.isFinite(n)) continue;
    out[f.indicator_id] = { display: FORMATOS[f.indicator_id](n), date: String(f.date ?? "").slice(0, 10) };
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

// ── La barra y el pie del sitio ───────────────────────────────────────────────────────

/**
 * La guía se sirve SIN layout (su html es un documento completo de Cowork), así que no traía la
 * barra del sitio ni su pie: ni un enlace de vuelta (lo vio Nicholas en el preview, 17-nov).
 * Se inyectan aquí, en la ruta, igual que los indicadores: la fila de D1 no se toca.
 *
 * DE DÓNDE SALEN: del cascarón /rq-shell-guia-{es,en}/, que el build compila con NavV2 y PieV2
 * —los mismos componentes del resto del sitio— dentro de un shadow root (BarraGuia.astro). Aquí
 * sólo se RECORTAN tres piezas por su etiqueta, sin reescribirlas:
 *   <style data-rq-barra>  lo del lado del documento (ancho completo, fuera de la impresión)
 *   <rq-sitio-arriba>      la barra       → justo después de <body>
 *   <rq-sitio-abajo>       el pie         → justo antes de </body>
 * y `__RQ_GUIA_ALT__` pasa a ser el `alt_path` de la fila: el EN/ES lleva al par de la guía.
 */
export const MARCA_ALT = "__RQ_GUIA_ALT__";
export const rutaCascaronBarra = (lang) => `/rq-shell-guia-${lang === "es" ? "es" : "en"}/`;

export function extraerBarra(cascaron) {
  const s = String(cascaron || "");
  const estilo = /<style data-rq-barra[^>]*>[\s\S]*?<\/style>/.exec(s);
  const arriba = /<rq-sitio-arriba[\s>][\s\S]*?<\/rq-sitio-arriba>/.exec(s);
  const abajo = /<rq-sitio-abajo[\s>][\s\S]*?<\/rq-sitio-abajo>/.exec(s);
  if (!estilo || !arriba || !abajo || !arriba[0].includes("shadowrootmode")) return null;
  // Los scripts de la barra (el menú móvil de NavV2 y frescura.js) buscan con
  // document.getElementById, que dentro de la sombra no encuentra nada. Se sacan de la sombra y se
  // corren con un `document` que busca en el shadow root y deja lo demás (lang, createElement) en
  // el documento real.
  let barra = arriba[0];
  const codigos = [];
  barra = barra.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g, (_, c) => { codigos.push(c); return ""; });
  const script = codigos.length
    ? `<script>(function(r){if(!r)return;var d={getElementById:function(i){return r.getElementById(i)},` +
      `querySelector:function(s){return r.querySelector(s)},querySelectorAll:function(s){return r.querySelectorAll(s)},` +
      `documentElement:document.documentElement,body:document.body,createElement:function(t){return document.createElement(t)}};` +
      codigos.map((c) => `(function(document){${c}})(d);`).join("") +
      `})((document.querySelector("rq-sitio-arriba")||{}).shadowRoot);</script>`
    : "";
  return { estilo: estilo[0], arriba: barra + script, abajo: abajo[0] };
}

/** Pone la barra y el pie en el html de la guía. Sin piezas o sin <body>, el html sale intacto. */
export function ponerBarra(html, piezas, altPath) {
  if (!piezas) return { html, estado: "FAILED:cascaron" };
  const cuerpo = /<body\b[^>]*>/i.exec(html);
  const cierre = html.lastIndexOf("</body>");
  if (!cuerpo || cierre < 0 || cierre < cuerpo.index) return { html, estado: "FAILED:sin-body" };
  const alt = String(altPath || "").replace(/[^\w\/.-]/g, "");
  const conAlt = (t) => t.split(MARCA_ALT).join(alt);
  const finCuerpo = cuerpo.index + cuerpo[0].length;
  let out = html.slice(0, finCuerpo) + conAlt(piezas.arriba) + html.slice(finCuerpo, cierre) +
    conAlt(piezas.abajo) + html.slice(cierre);
  const cab = out.indexOf("</head>");
  if (cab >= 0) out = out.slice(0, cab) + piezas.estilo + out.slice(cab);
  return { html: out, estado: "ok" };
}

async function leerBarra(env, url, lang) {
  if (!env || !env.ASSETS) return null;
  const r = await env.ASSETS.fetch(new Request(new URL(rutaCascaronBarra(lang), url.origin).toString()));
  if (r.status !== 200) return null;
  return extraerBarra(await r.text());
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

  // La barra del sitio. Si el cascarón no responde, la guía sale igual —es contenido completo—
  // y la cabecera lo declara: una falla de la barra no puede bajar la página.
  let b;
  try { b = ponerBarra(r.html, await leerBarra(env, url, fila.lang), fila.alt_path); }
  catch (e) { b = { html: r.html, estado: "FAILED:cascaron" }; }

  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": prueba ? "no-store" : CACHE_GUIA,
    "X-RQ-Guia": `${prueba ? (Number(fila.published) === 1 ? "prueba:publicada" : "prueba:borrador") : "publicada"} v${fila.version} indicadores:${r.estado} barra:${b.estado}`,
  };
  if (prueba) headers["X-Robots-Tag"] = "noindex, nofollow";
  return new Response(request.method === "HEAD" ? null : b.html, { status: 200, headers });
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
  const prueba = promoForzado(env, url);
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
        "Cache-Control": modoPruebaGuia(env, url) || promoForzado(env, url) ? "no-store" : "public, max-age=60",
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
