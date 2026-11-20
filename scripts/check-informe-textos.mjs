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
import { textosDeEdicion, apartados, sha256, frase, fraseCertificadoSinLeer, cierreCertificados } from "../src/lib/informe-textos.mjs";

const base = new URL("../src/data/informe-pqc/textos/", import.meta.url);
const APROBADOS = JSON.parse(readFileSync(new URL("APROBADOS.json", base), "utf8"));
const leer = (f) => { const u = new URL(f, base); return existsSync(u) ? readFileSync(u, "utf8") : null; };
const texto = (html) => html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ");
const plano = (md) => md.replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim();

/** Problemas del HTML construido para la edición `ed`. */
export function revisar(html, ed, aprobados = APROBADOS, lee = leer) {
  const mal = [], h = texto(html);
  for (const a of aprobados.filter((x) => x.seccion === "legal")) {
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
prueba("noviembre trae la frase de rutas desde su archivo sellado", t?.frase_rutas === "No exploramos rutas ni directorios más allá de la dirección estándar de security.txt.");
prueba("MUTACIÓN frase editada a mano: el sha la tumba",
  /no es el aprobado/.test(lanza(() => textosDeEdicion("2026-11", APROBADOS, (f) => f.endsWith("frase-rutas.md") ? leer(f).replace("estándar", "oficial") : leer(f))) ?? ""));
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

// Frase del certificado sin leer: se ARMA con las cifras; el sello cubre lo construido para su edición.
const selloSL = APROBADOS.find((a) => a.seccion === "certificado-sin-leer");
const laFrase = (md) => { const m = /^## La frase\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(md); return m ? m[1].trim().replace(/\s*\n\s*/g, " ") : null; };
const sellada = laFrase(leer(selloSL.archivo));
prueba(`certificado sin leer: lo construido para ${selloSL.edicion} (219, 220, 1) es byte a byte el sellado`, fraseCertificadoSinLeer(219, 220, 1) === sellada);
prueba("MUTACIÓN otra cifra en la edición (218 leídos de 219): lo construido deja de calzar con el sello", fraseCertificadoSinLeer(218, 219, 1) !== sellada);
prueba("grito: 2 sin leer con frase singular → el build se cae", /plural/.test(lanza(() => fraseCertificadoSinLeer(218, 220, 2)) ?? ""));
prueba("grito: cifras que no suman la muestra", /≠ muestra/.test(lanza(() => fraseCertificadoSinLeer(219, 221, 1)) ?? ""));
prueba("texto 5: el cierre sale del documento sellado", cierreCertificados("2026-11", APROBADOS, leer) === "Con la regla de NIST IR 8547 ninguna se separa hasta que aparezca un certificado post-cuántico.");
prueba("texto 5: agosto no declara cierre", cierreCertificados("2026-08", APROBADOS, leer) === null);
prueba("silencio: sin la clave (agosto) no hay frase; con 0 sin leer tampoco", fraseCertificadoSinLeer(170, 170, undefined) === null && fraseCertificadoSinLeer(220, 220, 0) === null);

const ruta = new URL("../dist/informe-pqc/index.html", import.meta.url);
if (existsSync(ruta)) {
  const html = readFileSync(ruta, "utf8");
  const ed = /data-edicion="([\d-]+)"/.exec(html)?.[1];
  if (ed) {
    // La frase vieja «No exploramos rutas ni directorios.» se precisa sólo donde sí pedimos security.txt
    // (aprobado por Nicholas el 18-nov: «Sí, así»). Agosto la conserva tal cual.
    const fr = APROBADOS.find((a) => a.edicion === ed && a.seccion === "legal-frase-rutas"), conSec = !!fr, h = texto(html);
    // la frase sale del archivo sellado, no de un literal de este chequeo
    const nueva = frase(leer(APROBADOS.find((a) => a.seccion === "legal-frase-rutas").archivo));
    const vieja = "No exploramos rutas ni directorios. No escaneamos";
    prueba(`dist/informe-pqc (${ed}): frase de rutas ${conSec ? "precisada" : "original"}`, conSec ? h.includes(nueva) && !h.includes(vieja) : h.includes(vieja) && !h.includes(nueva));
    const enPagina = texto(html).includes(sellada);
    prueba(`dist/informe-pqc (${ed}): frase del certificado sin leer ${ed === selloSL.edicion ? "presente y sellada" : "ausente"}`, ed === selloSL.edicion ? enPagina : !enPagina);
    // Texto 5 en la web (19-nov): con hallazgo_cert, el párrafo es el campo de la edición + el cierre sellado.
    const datosEd = [new URL(`../src/data/informe-pqc/${ed}.json`, import.meta.url)].filter(existsSync).map((u) => JSON.parse(readFileSync(u, "utf8")))[0];
    const hc = datosEd?.indice?.hallazgo_cert?.texto;
    const cierre = cierreCertificados(ed, APROBADOS, leer);
    if (cierre) {
      const parr = (/<p data-certificados-constante>([\s\S]*?)<\/p>/.exec(html.replace(/<!--[\s\S]*?-->/g, "")) || [])[1] ?? "";
      prueba(`dist/informe-pqc (${ed}): texto 5 · 1) no dice «prácticamente constante»`, !h.includes("prácticamente constante"));
      prueba(`dist/informe-pqc (${ed}): texto 5 · 2) ni «null» ni «Sólo  se separan» en el párrafo`, !/null|undefined|Sólo\s+se separan/.test(parr) && !/Sólo\s+se separan/.test(h));
      prueba(`dist/informe-pqc (${ed}): texto 5 · 3) el párrafo es hallazgo_cert.texto + el cierre sellado`, texto(parr).trim() === `${hc} ${cierre}`);
    } else {
      prueba(`dist/informe-pqc (${ed}): sin texto 5 declarado, sin su párrafo`, !html.includes("data-certificados-constante"));
    }
    const mal = revisar(html, ed); prueba(`dist/informe-pqc (${ed}): ${mal.length ? mal.join(" · ") : "textos aprobados donde van y sólo ahí"}`, mal.length === 0);
  }
  else { saltadas++; console.log("  SALTADA dist/informe-pqc: la página no declara data-edicion"); }
} else { saltadas++; console.log("  SALTADA dist/informe-pqc (no hay build)"); }

console.log(`\ncheck-informe-textos: ${pasa} pasaron, ${falla} fallaron, ${saltadas} saltadas`);
if (falla) process.exit(1);
