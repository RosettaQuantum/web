#!/usr/bin/env node
/**
 * Arma la visualizacion de un challenge a partir de piezas separadas, en los dos
 * idiomas.
 *
 * POR QUE
 * -------
 * El entregable original era UN archivo de 113.916 bytes del que **101.972 (89,5%)
 * eran datos**: `DATA` (coordenadas) y `ST` (estadistica) enterrado a mitad del
 * script. El render real son 8 KB. Con ese formato, el challenge siguiente no es
 * publicar datos nuevos: es fabricar otro HTML de 114 KB a mano.
 *
 * QUE PROTEGE LA VERIFICACION, Y QUE YA NO
 * -----------------------------------------
 * Cuando esto era solo una separacion, se podia rearmar y comparar el sha256 contra
 * el entregable original: calzaba exacto. Eso ya NO aplica — la pagina ahora lleva
 * etiquetas de honestidad y esta en dos idiomas, o sea que cambio a proposito. Decir
 * que sigue siendo byte-identica seria mentir.
 *
 * Lo que si se sigue protegiendo, y es lo que importa: **los datos no se tocaron**.
 * Los dos JSON se comparan por sha256 contra lo que se extrajo del entregable
 * original. Si alguien edita una coordenada o un percentil, esto grita.
 *
 * Uso:
 *   node scripts/build-viz-cleveland.mjs --verificar
 *   node scripts/build-viz-cleveland.mjs --salida a.html [--lang en] [--datos <json>]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(RAIZ, "src/viz/cleveland");

// Sellos de los datos tal como salieron del entregable original de Cleveland.
const SHA_DATOS = {
  "datos/cleveland-2026-07.json": "c00a761ffc4c0085077a728c5c619e70d9cdb6696a7450439b86f70d1dd57421",
  "datos/cleveland-2026-07.stats.json": "409883d8cd291e4f11f4721de68254024344dd65d15f50ce6efa0d1d3c79ceed",
};
const SHA_ENTREGABLE = "831ae820774455f98cfd20c07c4c9014032c12526bf0cac61520bb0c5994742d";

/**
 * Texto de la pagina, en los dos idiomas.
 * Aprobado por Nicholas el 9-ago-2026 (las etiquetas de honestidad y «notarizado»).
 * No se toca sin pasar por el.
 */
const TXT = {
  es: {
    titulo: "Rosetta Quantum — Cleveland Clinic: conectividad cuántica y sitios predichos",
    h1: "· Cleveland Clinic · caminata cuántica sobre la red de contactos",
    sub: "Rejilla congelada en PR-CLEV-001 (corte 8,5 Å, ventana 0,5–8,0, 16 muestras). " +
         "Ningún parámetro ajustado por proteína. Estructura de entrada = apo; el sitio conocido " +
         "se lee del fármaco co-cristalizado en la holo y <b>nunca entra al cálculo</b>.",
    btnQ: "caminata cuántica", btnD: "difusión clásica",
    btnS: "sitio conocido", btnP: "sitios predichos", btnG: "girar",
    leg: "puntaje de propagación (percentil entre residuos distales)",
    bajo: "bajo", alto: "alto",
    legV: "sitio conocido — leído del fármaco co-cristalizado, nunca entra al cálculo",
    legF: "fuente (sitio activo)",
    pie: "Corrida notarizada · rejilla congelada en PR-CLEV-001 · las cifras de esta página salen " +
         "del mismo JSON que las corridas del ledger, y su sello está publicado.",
  },
  en: {
    titulo: "Rosetta Quantum — Cleveland Clinic: quantum connectivity and predicted sites",
    h1: "· Cleveland Clinic · quantum walk over the contact network",
    sub: "Grid frozen in PR-CLEV-001 (cutoff 8.5 Å, window 0.5–8.0, 16 samples). " +
         "No parameter tuned per protein. Input structure = apo; the known site " +
         "is read from the co-crystallised drug in the holo and <b>never enters the computation</b>.",
    btnQ: "quantum walk", btnD: "classical diffusion",
    btnS: "known site", btnP: "predicted sites", btnG: "spin",
    leg: "propagation score (percentile among distal residues)",
    bajo: "low", alto: "high",
    legV: "known site — read from the co-crystallised drug, never enters the computation",
    legF: "source (active site)",
    pie: "Notarised run · grid frozen in PR-CLEV-001 · the figures on this page come from the " +
         "same JSON as the ledger runs, and its seal is published.",
  },
};

const args = process.argv.slice(2);
const verificar = args.includes("--verificar");
const salida = args.includes("--salida") ? args[args.indexOf("--salida") + 1] : null;
const lang = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "es";
const datosArg = args.includes("--datos") ? args[args.indexOf("--datos") + 1] : "datos/cleveland-2026-07.json";
const morir = m => { console.error("ABORTA: " + m); process.exit(1); };
const leer = p => readFileSync(join(DIR, p), "utf8");
const sha = t => createHash("sha256").update(t, "utf8").digest("hex");

export function armar({ datos = datosArg, lang: L = "es", conDatos = true } = {}) {
  const t = TXT[L] || TXT.es;
  let plantilla = leer("plantilla.html");

  if (!/name="viewport"/.test(plantilla)) {
    // Sin esto el telefono renderiza a 980 px y lo escala: el texto queda ~2,6x
    // por debajo de lo legible.
    plantilla = plantilla.replace('<meta charset="utf-8">',
      '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">');
  }
  plantilla = plantilla.replace("<!DOCTYPE html>", `<!DOCTYPE html>\n<html lang="${L}">`);

  const marcas = {
    __RQ_TITULO__: t.titulo, __RQ_H1__: t.h1, __RQ_SUB__: t.sub,
    __RQ_BTN_Q__: t.btnQ, __RQ_BTN_D__: t.btnD, __RQ_BTN_S__: t.btnS,
    __RQ_BTN_P__: t.btnP, __RQ_BTN_G__: t.btnG,
    __RQ_LEG__: t.leg, __RQ_BAJO__: t.bajo, __RQ_ALTO__: t.alto,
    __RQ_LEG_V__: t.legV, __RQ_LEG_F__: t.legF, __RQ_PIE__: t.pie,
    __RQ_HOME__: L === "en" ? "/" : "/es/",
  };
  for (const [k, v] of Object.entries(marcas)) plantilla = plantilla.split(k).join(v);
  // ESTILO y SCRIPT se rellenan mas abajo; el resto tiene que estar resuelto ya.
  // Un marcador sin rellenar sale impreso en la pagina como "__RQ_BTN_Q__", que es
  // el tipo de defecto que nadie ve hasta que lo ve un cliente.
  const quedan = (plantilla.match(/__RQ_[A-Z_]+__/g) || [])
    .filter(m => m !== "__RQ_ESTILO__" && m !== "__RQ_SCRIPT__");
  if (quedan.length) morir(`quedaron marcadores sin rellenar: ${[...new Set(quedan)].join(", ")}`);

  const estilo = leer("estilo.css");
  // `conDatos:false` es el modo que se publica: la pagina arranca con los objetos
  // VACIOS y los llena desde /v1/challenges. Asi el HTML pesa ~12 KB en vez de 114.
  // El modo con datos horneados queda para revisar sin servidor.
  const render = leer("render.js").replace("__RQ_STATS__",
    conDatos ? leer(datos.replace(/\.json$/, ".stats.json")) : "{}");
  const cabeza = conDatos
    ? "const DATA=" + leer(datos)
    : "const DATA={}";
  const script = cabeza + render;
  // El script se COMPILA antes de escribirlo. Una version anterior salio con un
  // ", ST={}" huerfano — sintaxis invalida — y la pagina cargo igual: titulo, pie y
  // estilos bien, y el contenido simplemente nunca aparecio. Un HTML roto no da
  // error visible, asi que el guardia tiene que estar aca y no en el navegador.
  try { new Function(script); }
  catch (e) { morir(`el script armado no compila: ${e.message}`); }
  return plantilla.replace("__RQ_ESTILO__", "<style>" + estilo + "</style>")
                  .replace("__RQ_SCRIPT__", "<script>\n" + script + "</script>");
}

if (verificar) {
  let fallos = 0;
  console.log("LOS DATOS no se tocaron desde el entregable original:");
  for (const [ruta, esperado] of Object.entries(SHA_DATOS)) {
    if (!existsSync(join(DIR, ruta))) { console.log(`  FALTA ${ruta}`); fallos++; continue; }
    const s = sha(leer(ruta));
    const ok = s === esperado;
    console.log(`  ${ok ? "ok  " : "MAL "} ${ruta}  ${s.slice(0, 16)}…`);
    if (!ok) fallos++;
  }
  console.log(`\nEl entregable original se conserva intacto en el repo:`);
  const orig = sha(leer("cleveland_viz.original.html"));
  console.log(`  ${orig === SHA_ENTREGABLE ? "ok  " : "MAL "} cleveland_viz.original.html  ${orig.slice(0, 16)}…`);
  if (orig !== SHA_ENTREGABLE) fallos++;

  console.log("\nLas dos caras se arman y llevan lo que tienen que llevar:");
  for (const L of ["es", "en"]) {
    const html = armar({ lang: L, conDatos: true });
    const chequeos = [
      [`<html lang="${L}"`, "declara el idioma"],
      ['name="viewport"', "trae viewport"],
      [L === "es" ? "notarizada" : "Notarised", "dice notarizado en el pie"],
      [L === "es" ? "nunca entra al cálculo" : "never enters the computation", "aclara que el sitio conocido no entra al cálculo"],
    ];
    for (const [frag, que] of chequeos) {
      const ok = html.includes(frag);
      console.log(`  ${ok ? "ok  " : "MAL "} ${L}: ${que}`);
      if (!ok) fallos++;
    }
    // El render arma "Top-N" desde el dato, no desde un 5 fijo.
    const malo = /Top-5 sitios predichos|Top-5 predicted/.test(html);
    console.log(`  ${malo ? "MAL " : "ok  "} ${L}: no declara un Top-5 fijo`);
    if (malo) fallos++;
    const tildes = (html.match(/[áéíóúñÁÉÍÓÚÑ]/g) || []).length;
    if (L === "es") {
      console.log(`  ${tildes >= 20 ? "ok  " : "MAL "} es: ${tildes} tildes y eñes (el original tenía 0)`);
      if (tildes < 20) fallos++;
    }
    for (const clave of ['"aceleracion"', "qubits_codificacion_binaria"]) {
      if (!html.includes(clave)) { console.log(`  MAL  ${L}: se corrompió la clave de datos ${clave}`); fallos++; }
    }
  }
  console.log(fallos ? `\n${fallos} fallo(s)` : "\ntodo verde");
  if (fallos) process.exit(1);
}

if (salida) {
  const html = armar({ datos: datosArg, lang, conDatos: args.includes("--con-datos") });
  writeFileSync(salida, html, "utf8");
  console.log(`escrito ${salida} (${Buffer.byteLength(html)} bytes, lang=${lang})`);
}

// Modo publicar: escribe las dos caras en public/, que Astro copia tal cual a dist/.
// Se hace en el prebuild para que la pagina no pueda quedar desincronizada de las
// piezas: si alguien edita render.js y no regenera, el build lo regenera igual.
if (args.includes("--publicar")) {
  for (const [L, ruta] of [["en", "public/cleveland"], ["es", "public/es/cleveland"]]) {
    const dir = join(RAIZ, ruta);
    mkdirSync(dir, { recursive: true });
    const html = armar({ lang: L, conDatos: false });
    writeFileSync(join(dir, "index.html"), html, "utf8");
    console.log(`  ${ruta}/index.html  ${Buffer.byteLength(html)} bytes (lang=${L})`);
  }
}

if (!verificar && !salida && !args.includes("--publicar"))
  console.log("nada que hacer: pasa --verificar, --publicar o --salida <archivo>");
