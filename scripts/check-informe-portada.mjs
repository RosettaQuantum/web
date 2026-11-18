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

/**
 * Fichas marcadas `_sin_comparacion` (17-nov-2026): la cifra anterior medía otra cosa, así que
 * la ficha no puede llevar una píldora con signo ni una flecha. Recibe el HTML y los titulares
 * de la edición que ese HTML muestra. Devuelve [problemas, fichas_miradas].
 * Mira la ficha por su rótulo (`<span class="k">`), que es lo que el lector ve.
 */
export function revisarFichas(html, titulares) {
  const h = sinComentarios(html), mal = [];
  const fichas = [...h.matchAll(/<div class="tile[^"]*">([\s\S]*?)<\/div>/g)].map((m) => m[1]);
  const rotulo = (f) => (/<span class="k"[^>]*>([\s\S]*?)<\/span>/.exec(f)?.[1] ?? "").replace(/<[^>]+>/g, "").replace(/\s*\*$/, "").trim();
  let miradas = 0;
  for (const t of titulares ?? []) {
    if (!t._sin_comparacion) continue;
    const f = fichas.find((x) => rotulo(x) === t.k);
    if (!f) { mal.push(`la ficha «${t.k}» está marcada sin comparación y no aparece en la página`); continue; }
    miradas++;
    const chip = /<span class="delta [^"]*"[^>]*>([^<]*)<\/span>/.exec(f)?.[1] ?? "";
    if (/^[+\-−]/.test(chip.trim()) || /→/.test(f)) mal.push(`la ficha «${t.k}» no admite comparación y publica «${chip.trim() || "→"}»`);
  }
  return [mal, miradas];
}

/**
 * Bandas del índice (18-nov-2026, «Sí, 0·0%»): una banda con conteo 0 se pinta «0 · 0%», nunca «—».
 * El «—» queda sólo para la banda SIN conteo, que desde 2026-11 tumba el build (index.astro) y en
 * 2026-08 es la ausencia publicada. Devuelve [problemas, filas_miradas].
 */
export function revisarBandas(html, conteo) {
  const h = sinComentarios(html), mal = [];
  let miradas = 0;
  for (const m of h.matchAll(/<tr[^>]*>\s*<td><strong>([^<]+)<\/strong><\/td>\s*<td class="mono">[^<]*<\/td>\s*<td>[\s\S]*?<\/td>\s*<td class="num">([^<]*)<\/td>/g)) {
    const [, banda, celda] = m;
    if (!(banda in (conteo ?? {})) && celda.trim() !== "—") { mal.push(`«${banda}» no tiene conteo y la página dice «${celda.trim()}»`); continue; }
    if (!(banda in (conteo ?? {}))) { miradas++; continue; }
    miradas++;
    const n = conteo[banda];
    if (!celda.trim().startsWith(`${n} · `)) mal.push(`«${banda}» tiene conteo ${n} y la página dice «${celda.trim()}»`);
  }
  return [mal, miradas];
}

let pasa = 0, falla = 0, saltadas = 0;
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
// Texto 1 aprobado el 18-nov: la frase de la portada es la fila «Diría» del documento sellado, sin la promesa de aviso.
{
  const md = readFileSync(new URL("../src/data/informe-pqc/textos/2026-11/textos-aprobados-2026-11-18.md", import.meta.url), "utf8");
  const diria = /\| \*\*Diría\*\* \| Pendiente antes de publicar: (.+?)\. Esta edición/.exec(md)?.[1];
  prueba("texto 1 aprobado: la frase construida (6, 14) es la fila «Diría» del documento sellado", pendientePorDefecto(6, 14) === diria);
  prueba("MUTACIÓN la promesa vieja de aviso previo ya no calza con lo aprobado", `${pendientePorDefecto(6, 14)}, y aviso previo a las organizaciones con hallazgos` !== diria);
}
prueba("MUTACIÓN «cuatro» y «11» clavados: gritan los dos",
  revisarHtml(pagina({ ventana: ventanaTexto({ desde: "2026-11-06", hasta: "2026-11-06" }),
    frase: "revisión legal de los cuatro puntos marcados en la sección 11, y aviso previo a las organizaciones con hallazgos" })).length === 2);
// 3 · silencio: dos días distintos llevan flecha y está bien.
prueba("silencio: ventana de dos días con flecha", revisarHtml(pagina({ ventana: ventanaTexto({ desde: "2026-07-31", hasta: "2026-08-02" }), frase: pendientePorDefecto(6, 14) })).length === 0);
// 4 · silencio paradójico: el defecto sólo en un comentario.
prueba("silencio paradójico: «sección 11» y «cuatro puntos» sólo en un comentario",
  revisarHtml(`<!-- revisión legal de los cuatro puntos marcados en la sección 11 · Medición 2026-11-06 → 2026-11-06 -->` +
    pagina({ ventana: ventanaTexto({ desde: "2026-07-31", hasta: "2026-08-02" }), frase: pendientePorDefecto(6, 14) })).length === 0);
// 6 · fichas sin comparación. Grito, silencio de la vecina y silencio paradójico.
const ficha = (k, chip) => `<div class="tile "><span class="k">${k}</span><span class="v">97%</span><span class="sub"><span class="delta up">${chip}</span> x</span></div>`;
const TIT = [{ k: "Sin security.txt publicado", _sin_comparacion: "otra base" }, { k: "Con híbrido post-cuántico" }];
prueba("MUTACIÓN delta() sin la condición: «+1%» en la ficha marcada grita",
  revisarFichas(ficha(TIT[0].k, "+1%") + ficha(TIT[1].k, "+4%"), TIT)[0].length === 1);
prueba("silencio: marcada en «línea base» y la vecina conserva su «+4%»",
  revisarFichas(ficha(TIT[0].k, "línea base") + ficha(TIT[1].k, "+4%"), TIT)[0].length === 0);
prueba("silencio paradójico: «+1%» sólo dentro de un comentario",
  revisarFichas(`<!-- ${ficha(TIT[0].k, "+1%")} -->` + ficha(TIT[0].k, "línea base"), TIT)[0].length === 0);
prueba("grito: la ficha marcada desapareció de la página", revisarFichas(ficha(TIT[1].k, "+4%"), TIT)[0].length === 1);

// 7 · bandas con cero
const fila = (b, c) => `<tr><td><strong>${b}</strong></td><td class="mono">0–20</td><td>x</td><td class="num">${c}</td></tr>`;
prueba("MUTACIÓN plantilla vieja: el 0 medido pintado «—» grita",
  revisarBandas(fila("Expuesto", "—") + fila("Consciente", "33 · 15%"), { Expuesto: 0, Consciente: 33 })[0].length === 1);
prueba("silencio: el 0 se pinta «0 · 0%» y la vecina «33 · 15%»",
  revisarBandas(fila("Expuesto", "0 · 0%") + fila("Consciente", "33 · 15%"), { Expuesto: 0, Consciente: 33 })[0].length === 0);
prueba("silencio (agosto): banda sin conteo publicada como «—»",
  revisarBandas(fila("Expuesto", "—"), { Consciente: 28 })[0].length === 0);
prueba("grito: banda sin conteo pintada como «0 · 0%» (un cero inventado)",
  revisarBandas(fila("Expuesto", "0 · 0%"), { Consciente: 28 })[0].length === 1);

// 5 · la página construida de verdad
const ruta = new URL("../dist/informe-pqc/index.html", import.meta.url);
if (existsSync(ruta)) {
  const mal = revisarHtml(readFileSync(ruta, "utf8"));
  prueba(`dist/informe-pqc: ${mal.length ? mal.join(" · ") : "sin números clavados ni fecha repetida"}`, mal.length === 0);
  // La edición que muestra el build: la que diga RQ_INFORME_PREVIEW, o la publicada (declarada aquí, no adivinada).
  const html = readFileSync(ruta, "utf8");
  const ed = /data-edicion="([\d-]+)"/.exec(html)?.[1] ?? process.env.RQ_INFORME_PREVIEW ?? null;
  const fuente = ed && [new URL(`../src/data/informe-pqc/${ed}.json`, import.meta.url)].find(existsSync);
  if (fuente) {
    const datos = JSON.parse(readFileSync(fuente, "utf8"));
    const [malB, nb] = revisarBandas(html, datos.indice?.bandas_conteo);
    prueba(`dist/informe-pqc bandas (${ed}, ${nb} filas): ${malB.length ? malB.join(" · ") : "cada cero como 0 y cada ausencia como —"}`, malB.length === 0 && nb === (datos.indice?.bandas?.length ?? -1));
    const [malF, n] = revisarFichas(html, datos.titulares);
    prueba(`dist/informe-pqc fichas sin comparación (${ed}, ${n} marcadas): ${malF.length ? malF.join(" · ") : "ninguna con variación"}`, malF.length === 0);
  } else { saltadas++; console.log(`  SALTADA fichas sin comparación: no sé qué edición muestra el build (${ed ?? "sin marca"})`); }
} else { saltadas++; console.log("  SALTADA dist/informe-pqc (no hay build)"); }

console.log(`\ncheck-informe-portada: ${pasa} pasaron, ${falla} fallaron, ${saltadas} saltadas`);
if (falla) process.exit(1);
