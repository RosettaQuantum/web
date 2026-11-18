/*
 * Un texto aprobado entra al informe tal como se aprobó, y sólo a su edición (17-nov-2026).
 * Caso real: los dos párrafos de método de «Sin security.txt publicado» (402 consultas,
 * 220 organizaciones, base 212), aprobados para noviembre. Si entraran a agosto, agosto
 * publicaría cifras que no midió; si cambiara una palabra, saldría un texto no aprobado.
 * Mira el HTML CONSTRUIDO sin comentarios, y compara contra el archivo con su sha256.
 * NO cubre: el PDF; la redacción de los párrafos vecinos que ya estaban en la plantilla.
 */
export const CONSUMIDOR = { quien: "el postbuild (bloquea el deploy) y quien agregue un texto aprobado al informe", hace: "copia el .md byte a byte, declara su sha256 en APROBADOS.json y no lo edita a mano" };
import { readFileSync, existsSync } from "node:fs";
import { textosDeEdicion, apartados, sha256 } from "../src/lib/informe-textos.mjs";

const base = new URL("../src/data/informe-pqc/textos/", import.meta.url);
const APROBADOS = JSON.parse(readFileSync(new URL("APROBADOS.json", base), "utf8"));
const leer = (f) => { const u = new URL(f, base); return existsSync(u) ? readFileSync(u, "utf8") : null; };
const texto = (html) => html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ");
const plano = (md) => md.replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim();

/** Problemas del HTML construido para la edición `ed`. */
export function revisar(html, ed, aprobados = APROBADOS, lee = leer) {
  const mal = [], h = texto(html);
  for (const a of aprobados) {
    const ap = apartados(lee(a.archivo));
    for (const p of [ap.hicimos, ap.no_hicimos]) {
      const esta = h.includes(plano(p));
      if (a.edicion === ed && !esta) mal.push(`${ed}: falta el párrafo aprobado «${plano(p).slice(0, 50)}…»`);
      if (a.edicion !== ed && esta) mal.push(`${ed}: trae el párrafo aprobado para ${a.edicion} «${plano(p).slice(0, 50)}…»`);
    }
  }
  return mal;
}

let pasa = 0, falla = 0, saltadas = 0;
const prueba = (n, ok) => { ok ? pasa++ : falla++; console.log(`  ${ok ? "ok   " : "FALLA"} ${n}`); };
const lanza = (f) => { try { f(); return null; } catch (e) { return e.message; } };

for (const a of APROBADOS) prueba(`${a.archivo}: sha256 igual al aprobado`, sha256(leer(a.archivo) ?? "") === a.sha256);
const t = textosDeEdicion("2026-11", APROBADOS, leer);
prueba("noviembre trae los dos párrafos, uno por apartado", !!t && t.crudo.hicimos.startsWith("**Canal de reporte de seguridad.**") && t.crudo.no_hicimos.startsWith("No medimos páginas"));
prueba("agosto no trae ninguno", textosDeEdicion("2026-08", APROBADOS, leer) === null);
// MUTACIÓN: una palabra distinta en la copia → el build se cae.
const md = leer(APROBADOS[0].archivo);
prueba("MUTACIÓN «212» → «213» en la copia: el sha la tumba",
  /no es el aprobado/.test(lanza(() => textosDeEdicion("2026-11", APROBADOS, () => md.replace("212 contestaron", "213 contestaron"))) ?? ""));
// HTML: grito y silencio.
const pag = (ed) => `<section id="legal"><p>${t.hicimos}</p><p>${t.no_hicimos}</p></section>`;
prueba("silencio: noviembre con sus dos párrafos", revisar(pag(), "2026-11").length === 0);
prueba("grito: agosto con los párrafos de noviembre", revisar(pag(), "2026-08").length === 2);
prueba("grito: noviembre sin los párrafos", revisar("<section id=\"legal\"></section>", "2026-11").length === 2);
prueba("silencio paradójico: los párrafos sólo dentro de un comentario no cuentan como publicados",
  revisar(`<!-- ${pag()} -->`, "2026-08").length === 0 && revisar(`<!-- ${pag()} -->`, "2026-11").length === 2);

const ruta = new URL("../dist/informe-pqc/index.html", import.meta.url);
if (existsSync(ruta)) {
  const html = readFileSync(ruta, "utf8");
  const ed = /data-edicion="([\d-]+)"/.exec(html)?.[1];
  if (ed) { const mal = revisar(html, ed); prueba(`dist/informe-pqc (${ed}): ${mal.length ? mal.join(" · ") : "textos aprobados donde van y sólo ahí"}`, mal.length === 0); }
  else { saltadas++; console.log("  SALTADA dist/informe-pqc: la página no declara data-edicion"); }
} else { saltadas++; console.log("  SALTADA dist/informe-pqc (no hay build)"); }

console.log(`\ncheck-informe-textos: ${pasa} pasaron, ${falla} fallaron, ${saltadas} saltadas`);
if (falla) process.exit(1);
