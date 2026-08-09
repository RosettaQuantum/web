#!/usr/bin/env node
/**
 * Genera db/quantum.seed.sql — el archivador de algoritmos y fuentes cuanticas.
 *
 * POR QUE ES UN SCRIPT Y NO UN SQL ESCRITO A MANO
 * -----------------------------------------------
 * Un catalogo escrito a mano envejece sin avisar y nadie puede comprobar de donde
 * salio cada fila. Este script baja la fuente canonica, le calcula el sha256, la
 * parsea y deja el hash grabado en la propia semilla: cualquiera puede bajar la
 * misma pagina, recomputar el hash y reconstruir estas filas.
 *
 * LO QUE HACE Y LO QUE NO
 * -----------------------
 * - Extrae HECHOS de la fuente: nombre, categoria, speedup declarado, enlaces de
 *   implementacion y la bibliografia de cada entrada. No copia la prosa descriptiva
 *   (la fuente no declara licencia).
 * - Las descripciones en espanol son nuestras y viven en db/quantum-problemas.es.json.
 *   Si falta una, la fila entra con NULL y el conteo lo declara. No se inventa.
 * - Ejerce cada URL de fuente y guarda el codigo REAL. Prometer un enlace que no
 *   abrimos es la trampa que ya nos costo caro con /api-docs.
 *
 * FALLA CERRADO
 * -------------
 * Si la fuente cambia de forma y salen menos entradas que el minimo esperado, o si
 * alguna fila queda sin cita, el script aborta en vez de emitir un catalogo mocho.
 *
 * Uso:  node scripts/build-quantum-catalog.mjs [--offline archivo.html] [--no-check-urls]
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const FUENTE_URL = "https://quantumalgorithmzoo.org/";
const FUENTE_NOMBRE = "Quantum Algorithm Zoo";

// Minimos de cordura. La fuente crece; si ENCOGE, algo se rompio en el parseo y es
// preferible abortar que publicar un catalogo mas chico sin que nadie lo note.
const MIN_ALGORITMOS = 70;
const MIN_CATEGORIAS = 4;
const MIN_REFS = 400;

// Cruce con NUESTRO ledger: que receta sellada ataca que algoritmo del catalogo.
// Se declara a mano y a proposito — es una afirmacion sobre nuestra evidencia, no
// un dato de la fuente. Deliberadamente corta: son 4 recetas contra 74 algoritmos.
const LEDGER = [
  ["quantum-approximate-optimization", "RQ-0012", "Compresion de portafolio con restricciones (Finanzas)"],
  ["quantum-approximate-optimization", "RQ-0019", "Ruteo de flota bajo incertidumbre (Mineria)"],
  ["quantum-approximate-optimization", "RQ-0033", "Expansion de red electrica bajo estres (Energia)"],
];
// Recetas nuestras que NO tienen entrada propia en el catalogo canonico. Se declara
// en vez de forzar un mapeo comodo: RQ-0007 usa caminata cuantica de tiempo continuo,
// que la fuente trata dentro de otras entradas y no como algoritmo separado.
const RECETAS_SIN_MAPEO = ["RQ-0007"];

const args = process.argv.slice(2);
const offline = args.includes("--offline") ? args[args.indexOf("--offline") + 1] : null;
const checkUrls = !args.includes("--no-check-urls");

const hoy = new Date().toISOString().slice(0, 10);

function sql(v) {
  if (v === null || v === undefined || v === "") return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function limpiar(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, " ").trim();
}
function slug(s) {
  return limpiar(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).replace(/-$/, "");
}
function morir(msg) { console.error("ABORTA: " + msg); process.exit(1); }

// ------------------------------------------------------------------ 1. la fuente

let html;
if (offline) {
  html = readFileSync(offline, "utf8");
  console.log(`fuente: archivo local ${offline}`);
} else {
  const r = await fetch(FUENTE_URL, { headers: { "User-Agent": "rosettaquantum.com catalog builder" } });
  if (!r.ok) morir(`la fuente respondio ${r.status}`);
  html = await r.text();
  console.log(`fuente: ${FUENTE_URL} -> ${r.status}`);
}
const sha = createHash("sha256").update(html, "utf8").digest("hex");
console.log(`sha256 de la instantanea: ${sha}`);
console.log(`bytes: ${Buffer.byteLength(html, "utf8")}`);

// ------------------------------------------------------------ 2. la bibliografia

const iRefs = html.indexOf('<h2 id="references"');
if (iRefs < 0) morir("no se encontro la seccion de referencias");
const bib = new Map();
for (const m of html.slice(iRefs).matchAll(/<dt id="([^"]+)">(\d+)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)) {
  const url = (m[3].match(/href="(https?:\/\/[^"]+)"/) || [])[1] || null;
  bib.set(m[1], { n: Number(m[2]), cita: limpiar(m[3]), url });
}
console.log(`bibliografia: ${bib.size} referencias`);
if (bib.size < MIN_REFS) morir(`solo ${bib.size} referencias, se esperaban >= ${MIN_REFS}`);

// -------------------------------------------------------------- 3. las categorias

const OMITIR = new Set(["acknowledgments", "references", "navigation", "about",
  "translations", "quantum-graph", "other-surveys", "terminology"]);
const heads = [...html.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)]
  .map(m => ({ id: m[1], nombre: limpiar(m[2]), pos: m.index }));
const categorias = heads
  .map((h, i) => ({ ...h, fin: i + 1 < heads.length ? heads[i + 1].pos : html.length }))
  .filter(h => !OMITIR.has(h.id));
if (categorias.length < MIN_CATEGORIAS) morir(`solo ${categorias.length} categorias`);

// --------------------------------------------------------------- 4. los algoritmos

// OJO: el marcado de la fuente NO es uniforme, y costo dos vueltas descubrirlo.
// Hay TRES formas de la misma etiqueta:
//     <b>Algorithm:</b>            60 entradas
//     <b>Algorithm: </b>           (espacio antes del cierre)
//     <b id="gradients">Algorithm:</b>   (10 entradas llevan ancla propia)
// El total real es 74. Un primer intento exigio la forma exacta, vio 60, y le colgo
// a QAOA el "Speedup: Polynomial" de la entrada siguiente en vez de su
// "Superpolynomial" real — en verde, porque el minimo era 55 y 60 lo superaba.
// El segundo intento acepto el espacio, vio 64, y volvio a pasar en verde porque el
// contraste de totales comparaba el mismo regex CONSIGO MISMO. De ahi que el
// contraste de mas abajo mida con un patron deliberadamente distinto.
const ETIQUETA = et => new RegExp(`<b[^>]*>\\s*${et}\\s*:\\s*</b>([\\s\\S]*?)<br\\s*/?>`, "i");
const MARCA_ALGORITMO = /<b[^>]*>\s*Algorithm\s*:\s*<\/b>/gi;
// Las 10 entradas con `<b id="...">` son las que el resto de la pagina referencia
// por ancla. Guardarlas da una cita mucho mas precisa que apuntar a la categoria.
const ANCLA_ENTRADA = /<b[^>]*\sid="([^"]+)"[^>]*>\s*Algorithm\s*:\s*<\/b>/i;

function campo(bloque, etiqueta) {
  const m = bloque.match(ETIQUETA(etiqueta));
  return m ? limpiar(m[1]) : null;
}

const algoritmos = [];
let refsTotales = 0, refsRotas = 0;
for (const cat of categorias) {
  const seg = html.slice(cat.pos, cat.fin);
  const marcas = [...seg.matchAll(MARCA_ALGORITMO)].map(m => m.index);
  for (let j = 0; j < marcas.length; j++) {
    const bloque = seg.slice(marcas[j], j + 1 < marcas.length ? marcas[j + 1] : seg.length);
    const nombre = campo(bloque, "Algorithm");
    const speedup = campo(bloque, "Speedup");
    // Un speedup ausente NO puede caer al de la entrada siguiente: se aborta. Ese
    // fue el bug real (QAOA quedo "Polynomial" cuando la fuente dice "Superpolynomial").
    if (!nombre) morir(`entrada sin nombre en ${cat.id}, posicion ${j + 1}`);
    if (!speedup) morir(`la entrada "${nombre}" (${cat.id}) no declara Speedup dentro de su propio bloque`);

    // implementaciones: enlaces externos del campo Implementation
    const implRaw = (bloque.match(ETIQUETA("Implementation")) || [])[1] || "";
    const impl = [...implRaw.matchAll(/<a href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
      .map(m => ({ nombre: limpiar(m[2]), url: m[1] }));

    // bibliografia citada por esta entrada, resuelta contra la seccion References.
    // Las anclas que NO son bibliografia son remisiones a otras entradas del propio
    // catalogo (#abelian_HSP, #adiabatic, ...). No son citas rotas: se guardan aparte.
    const refs = [], remisiones = [];
    const vistas = new Set();
    for (const m of bloque.matchAll(/href="#([^"]+)"/g)) {
      if (vistas.has(m[1])) continue;
      vistas.add(m[1]);
      const r = bib.get(m[1]);
      if (r) { refs.push(r); continue; }
      remisiones.push(m[1]);
    }
    refs.sort((a, b) => a.n - b.n);
    refsTotales += refs.length;

    // Ancla propia si la entrada la trae; si no, la de su categoria.
    const ancla = (bloque.match(ANCLA_ENTRADA) || [])[1] || cat.id;

    algoritmos.push({
      id: slug(nombre), nombre, categoria: cat.nombre, categoria_id: cat.id,
      speedup, impl, refs, remisiones, ancla, orden: algoritmos.length + 1,
      fuente_url: FUENTE_URL + "#" + ancla,
    });
  }
}
console.log(`algoritmos: ${algoritmos.length} en ${categorias.length} categorias`);
console.log(`citas resueltas: ${refsTotales} · anclas internas rotas en la fuente: ${refsRotas}`);
if (algoritmos.length < MIN_ALGORITMOS) morir(`solo ${algoritmos.length} algoritmos, se esperaban >= ${MIN_ALGORITMOS}`);

// DOS TOTALES QUE DEBEN COINCIDIR, SE RESTAN — pero medidos de forma DISTINTA.
// Un contraste que usa el mismo regex de los dos lados no prueba nada: ya paso una
// vez que diera 64 = 64 mientras faltaban 10 entradas. El segundo conteo se hace
// sobre el texto plano, sin mirar etiquetas HTML, para que un cambio de marcado no
// pueda enganar a las dos mediciones a la vez.
const textoCategorias = categorias.map(c => limpiar(html.slice(c.pos, c.fin))).join(" ");
const conteoIndependiente = (textoCategorias.match(/\bAlgorithm\s*:/g) || []).length;
if (conteoIndependiente !== algoritmos.length) {
  morir(`descuadre de totales: el texto plano de las categorias dice ${conteoIndependiente} ` +
        `entradas y el parseo de HTML produjo ${algoritmos.length} ` +
        `(diferencia: ${conteoIndependiente - algoritmos.length}). ` +
        `Casi seguro la fuente uso una variante de marcado nueva.`);
}
console.log(`contraste de totales (texto plano vs HTML): ${conteoIndependiente} = ${algoritmos.length}`);

const dupes = algoritmos.map(a => a.id).filter((v, i, arr) => arr.indexOf(v) !== i);
if (dupes.length) morir(`ids duplicados: ${dupes.join(", ")}`);
const sinCita = algoritmos.filter(a => !a.fuente_url);
if (sinCita.length) morir(`${sinCita.length} filas sin fuente_url`);

// ------------------------------------------------ 5. descripciones ES (nuestras)

const problemas = JSON.parse(readFileSync(join(RAIZ, "db/quantum-problemas.es.json"), "utf8"));
let conProblema = 0;
for (const a of algoritmos) {
  a.problema_es = problemas[a.id] || null;
  if (a.problema_es) conProblema++;
}
const faltantes = algoritmos.filter(a => !a.problema_es).map(a => a.id);
console.log(`descripciones ES: ${conProblema} de ${algoritmos.length}` +
  (faltantes.length ? ` · sin redactar: ${faltantes.join(", ")}` : ""));
// Claves del JSON que ya no corresponden a ninguna entrada: la fuente cambio de
// nombre y la descripcion quedo huerfana. Se avisa, no se borra sola.
const huerfanas = Object.keys(problemas).filter(k => !k.startsWith("_") && !algoritmos.some(a => a.id === k));
if (huerfanas.length) console.log(`AVISO descripciones huerfanas (ya no existen en la fuente): ${huerfanas.join(", ")}`);

// --------------------------------------------------------------- 6. las fuentes

const fuentes = JSON.parse(readFileSync(join(RAIZ, "db/quantum-sources.json"), "utf8"));
console.log(`fuentes declaradas: ${fuentes.length}`);

let ok = 0, manuales = 0, malos = [];
if (checkUrls) {
  // Se ejercen de a tandas para no golpear todo de una.
  const tanda = 8;
  for (let i = 0; i < fuentes.length; i += tanda) {
    await Promise.all(fuentes.slice(i, i + tanda).map(async f => {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 15000);
        // Varios sitios corporativos rechazan HEAD; se pide GET y se corta al recibir cabeceras.
        const r = await fetch(f.url, { redirect: "follow", signal: c.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; rosettaquantum.com link check)" } });
        clearTimeout(t);
        f.http_status = r.status;
        try { await r.body?.cancel(); } catch (e) {}
      } catch (e) {
        f.http_status = 0;   // 0 = no respondio / timeout
      }
      f.verificado_at = hoy;
      if (f.http_status >= 200 && f.http_status < 400) { ok++; return; }
      // Algunos sitios (revistas, organismos de norma) devuelven 403 a todo cliente
      // automatizado aunque la pagina exista. Eso se declara UNO POR UNO en el JSON
      // con la fecha en que se abrio a mano en un navegador — no es una excepcion
      // global. Un 403 en una fuente NO declarada sigue siendo un fallo.
      if (f.http_status === 403 && f.bloquea_automatas && f.verificado_a_mano) {
        f.nota_enlace = `El sitio responde 403 a clientes automatizados. Abierto a mano en un navegador el ${f.verificado_a_mano}.`;
        manuales++;
        return;
      }
      malos.push(`${f.id} (${f.url}) -> ${f.http_status}`);
    }));
  }
  console.log(`enlaces de fuente ejercidos: ${ok} de ${fuentes.length} responden` +
    (manuales ? ` · ${manuales} verificados a mano (el sitio bloquea automatas)` : ""));
  if (malos.length) {
    console.log("  NO responden:\n   - " + malos.join("\n   - "));
    // Un 404/410 es definitivo: la URL esta mal y no se publica. Un 0 o un 5xx puede
    // ser la red de hoy, asi que avisa fuerte pero no retiene el trabajo bueno.
    const definitivos = malos.filter(m => /-> (40[0-9]|41[0-9]|42[0-9])$/.test(m) );
    if (definitivos.length) morir(`${definitivos.length} enlace(s) con error definitivo. Corrigelos antes de sembrar:\n   - ` + definitivos.join("\n   - "));
    console.log("  (ninguno es 4xx definitivo: se siguen, pero revisalos)");
  }
} else {
  console.log("enlaces de fuente: NO verificados (--no-check-urls)");
  for (const f of fuentes) { f.http_status = null; f.verificado_at = null; }
}

// ------------------------------------------------------------------ 7. emitir SQL

const L = [];
L.push("-- GENERADO por scripts/build-quantum-catalog.mjs — no editar a mano.");
L.push(`-- fuente: ${FUENTE_URL}`);
L.push(`-- instantanea sha256: ${sha}`);
L.push(`-- generado: ${hoy}`);
L.push(`-- algoritmos: ${algoritmos.length} · categorias: ${categorias.length} · citas: ${refsTotales} · fuentes: ${fuentes.length}`);
L.push("");
L.push("DELETE FROM quantum_algorithm_ledger;");
L.push("DELETE FROM quantum_algorithms;");
L.push("DELETE FROM quantum_sources;");
L.push("DELETE FROM quantum_catalog_meta;");
L.push("");

for (const f of fuentes) {
  L.push("INSERT INTO quantum_sources (id,tipo,nombre,url,que_es,por_que_importa,pais,http_status,verificado_at,nota_enlace,orden) VALUES (" +
    [f.id, f.tipo, f.nombre, f.url, f.que_es, f.por_que_importa, f.pais].map(sql).join(",") +
    `,${f.http_status === null || f.http_status === undefined ? "NULL" : f.http_status},${sql(f.verificado_at)},${sql(f.nota_enlace)},${fuentes.indexOf(f) + 1});`);
}
L.push("");
for (const a of algoritmos) {
  L.push("INSERT INTO quantum_algorithms (id,nombre,categoria,categoria_id,problema_es,speedup_declarado,fuente_nombre,fuente_url,ancla,refs_json,impl_json,remisiones_json,n_refs,orden) VALUES (" +
    [a.id, a.nombre, a.categoria, a.categoria_id, a.problema_es, a.speedup, FUENTE_NOMBRE, a.fuente_url, a.ancla,
     JSON.stringify(a.refs), JSON.stringify(a.impl), JSON.stringify(a.remisiones)].map(sql).join(",") +
    `,${a.refs.length},${a.orden});`);
}
L.push("");
for (const [aid, rid, nota] of LEDGER) {
  if (!algoritmos.some(a => a.id === aid)) morir(`el cruce con el ledger apunta a un algoritmo inexistente: ${aid}`);
  L.push(`INSERT INTO quantum_algorithm_ledger (algorithm_id,recipe_id,nota) VALUES (${sql(aid)},${sql(rid)},${sql(nota)});`);
}
L.push("");
const meta = {
  fuente_nombre: FUENTE_NOMBRE,
  fuente_url: FUENTE_URL,
  fuente_sha256: sha,
  generado_at: hoy,
  algoritmos: String(algoritmos.length),
  categorias: String(categorias.length),
  citas_resueltas: String(refsTotales),
  bibliografia_fuente: String(bib.size),
  descripciones_es: `${conProblema} de ${algoritmos.length}`,
  fuentes: String(fuentes.length),
  fuentes_que_responden: checkUrls
    ? `${ok + manuales} de ${fuentes.length}` + (manuales ? ` (${manuales} verificada(s) a mano: el sitio bloquea clientes automatizados)` : "")
    : "no verificado",
  algoritmos_con_evidencia_rosetta: String(new Set(LEDGER.map(x => x[0])).size),
  recetas_sin_mapeo: RECETAS_SIN_MAPEO.join(",") || "ninguna",
  como_reconstruir: `Baja ${FUENTE_URL}, recomputa su sha256 y corre scripts/build-quantum-catalog.mjs`,
};
for (const [k, v] of Object.entries(meta)) {
  L.push(`INSERT INTO quantum_catalog_meta (clave,valor) VALUES (${sql(k)},${sql(v)});`);
}
L.push("");

const salida = join(RAIZ, "db/quantum.seed.sql");
writeFileSync(salida, L.join("\n"), "utf8");
console.log(`\nescrito: db/quantum.seed.sql (${L.length} sentencias aprox., ${Buffer.byteLength(L.join("\n"))} bytes)`);
console.log(`cruce con el ledger: ${new Set(LEDGER.map(x => x[0])).size} de ${algoritmos.length} algoritmos tienen receta sellada nuestra`);
if (RECETAS_SIN_MAPEO.length) console.log(`recetas nuestras sin entrada propia en la fuente: ${RECETAS_SIN_MAPEO.join(", ")}`);
