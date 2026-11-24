#!/usr/bin/env node
// RQ.T · corre el descubrimiento de proveedores (T.01–T.07) sobre un dominio, desde esta máquina.
//
//   node scripts/descubrir-proveedores.mjs ejemplo.cl --salida DIR [--declarados a,b,c]
//       consulta DNS y CT, escribe DIR/insumos-<dominio>-<utc>.json y DIR/rqt-<dominio>-<utc>.json, imprime la tabla
//   node scripts/descubrir-proveedores.mjs --releer DIR/insumos-….json
//       re-clasifica unos insumos guardados SIN consultar nada (sirve para cambiar el catálogo y comparar)
//   node scripts/descubrir-proveedores.mjs --diff A.json B.json
//       compara dos resultados (rqt-…json): filas y proveedores, no la hora
//
// Sólo lee DNS y CT. No escribe en ninguna base. La salida NOMBRA proveedores: es privada, del cliente
// que la contrata (regla 4 del encargo). No se publica.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { recolectar } from "../lib/proveedores-ejecutor.mjs";
import { descubrir, diffCorridas, tabla } from "../lib/proveedores-descubrir.mjs";
import { dominioValido } from "../lib/ct-registro.mjs";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const sha = (s) => createHash("sha256").update(s).digest("hex");

if (args[0] === "--diff") {
  const [a, b] = [args[1], args[2]].map((p) => JSON.parse(readFileSync(p, "utf8")));
  const d = diffCorridas(a, b);
  console.log(`A ${a.medido_utc} · ${d.filas_a} filas · ${d.proveedores_a} proveedores`);
  console.log(`B ${b.medido_utc} · ${d.filas_b} filas · ${d.proveedores_b} proveedores`);
  console.log(`resultado (señal · proveedor · estado): ${d.resultado_igual ? "IGUAL" : "DISTINTO"}`);
  for (const x of d.pares_solo_en_a) console.log(`  - ${x}`);
  for (const x of d.pares_solo_en_b) console.log(`  + ${x}`);
  console.log(`evidencia completa: ${d.iguales ? "IGUAL" : "DISTINTA"}`);
  for (const x of d.solo_en_a) console.log(`  - ${x}`);
  for (const x of d.solo_en_b) console.log(`  + ${x}`);
  process.exit(d.resultado_igual ? 0 : 1);
}

const declarados = opt("--declarados") ? opt("--declarados").split(",").map((s) => s.trim()).filter(Boolean) : null;
let insumos, rutaInsumos = null;
if (args[0] === "--releer") {
  insumos = JSON.parse(readFileSync(args[1], "utf8"));
} else {
  const dominio = String(args[0] || "").trim().toLowerCase();
  if (!dominioValido(dominio)) { console.error("uso: node scripts/descubrir-proveedores.mjs <dominio> --salida DIR"); process.exit(2); }
  const t = Date.now();
  insumos = await recolectar(dominio);
  insumos.segundos = Math.round((Date.now() - t) / 100) / 10;
}
const r = descubrir(insumos, { declarados });
r.insumos_sha256 = sha(JSON.stringify(insumos));
r.consultas = insumos.consultas || null;
const dir = opt("--salida");
if (dir && args[0] !== "--releer") {
  mkdirSync(dir, { recursive: true });
  const marca = insumos.medido_utc.replace(/[:.]/g, "-");
  rutaInsumos = join(dir, `insumos-${insumos.dominio}-${marca}.json`);
  writeFileSync(rutaInsumos, JSON.stringify(insumos));
  const rutaR = join(dir, `rqt-${insumos.dominio}-${marca}.json`);
  writeFileSync(rutaR, JSON.stringify(r, null, 1));
  console.error(`escrito ${rutaInsumos}\nescrito ${rutaR}`);
}
console.log(tabla(r));
console.log(`\nconsultas: ${JSON.stringify(r.consultas)} · insumos sha256 ${r.insumos_sha256.slice(0, 16)}…`);
for (const [s, x] of Object.entries(r.por_senal))
  console.log(`${s} ${x.estado.padEnd(9)} proveedores=${x.proveedores ?? "null"} externos=${x.externos_sin_clasificar ?? "null"} · ${JSON.stringify(x.denominador)}`);
console.log(`\n${r.resumen.nota}`);
