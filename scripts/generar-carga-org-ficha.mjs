#!/usr/bin/env node
/**
 * Genera la CARGA de la tabla privada org_ficha (db/org-ficha.schema.sql) desde el archivo sellado de un
 * estudio (18-nov-2026). El .sql que produce NOMBRA a las organizaciones: se escribe FUERA del repo
 * (el repo es público; scripts/check-sin-clientes.mjs). Este script no contiene ningún nombre.
 *
 * El archivo de entrada es una lista de filas con `domain` y `vertical` (forma del estudio de Chile). El
 * país NO viene en el archivo: lo declara quien genera la carga (--pais), porque es la definición del
 * estudio (todas sus organizaciones son de ese país). Se escribe en el comentario, con el sha256 del
 * archivo de entrada y el del cuerpo SQL, para que quien aplique pueda comprobar ambos.
 *
 * Upsert explícito (ON CONFLICT … DO UPDATE): un INSERT OR IGNORE dejaría la fila vieja en silencio.
 *   node scripts/generar-carga-org-ficha.mjs <estudio.json> <salida.sql> --pais CL [--fecha AAAA-MM-DD]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename } from "node:path";

const [entrada, salida] = process.argv.slice(2).filter((a, i, v) => !a.startsWith("--") && !(v[i - 1] || "").startsWith("--"));
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const pais = String(arg("--pais") || "").toUpperCase();
const fecha = arg("--fecha") || new Date().toISOString().slice(0, 10);
if (!entrada || !salida || !/^[A-Z]{2}$/.test(pais) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
  console.error("uso: node scripts/generar-carga-org-ficha.mjs <estudio.json> <salida.sql> --pais CL [--fecha AAAA-MM-DD]");
  process.exit(2);
}
const crudo = readFileSync(entrada);
const filas = JSON.parse(crudo.toString("utf8"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const fuente = basename(entrada);
const vistos = new Set(), malas = [];
const valores = [];
for (const f of filas) {
  const d = String(f.domain || "").trim().toLowerCase().replace(/^www\./, "");
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d)) { malas.push(`dominio inválido: ${f.domain}`); continue; }
  if (vistos.has(d)) { malas.push(`dominio repetido: ${d}`); continue; }
  vistos.add(d);
  valores.push(`(${q(d)}, ${q(pais)}, ${f.vertical ? q(f.vertical) : "NULL"}, ${q(fuente)}, ${q(fecha)})`);
}
if (malas.length) { console.error("la carga NO se escribió:\n  " + malas.join("\n  ")); process.exit(1); }
const cuerpo = [
  "INSERT INTO org_ficha (dominio, pais, sector, fuente, actualizado) VALUES",
  valores.join(",\n"),
  "ON CONFLICT(dominio) DO UPDATE SET pais = excluded.pais, sector = excluded.sector, fuente = excluded.fuente, actualizado = excluded.actualizado;",
  "",
  "-- comprobación: tiene que dar " + valores.length + " filas con esta fuente",
  `SELECT count(*) AS filas FROM org_ficha WHERE fuente = ${q(fuente)};`,
  "",
].join("\n");
const cabeza = [
  `-- Carga de org_ficha (PRIVADA: nombra organizaciones; no va al repo público).`,
  `-- Generada por scripts/generar-carga-org-ficha.mjs el ${fecha}.`,
  `-- Fuente: ${fuente} · sha256 ${sha(crudo)} · ${filas.length} filas · ${valores.length} organizaciones.`,
  `-- País: ${pais}, declarado por la definición del estudio (el archivo no trae país).`,
  `-- sha256 del cuerpo SQL (desde la línea INSERT hasta el final): ${sha(cuerpo)}`,
  `-- Aplicar DESPUÉS del esquema:`,
  `--   npx wrangler d1 execute rosettaq-ledger --remote --file db/org-ficha.schema.sql`,
  `--   npx wrangler d1 execute rosettaq-ledger --remote --file <este archivo>`,
  "",
].join("\n");
writeFileSync(salida, cabeza + cuerpo);
console.log(`org_ficha: ${valores.length} organizaciones · fuente sha256 ${sha(crudo).slice(0, 12)}… · cuerpo sha256 ${sha(cuerpo).slice(0, 12)}… → ${salida}`);
