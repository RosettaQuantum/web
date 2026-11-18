/*
 * Ninguna URL del sitemap construido lleva noindex (18-nov-2026).
 * Caso real: /es/metodologia/qex y /methodology/qex (texto provisorio, sin aprobar) llevaban
 * <meta name="robots" content="noindex"> y estaban en sitemap-0.xml: una señal le pedía al
 * buscador que no indexara y la otra iba a buscarlo. Lo vio la sesión Q-Ready medición en
 * producción.
 * La exclusión y este guardia usan la MISMA definición (src/lib/noindex.mjs), leída de la
 * página construida: no hay lista al lado que pueda divergir.
 * NO cubre: las notas que el Worker agrega al sitemap en tiempo de ejecución desde D1
 * (augmentSitemap); ésas no existen en dist/.
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

let pasa = 0, falla = 0, saltadas = 0;
const prueba = (n, ok) => { ok ? pasa++ : falla++; console.log(`  ${ok ? "ok   " : "FALLA"} ${n}`); };

prueba("grito: meta robots noindex", htmlNoindex('<head><meta name="robots" content="noindex"></head>'));
prueba("grito: noindex junto a otra directiva y atributos en otro orden", htmlNoindex("<meta content='noindex, follow' name='robots'>"));
prueba("silencio: página indexable", !htmlNoindex('<meta name="description" content="noindex no es esto"><meta name="robots" content="index,follow">'));
prueba("silencio paradójico: el meta sólo dentro de un comentario", !htmlNoindex('<!-- <meta name="robots" content="noindex"> -->'));
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
