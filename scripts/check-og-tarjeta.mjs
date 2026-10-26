#!/usr/bin/env node
/**
 * T-og-tarjeta — la tarjeta social por nota sale en PAPEL, con sus letras, a 1200x630.
 *
 * EL DEFECTO QUE VIGILA, Y POR QUE NINGUNO DE LOS QUE YA EXISTEN LO VERIA
 * ----------------------------------------------------------------------
 * /og/<id>.png se dibuja en el Worker con resvg. Sus dos modos de fallo son MUDOS:
 *
 *  1. LA PLANTILLA SE QUEDA EN LA PALETA VIEJA. El sitio paso de basalto #141210 a papel
 *     #F4F5F1 (Sistema de marca v1.1). Una tarjeta en basalto se genera perfecto, pesa lo
 *     mismo, mide 1200x630 y responde 200: lo unico que esta mal es el color, y ningun
 *     chequeo de tamano ni de estado lo ve. Por eso aqui el fondo se lee DEL PNG, pixel a
 *     pixel, y se compara contra el token --paper que declara global.css — no contra una
 *     constante de este archivo, que seria darse la razon solo.
 *
 *  2. LA TIPOGRAFIA NO CARGA. En un Worker no hay fuentes del sistema. Medido con resvg:
 *     un texto cuya familia falta no da error ni cae a un sustituto — sale VACIO. El PNG
 *     queda con el fondo correcto y sin una sola letra. Por eso se cuenta la TINTA.
 *
 * COMO SE PRUEBA ESTE GUARDIA (grito y silencio, y el de silencio es el paradojico)
 * --------------------------------------------------------------------------------
 *  · GRITO 1 — se renderiza sin fontBuffers: tiene que detectarse como `sin-glifos`.
 *  · GRITO 2 — se renderiza con --paper mutado a basalto: la lectura del pixel tiene que
 *    cantar que el fondo no es papel.
 *  · GRITO 3 — un archivo de render con `fill="#141210"` EN EL CODIGO tiene que gritar.
 *  · SILENCIO — un archivo cuyo COMENTARIO describe el defecto ("el fondo NO es basalto
 *    #141210") y cuyo codigo usa el token tiene que CALLARSE. Es el caso que separa leer
 *    codigo de leer prosa, y en este repo ya hubo un guardia que conto un marcador
 *    escrito dentro de un comentario de CSS.
 *
 * PUNTO CIEGO DECLARADO
 * ---------------------
 * Comprueba el color de fondo, que haya tinta, la geometria y el sha de las dos TTF. NO
 * comprueba que la tarjeta se vea bien, ni que el titular quepa con gracia, ni nada de
 * lo que viva en D1: aqui no hay base. Que una nota concreta produzca su tarjeta se mira
 * contra el sitio vivo, con `X-RQ-OG`.
 *
 * Uso:
 *   node scripts/check-og-tarjeta.mjs
 */
export const CONSUMIDOR = {
  quien: "la sesion que toca lib/og.mjs o las fuentes de og/fonts/",
  hace: "no despliega: la tarjeta se genera igual —200, 1200x630— y sale en la paleta vieja o sin una sola letra, y LinkedIn la cachea asi durante meses",
};

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { createHash } from "node:crypto";
import { construirTarjeta, tokensDeCss, marcaDeSvg, leerPng, hexARgb, LIENZO, medidor } from "../lib/og.mjs";

/** Las TTF que se embeben en el Worker, selladas. Una fuente cambiada es otra marca. */
const FUENTES = [
  ["og/fonts/Newsreader-Regular.ttf", "b8f5e0a8bdd6a12c722ca5635d9da87e77ccbb2d0172112e34e00c4e55f2cd5a"],
  ["og/fonts/IBMPlexMono-Regular.ttf", "a7fdc993f9f0387caedba4e42521136fa97e4c0837ae6239bf0413ccf8af00c2"],
];
/** Los archivos que DIBUJAN. Su color sale de global.css; un hex en el codigo es el defecto. */
const RENDERIZADORES = ["lib/og.mjs", "lib/og-ruta.mjs"];
const BASALTO = "#141210";

let fallos = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const mal = (t) => { console.log(`  FALLA ${t}`); fallos++; };

await initWasm(readFileSync("node_modules/@resvg/resvg-wasm/index_bg.wasm"));

// ── 1 · las fuentes son las selladas ─────────────────────────────────────────────────
const buffers = [];
for (const [ruta, sha] of FUENTES) {
  const b = readFileSync(ruta);
  const real = createHash("sha256").update(b).digest("hex");
  if (real !== sha) mal(`${ruta} no es la sellada (${real.slice(0, 12)} != ${sha.slice(0, 12)})`);
  else ok(`${ruta.padEnd(34)} sha ${sha.slice(0, 12)}`);
  buffers.push(new Uint8Array(b));
}

// ── 2 · los tokens salen de global.css, no de aqui ───────────────────────────────────
const css = readFileSync("src/styles/global.css", "utf8");
let tokens;
try { tokens = tokensDeCss(css); }
catch (e) {
  // Un token que desaparece de global.css no puede salir como stack trace: eso se lee
  // como "el guardia esta roto" y no como "falta --verdict en el sistema de marca".
  console.log(`  FALLA ${e.message}`);
  console.log("\nT-og-tarjeta: 1 problema(s). Sin tokens no hay tarjeta que comprobar.");
  process.exit(1);
}
const marca = marcaDeSvg(readFileSync("public/rosetta-mark.svg", "utf8"));
ok(`tokens de global.css              paper ${tokens.paper} · ink ${tokens.ink} · verdict ${tokens.verdict}`);
if (tokens.paper.toUpperCase() === BASALTO) mal("global.css declara el papel en basalto — el sitio dejo de ser oscuro en v1.1");

// El titular de la prueba es el <h1> ya publicado de /services/sample-report: largo, con
// dos puntos y signo de interrogacion. No se inventa una frase para la ocasion.
const DATOS = {
  titular: "Constrained portfolio compression: does QAOA beat the classical champion?",
  tldr: "A public record that cannot be rewritten.",
  rotulo: "Pillar C · State as of 2026-10-12",
  pie: "rosettaquantum.com/blog/advantaged-solve",
  tokens, ...marca,
};

// ── 3 · el caso sano: geometria, fondo y tinta, leidos DEL PNG ───────────────────────
const sana = construirTarjeta(DATOS, { Resvg, fontBuffers: buffers });
if (sana.error) mal(`la tarjeta sana no se pudo construir: ${sana.error}`);
else {
  const im = leerPng(sana.png, (b) => inflateSync(b));
  if (im.ancho !== LIENZO.ancho || im.alto !== LIENZO.alto) mal(`IHDR dice ${im.ancho}x${im.alto}, no ${LIENZO.ancho}x${LIENZO.alto}`);
  else ok(`IHDR del PNG                      ${im.ancho}x${im.alto}`);

  const papel = hexARgb(tokens.paper);
  const esquina = im.pixel(4, 4).slice(0, 3);
  if (esquina.join(",") !== papel.join(",")) mal(`el fondo es rgb(${esquina}) y --paper es rgb(${papel})`);
  else ok(`fondo del PNG                     rgb(${esquina}) = --paper ${tokens.paper}`);
  if (esquina.join(",") === hexARgb(BASALTO).join(",")) mal("el fondo salio BASALTO: la plantilla se quedo en la paleta vieja");

  let tinta = 0, muestras = 0;
  for (let y = 0; y < im.alto; y += 3) for (let x = 0; x < im.ancho; x += 3) {
    muestras++;
    const p = im.pixel(x, y);
    if (Math.abs(p[0] - papel[0]) + Math.abs(p[1] - papel[1]) + Math.abs(p[2] - papel[2]) > 12) tinta++;
  }
  const pct = (100 * tinta) / muestras;
  if (pct < 1) mal(`solo ${pct.toFixed(2)}% de la tarjeta no es fondo: la tipografia no pinto`);
  else ok(`tinta en la tarjeta               ${pct.toFixed(2)}% de ${muestras} muestras`);

  // Y la que de verdad cierra el caso: la tinta DENTRO de la caja del titular. El umbral
  // sobre el lienzo entero no servia — medido por mutacion, borrando el titular completo
  // la tarjeta seguia con 1,87% de tinta (marca, rotulo, tldr, regla y pie) y pasaba. En
  // la caja del titular, en cambio, pasa de ~12% a 0%.
  const c = sana.meta.caja;
  let tt = 0, tm = 0;
  for (let y = c.y; y < Math.min(c.y + c.h, im.alto); y += 2) for (let x = c.x; x < Math.min(c.x + c.w, im.ancho); x += 2) {
    tm++;
    const p = im.pixel(x, y);
    if (Math.abs(p[0] - papel[0]) + Math.abs(p[1] - papel[1]) + Math.abs(p[2] - papel[2]) > 12) tt++;
  }
  const pctT = tm ? (100 * tt) / tm : 0;
  if (pctT < 4) mal(`la caja del titular (${c.w}x${c.h} en ${c.x},${c.y}) tiene ${pctT.toFixed(2)}% de tinta: el titular no se pinto`);
  else ok(`tinta en la caja del titular      ${pctT.toFixed(2)}% de ${tm} muestras en ${c.w}x${c.h}`);
}

// ── 4 · los glifos con tilde existen de verdad ───────────────────────────────────────
{
  const medir = medidor(Resvg, buffers);
  const faltan = [];
  for (const g of ["ó", "á", "ú", "¿", "ñ"]) if (medir(g, 84, "Newsreader") <= 0) faltan.push(g);
  if (faltan.length) mal(`la TTF no pinta ${faltan.join(" ")} — una nota en espanol saldria mutilada`);
  else ok("glifos con tilde                  o a u ? n acentuados miden > 0 en Newsreader");
}

// ── 5 · GRITO 1: sin fuentes, la tarjeta tiene que detectarse, no salir en blanco ────
{
  const r = construirTarjeta(DATOS, { Resvg, fontBuffers: [] });
  if (r.error === "sin-glifos") ok("grito 1  sin fontBuffers          detectado como sin-glifos");
  else mal(`grito 1  sin fontBuffers: se esperaba sin-glifos y dio ${r.error ? r.error : "un PNG"}`);
}

// ── 6 · GRITO 2: el papel mutado a basalto tiene que cantar en el pixel ──────────────
{
  const r = construirTarjeta({ ...DATOS, tokens: { ...tokens, paper: BASALTO } }, { Resvg, fontBuffers: buffers });
  if (r.error) mal(`grito 2  no se pudo construir la mutada: ${r.error}`);
  else {
    const p = leerPng(r.png, (b) => inflateSync(b)).pixel(4, 4).slice(0, 3);
    if (p.join(",") === hexARgb(BASALTO).join(",")) ok("grito 2  papel mutado a basalto   el pixel lo canta");
    else mal(`grito 2  el pixel dio rgb(${p}) y la mutacion pedia basalto: la lectura del fondo no mide lo que dice`);
  }
}

// ── 7 · el color vive en global.css: ni un hex en el codigo que dibuja ───────────────
/** Quita comentarios de bloque y de linea. La prosa no es codigo. */
export function sinComentarios(fuente) {
  return String(fuente ?? "").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}
export function hexEnCodigo(fuente) {
  return [...sinComentarios(fuente).matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0]);
}
for (const f of RENDERIZADORES) {
  const hex = hexEnCodigo(readFileSync(f, "utf8"));
  if (hex.length) mal(`${f} trae ${hex.join(", ")} en el CODIGO: el color se lee de global.css`);
  else ok(`${f.padEnd(34)} sin color propio`);
}

// ── 8 · SILENCIO (el paradojico) y GRITO 3, por mutacion sobre texto ─────────────────
{
  const prosa = `/* El fondo NO es basalto ${BASALTO}: desde v1.1 es papel. */\nconst f = \`fill="\${tokens.paper}"\`;\n`;
  if (hexEnCodigo(prosa).length === 0) ok("silencio el defecto DESCRITO en un comentario no se cuenta como defecto");
  else mal("silencio un comentario que nombra basalto hizo gritar al guardia: lee prosa, no codigo");

  const codigo = `const f = \`fill="${BASALTO}"\`;\n`;
  if (hexEnCodigo(codigo).includes(BASALTO)) ok("grito 3  un fill basalto en el codigo se detecta");
  else mal("grito 3  la prueba de grito no detecto el hex inyectado");
}

console.log(fallos
  ? `\nT-og-tarjeta: ${fallos} problema(s). La tarjeta se genera igual: por eso esto se mira aqui.`
  : "\nT-og-tarjeta: papel, letras y 1200x630, leidos del PNG.");
process.exit(fallos ? 1 : 0);
