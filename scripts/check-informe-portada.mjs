/*
 * La portada del informe no afirma números que no salen del dato (18-nov-2026).
 * Defectos reales: «cuatro puntos … sección 11» (eran seis y la 14) y «Medición 2026-11-06 → 2026-11-06».
 * Mira el HTML CONSTRUIDO, sin comentarios: una frase dentro de un comentario no es la página.
 * Precisión antes que cobertura: si la página no trae la frase (edición publicada), no hay nada que mirar.
 */
export const CONSUMIDOR = { quien: "el postbuild (bloquea el deploy) y quien edite la portada del informe", hace: "deriva el conteo y la sección en vez de escribirlos, y no repite la fecha de una ventana de un día" };
import { readFileSync, existsSync } from "node:fs";
import { pendientePorDefecto, ventanaTexto, PENDIENTES_LEGALES } from "../src/lib/informe-portada.mjs";

const PALABRAS = ["cero","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez","once","doce"];
const sinComentarios = (h) => h.replace(/<!--[\s\S]*?-->/g, "");

/** Devuelve la lista de problemas del HTML de la página del informe. */
export function revisarHtml(html) {
  const h = sinComentarios(html), mal = [];
  for (const m of h.matchAll(/Medición:?\s*(\d{4}-\d{2}-\d{2})\s*→\s*(\d{4}-\d{2}-\d{2})/g))
    if (m[1] === m[2]) mal.push(`la ventana repite la fecha: «${m[0]}»`);
  const f = /revisión legal de los (\S+) puntos marcados en la sección (\d+)/.exec(h);
  if (f) {
    const ol = /<div class="rev">[\s\S]*?<ol>([\s\S]*?)<\/ol>/.exec(h);
    const puntos = ol ? (ol[1].match(/<li\b/g) || []).length : null;
    const ids = [...h.matchAll(/<section[^>]*\bid="([^"]+)"/g)].map((x) => x[1]);
    const seccion = ids.indexOf("legal") + 1;
    if (puntos == null) mal.push("la frase cuenta puntos pero no hay recuadro de pendientes");
    else if (f[1] !== PALABRAS[puntos]) mal.push(`la frase dice «${f[1]}» puntos y el recuadro tiene ${puntos}`);
    if (!seccion) mal.push("la frase cita una sección legal que la página no tiene");
    else if (Number(f[2]) !== seccion) mal.push(`la frase dice sección ${f[2]} y la sección legal es la ${seccion}`);
  }
  return mal;
}

let pasa = 0, falla = 0;
const prueba = (n, ok) => { ok ? pasa++ : falla++; console.log(`  ${ok ? "ok   " : "FALLA"} ${n}`); };
const pagina = ({ ventana, frase, lis = 6, secciones = 14, comentario = "" }) =>
  `${comentario}<span>${ventana}</span><p>Pendiente antes de publicar: ${frase}.</p>` +
  Array.from({ length: secciones }, (_, i) => `<section id="${i === secciones - 1 ? "legal" : "s" + i}"></section>`).join("") +
  `<div class="rev"><ol>${"<li>x</li>".repeat(lis)}</ol></div>`;

// 1 · grito: la fecha de un día. Mutación: la línea vieja («desde → hasta»).
prueba("un día se escribe una vez", ventanaTexto({ desde: "2026-11-06", hasta: "2026-11-06" }) === "Medición: 6 de noviembre de 2026");
prueba("MUTACIÓN línea vieja: la ventana repetida grita",
  revisarHtml(pagina({ ventana: "Medición 2026-11-06 → 2026-11-06", frase: pendientePorDefecto(6, 14) })).length === 1);
// 2 · grito: los números. Mutación: «cuatro» y «11» clavados.
prueba("la frase derivada dice seis y 14", pendientePorDefecto(PENDIENTES_LEGALES.length, 14).includes("los seis puntos marcados en la sección 14"));
prueba("MUTACIÓN «cuatro» y «11» clavados: gritan los dos",
  revisarHtml(pagina({ ventana: ventanaTexto({ desde: "2026-11-06", hasta: "2026-11-06" }),
    frase: "revisión legal de los cuatro puntos marcados en la sección 11, y aviso previo a las organizaciones con hallazgos" })).length === 2);
// 3 · silencio: dos días distintos llevan flecha y está bien.
prueba("silencio: ventana de dos días con flecha", revisarHtml(pagina({ ventana: ventanaTexto({ desde: "2026-07-31", hasta: "2026-08-02" }), frase: pendientePorDefecto(6, 14) })).length === 0);
// 4 · silencio paradójico: el defecto sólo en un comentario.
prueba("silencio paradójico: «sección 11» y «cuatro puntos» sólo en un comentario",
  revisarHtml(`<!-- revisión legal de los cuatro puntos marcados en la sección 11 · Medición 2026-11-06 → 2026-11-06 -->` +
    pagina({ ventana: ventanaTexto({ desde: "2026-07-31", hasta: "2026-08-02" }), frase: pendientePorDefecto(6, 14) })).length === 0);
// 5 · la página construida de verdad
const ruta = new URL("../dist/informe-pqc/index.html", import.meta.url);
if (existsSync(ruta)) {
  const mal = revisarHtml(readFileSync(ruta, "utf8"));
  prueba(`dist/informe-pqc: ${mal.length ? mal.join(" · ") : "sin números clavados ni fecha repetida"}`, mal.length === 0);
} else { console.log("  SALTADA dist/informe-pqc (no hay build)"); }

console.log(`\ncheck-informe-portada: ${pasa} pasaron, ${falla} fallaron`);
if (falla) process.exit(1);
