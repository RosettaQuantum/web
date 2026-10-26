#!/usr/bin/env node
/**
 * T-og-tarjeta — la tarjeta social por nota sale en PAPEL, con sus letras, a 1200x630, y
 * contra las filas REALES de li_cards.
 *
 * EL DEFECTO QUE LO HIZO NECESARIO, QUE FUE MIO
 * ---------------------------------------------
 * La primera version de /og/<id>.png se escribio sin poder leer la D1 de produccion y
 * resolvio adivinando: `SELECT *` sobre li_cards y emparejado de nombres candidatos
 * (`post_id`, `title`, `tldr`…). La semilla local tenia esa misma forma inventada, asi
 * que **el codigo inventado pasaba contra la fixture inventada**, en verde, y la cabecera
 * devolvia los nombres de mi propia fixture como si fueran un dato de produccion. El
 * esquema real tiene tres columnas —slug_base, spec_json, created_at— y el contenido vive
 * DENTRO del JSON: no existia ni una de las columnas que el codigo creia leer.
 *
 * De ahi el caso 1 de este guardia, que es el que de verdad importa: **las cuatro filas
 * reales se parsean y se dibujan con el mismo codigo que corre en el Worker.** No hay
 * forma de pasar contra una fixture imaginada.
 *
 * LOS OTROS DOS MODOS DE FALLO, LOS DOS MUDOS
 * -------------------------------------------
 *  · LA PALETA VIEJA. El sitio paso de basalto #141210 a papel #F4F5F1. Una tarjeta en
 *    basalto se genera perfecto, pesa lo mismo, mide 1200x630 y responde 200. Por eso el
 *    fondo se lee DEL PNG y se compara contra el token de global.css, no contra una
 *    constante de este archivo —que seria darse la razon solo.
 *  · LA TIPOGRAFIA. En un Worker no hay fuentes del sistema: un texto cuya familia falta
 *    no da error ni cae a un sustituto, sale VACIO. Y un `<b>` sin la cara SemiBold
 *    cargada sale en regular sin que nadie lo note. Las dos se miden.
 *
 * GRITO Y SILENCIO, Y EL DE SILENCIO ES EL PARADOJICO
 * ---------------------------------------------------
 *  · GRITO 1 — render sin fontBuffers: tiene que detectarse como `sin-glifos`.
 *  · GRITO 2 — --paper mutado a basalto: el pixel tiene que cantarlo.
 *  · GRITO 3 — un `fill="#141210"` en el CODIGO tiene que detectarse.
 *  · GRITO 4 — una lista de columnas con `post_id` (el error original) tiene que caerse
 *    contra el esquema declarado.
 *  · SILENCIO — un archivo cuyo COMENTARIO describe el defecto («el fondo NO es basalto
 *    #141210») y cuyo codigo usa el token tiene que CALLARSE.
 *
 * PUNTO CIEGO DECLARADO
 * ---------------------
 * Comprueba color, tinta, geometria, cobertura de glifos, el sello de las tres TTF y que
 * las columnas que la ruta lee existan en el esquema declarado. NO comprueba que la
 * tarjeta se vea BIEN, ni que el reparto de dos columnas sea el que el motor imagino: el
 * spec describe datos, no geometria. Tampoco ve una TERCERA forma de spec_json que
 * aparezca manana — eso cae a `posts` en vivo y lo declara `X-RQ-OG`, no este guardia.
 *
 * Uso:  node scripts/check-og-tarjeta.mjs
 */
export const CONSUMIDOR = {
  quien: "la sesion que toca lib/og.mjs, lib/og-ruta.mjs o las fuentes de og/fonts/",
  hace: "no despliega: la tarjeta se genera igual —200, 1200x630— y sale en la paleta vieja, sin letras, o leyendo columnas que no existen, y LinkedIn la cachea asi durante meses",
};

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import {
  construirTarjeta, tokensDeCss, marcaDeSvg, leerPng, hexARgb, medidor,
  LIENZO, COLUMNAS_LI_CARDS, clavesDe, formaDe,
} from "../lib/og.mjs";

/** Las TTF que se embeben en el Worker, selladas. Una fuente cambiada es otra marca. */
const FUENTES = [
  ["og/fonts/Newsreader-Regular.ttf", "b8f5e0a8bdd6a12c722ca5635d9da87e77ccbb2d0172112e34e00c4e55f2cd5a"],
  ["og/fonts/Newsreader-SemiBold.ttf", "04188d5295f4e1100ce91a96b864f15b7af5be976e9fb9cc279af737be804272"],
  ["og/fonts/IBMPlexMono-Regular.ttf", "a7fdc993f9f0387caedba4e42521136fa97e4c0837ae6239bf0413ccf8af00c2"],
];
const RENDERIZADORES = ["lib/og.mjs", "lib/og-ruta.mjs"];
const ESQUEMA = "db/li-cards.schema.sql";
const FILAS_REALES = "test/li_cards.real.seed.sql";
const BASALTO = "#141210";

let fallos = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const mal = (t) => { console.log(`  FALLA ${t}`); fallos++; };

await initWasm(readFileSync("node_modules/@resvg/resvg-wasm/index_bg.wasm"));

// ── 0 · las fuentes y los tokens ─────────────────────────────────────────────────────
const buffers = [];
for (const [ruta, sha] of FUENTES) {
  const b = readFileSync(ruta);
  const real = createHash("sha256").update(b).digest("hex");
  if (real !== sha) mal(`${ruta} no es la sellada (${real.slice(0, 12)} != ${sha.slice(0, 12)})`);
  else ok(`${ruta.padEnd(34)} sha ${sha.slice(0, 12)}`);
  buffers.push(new Uint8Array(b));
}
let tokens;
try { tokens = tokensDeCss(readFileSync("src/styles/global.css", "utf8")); }
catch (e) {
  console.log(`  FALLA ${e.message}`);
  console.log("\nT-og-tarjeta: 1 problema(s). Sin tokens no hay tarjeta que comprobar.");
  process.exit(1);
}
const marca = marcaDeSvg(readFileSync("public/rosetta-mark.svg", "utf8"));
ok(`tokens de global.css              paper ${tokens.paper} - ink ${tokens.ink} - verdict ${tokens.verdict} - pending ${tokens.pending}`);
if (tokens.paper.toUpperCase() === BASALTO) mal("global.css declara el papel en basalto — el sitio dejo de ser oscuro en v1.1");

const papel = hexARgb(tokens.paper);
/** Hay al menos un pixel de ese color (con holgura por el antialias) en el rectangulo. */
function hayColor(im, c, rgb, tol = 24) {
  for (let y = Math.max(0, c.y); y < Math.min(c.y + c.h, im.alto); y += 2)
    for (let x = Math.max(0, c.x); x < Math.min(c.x + c.w, im.ancho); x += 2) {
      const p = im.pixel(x, y);
      if (Math.abs(p[0] - rgb[0]) + Math.abs(p[1] - rgb[1]) + Math.abs(p[2] - rgb[2]) <= tol) return true;
    }
  return false;
}

/** Fraccion de pixeles que NO son el fondo dentro de un rectangulo del PNG. */
function tinta(im, c) {
  let n = 0, m = 0;
  for (let y = Math.max(0, c.y); y < Math.min(c.y + c.h, im.alto); y += 2)
    for (let x = Math.max(0, c.x); x < Math.min(c.x + c.w, im.ancho); x += 2) {
      m++;
      const p = im.pixel(x, y);
      if (Math.abs(p[0] - papel[0]) + Math.abs(p[1] - papel[1]) + Math.abs(p[2] - papel[2]) > 12) n++;
    }
  return m ? (100 * n) / m : 0;
}

// ── 1 · las columnas que la ruta lee existen en el esquema DECLARADO ────────────────
// VA PRIMERO a proposito: si la ruta vuelve a inventar columnas, la consulta del caso 2
// se cae con un «no such column» crudo y el guardia se lee como roto en vez de como
// «la ruta lee algo que no existe», que es el defecto que este caso existe para nombrar.
/** Columnas de un CREATE TABLE, sin comentarios: la prosa no declara nada. */
export function columnasDeclaradas(sql) {
  const limpio = String(sql ?? "").replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
  const m = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?li_cards[`"']?\s*\(([\s\S]*?)\n?\s*\);/i.exec(limpio);
  if (!m) return null;
  return m[1].split("\n").map((l) => (/^\s*[`"'\[]?([A-Za-z_]\w*)/.exec(l) || [])[1]).filter(Boolean);
}
/** @returns {string[]} las columnas que se leen y NADIE declara. */
export function columnasHuerfanas(leidas, declaradas) {
  if (!declaradas) return ["(el esquema no declara li_cards)"];
  const d = new Set(declaradas.map((c) => c.toLowerCase()));
  return leidas.filter((c) => !d.has(String(c).toLowerCase()));
}
console.log("");
const declaradas = columnasDeclaradas(readFileSync(ESQUEMA, "utf8"));
const huerfanas = columnasHuerfanas(COLUMNAS_LI_CARDS, declaradas);
if (huerfanas.length) mal(`la ruta lee ${huerfanas.join(", ")} y ${ESQUEMA} no lo declara`);
else ok(`columnas que lee la ruta          ${COLUMNAS_LI_CARDS.join(", ")} - declaradas en ${ESQUEMA} (${declaradas.length})`);

// Y el wildcard, que es la forma concreta que tuvo el defecto: con `SELECT *` nadie se
// entera de que las columnas no son las que el codigo cree.
const fuenteRuta = readFileSync("lib/og-ruta.mjs", "utf8");
if (/SELECT\s+\*\s+FROM\s+li_cards/i.test(fuenteRuta)) mal("lib/og-ruta.mjs hace SELECT * sobre li_cards: el wildcard es lo que escondio el desajuste");
else ok("lib/og-ruta.mjs                   sin SELECT * sobre li_cards");

// ── 2 · LAS CUATRO FILAS REALES, parseadas y dibujadas con el codigo del Worker ──────
// Se cargan en un SQLite en memoria en vez de leer el .sql con un regex: asi el JSON
// pasa por el mismo escapado de comillas que en D1, que es donde se rompen estas cosas.
const db = new DatabaseSync(":memory:");
db.exec(readFileSync(FILAS_REALES, "utf8"));
let filas = [];
try {
  filas = db.prepare(`SELECT ${COLUMNAS_LI_CARDS.join(", ")} FROM li_cards ORDER BY slug_base`).all();
} catch (e) {
  mal(`la consulta de la ruta no corre contra las filas REALES: ${e.message}`);
}
console.log(`\n  li_cards reales: ${filas.length} fila(s) en ${FILAS_REALES}`);
if (filas.length < 2) mal("la semilla real trae menos de 2 filas: no alcanza para ejercer las dos formas");

const formasVistas = new Set();
for (const fila of filas) {
  const etiqueta = fila.slug_base.slice(0, 46).padEnd(46);
  let spec = null;
  try { spec = JSON.parse(fila.spec_json); } catch (e) { mal(`${etiqueta} spec_json no parsea`); continue; }
  const forma = formaDe(spec);
  if (!forma) { mal(`${etiqueta} forma desconocida: la ruta caeria a posts`); continue; }
  formasVistas.add(forma);
  // La forma B es bilingue: se dibujan sus DOS idiomas.
  for (const lang of forma === "B" ? ["en", "es"] : ["en"]) {
    const r = construirTarjeta({ forma, spec, lang, tokens, ...marca }, { Resvg, fontBuffers: buffers });
    if (r.error) { mal(`${etiqueta} forma ${forma}/${lang}: ${r.error}`); continue; }
    const im = leerPng(r.png, (b) => inflateSync(b));
    const problemas = [];
    if (im.ancho !== LIENZO.ancho || im.alto !== LIENZO.alto) problemas.push(`IHDR ${im.ancho}x${im.alto}`);
    const esquina = im.pixel(4, 4).slice(0, 3);
    if (esquina.join(",") !== papel.join(",")) problemas.push(`fondo rgb(${esquina})`);
    const t = tinta(im, r.meta.caja);
    if (t < 4) problemas.push(`${t.toFixed(2)}% de tinta en la caja del titular`);
    // El marcado del motor tiene que quedar DIBUJADO, no impreso: si <accent> se perdiera
    // —o si alguien lo imprimiera literal— no habria un solo pixel del teal de veredicto
    // dentro del titular, y la tarjeta se veria «bien» igual.
    const pideAcento = forma === "A" && /<accent>/i.test(String(spec.title_html || ""));
    if (pideAcento && !hayColor(im, r.meta.caja, hexARgb(tokens.verdict))) {
      problemas.push("el <accent> del titular no pinto ni un pixel de --verdict");
    }
    if (problemas.length) mal(`${etiqueta} ${forma}/${lang} — ${problemas.join(" · ")}`);
    else ok(`${etiqueta} ${forma}/${lang} ${im.ancho}x${im.alto} - fondo papel - titular ${t.toFixed(1)}% - omitidos: ${r.meta.omitidos.length ? r.meta.omitidos.join("+") : "ninguno"}`);
  }
}
for (const f of ["A", "B"]) if (!formasVistas.has(f)) mal(`la semilla real no ejerce la forma ${f}`);



// ── 3 · la cara SemiBold existe de verdad (el `<b>` del motor) ───────────────────────
{
  const medir = medidor(Resvg, buffers);
  const frase = "advantage utility";
  const r400 = medir(frase, 84, "Newsreader", 400), r600 = medir(frase, 84, "Newsreader", 600);
  if (r400 <= 0 || r600 <= 0) mal("Newsreader no pinta: medida 0");
  else if (Math.abs(r600 - r400) < 1) mal(`<b> sale en regular: 400 mide ${r400.toFixed(1)} y 600 mide ${r600.toFixed(1)} — la cara SemiBold no cargo`);
  else ok(`la negrita del motor es negrita   400 -> ${r400.toFixed(0)} px, 600 -> ${r600.toFixed(0)} px`);
  // El ancho del espacio se saca por diferencia; si diera 0, toda la envoltura mentiria.
  if (medir.espacio(84, "Newsreader", 400) <= 0) mal("el ancho del espacio mide 0: la envoltura sumaria cero por cada espacio");
  else ok(`ancho del espacio                 ${medir.espacio(84, "Newsreader", 400).toFixed(1)} px a 84 px`);

  // Cobertura de glifos, sacada de las FILAS REALES y no de una lista inventada: lo que
  // una fuente no tiene no sale en rojo, no sale.
  const raros = [...new Set([...readFileSync(FILAS_REALES, "utf8")].filter((c) => c.codePointAt(0) > 126))];
  const faltan = [];
  for (const fam of ["Newsreader", "IBM Plex Mono"])
    for (const c of raros) if (medir(c, 84, fam, 400) <= 0) faltan.push(`${c} en ${fam}`);
  if (faltan.length) mal(`glifos ausentes: ${faltan.join(", ")} — ese caracter desaparece de la tarjeta sin avisar`);
  else ok(`glifos de las filas reales        ${raros.length} no-ASCII, presentes en las dos familias`);
}

// ── 4 · GRITOS 1 y 2, por mutacion sobre el render ──────────────────────────────────
const NOTA = {
  forma: "NOTA", tokens, ...marca,
  nota: {
    titular: 'What is an "advantaged solve" and why does it matter?',
    tldr: "", rotulo: "PILLAR B · STATE AS OF 2026-08-26", pie: "rosettaquantum.com/blog/advantaged-solve",
  },
};
console.log("");
{
  const r = construirTarjeta(NOTA, { Resvg, fontBuffers: [] });
  if (r.error === "sin-glifos") ok("grito 1  sin fontBuffers          detectado como sin-glifos");
  else mal(`grito 1  sin fontBuffers: se esperaba sin-glifos y dio ${r.error ? r.error : "un PNG"}`);
}
{
  const r = construirTarjeta({ ...NOTA, tokens: { ...tokens, paper: BASALTO } }, { Resvg, fontBuffers: buffers });
  if (r.error) mal(`grito 2  no se pudo construir la mutada: ${r.error}`);
  else {
    const p = leerPng(r.png, (b) => inflateSync(b)).pixel(4, 4).slice(0, 3);
    if (p.join(",") === hexARgb(BASALTO).join(",")) ok("grito 2  papel mutado a basalto   el pixel lo canta");
    else mal(`grito 2  el pixel dio rgb(${p}) y la mutacion pedia basalto: la lectura del fondo no mide lo que dice`);
  }
}

// ── 5 · el color vive en global.css: ni un hex en el codigo que dibuja ──────────────
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

// ── 6 · SILENCIO (el paradojico) y GRITOS 3 y 4, por mutacion sobre texto ───────────
console.log("");
{
  const prosa = `/* El fondo NO es basalto ${BASALTO}: desde v1.1 es papel. */\nconst f = \`fill="\${tokens.paper}"\`;\n`;
  if (hexEnCodigo(prosa).length === 0) ok("silencio el defecto DESCRITO en un comentario no se cuenta como defecto");
  else mal("silencio un comentario que nombra basalto hizo gritar al guardia: lee prosa, no codigo");

  if (hexEnCodigo(`const f = \`fill="${BASALTO}"\`;\n`).includes(BASALTO)) ok("grito 3  un fill basalto en el codigo se detecta");
  else mal("grito 3  la prueba de grito no detecto el hex inyectado");

  // El error original, exactamente: columnas que no existen en el esquema real.
  const inventadas = ["post_id", "title", "tldr", "pillar", "date", "lang"];
  const pilladas = columnasHuerfanas(inventadas, declaradas);
  if (pilladas.length === inventadas.length) ok(`grito 4  las 6 columnas inventadas (post_id, title, …) se detectan como no declaradas`);
  else mal(`grito 4  solo ${pilladas.length} de ${inventadas.length} columnas inventadas se detectaron: el caso que ya ocurrio volveria a pasar`);

  // Y el silencio del mismo caso: una columna declarada de verdad no puede gritar.
  if (columnasHuerfanas(["spec_json"], declaradas).length === 0) ok("silencio una columna que SI esta declarada no hace gritar al guardia");
  else mal("silencio spec_json esta declarada y el guardia la marco: falso positivo");

  // Un spec de forma desconocida NO puede pasar por A ni por B.
  if (formaDe({ cualquier: "cosa" }) === null && formaDe({ title_html: "x" }) === "A" && formaDe({ headline_es: "x" }) === "B") {
    ok("silencio un spec de forma desconocida cae a posts en vez de dibujarse a medias");
  } else mal("la deteccion de forma no distingue A, B y desconocida");

  // Y la clave: el id lleva sufijo de idioma y li_cards no.
  const c = clavesDe("advantaged-solve-es");
  if (c.lang === "es" && c.claves[0] === "advantaged-solve") ok("silencio /og/<slug>-es.png busca el slug SIN sufijo, y en espanol");
  else mal(`clavesDe devolvio ${JSON.stringify(c)}: la busqueda por slug_base esta mal`);
}

console.log(fallos
  ? `\nT-og-tarjeta: ${fallos} problema(s). La tarjeta se genera igual: por eso esto se mira aqui.`
  : `\nT-og-tarjeta: ${filas.length} filas reales dibujadas, papel, letras y 1200x630 leidos del PNG.`);
process.exit(fallos ? 1 : 0);
