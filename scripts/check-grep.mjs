/**
 * T-grep — las notas internas no salen en lo que se publica.
 *
 * LO QUE SE MIDIO ANTES DE ESCRIBIRLO (7-sep, sobre dist/)
 * -------------------------------------------------------
 *   "mina nº"  →  56 archivos      "Cowork"  →  55 archivos
 *   "Nicholas" →   8 archivos      "decision de <nombre>" → 1
 * Casi todo venia de los COMENTARIOS de las hojas de estilo, que en este sitio se sirven
 * INLINE: el por qué de cada regla —de dónde salió el defecto, quién lo decidió— viajaba
 * dentro de cada página. Los comentarios siguen en los archivos fuente, que es donde
 * sirven; lo que se publica va sin ellos.
 *
 * LA EXCEPCION, DECLARADA
 * -----------------------
 * /about y /es/nosotros NOMBRAN al fundador a proposito: "cada veredicto lleva un autor
 * con nombre, porque un arbitro que no puedes nombrar no es un arbitro". Es texto publico
 * aprobado. Una regla "dist sin ese nombre" sin esta excepcion habria borrado justo lo
 * que la pagina existe para decir — precision sobre cobertura.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const CONSUMIDOR = {
  quien: "quien construye el sitio, antes de desplegar",
  hace: "no despliega: las notas de trabajo del equipo se sirven dentro de las paginas publicas",
};

const RAIZ = "dist";
const EXT = /\.(html|css|js|mjs|txt|xml|json)$/;

// [patron, por que no puede salir, rutas donde SI puede]
const PROHIBIDO = [
  [/mina n[ºo°]/i, "vocabulario interno del catastro", []],
  [/\bCowork\b/, "nombre de otra sesion del equipo", []],
  [/Nicholas/, "nombre propio en una nota interna", ["about/index.html", "es/nosotros/index.html"]],
  [/\bFIXME\b|\bTODO:/, "marca de trabajo sin terminar", []],
  [/decision de direccion|decision de Nicholas/i, "atribucion interna de una decision", []],
];

function archivos(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) out.push(...archivos(f));
    else if (EXT.test(e)) out.push(f);
  }
  return out;
}

const todos = archivos(RAIZ);
const fallos = [];
for (const [re, porque, permitidas] of PROHIBIDO) {
  const hits = [];
  for (const f of todos) {
    const rel = relative(RAIZ, f);
    if (permitidas.some((p) => rel === p)) continue;
    const s = readFileSync(f, "utf8");
    const m = re.exec(s);
    if (m) hits.push(`${rel} (${JSON.stringify(s.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, " "))})`);
  }
  if (hits.length) {
    console.log(`  FALLA ${re} — ${porque} · ${hits.length} archivo(s)`);
    hits.slice(0, 3).forEach((h) => console.log(`        ${h}`));
    if (hits.length > 3) console.log(`        …y ${hits.length - 3} mas`);
    fallos.push(String(re));
  } else {
    const nota = permitidas.length ? ` (excepto ${permitidas.join(", ")}, texto publico aprobado)` : "";
    console.log(`  ok    ${String(re).padEnd(34)} 0 de ${todos.length} archivos${nota}`);
  }
}

// Caso de silencio: la excepcion tiene que SERVIR. Si /about dejara de nombrar al autor,
// la pagina perdio su tesis — y este guardia, que la excluye, no lo notaria. Asi que
// aqui se comprueba lo contrario: que el nombre SIGA estando donde debe.
const about = todos.find((f) => f.endsWith("about/index.html"));
if (about && !/Nicholas/.test(readFileSync(about, "utf8"))) {
  console.log("  FALLA /about ya no nombra a quien firma — la excepcion existe para eso");
  fallos.push("about");
} else if (about) {
  console.log("  ok    /about sigue nombrando a quien firma");
}

if (fallos.length) { console.log(`\nT-grep: ${fallos.length} patron(es) filtrandose a lo publicado.`); process.exit(1); }
console.log(`\nT-grep: ${todos.length} archivos publicados, sin notas internas.`);
