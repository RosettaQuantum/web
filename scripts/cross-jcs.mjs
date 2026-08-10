#!/usr/bin/env node
/**
 * Validacion cruzada de rosettaq-archive/v3 contra los vectores del laboratorio.
 *
 * Se compara el TEXTO canonico, no solo el hash: el hash dice QUE difieren, el texto
 * dice DONDE. Cuando algo no calza, se imprime el primer caracter distinto con su
 * contexto y su code point, para que el reporte sirva sin volver a correr nada.
 *
 * Uso: node scripts/cross-jcs.mjs <ruta a jcs_vectores.json>
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { jcs } from "./lib/jcs.mjs";

const ruta = process.argv[2];
if (!ruta) { console.error("falta la ruta a jcs_vectores.json"); process.exit(2); }
const V = JSON.parse(readFileSync(ruta, "utf8"));
// los sellos se nombran relativos AL archivo de vectores, no al cwd
const BASE = dirname(resolve(ruta));
const sha = t => "sha256:" + createHash("sha256").update(t, "utf8").digest("hex");

let ok = 0, mal = 0; const discrepancias = [];

/** Primer punto donde dos textos difieren, con contexto legible. */
function donde(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0; while (i < n && a[i] === b[i]) i++;
  const ctx = s => JSON.stringify(s.slice(Math.max(0, i - 25), i + 25));
  const cp = s => (s[i] === undefined ? "(fin)" : `${JSON.stringify(s[i])} U+${s.codePointAt(i).toString(16).toUpperCase().padStart(4, "0")}`);
  return `posicion ${i} · mio ${cp(a)} vs suyo ${cp(b)}\n           mio:  ${ctx(a)}\n           suyo: ${ctx(b)}`;
}

function comparar(nombre, mio, suyo, extra = "") {
  if (mio === suyo) { ok++; console.log(`  ok    ${nombre}`); return true; }
  mal++;
  const d = `${nombre}${extra ? " (" + extra + ")" : ""}\n           ${donde(mio, suyo)}`;
  discrepancias.push(d);
  console.log(`  FALLA ${d}`);
  return false;
}

console.log(`\nValidacion cruzada de JCS · ${V.vectores.length} vectores + ${V.sellos_reales.length} sellos reales\n`);
console.log("— los vectores —");
for (const v of V.vectores) {
  const nombre = v.porque_esta ? v.porque_esta.slice(0, 74) : JSON.stringify(v.entrada).slice(0, 60);
  const mio = jcs(v.entrada);
  if (comparar(nombre, mio, v.canonico_esperado)) {
    // y el hash del texto, para cerrar la cadena entera
    // su vector trae el hex pelado; el ledger lo escribe con prefijo. Se compara el hex.
    const h = sha(mio).replace(/^sha256:/, "");
    if (v.sha256_del_canonico && h !== v.sha256_del_canonico.replace(/^sha256:/, "")) {
      mal++; ok--;
      const d = `${nombre}: el texto calza pero el sha256 no — mio ${h}, suyo ${v.sha256_del_canonico}`;
      discrepancias.push(d); console.log(`  FALLA ${d}`);
    }
  }
}

console.log("\n— los 7 sellos reales del archivo —");
for (const s of V.sellos_reales) {
  // payload v3 = meta SIN content_hash ni schema, mas el cuerpo SIN storage
  let bruto = null;
  for (const p of [resolve(BASE, s.archivo), resolve(s.archivo)]) {
    try { bruto = JSON.parse(readFileSync(p, "utf8")); break; } catch (e) {}
  }
  if (!bruto) { mal++; const d = `${s.file_id}: no pude abrir ${s.archivo}`; discrepancias.push(d); console.log(`  FALLA ${d}`); continue; }
  const meta = { ...bruto.meta }; delete meta.content_hash; delete meta.schema;
  const cuerpo = { ...bruto }; delete cuerpo.meta; delete cuerpo.storage;
  const canon = jcs({ meta, ...cuerpo });
  const h = sha(canon);
  // BYTES en UTF-8, no unidades UTF-16. `.length` de JS cuenta lo segundo, y con
  // acentos y guiones largos da de menos: 5277 donde el laboratorio media 5289.
  // Mi error, y de la misma familia que todo lo de esta semana — contar la unidad
  // equivocada y no notarlo porque el numero se parece.
  const bytes = Buffer.byteLength(canon, "utf8");
  const nombre = `${s.file_id} (${bytes} bytes)`;
  if (h.replace(/^sha256:/, "") === String(s.content_hash_v3_seria).replace(/^sha256:/, "")) {
    ok++; console.log(`  ok    ${nombre}`);
    if (s.bytes_del_canonico_v3 && s.bytes_del_canonico_v3 !== bytes) {
      mal++; ok--;
      const d = `${s.file_id}: el hash calza pero el tamaño no — declara ${s.bytes_del_canonico_v3} bytes y me dio ${bytes}`;
      discrepancias.push(d); console.log(`  FALLA ${d}`);
    }
  } else {
    mal++;
    const d = `${nombre}: hash v3 distinto — mio ${h}, suyo ${s.content_hash_v3_seria}`;
    discrepancias.push(d); console.log(`  FALLA ${d}`);
  }
}

console.log(`\n${ok} calzaron, ${mal} no`);
if (mal) { console.log("\nDISCREPANCIAS:\n - " + discrepancias.join("\n - ")); process.exit(1); }
