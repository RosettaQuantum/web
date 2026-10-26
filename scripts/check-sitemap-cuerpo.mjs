#!/usr/bin/env node
/**
 * T-sitemap-cuerpo — /sitemap-0.xml no devuelve una respuesta con el cuerpo ya leido.
 *
 * EL DEFECTO REAL, no uno inventado
 * ---------------------------------
 * `augmentSitemap` leia `await assetRes.text()` y, cuando no habia nada que agregar,
 * devolvia ESA MISMA respuesta:
 *
 *     TypeError: Body has already been used. It can only be used once.
 *     GET /sitemap-0.xml -> 500
 *
 * Reproducido en local sobre `origin/main`, sin ningun cambio encima. **El caso que lo
 * dispara es el estado normal**, no un borde: `fresh` queda vacio cuando todos los posts
 * de D1 ya aparecen en el sitemap construido, o sea siempre que no se haya publicado una
 * nota por INSERT desde el ultimo build.
 *
 * POR QUE NO SIRVE MIRAR PRODUCCION. El dia que se encontro, produccion respondia 200
 * **por casualidad**: existia una nota de D1 que el build no citaba, asi que `fresh`
 * tenia una fila y la salida temprana no se tomaba. Un chequeo contra la URL viva habria
 * dado verde sobre un bug presente. El caso hay que FABRICARLO, y eso se hace aqui.
 *
 * COMO SE PRUEBA
 * --------------
 *  · GRITO — el mismo escenario contra `augmentSitemapConElDefecto`, que es el codigo
 *    anterior conservado a proposito: tiene que fallar al leer el cuerpo. Sin este caso,
 *    el guardia solo demostraria que la version nueva funciona, no que sepa detectar el
 *    defecto.
 *  · SILENCIO 1 — mismo escenario contra la version viva: 200 y el XML **byte a byte**
 *    igual al construido.
 *  · SILENCIO 2 — el camino contrario, con una nota que si hay que agregar: 200, la URL
 *    nueva dentro y `X-RQ-Sitemap: added:1`. Un arreglo que rompiera esto seria peor que
 *    el bug.
 *
 * PUNTO CIEGO DECLARADO: ejerce la funcion con un ASSETS y un D1 de mentira. NO comprueba
 * que la ruta este cableada en worker.js ni que `/sitemap-0.xml` entre en
 * run_worker_first — eso lo ve T-paginas contra el preview.
 *
 * Uso:  node scripts/check-sitemap-cuerpo.mjs
 */
export const CONSUMIDOR = {
  quien: "la sesion que toca lib/sitemap.mjs",
  hace: "no despliega: /sitemap-0.xml responde 500 a Google en cuanto deja de haber posts nuevos que agregar, y el sitio no tiene ningun otro aviso de eso",
};

import { augmentSitemap, augmentSitemapConElDefecto } from "../lib/sitemap.mjs";

let fallos = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const mal = (t) => { console.log(`  FALLA ${t}`); fallos++; };

const XML_BASE = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  + "<url><loc>https://rosettaquantum.com/blog/advantaged-solve-en/</loc></url>"
  + "<url><loc>https://rosettaquantum.com/blog/advantaged-solve-es/</loc></url>"
  + "</urlset>";

/** Un entorno de mentira: ASSETS sirve el sitemap construido y DB devuelve `filas`. */
function entorno(filas, xml = XML_BASE) {
  return {
    ASSETS: { fetch: async () => new Response(xml, { status: 200, headers: { "content-type": "application/xml" } }) },
    DB: { prepare: () => ({ all: async () => ({ results: filas }) }) },
  };
}
const pedido = () => new Request("https://rosettaquantum.com/sitemap-0.xml");

// Las DOS filas ya estan en el xml construido -> fresh.length === 0 -> la salida temprana.
const YA_ESTAN = [
  { id: "advantaged-solve-en", slug_base: "advantaged-solve", lang: "en", date: "2026-08-26" },
  { id: "advantaged-solve-es", slug_base: "advantaged-solve", lang: "es", date: "2026-08-26" },
];
const UNA_NUEVA = [...YA_ESTAN, { id: "prospective-2026-w44-en", slug_base: "prospective-2026-w44", lang: "en", date: "2026-10-26" }];

// ── GRITO: el codigo anterior tiene que caerse en este escenario ────────────────────
{
  let detectado = null;
  try {
    const r = await augmentSitemapConElDefecto(entorno(YA_ESTAN), pedido());
    await r.text();                     // es aqui donde el runtime se queja
    detectado = false;
  } catch (e) {
    detectado = /already been used|unusable|disturbed/i.test(String(e.message));
    if (!detectado) mal(`grito    se cayo por otra razon: ${e.message}`);
  }
  if (detectado === true) ok("grito    el codigo anterior falla con fresh.length === 0 (cuerpo ya consumido)");
  else if (detectado === false) mal("grito    el codigo anterior NO fallo: la prueba no reproduce el defecto y no demuestra nada");
}

// ── SILENCIO 1: la version viva devuelve el xml intacto en ese MISMO escenario ──────
{
  try {
    const r = await augmentSitemap(entorno(YA_ESTAN), pedido());
    const cuerpo = await r.text();
    if (r.status !== 200) mal(`silencio 1 estado ${r.status}, se esperaba 200`);
    else if (cuerpo !== XML_BASE) mal(`silencio 1 el xml cambio: ${cuerpo.length} bytes contra ${XML_BASE.length}`);
    else ok(`silencio 1 sin nada que agregar: 200 y el xml construido byte a byte (${cuerpo.length} bytes)`);
  } catch (e) { mal(`silencio 1 se cayo: ${e.message}`); }
}

// ── SILENCIO 2: el camino que SI agrega sigue funcionando ──────────────────────────
{
  try {
    const r = await augmentSitemap(entorno(UNA_NUEVA), pedido());
    const cuerpo = await r.text();
    const problemas = [];
    if (r.status !== 200) problemas.push(`estado ${r.status}`);
    if (!cuerpo.includes("/blog/prospective-2026-w44-en/")) problemas.push("la nota nueva no entro al xml");
    if (r.headers.get("X-RQ-Sitemap") !== "added:1") problemas.push(`X-RQ-Sitemap: ${r.headers.get("X-RQ-Sitemap")}`);
    if (!cuerpo.endsWith("</urlset>")) problemas.push("el xml quedo mal cerrado");
    if (problemas.length) mal(`silencio 2 ${problemas.join(" · ")}`);
    else ok("silencio 2 con una nota nueva: 200, la URL dentro y X-RQ-Sitemap: added:1");
  } catch (e) { mal(`silencio 2 se cayo: ${e.message}`); }
}

// ── SILENCIO 3: el par de idioma solo se declara si las dos caras existen ──────────
{
  const soloEn = [{ id: "nueva-en", slug_base: "nueva", lang: "en", date: "2026-10-26" }];
  const r = await augmentSitemap(entorno(soloEn), pedido());
  const cuerpo = await r.text();
  if (cuerpo.includes("hreflang")) mal("silencio 3 declaro un alternate para una traduccion que no existe");
  else ok("silencio 3 sin la cara en espanol no se declara ningun alternate");
}

console.log(fallos
  ? `\nT-sitemap-cuerpo: ${fallos} problema(s).`
  : "\nT-sitemap-cuerpo: el caso que daba 500 da 200, y el que agregaba sigue agregando.");
process.exit(fallos ? 1 : 0);
