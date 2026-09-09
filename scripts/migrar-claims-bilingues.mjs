#!/usr/bin/env node
/**
 * Deja `rq_claims` con las dos caras: el titulo y el dominio en español y en ingles.
 *
 * EL DEFECTO (medido el 2026-09-09): los 19 claims tienen UN solo titulo, en español y
 * sin tildes, y esa misma cadena se pinta en /library/registry (lang="en") y en el
 * buscador ingles. La pagina inglesa del registro publico —la que la home enlaza como
 * "Open the full ledger"— mostraba 16 filas en español macarronico.
 *
 * Efecto colateral medido: la busqueda inglesa no podia encontrarlos. "certified
 * randomness" devolvia CERO porque el titulo dice "Aleatoriedad certificada".
 *
 * IDEMPOTENTE: mira PRAGMA table_info antes de cada ALTER, y los UPDATE se pueden
 * repetir sin efecto. Falla cerrado: si un id de D1 no tiene texto propuesto, aborta
 * antes de escribir nada — mejor no migrar que dejar media tabla bilingue.
 *
 * El texto sale de db/propuestas/claims-bilingues.json y NO se corre hasta que ese
 * archivo este aprobado (CLAUDE.md §5: el texto que lee un usuario pasa por Nicholas).
 *
 * Uso:  node scripts/migrar-claims-bilingues.mjs --aplicar
 *       node scripts/migrar-claims-bilingues.mjs            # solo dice que haria
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const DB = "rosettaq-ledger";
const d1 = (sql) => JSON.parse(execSync(
  `npx wrangler d1 execute ${DB} --remote --command ${JSON.stringify(sql)} --json`,
  { maxBuffer: 1e8, stdio: ["ignore", "pipe", "ignore"] }).toString());

const prop = JSON.parse(readFileSync("db/propuestas/claims-bilingues.json", "utf8"));
const filas = d1("SELECT id, title, domain FROM rq_claims")[0].results;

// Falla cerrado ANTES de tocar la tabla.
const faltan = [];
for (const f of filas) {
  if (!prop.titulos[f.id]) faltan.push(`titulo de ${f.id}`);
  if (!prop.dominios[f.domain]) faltan.push(`dominio "${f.domain}" (${f.id})`);
}
if (faltan.length) {
  console.error(`ABORTA: ${faltan.length} sin texto propuesto:\n  ` + faltan.join("\n  "));
  process.exit(1);
}
console.log(`cobertura: ${filas.length} de ${filas.length} filas tienen las dos caras propuestas.`);

const aplicar = process.argv.includes("--aplicar");
if (!aplicar) {
  console.log("modo seco. Con --aplicar: 4 ALTER (si faltan) y " + filas.length + " UPDATE.");
  process.exit(0);
}

const cols = d1("PRAGMA table_info(rq_claims)")[0].results.map((c) => c.name);
for (const c of ["title_es", "title_en", "domain_es", "domain_en"]) {
  if (cols.includes(c)) { console.log(`  ya existe: ${c}`); continue; }
  d1(`ALTER TABLE rq_claims ADD COLUMN ${c} TEXT`);
  console.log(`  columna agregada: ${c}`);
}

const esc = (s) => String(s).replace(/'/g, "''");
let n = 0;
for (const f of filas) {
  const t = prop.titulos[f.id], dom = prop.dominios[f.domain];
  d1(`UPDATE rq_claims SET title_es='${esc(t.es)}', title_en='${esc(t.en)}', ` +
     `domain_es='${esc(dom.es)}', domain_en='${esc(dom.en)}', title='${esc(t.es)}', domain='${esc(dom.es)}' ` +
     `WHERE id='${esc(f.id)}'`);
  n++;
}
console.log(`${n} filas con titulo y dominio en las dos caras.`);

// Verifica contra el terreno, no contra el reporte: relee y cuenta.
const v = d1("SELECT count(*) n, sum(CASE WHEN title_en IS NULL OR title_es IS NULL OR domain_en IS NULL OR domain_es IS NULL THEN 1 ELSE 0 END) huecos FROM rq_claims")[0].results[0];
console.log(`releido de D1: ${v.n} filas · ${v.huecos} con algun hueco`);
process.exit(v.huecos ? 1 : 0);
