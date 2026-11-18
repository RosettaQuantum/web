/*
 * Ninguna URL del sitemap construido lleva noindex (18-nov-2026).
 * Caso real: /es/metodologia/qex y /methodology/qex (texto provisorio, sin aprobar) llevaban
 * <meta name="robots" content="noindex"> y estaban en sitemap-0.xml: una señal le pedía al
 * buscador que no indexara y la otra iba a buscarlo. Lo vio la sesión Q-Ready medición en
 * producción.
 * La exclusión y este guardia usan la MISMA definición (src/lib/noindex.mjs), leída de la
 * página construida: no hay lista al lado que pueda divergir.
 * Dos modos:
 *   (sin argumentos)            el sitemap CONSTRUIDO contra las páginas de dist/ (postbuild).
 *   --servido <origen>          el sitemap SERVIDO por el Worker contra cada página servida
 *                               (después del deploy). El construido ve ~70 de ~336 URLs: el resto
 *                               lo agrega el Worker desde D1 (notas, guía) y sólo se ve aquí.
 *                               Mira el meta robots Y la cabecera X-Robots-Tag. Declara su
 *                               denominador; una URL que no responde no es un noindex (no grita
 *                               por ella), pero si no responde más del 5 % el chequeo falla:
 *                               verde sin haber mirado no es verde.
 */
export const CONSUMIDOR = { quien: "el postbuild (bloquea el deploy) y quien ponga noindex a una página", hace: "deja que astro.config.mjs la saque del sitemap leyendo el meta de la propia página; nunca la excluye a mano" };
import fs from "node:fs";
import path from "node:path";
import { htmlNoindex, urlNoindex, archivoDe } from "../src/lib/noindex.mjs";

const DIST = path.resolve(new URL("..", import.meta.url).pathname, "dist");
/** URLs del sitemap que llevan noindex. */
export function revisar(xml, dist = DIST) {
  const locs = [...xml.replace(/<!--[\s\S]*?-->/g, "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  return { locs, mal: locs.filter((u) => urlNoindex(u, dist)) };
}

/** ¿La respuesta servida pide noindex? Cabecera X-Robots-Tag o meta en el cuerpo. */
export function respuestaNoindex(xRobots, cuerpo) {
  return /\bnoindex\b/i.test(xRobots || "") || htmlNoindex(cuerpo || "");
}

async function servido(origen) {
  const sm = await fetch(new URL("/sitemap-0.xml", origen) + "?rq=" + Date.now());
  if (!sm.ok) { console.log(`FALLA sitemap servido: HTTP ${sm.status}`); process.exit(1); }
  const xml = await sm.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const mal = [], sinRespuesta = [];
  let i = 0;
  const trabajador = async () => {
    while (i < locs.length) {
      const u = locs[i++];
      try {
        const r = await fetch(u, { redirect: "follow", headers: { "user-agent": "rosetta-check-sitemap-noindex/1" } });
        const cuerpo = (r.headers.get("content-type") || "").includes("html") ? await r.text() : "";
        if (!r.ok) sinRespuesta.push(`${u} (${r.status})`);
        else if (respuestaNoindex(r.headers.get("x-robots-tag"), cuerpo)) mal.push(u);
      } catch (e) { sinRespuesta.push(`${u} (${e.message})`); }
    }
  };
  await Promise.all(Array.from({ length: 8 }, trabajador));
  const miradas = locs.length - sinRespuesta.length;
  console.log(`check-sitemap-noindex --servido ${origen}: ${locs.length} URLs en el sitemap · ${miradas} miradas · ${sinRespuesta.length} sin respuesta · ${mal.length} con noindex`);
  for (const u of mal) console.log(`  FALLA noindex anunciado: ${u}`);
  for (const u of sinRespuesta.slice(0, 10)) console.log(`  sin respuesta: ${u}`);
  if (!locs.length || mal.length || sinRespuesta.length > locs.length * 0.05) process.exit(1);
  process.exit(0);
}
const k = process.argv.indexOf("--servido");
if (k > 0) await servido(process.argv[k + 1] || "https://rosettaquantum.com");

let pasa = 0, falla = 0, saltadas = 0;
const prueba = (n, ok) => { ok ? pasa++ : falla++; console.log(`  ${ok ? "ok   " : "FALLA"} ${n}`); };

prueba("grito: meta robots noindex", htmlNoindex('<head><meta name="robots" content="noindex"></head>'));
prueba("grito: noindex junto a otra directiva y atributos en otro orden", htmlNoindex("<meta content='noindex, follow' name='robots'>"));
prueba("silencio: página indexable", !htmlNoindex('<meta name="description" content="noindex no es esto"><meta name="robots" content="index,follow">'));
prueba("silencio paradójico: el meta sólo dentro de un comentario", !htmlNoindex('<!-- <meta name="robots" content="noindex"> -->'));
prueba("servido · grito: cabecera X-Robots-Tag: noindex con cuerpo limpio", respuestaNoindex("noindex, nofollow", "<html></html>"));
prueba("servido · silencio: sin cabecera ni meta", !respuestaNoindex(null, '<meta name="robots" content="index">'));
prueba("archivoDe: /es/metodologia/qex/ → dist/es/metodologia/qex/index.html",
  archivoDe("https://rosettaquantum.com/es/metodologia/qex/", "/d") === "/d/es/metodologia/qex/index.html");

const maps = fs.existsSync(DIST) ? fs.readdirSync(DIST).filter((f) => /^sitemap-\d+\.xml$/.test(f)) : [];
if (!maps.length) { saltadas++; console.log("  SALTADA dist/sitemap-*.xml (no hay build)"); }
else {
  // MUTACIÓN contra el build real: un sitemap que vuelve a traer las páginas noindex tiene que gritar.
  const conNoindex = fs.readdirSync(DIST, { recursive: true }).filter((f) => f.endsWith("index.html"))
    .filter((f) => htmlNoindex(fs.readFileSync(path.join(DIST, f), "utf8")))
    .map((f) => "https://rosettaquantum.com/" + f.replace(/index\.html$/, ""));
  prueba(`MUTACIÓN sin la exclusión: ${conNoindex.length} páginas noindex de dist/ metidas al sitemap gritan`,
    conNoindex.length > 0 && revisar(`<urlset>${conNoindex.map((u) => `<url><loc>${u}</loc></url>`).join("")}</urlset>`).mal.length === conNoindex.length);
  for (const f of maps) {
    const { locs, mal } = revisar(fs.readFileSync(path.join(DIST, f), "utf8"));
    prueba(`dist/${f}: ${locs.length} URLs, ${mal.length ? "con noindex: " + mal.join(" · ") : "ninguna con noindex"}`, locs.length > 0 && mal.length === 0);
  }
}
console.log(`\ncheck-sitemap-noindex: ${pasa} pasaron, ${falla} fallaron, ${saltadas} saltadas`);
if (falla) process.exit(1);
