/**
 * /sitemap-0.xml — el construido, mas los posts que solo viven en D1.
 *
 * POR QUE VIVE AQUI Y NO EN worker.js
 * -----------------------------------
 * Para poder PROBARLO. `worker.js` importa .ttf, .css y .wasm por reglas de modulo del
 * Worker, asi que Node no puede cargarlo y ningun guardia podia ejercer esta funcion.
 * Movida aqui, `scripts/check-sitemap-cuerpo.mjs` la corre con un ASSETS y un D1 de
 * mentira y comprueba los dos caminos de verdad. El codigo no cambio de comportamiento:
 * cambio de archivo, y cambio el bug.
 *
 * EL DEFECTO QUE TENIA, MEDIDO
 * ----------------------------
 * `const xml = await assetRes.text()` consume el cuerpo, y tres lineas mas abajo el
 * camino `if (!fresh.length) return assetRes` devolvia ESA MISMA respuesta ya consumida:
 *
 *     TypeError: Body has already been used. It can only be used once.
 *     GET /sitemap-0.xml -> 500
 *
 * Y el caso que lo dispara no es raro, es el estado NORMAL: `fresh` esta vacio cuando
 * todos los posts de D1 ya aparecen en el sitemap construido, o sea siempre que no se
 * haya publicado una nota por INSERT desde el ultimo build. Reproducido en local sobre
 * `origin/main` sin ningun cambio mio. En produccion respondia 200 por casualidad —
 * habia una nota de D1 que el build no citaba— y por eso nadie lo habia visto: el dia
 * que esa nota entre al build, Google empieza a recibir 500 en el sitemap.
 *
 * EL ARREGLO ELEGIDO, Y POR QUE ESTE
 * ----------------------------------
 * Se lee el texto de un **clon**, nunca del original. La alternativa —reordenar para no
 * consumir el cuerpo hasta saber si hay algo que agregar— no se puede: para saber si hay
 * algo que agregar hay que LEER el xml. Con el clon, el original queda intacto pase lo
 * que pase, asi que **cualquier `return assetRes` futuro sigue siendo valido**: el
 * arreglo no depende de que nadie agregue una salida temprana mas adelante, que es
 * exactamente como nacio este bug.
 */

const SITE = "https://rosettaquantum.com";

export async function augmentSitemap(env, request) {
  const assetRes = await env.ASSETS.fetch(request);
  if (assetRes.status !== 200) return assetRes;
  const { results = [] } = await env.DB.prepare(
    "SELECT id, slug_base, lang, date FROM posts WHERE published=1"
  ).all();
  // EL CLON ES EL ARREGLO. No se toca `assetRes`: se lee una copia. Ver la cabecera.
  let xml = await assetRes.clone().text();
  const live = new Set(results.map((p) => `${p.slug_base}|${p.lang}`));
  const fresh = results.filter((p) => !xml.includes(`/blog/${p.id}`));
  if (!fresh.length) return assetRes;

  const entries = fresh.map((p) => {
    const other = p.lang === "es" ? "en" : "es";
    const loc = `${SITE}/blog/${p.id}/`;
    let links = "";
    // Reconstruye el par de idioma solo cuando las dos caras estan publicadas: declarar
    // un alternate que no existe es peor que no declarar ninguno.
    if (live.has(`${p.slug_base}|${other}`)) {
      const enUrl = `${SITE}/blog/${p.slug_base}-en/`;
      const esUrl = `${SITE}/blog/${p.slug_base}-es/`;
      links =
        `<xhtml:link rel="alternate" hreflang="en" href="${enUrl}"/>` +
        `<xhtml:link rel="alternate" hreflang="es" href="${esUrl}"/>` +
        `<xhtml:link rel="alternate" hreflang="x-default" href="${enUrl}"/>`;
    }
    return `<url><loc>${loc}</loc><lastmod>${p.date}</lastmod>${links}</url>`;
  }).join("");

  xml = xml.replace("</urlset>", entries + "</urlset>");
  return new Response(xml, {
    headers: {
      "Content-Type": assetRes.headers.get("content-type") || "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=60",
      "X-RQ-Sitemap": `added:${fresh.length}`,
    },
  });
}

/**
 * LA VERSION CON EL DEFECTO, a proposito y con nombre feo. No la usa nadie: existe para
 * que `scripts/check-sitemap-cuerpo.mjs` pueda comprobar que su prueba de grito DETECTA
 * el bug real. Un test que solo corre contra el codigo arreglado demuestra que el codigo
 * arreglado funciona, no que el test sirva — y aqui el bug ya vivio meses sin que nadie
 * lo viera.
 */
export async function augmentSitemapConElDefecto(env, request) {
  const assetRes = await env.ASSETS.fetch(request);
  if (assetRes.status !== 200) return assetRes;
  const { results = [] } = await env.DB.prepare(
    "SELECT id, slug_base, lang, date FROM posts WHERE published=1"
  ).all();
  const xml = await assetRes.text();          // <- consume el cuerpo
  const fresh = results.filter((p) => !xml.includes(`/blog/${p.id}`));
  if (!fresh.length) return assetRes;         // <- lo devuelve consumido
  return new Response(xml.replace("</urlset>", "</urlset>"));
}
