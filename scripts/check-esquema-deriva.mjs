#!/usr/bin/env node
/**
 * Ninguna tabla vive en produccion sin estar declarada en el repositorio.
 *
 * EL DEFECTO (medido el 2026-08-26). Este proyecto no tiene sistema de migraciones: tiene
 * archivos `db/*.schema.sql` y **nada que registre que version esta aplicada**. Al comparar
 * por primera vez lo declarado contra lo vivo:
 *
 *     declaradas en el repo   12
 *     vivas en D1             22
 *     solo en produccion      10   <- entre ellas recipes, verdicts y experiments
 *
 * `recipes`, `verdicts` y `experiments` son las tres que alimentan el ledger publico. **Si la
 * base se perdia, no habia con que reconstruirlas.** Existian unicamente donde corren.
 *
 * Se cerro recuperando su definicion desde `sqlite_master` a
 * `db/recuperado-de-produccion.schema.sql`. Este guardia existe para que **no se vuelva a
 * abrir**: la proxima tabla que alguien cree a mano contra la base viva aparece aqui.
 *
 * PRECISION SOBRE COBERTURA. Solo grita por lo que vive en D1 y **nadie** declara. No compara
 * columnas ni tipos: una tabla declarada cuya forma real difiera pasa sin ruido. Se eligio asi
 * porque el fallo caro es el que ya ocurrio —una tabla entera sin respaldo— y porque comparar
 * formas produciria falsos positivos con cada diferencia cosmetica de SQLite.
 *
 * SU PUNTO CIEGO, declarado: no ve el sentido inverso. Una tabla declarada que NO existe en
 * produccion no se reporta como error, porque es el estado normal de un esquema que aun no se
 * aplico. Eso es lo que un sistema de migraciones resolveria, y sigue sin existir.
 *
 * LA TRAMPA CERRADA: si D1 no responde, la respuesta es «no se pudo comprobar» y sale con 2.
 * Un guardia que se conforma con leer el repositorio estaria comparandolo consigo mismo.
 *
 * Uso:
 *   node scripts/check-esquema-deriva.mjs --self-test
 *   node scripts/check-esquema-deriva.mjs
 */
/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "sesion CTO",
  hace: "recupera desde sqlite_master la definicion de la tabla que vive sin declararse",
};

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const DB = "rosettaq-ledger";
const DIR = "db";

/** Nombres de tabla declarados en un archivo de esquema. Sin comentarios (§4 bis). */
export function tablasDeclaradas(sql) {
  const limpio = String(sql ?? "").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
  const out = new Set();
  for (const m of limpio.matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([A-Za-z_][\w]*)/gi)) {
    out.add(m[1]);
  }
  return out;
}

/**
 * @param {{declaradas:Set<string>, vivas:string[]|null}} ctx
 *   vivas: null significa que D1 no respondio. Eso NO es ok.
 */
export function evaluar({ declaradas, vivas }) {
  if (!vivas) return { estado: "indeterminado", motivo: "D1 no responde: no hay contra que comparar" };
  const huerfanas = vivas.filter((t) => !declaradas.has(t));
  return huerfanas.length
    ? { estado: "deriva", huerfanas, vistas: vivas.length, declaradas: declaradas.size }
    : { estado: "ok", vistas: vivas.length, declaradas: declaradas.size };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--self-test")) {
  const casos = [
    ["grita: una tabla vive en D1 y nadie la declara", () =>
      evaluar({ declaradas: new Set(["a"]), vivas: ["a", "recipes"] }).estado === "deriva"],

    ["grita: la nombra, no solo dice que hay deriva", () =>
      evaluar({ declaradas: new Set(["a"]), vivas: ["a", "recipes"] }).huerfanas[0] === "recipes"],

    // LA TRAMPA: sin D1 no hay comparacion posible.
    ["grita distinto: sin D1 es INDETERMINADO, nunca ok", () =>
      evaluar({ declaradas: new Set(["a"]), vivas: null }).estado === "indeterminado"],

    ["CALLA: todo lo vivo esta declarado", () =>
      evaluar({ declaradas: new Set(["a", "b"]), vivas: ["a", "b"] }).estado === "ok"],

    // El estado normal de un esquema aun no aplicado. Gritar aqui retendria trabajo bueno.
    ["CALLA: declarada de mas, sin existir todavia en produccion", () =>
      evaluar({ declaradas: new Set(["a", "b", "futura"]), vivas: ["a", "b"] }).estado === "ok"],

    ["reporta denominador", () => {
      const r = evaluar({ declaradas: new Set(["a"]), vivas: ["a", "x", "y"] });
      return r.vistas === 3 && r.declaradas === 1 && r.huerfanas.length === 2;
    }],

    // ── el lector de SQL ──
    ["lee CREATE TABLE con y sin IF NOT EXISTS, con y sin comillas", () => {
      const t = tablasDeclaradas('CREATE TABLE a (x); CREATE TABLE IF NOT EXISTS "b" (x); CREATE TABLE `c` (x);');
      return t.size === 3 && t.has("a") && t.has("b") && t.has("c");
    }],

    // EL PARADOJICO: descrito en un comentario, ausente del SQL.
    ["CALLA: 'CREATE TABLE recipes' solo mencionado en un comentario", () =>
      tablasDeclaradas("-- falta un CREATE TABLE recipes por aqui\nSELECT 1;").size === 0],

    ["CALLA: comentario de bloque con el defecto adentro", () =>
      tablasDeclaradas("/* CREATE TABLE verdicts (id TEXT) */\nSELECT 1;").size === 0],

    ["MUTACION: sin quitar comentarios, el paradojico se leeria como declaracion", () => {
      const conFiltro = tablasDeclaradas("-- CREATE TABLE recipes\nSELECT 1;").size;
      const crudo = ("-- CREATE TABLE recipes\nSELECT 1;".match(/CREATE\s+TABLE\s+(\w+)/gi) || []).length;
      return conFiltro === 0 && crudo === 1;
    }],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[esquema-deriva] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
if (!process.argv.includes("--self-test")) {
  if (!existsSync(DIR)) {
    console.error(`[esquema-deriva] NO SE PUDO COMPROBAR: no existe ${DIR}/`);
    process.exit(2);
  }
  const declaradas = new Set();
  let archivos = 0;
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".sql"))) {
    archivos++;
    for (const t of tablasDeclaradas(readFileSync(join(DIR, f), "utf8"))) declaradas.add(t);
  }

  let vivas = null;
  try {
    const salida = execSync(
      `npx wrangler d1 execute ${DB} --remote --json --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"`,
      { stdio: ["ignore", "pipe", "pipe"] }
    ).toString();
    vivas = JSON.parse(salida)[0].results.map((x) => x.name);
  } catch (err) {
    console.error(`[esquema-deriva] D1 no responde: ${String(err).split("\n")[0]}`);
  }

  const r = evaluar({ declaradas, vivas });
  console.log(`[esquema-deriva] ${archivos} archivo(s) en ${DIR}/ · ${declaradas.size} tabla(s) declarada(s)`);

  if (r.estado === "indeterminado") {
    console.error(`[esquema-deriva] NO SE PUDO COMPROBAR: ${r.motivo}`);
    process.exit(2);
  }
  console.log(`[esquema-deriva] ${r.vistas} vivas en D1`);

  if (r.estado === "deriva") {
    console.error(`\n[esquema-deriva] DERIVA: ${r.huerfanas.length} tabla(s) viven en produccion y nadie las declara.`);
    for (const t of r.huerfanas) console.error(`    ${t}`);
    console.error("[esquema-deriva] Si D1 se pierde, eso no se puede reconstruir desde el repositorio.");
    console.error("[esquema-deriva] Recuperalas: wrangler d1 execute " + DB + " --remote --json \\");
    console.error("                    --command \"SELECT name, sql FROM sqlite_master WHERE type='table'\"");
    process.exit(1);
  }
  console.log("\n[esquema-deriva] todo lo que vive esta declarado.");
}
