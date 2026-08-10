#!/usr/bin/env node
/**
 * Sube a D1 los contratos que publica el motor.
 *
 * Los JSON NO se copian a mano ni se transcriben: se leen de `db/contracts/v1/`,
 * que es una copia por archivo de `quantum-run/contracts/v1/` en el commit 1b2bb9b.
 * Cada fila lleva el sha256 del archivo de contrato del que salio, asi que se puede
 * comprobar de que version vino sin preguntarle a nadie.
 *
 * FALLA CERRADO en lo que importa:
 *  - si un contrato no trae `validado_experimentalmente:false`, aborta. Estas son
 *    predicciones, y esa afirmacion no puede depender de que alguien la escriba.
 *  - si `n_sitios_predichos` no coincide con los sitios que trae de verdad, aborta.
 *    Ese descuadre es exactamente el defecto del "Top-5" que declaraba cinco y
 *    entregaba dos.
 *  - si la matriz no declara `contenido_sha256` y `bytes`, aborta: una referencia
 *    sin firma no se puede comprobar, y entonces no es evidencia.
 *
 * Uso: node scripts/seed-motor.mjs > db/motor.seed.sql
 */

import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(RAIZ, "db/contracts/v1");
const COMMIT_ORIGEN = "1b2bb9b";
const sql = v => (v === null || v === undefined ? "NULL" : "'" + String(v).replace(/'/g, "''") + "'");
const sha = t => createHash("sha256").update(t, "utf8").digest("hex");
const morir = m => { console.error("ABORTA: " + m); process.exit(1); };

const L = [];
L.push("-- GENERADO por scripts/seed-motor.mjs — no editar a mano.");
L.push(`-- contratos de quantum-run, commit ${COMMIT_ORIGEN}`);

// ------------------------------------------------------------------ estructuras
const archivosEst = readdirSync(join(DIR, "structures")).filter(f => f.endsWith(".json")).sort();
L.push("DELETE FROM structures;");
let i = 0;
const resumen = [];
for (const f of archivosEst) {
  const crudo = readFileSync(join(DIR, "structures", f), "utf8");
  const e = JSON.parse(crudo);
  for (const campo of ["pdb_id", "target", "n_residuos", "n_aristas", "procedencia", "aviso"]) {
    if (e[campo] === undefined) morir(`${f} no trae ${campo}`);
  }
  if (!e.procedencia.estructura_sha256 || !e.procedencia.estructura_url)
    morir(`${f}: la procedencia no declara sha256 y URL del PDB de origen`);
  resumen.push(`${e.pdb_id}: n=${e.n_residuos} aristas=${e.n_aristas} distales=${e.n_distales} fuente=${e.n_fuente}`);
  L.push("INSERT INTO structures (pdb_id,target,chain,n_residuos,n_aristas,n_distales,n_fuente," +
    "red_json,fuente_json,distal_json,procedencia_json,aviso,contrato_sha256,orden) VALUES (" +
    [e.pdb_id, e.target, e.chain].map(sql).join(",") +
    `,${e.n_residuos},${e.n_aristas},${e.n_distales || 0},${e.n_fuente || 0},` +
    [JSON.stringify(e.red || {}), JSON.stringify(e.fuente || {}), JSON.stringify(e.distal || {}),
     JSON.stringify(e.procedencia), e.aviso, sha(crudo)].map(sql).join(",") + `,${++i});`);
}

// ----------------------------------------------------------------- propagaciones
const corridas = readdirSync(join(DIR, "propagate")).filter(f => !f.startsWith("."));
L.push("DELETE FROM propagations;");
let j = 0;
for (const corrida of corridas) {
  const dir = join(DIR, "propagate", corrida);
  const archivos = readdirSync(dir).filter(f => f.endsWith(".json") && f !== "_index.json").sort();
  for (const f of archivos) {
    const crudo = readFileSync(join(dir, f), "utf8");
    const p = JSON.parse(crudo);

    // Los tres guardias que importan.
    if (p.validado_experimentalmente !== false)
      morir(`${f}: no declara validado_experimentalmente:false. Son predicciones; eso no se omite.`);
    const reales = (p.sitios_predichos || []).length;
    if (p.n_sitios_predichos !== reales)
      morir(`${f}: declara ${p.n_sitios_predichos} sitios y trae ${reales}. Ese descuadre es el defecto del "Top-5".`);
    const m = p.matriz_conectividad || {};
    if (!m.contenido_sha256 || !m.bytes || !m.url)
      morir(`${f}: la matriz no declara url + contenido_sha256 + bytes. Sin firma no se puede comprobar.`);

    resumen.push(`${p.target}: sitios=${p.n_sitios_predichos} matriz=${Math.round(m.bytes / 1024)}KB ${m.forma.join("x")}`);
    L.push("INSERT INTO propagations (run_id,target,pdb_id,chain,validado,metrico_json,matriz_json," +
      "n_sitios_predichos,sitios_json,aviso,contrato_sha256,orden) VALUES (" +
      [p.run_id, p.target, p.pdb_id, p.chain].map(sql).join(",") +
      ",0," +
      [JSON.stringify(p.metrico || {}), JSON.stringify(m)].map(sql).join(",") +
      `,${p.n_sitios_predichos},` +
      [JSON.stringify(p.sitios_predichos || []), p.aviso, sha(crudo)].map(sql).join(",") + `,${++j});`);
  }
}

L.splice(2, 0, ...resumen.map(r => "-- " + r));
console.log(L.join("\n"));
console.error(`estructuras: ${i} · propagaciones: ${j}\n  ` + resumen.join("\n  "));
