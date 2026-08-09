#!/usr/bin/env node
/**
 * Genera el SQL que sube la corrida de Cleveland a D1, UNA FILA POR PROTEINA.
 *
 * Una sola fila con los 102 KB dio SQLITE_TOOBIG. Partirlo por proteina resuelve
 * eso y ademas deja el dato consultable de a uno, que es lo que sirve a un agente.
 *
 * Los JSON no se copian a mano: se leen del archivo, se les calcula el sha256 y ese
 * sello viaja en la fila para que un tercero lo recompute desde la API.
 *
 * Uso: node scripts/seed-challenge-cleveland.mjs > db/challenges.seed.sql
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src/viz/cleveland/datos");
const sql = v => (v === null || v === undefined ? "NULL" : "'" + String(v).replace(/'/g, "''") + "'");
const sha = t => createHash("sha256").update(t, "utf8").digest("hex");
const RUN = "cleveland-2026-07";
const hoy = new Date().toISOString().slice(0, 10);

const datos = JSON.parse(readFileSync(join(DIR, "cleveland-2026-07.json"), "utf8"));
const stats = JSON.parse(readFileSync(join(DIR, "cleveland-2026-07.stats.json"), "utf8"));
const claves = Object.keys(datos);
if (claves.length < 4) { console.error(`ABORTA: solo ${claves.length} proteinas`); process.exit(1); }

const L = [];
L.push("-- GENERADO por scripts/seed-challenge-cleveland.mjs — no editar a mano.");
L.push(`-- corrida ${RUN} · ${claves.length} proteinas`);
L.push(`DELETE FROM challenge_proteins WHERE run_id='${RUN}';`);
L.push(`DELETE FROM challenge_runs WHERE id='${RUN}';`);
L.push("INSERT INTO challenge_runs (id,challenge,titulo_es,titulo_en,recipe_id,prereg,fecha,validado,publicado,creado_at) VALUES (" +
  [RUN, "cleveland",
   "Conectividad cuántica y sitios alostéricos predichos",
   "Quantum connectivity and predicted allosteric sites",
   "RQ-0007", "PR-CLEV-001", "2026-07"].map(sql).join(",") +
  // validado = 0: son predicciones, no hallazgos confirmados en laboratorio.
  `,0,1,${sql(hoy)});`);

let i = 0, resumen = [];
for (const k of claves) {
  const d = datos[k], s = stats[k] || {};
  if (!Array.isArray(d.coords) || !d.coords.length) { console.error(`ABORTA: ${k} sin coordenadas`); process.exit(1); }
  const dj = JSON.stringify(d), sj = JSON.stringify(s);
  const nSitios = (d.sites || []).length;
  const conocidos = (d.allo || []).length;
  resumen.push(`${k}: n=${d.n} sitios=${nSitios} conocidos=${conocidos} ${Math.round((dj.length + sj.length) / 1024)}KB`);
  L.push("INSERT INTO challenge_proteins (run_id,clave,label,pdb,n_residuos,n_sitios,sitios_conocidos,datos_json,stats_json,sha256,orden) VALUES (" +
    [RUN, k, d.label, d.pdb].map(sql).join(",") +
    `,${d.n},${nSitios},${conocidos},` +
    [dj, sj, sha(dj + sj)].map(sql).join(",") + `,${++i});`);
}
L.unshift(...resumen.map(r => "-- " + r));
console.log(L.join("\n"));
console.error("proteinas sembradas: " + claves.length + "\n  " + resumen.join("\n  "));
