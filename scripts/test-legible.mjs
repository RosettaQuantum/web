#!/usr/bin/env node
/**
 * El guardia del texto legible.
 *
 * LA INVARIANTE
 * -------------
 * `legible()` SOLO puede agregar tildes. Si alguna vez cambia una letra, el texto que ve
 * el comprador deja de decir lo que dice el sello — y el sello es el producto. Se
 * comprueba sobre los textos REALES del archivo, no sobre ejemplos inventados.
 *
 * LAS DOS DIRECCIONES
 * -------------------
 * Un guardia que solo sabe gritar pasa todas las pruebas de gritar. Por cada regla hay un
 * caso que grita y uno que se calla:
 *   - grita  cuando dos textos difieren en algo que no son tildes;
 *   - se calla cuando la unica diferencia son las tildes.
 * Sin el segundo, `soloDifierenEnTildes` podria devolver `false` siempre y todo pasaria.
 *
 * LOS TEXTOS
 * ----------
 * `--vivo` los baja de la API y ejerce la cadena entera. Sin esa bandera corre contra la
 * fija de `test/legible-fijas.json`, que se commitea: CI no depende de la red, y si la
 * fija se borra el conteo lo dice en vez de pasar en verde por ausencia.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { legible, soloDifierenEnTildes, TILDES, AMBIGUAS } from "../lib/legible.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIJAS = join(RAIZ, "test/legible-fijas.json");
const API = "https://rosettaquantum.com";

let ok = 0, mal = 0;
const prueba = (nombre, cond, detalle = "") => {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? "\n         " + detalle : ""}`); }
};

// --------------------------------------------------------- las dos direcciones
prueba("grita: textos que difieren de verdad",
  !soloDifierenEnTildes("el metodo gano", "el metodo perdio"));
prueba("se calla: la unica diferencia son las tildes",
  soloDifierenEnTildes("el metodo cuantico", "el método cuántico"));
prueba("grita: una palabra de menos",
  !soloDifierenEnTildes("no alcanza significancia", "alcanza significancia"));
prueba("se calla: texto identico", soloDifierenEnTildes("igual", "igual"));

// ------------------------------------------------------------- la conversion
prueba("null cuando no hay nada que cambiar", legible("Portfolio optimization") === null);
prueba("null con entrada vacia o no-texto", legible("") === null && legible(null) === null);
prueba("conserva la caja", legible("METODO Metodo metodo") === "MÉTODO Método método");
prueba("no toca las ambiguas",
  legible("mas solo esta replica") === null,
  `devolvio: ${legible("mas solo esta replica")}`);
// Una entrada que no cambia nada —«predicciones: predicciones»— hace que el guardia de
// api.js grite para siempre sobre un texto que ya estaba bien. Me paso con dos.
prueba("ninguna entrada de la tabla es identica a su clave",
  Object.entries(TILDES).every(([k, v]) => k !== v),
  `identidades: ${Object.entries(TILDES).filter(([k, v]) => k === v).map(([k]) => k).join(", ")}`);
prueba("las ambiguas no estan en la tabla",
  AMBIGUAS.every(a => !(a in TILDES)),
  `coladas: ${AMBIGUAS.filter(a => a in TILDES).join(", ")}`);

// ------------------------------------- la prosa que emite api.js va con tildes
//
// El texto sellado lleva su campo derivado; las cadenas del propio api.js no tienen
// excusa: las escribimos nosotros. Este chequeo mira SOLO las cadenas —los comentarios
// del repo van en ASCII a proposito— y usa la misma tabla cerrada, asi que no puede
// inventar reglas nuevas. Las ambiguas quedan fuera por definicion.
export function prosaSinTildes(fuente) {
  const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const malas = [];
  for (const m of codigo.matchAll(/"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
    const cad = m[1] ?? m[2];
    if (!cad || cad.length < 12 || esCodigo(cad)) continue;
    const hits = [...new Set((cad.toLowerCase().match(/[a-z]+/g) || []).filter(w => TILDES[w]))];
    if (hits.length) malas.push([hits.join(", "), cad.slice(0, 64)]);
  }
  return malas;
}

/**
 * Lo que NO es prosa no lleva tildes, aunque lo parezca.
 *
 * Mi barrido de acentos toco dos cosas que no eran texto y casi las publica:
 *  - el alias de una consulta SQL (`n_proteinas` -> `n_proteínas`), que el codigo lee sin
 *    tilde tres lineas mas abajo: habria devuelto `undefined` en produccion, en silencio;
 *  - una plantilla de ruta (`{proteina}` -> `{proteína}`), que es contrato publico.
 *
 * Uno lo caza test-usage.mjs; el otro lo encontre mirando. Este chequeo los cubre a los
 * dos: dentro de SQL y dentro de rutas, ningun caracter acentuado.
 */
const ES_SQL = /\b(SELECT|FROM|WHERE|GROUP BY|INSERT INTO)\b/;
const ES_RUTA = c => /^\/[a-z0-9]/i.test(c) || /\{[a-z_]+\}/.test(c);
/** SQL e identificadores no son prosa: ni les faltan tildes ni les sobran. */
const esCodigo = c => ES_SQL.test(c) || ES_RUTA(c);

export function tildesDondeNoVan(fuente) {
  const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const malas = [];
  for (const m of codigo.matchAll(/"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
    const cad = m[1] ?? m[2];
    if (!cad) continue;
    const acentos = cad.normalize("NFD").match(/[\u0300-\u036f]/g);
    if (!acentos) continue;
    if (ES_SQL.test(cad)) malas.push(["SQL", cad.slice(0, 60)]);
    else if (ES_RUTA(cad)) malas.push(["ruta", cad.slice(0, 60)]);
  }
  return malas;
}

const fuenteApi = readFileSync(join(RAIZ, "api.js"), "utf8");
prueba("api.js: sin tildes dentro de SQL ni de plantillas de ruta",
  tildesDondeNoVan(fuenteApi).length === 0,
  tildesDondeNoVan(fuenteApi).slice(0, 4).map(([t, c]) => `[${t}] ${c}`).join("\n         "));
prueba("y grita con el alias SQL que casi publico",
  tildesDondeNoVan('const q = "SELECT count(*) n_proteínas FROM p";').length === 1);
prueba("y grita con la ruta acentuada",
  tildesDondeNoVan('{ ruta: "/v1/challenges/{id}/{proteína}" }').length === 1);
prueba("se calla con prosa acentuada normal",
  tildesDondeNoVan('const t = "esa proteína no está en la corrida";').length === 0);

const malas = prosaSinTildes(fuenteApi);
prueba("api.js: ninguna cadena tiene palabras sin tilde de la tabla",
  malas.length === 0, malas.slice(0, 4).map(([w, c]) => `[${w}] ${c}`).join("\n         "));
// La otra direccion: el chequeo TIENE que gritar con una cadena plantada. Sin esto,
// `prosaSinTildes` podria devolver [] siempre y el verde no diria nada.
prueba("y grita si alguien escribe una cadena sin tildes",
  prosaSinTildes('const x = "el metodo cuantico no gana";').length === 1);
prueba("se calla con ingles y con comentarios",
  prosaSinTildes('const x = "the quantum method wins";\n// el metodo cuantico\n').length === 0);

// -------------------------------------------------- los textos reales del archivo
let textos = [];
if (process.argv.includes("--vivo")) {
  const r = await fetch(`${API}/v1/runs?limit=1000`);
  if (!r.ok) { console.error(`ABORTA: /v1/runs respondio ${r.status}`); process.exit(1); }
  const d = await r.json();
  for (const it of d.items) {
    for (const c of ["clase_de_problema", "instancia", "resultado", "metrica"]) {
      if (typeof it[c] === "string" && it[c].trim()) textos.push(it[c]);
    }
  }
  // La cadena entera, no solo la funcion: lo que la API EMITE tiene que cumplir la
  // invariante. Si alguien escribe el campo a mano en el Worker, esto lo caza.
  let conLegible = 0, malos = [];
  for (const it of d.items) {
    if (it.legible === undefined) { malos.push(`${it.id}: la API no emitio el campo legible`); continue; }
    for (const [c, v] of Object.entries(it.legible)) {
      conLegible++;
      if (!soloDifierenEnTildes(v, it[c])) malos.push(`${it.id}.${c}: el legible dice algo distinto del sellado`);
      if (v === it[c]) malos.push(`${it.id}.${c}: legible identico al sellado, no deberia emitirse`);
    }
  }
  prueba(`la API emite ${conLegible} campos legibles y todos difieren SOLO en tildes`,
    malos.length === 0, malos.slice(0, 5).join("\n         "));
} else if (existsSync(FIJAS)) {
  textos = JSON.parse(readFileSync(FIJAS, "utf8")).textos;
} else {
  // Falla cerrado: sin fijas no hay cobertura, y una suite verde por ausencia es el peor
  // resultado posible.
  console.error(`ABORTA: falta ${FIJAS}. Regenerala con --vivo --guardar.`);
  process.exit(1);
}

prueba(`hay textos que ejercer (${textos.length})`, textos.length >= 20, `sólo ${textos.length}`);

const rotos = textos.map(t => [t, legible(t)]).filter(([t, l]) => l !== null && !soloDifierenEnTildes(t, l));
prueba(`la invariante se cumple en los ${textos.length} textos reales`,
  rotos.length === 0, rotos.slice(0, 3).map(([t]) => t.slice(0, 60)).join("\n         "));

const cambiados = textos.filter(t => legible(t) !== null).length;
console.log(`\n  ${cambiados} de ${textos.length} textos ganan tildes; el resto ya estaba bien o es inglés.`);

if (process.argv.includes("--guardar")) {
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync(join(RAIZ, "test"), { recursive: true });
  writeFileSync(FIJAS, JSON.stringify({
    nota: "Textos REALES de /v1/runs, guardados para que CI no dependa de la red. Regenerar con: node scripts/test-legible.mjs --vivo --guardar",
    generado: new Date().toISOString().slice(0, 10),
    textos,
  }, null, 1) + "\n");
  console.log(`  fija escrita: ${textos.length} textos`);
}

console.log(`\n${ok} pasaron, ${mal} fallaron`);
process.exit(mal ? 1 : 0);
